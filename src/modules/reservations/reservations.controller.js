function createReservationsController(service) {
  const { NotFoundError } = require('../../errors/app-error');
  const { toReservationResponse } = require('./reservations.dto');
  return {
    list: async (req, res) => {
      const result = await service.list(req.validated.query);
      return res.json({
        data: result.data.map(toReservationResponse),
        meta: result.meta,
      });
    },
    get: async (req, res) => {
      const reservation = await service.get(req.validated.params.id);
      if (!reservation) throw new NotFoundError('Reservation not found', 'RESERVATION_NOT_FOUND');
      return res.json(toReservationResponse(reservation));
    },
    create: async (req, res) => {
      const reservation = await service.create(req.validated.body, req.user.id);
      const location = `/api/reservations/${reservation.id}`;
      return res.location(location).status(201).json(toReservationResponse(reservation));
    },
    cancel: async (req, res) => {
      const reservation = await service.cancel(req.validated.params.id);
      return res.json(toReservationResponse(reservation));
    },
  };
}

module.exports = { createReservationsController };
