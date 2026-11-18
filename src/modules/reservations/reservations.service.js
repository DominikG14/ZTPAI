function createReservationsService({ reservationRepository }) {
  const { NotFoundError, ConflictError, ValidationError } = require('../../errors/app-error');
  const allowedTransitions = Object.freeze({
    CONFIRMED: Object.freeze(['CANCELLED']),
    CANCELLED: Object.freeze([]),
  });

  return {
    list: (filters) => reservationRepository.findAll(filters),
    get: (id) => reservationRepository.findById(id),
    create: async (data, userId) => {
      const startMs = new Date(data.startTime).getTime();
      const endMs = new Date(data.endTime).getTime();
      const validationDetails = [];
      const addDetail = (field, message) => validationDetails.push({ location: 'body', field, message });

      if (startMs < Date.now()) addDetail('startTime', 'startTime cannot be in the past');
      if (endMs <= startMs) addDetail('endTime', 'endTime must be after startTime');
      if (endMs > startMs) {
        const durationMs = endMs - startMs;
        if (durationMs < 15 * 60 * 1000) addDetail('endTime', 'Reservation must be at least 15 minutes long');
        if (durationMs > 8 * 60 * 60 * 1000) addDetail('endTime', 'Reservation cannot be longer than 8 hours');
      }
      if (validationDetails.length) throw new ValidationError(validationDetails);

      return reservationRepository.withRoomLock(data.roomId, async ({ room, findConflicts, create }) => {
        if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');
        if (data.participants > room.capacity) throw new ConflictError('Room capacity exceeded', 'CAPACITY_EXCEEDED');
        if (await findConflicts(data.startTime, data.endTime)) {
          throw new ConflictError('Room is already reserved for this time', 'ROOM_ALREADY_BOOKED');
        }
        return create({
          ...data,
          userId: Number(userId),
          status: 'CONFIRMED',
          createdAt: new Date().toISOString(),
          cancelledAt: null,
          internalNote: 'created via API v2',
        });
      });
    },
    cancel: async (id) => {
      const reservation = await reservationRepository.findById(id);
      if (!reservation) throw new NotFoundError('Reservation not found', 'RESERVATION_NOT_FOUND');

      // Repeating a cancellation is idempotent and preserves the first timestamp.
      if (reservation.status === 'CANCELLED') return reservation;

      const allowedNextStates = allowedTransitions[reservation.status] || [];
      if (!allowedNextStates.includes('CANCELLED')) {
        throw new ConflictError(`Cannot cancel a reservation in ${reservation.status} status`, 'INVALID_RESERVATION_STATE');
      }
      if (new Date(reservation.startTime).getTime() <= Date.now()) {
        throw new ConflictError('A reservation that has already started cannot be cancelled', 'RESERVATION_ALREADY_STARTED');
      }

      return reservationRepository.cancel(id, new Date().toISOString());
    },
  };
}

module.exports = { createReservationsService };
