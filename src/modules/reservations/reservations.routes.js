const express = require('express');
const { validate } = require('../../middleware/validate');
const { createReservationSchema, reservationParamsSchema, reservationQuerySchema } = require('./reservations.schemas');

function createReservationsRouter(controller) {
  const router = express.Router();
  router.get('/', validate({ query: reservationQuerySchema }), controller.list);
  router.get('/:id', validate({ params: reservationParamsSchema }), controller.get);
  router.post('/', validate({ body: createReservationSchema }), controller.create);
  router.patch('/:id/cancel', validate({ params: reservationParamsSchema }), controller.cancel);
  return router;
}

module.exports = { createReservationsRouter };
