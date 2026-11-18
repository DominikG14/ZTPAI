const express = require('express');
const { validate } = require('../../middleware/validate');
const { roomParamsSchema, createRoomSchema } = require('./rooms.schemas');

function createRoomsRouter(controller) {
  const router = express.Router();
  router.get('/', controller.list);
  router.post('/', validate({ body: createRoomSchema }), controller.create);
  router.get('/:id', validate({ params: roomParamsSchema }), controller.get);
  return router;
}

module.exports = { createRoomsRouter };
