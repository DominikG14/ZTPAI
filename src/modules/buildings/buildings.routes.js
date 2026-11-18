const express = require('express');
const { validate } = require('../../middleware/validate');
const { buildingParamsSchema, createBuildingSchema } = require('./buildings.schemas');

function createBuildingsRouter(controller) {
  const router = express.Router();
  router.get('/', controller.list);
  router.get('/:id/rooms', validate({ params: buildingParamsSchema }), controller.rooms);
  router.get('/:id', validate({ params: buildingParamsSchema }), controller.get);
  router.post('/', validate({ body: createBuildingSchema }), controller.create);
  return router;
}

module.exports = { createBuildingsRouter };
