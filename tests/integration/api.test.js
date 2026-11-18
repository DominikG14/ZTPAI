const request = require('supertest');
const knexFactory = require('knex');
const { createApp } = require('../../src/app');
const { createBuildingsKnexRepository } = require('../../src/modules/buildings/buildings.repository.knex');
const { createRoomsKnexRepository } = require('../../src/modules/rooms/rooms.repository.knex');
const { createReservationsKnexRepository } = require('../../src/modules/reservations/reservations.repository.knex');
const { createAuthKnexRepository } = require('../../src/modules/auth/auth.repository.knex');

describe('API Integration Tests (PostgreSQL)', () => {
  let testKnex;
  let app;

  beforeAll(async () => {
    const testDbUrl = process.env.TEST_DATABASE_URL || 'postgres://room_booking:room_booking_dev@127.0.0.1:5433/room_booking_test';
    const adminUrl = process.env.DEV_DATABASE_URL || testDbUrl.replace('/room_booking_test', '/room_booking');

    // Ensure dedicated test database exists (never use development DB)
    const adminKnex = knexFactory({ client: 'pg', connection: adminUrl });
    try {
      const checkRes = await adminKnex.raw("SELECT 1 FROM pg_database WHERE datname = 'room_booking_test'");
      if (checkRes.rows.length === 0) {
        await adminKnex.raw('CREATE DATABASE room_booking_test');
      }
    } finally {
      await adminKnex.destroy();
    }

    // Connect to test database and execute migrations
    testKnex = knexFactory({
      client: 'pg',
      connection: testDbUrl,
      migrations: { directory: './src/db/migrations' },
    });
    await testKnex.migrate.latest({ directory: './src/db/migrations' });

    // Initialize application with Knex repositories without listening on a network port
    const buildingsRepo = createBuildingsKnexRepository(testKnex);
    const roomsRepo = createRoomsKnexRepository(testKnex);
    const reservationsRepo = createReservationsKnexRepository(testKnex);
    const usersRepo = createAuthKnexRepository(testKnex);

    app = createApp({ buildingsRepo, roomsRepo, reservationsRepo, usersRepo });
  });

  afterAll(async () => {
    // Cleanly close database connections to prevent open handles
    if (testKnex) {
      await testKnex.destroy();
    }
  });

  beforeEach(async () => {
    // Truncate all tables and reset identities before each test
    await testKnex.raw('TRUNCATE TABLE reservations, rooms, buildings, users RESTART IDENTITY CASCADE');
  });

  // Test helpers
  const registerAndLogin = async ({ email = 'tester@example.com', password = 'Password123!', role = 'USER' } = {}) => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email, password });

    if (role === 'ADMIN') {
      await testKnex('users').where({ id: regRes.body.id }).update({ role: 'ADMIN' });
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    return {
      user: regRes.body,
      token: loginRes.body.accessToken,
    };
  };

  const seedBuildingAndRoom = async ({ buildingName = 'Budynek Testowy', roomName = 'Sala 101', capacity = 25 } = {}) => {
    const [building] = await testKnex('buildings').insert({
      name: buildingName,
      address: 'ul. Testowa 1, Warszawa',
    }).returning('*');

    const [room] = await testKnex('rooms').insert({
      building_id: building.id,
      name: roomName,
      capacity,
    }).returning('*');

    return { building, room };
  };

  test('1. rejestracja + logowanie + GET /api/auth/me', async () => {
    // 1. Rejestracja nowego użytkownika
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'jan.nowak@example.com', password: 'SecretPassword123!' });

    expect(regRes.status).toBe(201);
    expect(regRes.body).toHaveProperty('id');
    expect(regRes.body.email).toBe('jan.nowak@example.com');
    expect(regRes.body.role).toBe('USER');
    expect(regRes.body).not.toHaveProperty('passwordHash');

    // 2. Logowanie
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'jan.nowak@example.com', password: 'SecretPassword123!' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty('accessToken');
    expect(loginRes.body.tokenType).toBe('Bearer');
    const token = loginRes.body.accessToken;

    // 3. Pobranie profilu GET /api/auth/me
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.id).toBe(regRes.body.id);
    expect(meRes.body.email).toBe('jan.nowak@example.com');
    expect(meRes.body.role).toBe('USER');
    expect(meRes.body).not.toHaveProperty('passwordHash');
  });

  test('2. POST /api/reservations -> 201, nagłówek Location oraz sprawdzenie, że rekord jest w bazie', async () => {
    const { room } = await seedBuildingAndRoom();
    const { token, user } = await registerAndLogin();

    const payload = {
      roomId: room.id,
      participants: 10,
      startTime: '2030-05-10T10:00:00.000Z',
      endTime: '2030-05-10T11:00:00.000Z',
    };

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    const reservationId = res.body.id;

    // Sprawdzenie nagłówka Location
    expect(res.headers.location).toBe(`/api/reservations/${reservationId}`);

    // Sprawdzenie, że rekord fizycznie istnieje w bazie danych PostgreSQL
    const dbRecord = await testKnex('reservations').where({ id: reservationId }).first();
    expect(dbRecord).toBeDefined();
    expect(dbRecord.room_id).toBe(room.id);
    expect(dbRecord.user_id).toBe(user.id);
    expect(dbRecord.status).toBe('CONFIRMED');
    expect(dbRecord.participants).toBe(10);
    expect(new Date(dbRecord.start_time).toISOString()).toBe('2030-05-10T10:00:00.000Z');
    expect(new Date(dbRecord.end_time).toISOString()).toBe('2030-05-10T11:00:00.000Z');
  });

  test('3. 400 z poprawnymi details dla błędnego body', async () => {
    const { token } = await registerAndLogin();

    const invalidPayload = {
      roomId: -1,
      participants: 0,
      startTime: 'not-a-valid-date',
      endTime: 'not-a-valid-date',
    };

    const res = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
    for (const detail of res.body.error.details) {
      expect(detail).toHaveProperty('field');
      expect(detail).toHaveProperty('message');
    }
  });

  test('4. 401 bez tokenu', async () => {
    const res = await request(app)
      .get('/api/reservations');

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  test('5. 403 dla USER próbującego utworzyć salę', async () => {
    const { building } = await seedBuildingAndRoom();
    const { token } = await registerAndLogin({ role: 'USER' });

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buildingId: building.id,
        name: 'Sala Niedozwolona',
        capacity: 15,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('6. 404 dla USER pobierającego cudzą rezerwację', async () => {
    const { room } = await seedBuildingAndRoom();

    // Użytkownik A tworzy rezerwację
    const userA = await registerAndLogin({ email: 'userA@example.com' });
    const createRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${userA.token}`)
      .send({
        roomId: room.id,
        participants: 5,
        startTime: '2030-06-01T10:00:00.000Z',
        endTime: '2030-06-01T11:00:00.000Z',
      });
    expect(createRes.status).toBe(201);
    const reservationId = createRes.body.id;

    // Użytkownik B (inny USER) próbuje pobrać rezerwację Użytkownika A
    const userB = await registerAndLogin({ email: 'userB@example.com' });
    const getRes = await request(app)
      .get(`/api/reservations/${reservationId}`)
      .set('Authorization', `Bearer ${userB.token}`);

    expect(getRes.status).toBe(404);
    expect(getRes.body.error).toBeDefined();
    expect(getRes.body.error.code).toBe('RESERVATION_NOT_FOUND');
  });

  test('7. 409 ROOM_ALREADY_BOOKED dla nakładającej się rezerwacji', async () => {
    const { room } = await seedBuildingAndRoom();
    const { token } = await registerAndLogin();

    // Pierwsza rezerwacja: 10:00 - 12:00
    const firstRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId: room.id,
        participants: 8,
        startTime: '2030-07-01T10:00:00.000Z',
        endTime: '2030-07-01T12:00:00.000Z',
      });
    expect(firstRes.status).toBe(201);

    // Druga rezerwacja częściowo nakładająca się: 11:00 - 13:00
    const conflictRes = await request(app)
      .post('/api/reservations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        roomId: room.id,
        participants: 6,
        startTime: '2030-07-01T11:00:00.000Z',
        endTime: '2030-07-01T13:00:00.000Z',
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.error).toBeDefined();
    expect(conflictRes.body.error.code).toBe('ROOM_ALREADY_BOOKED');
  });

  test('8. pagination: meta.total i liczba elementów w data dla limit mniejszego niż liczba rekordów', async () => {
    const { room } = await seedBuildingAndRoom();
    const { token } = await registerAndLogin();

    // Utworzenie 5 rezerwacji o różnych godzinach
    for (let i = 1; i <= 5; i++) {
      const hourStart = String(i + 8).padStart(2, '0');
      const hourEnd = String(i + 9).padStart(2, '0');
      const createRes = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${token}`)
        .send({
          roomId: room.id,
          participants: 5,
          startTime: `2030-08-01T${hourStart}:00:00.000Z`,
          endTime: `2030-08-01T${hourEnd}:00:00.000Z`,
        });
      expect(createRes.status).toBe(201);
    }

    // Zapytanie z limitem 2 i stroną 1
    const listRes = await request(app)
      .get('/api/reservations?limit=2&page=1')
      .set('Authorization', `Bearer ${token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveProperty('data');
    expect(listRes.body).toHaveProperty('meta');

    // Weryfikacja: meta.total == 5, liczba rekordów w data == 2
    expect(listRes.body.meta.total).toBe(5);
    expect(listRes.body.meta.limit).toBe(2);
    expect(listRes.body.meta.page).toBe(1);
    expect(listRes.body.meta.totalPages).toBe(3);
    expect(listRes.body.data.length).toBe(2);
  });

  test('9. ADMIN może utworzyć salę (status 201)', async () => {
    const { building } = await seedBuildingAndRoom();
    const { token } = await registerAndLogin({ email: 'admin@example.com', role: 'ADMIN' });

    const res = await request(app)
      .post('/api/rooms')
      .set('Authorization', `Bearer ${token}`)
      .send({
        buildingId: building.id,
        name: 'Sala Konferencyjna VIP',
        capacity: 40,
      });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Sala Konferencyjna VIP');
    expect(res.body.capacity).toBe(40);
    expect(res.headers.location).toBe(`/api/rooms/${res.body.id}`);
  });
});
