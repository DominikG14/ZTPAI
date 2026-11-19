const { createReservationsService } = require('../../src/modules/reservations/reservations.service');
const { createReservationsRepositoryMemory } = require('../../src/modules/reservations/reservations.repository.memory');
const { createRoomsRepositoryMemory } = require('../../src/modules/rooms/rooms.repository.memory');

describe('ReservationsService - Unit Tests', () => {
  let currentTime;
  let roomsRepo;
  let reservationsRepo;
  let service;
  let eventBus;

  beforeEach(() => {
    currentTime = new Date('2026-11-20T09:00:00.000Z');
    // Each test starts with isolated in-memory repositories and fresh state
    roomsRepo = createRoomsRepositoryMemory([
      { id: 1, buildingId: 1, name: 'A101', capacity: 30 },
      { id: 2, buildingId: 1, name: 'B202', capacity: 15 },
    ]);
    reservationsRepo = createReservationsRepositoryMemory({
      roomsRepository: roomsRepo,
      initialReservations: [],
    });
    eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
    service = createReservationsService({
      reservationRepository: reservationsRepo,
      eventBus,
      now: () => currentTime,
    });
  });

  test('publishes reservation.created after success and does not publish after a failed create', async () => {
    const payload = {
      roomId: 1,
      participants: 10,
      startTime: '2026-11-20T10:00:00.000Z',
      endTime: '2026-11-20T11:00:00.000Z',
    };
    const created = await service.create(payload, 7);
    expect(eventBus.publish).toHaveBeenCalledWith('reservation.created', {
      reservationId: created.id,
      roomId: 1,
      userId: 7,
      startTime: payload.startTime,
      endTime: payload.endTime,
    });

    eventBus.publish.mockClear();
    await expect(service.create({ ...payload, startTime: '2026-11-20T10:30:00.000Z' }, 8))
      .rejects.toMatchObject({ code: 'ROOM_ALREADY_BOOKED' });
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  describe('Reguła: Nakładanie się rezerwacji (Overlapping)', () => {
    beforeEach(async () => {
      // Seed a base confirmed reservation for Room 1 from 10:00 to 12:00
      await service.create(
        {
          roomId: 1,
          participants: 10,
          startTime: '2026-11-20T10:00:00.000Z',
          endTime: '2026-11-20T12:00:00.000Z',
        },
        1
      );
    });

    test('nakładanie częściowe (rozpoczęcie przed istniejącą, zakończenie w trakcie) zostaje odrzucone', async () => {
      await expect(
        service.create(
          {
            roomId: 1,
            participants: 5,
            startTime: '2026-11-20T09:30:00.000Z',
            endTime: '2026-11-20T10:30:00.000Z',
          },
          2
        )
      ).rejects.toMatchObject({ code: 'ROOM_ALREADY_BOOKED' });
    });

    test('nakładanie częściowe (rozpoczęcie w trakcie istniejącej, zakończenie po niej) zostaje odrzucone', async () => {
      await expect(
        service.create(
          {
            roomId: 1,
            participants: 5,
            startTime: '2026-11-20T11:30:00.000Z',
            endTime: '2026-11-20T12:30:00.000Z',
          },
          2
        )
      ).rejects.toMatchObject({ code: 'ROOM_ALREADY_BOOKED' });
    });

    test('zawieranie (nowa rezerwacja w całości wewnątrz istniejącej) zostaje odrzucone', async () => {
      await expect(
        service.create(
          {
            roomId: 1,
            participants: 5,
            startTime: '2026-11-20T10:30:00.000Z',
            endTime: '2026-11-20T11:30:00.000Z',
          },
          2
        )
      ).rejects.toMatchObject({ code: 'ROOM_ALREADY_BOOKED' });
    });

    test('zawieranie (nowa rezerwacja całkowicie obejmuje istniejącą) zostaje odrzucone', async () => {
      await expect(
        service.create(
          {
            roomId: 1,
            participants: 5,
            startTime: '2026-11-20T09:30:00.000Z',
            endTime: '2026-11-20T12:30:00.000Z',
          },
          2
        )
      ).rejects.toMatchObject({ code: 'ROOM_ALREADY_BOOKED' });
    });

    test('przedziały stykające się zaraz po istniejącej rezerwacji są dozwolone', async () => {
      const result = await service.create(
        {
          roomId: 1,
          participants: 5,
          startTime: '2026-11-20T12:00:00.000Z',
          endTime: '2026-11-20T13:00:00.000Z',
        },
        2
      );
      expect(result.status).toBe('CONFIRMED');
      expect(result.startTime).toBe('2026-11-20T12:00:00.000Z');
      expect(result.endTime).toBe('2026-11-20T13:00:00.000Z');
    });

    test('przedziały stykające się zaraz przed istniejącą rezerwacją są dozwolone', async () => {
      const result = await service.create(
        {
          roomId: 1,
          participants: 5,
          startTime: '2026-11-20T09:00:00.000Z',
          endTime: '2026-11-20T10:00:00.000Z',
        },
        2
      );
      expect(result.status).toBe('CONFIRMED');
      expect(result.startTime).toBe('2026-11-20T09:00:00.000Z');
      expect(result.endTime).toBe('2026-11-20T10:00:00.000Z');
    });

    test('inna sala w tym samym przedziale czasowym jest dozwolona', async () => {
      const result = await service.create(
        {
          roomId: 2,
          participants: 5,
          startTime: '2026-11-20T10:00:00.000Z',
          endTime: '2026-11-20T12:00:00.000Z',
        },
        2
      );
      expect(result.status).toBe('CONFIRMED');
      expect(result.roomId).toBe(2);
    });
  });

  describe('Reguła: Anulowane rezerwacje', () => {
    test('rezerwacja CANCELLED nie blokuje przedziału czasowego', async () => {
      // Create a reservation
      const initial = await service.create(
        {
          roomId: 1,
          participants: 10,
          startTime: '2026-11-20T10:00:00.000Z',
          endTime: '2026-11-20T12:00:00.000Z',
        },
        1
      );

      // Cancel it
      await service.cancel(initial.id, { id: 1, role: 'USER' });

      // Create a new reservation for the exact same room and interval
      const replacement = await service.create(
        {
          roomId: 1,
          participants: 12,
          startTime: '2026-11-20T10:00:00.000Z',
          endTime: '2026-11-20T12:00:00.000Z',
        },
        2
      );

      expect(replacement.status).toBe('CONFIRMED');
      expect(replacement.id).toBeDefined();
    });
  });

  describe('Reguła: Pojemność sali (Capacity)', () => {
    test('participants == capacity jest dozwolone', async () => {
      const result = await service.create(
        {
          roomId: 1, // capacity: 30
          participants: 30,
          startTime: '2026-11-20T10:00:00.000Z',
          endTime: '2026-11-20T11:00:00.000Z',
        },
        1
      );
      expect(result.status).toBe('CONFIRMED');
      expect(result.participants).toBe(30);
    });

    test('participants == capacity + 1 zostaje odrzucone z kodem CAPACITY_EXCEEDED', async () => {
      await expect(
        service.create(
          {
            roomId: 1, // capacity: 30
            participants: 31,
            startTime: '2026-11-20T10:00:00.000Z',
            endTime: '2026-11-20T11:00:00.000Z',
          },
          1
        )
      ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED' });
    });
  });

  describe('Reguła: Czas trwania (Duration)', () => {
    test.each([
      ['dokładnie 15 min', '2026-11-20T10:00:00.000Z', '2026-11-20T10:15:00.000Z'],
      ['dokładnie 8 h', '2026-11-20T10:00:00.000Z', '2026-11-20T18:00:00.000Z'],
    ])('dozwolony czas trwania: %s', async (_description, startTime, endTime) => {
      const result = await service.create(
        {
          roomId: 1,
          participants: 10,
          startTime,
          endTime,
        },
        1
      );
      expect(result.status).toBe('CONFIRMED');
    });

    test.each([
      ['14 min (za krótko)', '2026-11-20T10:00:00.000Z', '2026-11-20T10:14:00.000Z'],
      ['8 h 1 min (za długo)', '2026-11-20T10:00:00.000Z', '2026-11-20T18:01:00.000Z'],
    ])('niedozwolony czas trwania: %s zostaje odrzucony z kodem VALIDATION_ERROR', async (_description, startTime, endTime) => {
      await expect(
        service.create(
          {
            roomId: 1,
            participants: 10,
            startTime,
            endTime,
          },
          1
        )
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('Reguła: Anulowanie rezerwacji (Cancellation)', () => {
    test('rozpoczęta rezerwacja nie może zostać odwołana (RESERVATION_ALREADY_STARTED)', async () => {
      // Reservation starts at 10:00
      const reservation = await service.create(
        {
          roomId: 1,
          participants: 5,
          startTime: '2026-11-20T10:00:00.000Z',
          endTime: '2026-11-20T11:00:00.000Z',
        },
        1
      );

      // Advance simulated current time past startTime (10:05)
      currentTime = new Date('2026-11-20T10:05:00.000Z');

      await expect(
        service.cancel(reservation.id, { id: 1, role: 'USER' })
      ).rejects.toMatchObject({ code: 'RESERVATION_ALREADY_STARTED' });
    });

    test('podwójne anulowanie jest idempotentne i zachowuje pierwotny cancelledAt bez zmian', async () => {
      // Reservation starts at 14:00
      const reservation = await service.create(
        {
          roomId: 1,
          participants: 5,
          startTime: '2026-11-20T14:00:00.000Z',
          endTime: '2026-11-20T15:00:00.000Z',
        },
        1
      );

      // Cancel at 09:15
      currentTime = new Date('2026-11-20T09:15:00.000Z');
      const firstCancel = await service.cancel(reservation.id, { id: 1, role: 'USER' });
      expect(firstCancel.status).toBe('CANCELLED');
      const initialCancelledAt = firstCancel.cancelledAt;
      expect(initialCancelledAt).toBe('2026-11-20T09:15:00.000Z');

      // Attempt second cancellation at 09:45
      currentTime = new Date('2026-11-20T09:45:00.000Z');
      const secondCancel = await service.cancel(reservation.id, { id: 1, role: 'USER' });
      expect(secondCancel.status).toBe('CANCELLED');
      expect(secondCancel.cancelledAt).toBe(initialCancelledAt);
    });
  });

  describe('Reguła: Ownership', () => {
    let reservation;

    beforeEach(async () => {
      // Created by User 2
      reservation = await service.create(
        {
          roomId: 1,
          participants: 5,
          startTime: '2026-11-20T14:00:00.000Z',
          endTime: '2026-11-20T15:00:00.000Z',
        },
        2
      );
    });

    test('obcy USER zostaje odrzucony z kodem FORBIDDEN', async () => {
      // User 3 (not owner, regular USER) tries to cancel
      await expect(
        service.cancel(reservation.id, { id: 3, role: 'USER' })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    });

    test('ADMIN może anulować rezerwację innego użytkownika', async () => {
      // User 3 with ADMIN role cancels User 2's reservation
      const result = await service.cancel(reservation.id, { id: 3, role: 'ADMIN' });
      expect(result.status).toBe('CANCELLED');
    });

    test('właściciel (USER) może anulować własną rezerwację', async () => {
      // User 2 (the owner) cancels
      const result = await service.cancel(reservation.id, { id: 2, role: 'USER' });
      expect(result.status).toBe('CANCELLED');
    });
  });
});
