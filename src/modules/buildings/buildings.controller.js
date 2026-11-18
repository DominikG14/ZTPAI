function createBuildingsController(service) {
  const { NotFoundError } = require('../../errors/app-error');
  const { toBuildingResponse } = require('./buildings.dto');
  const { toRoomResponse } = require('../rooms/rooms.dto');

  return {
    list: async (_req, res) => res.json((await service.list()).map(toBuildingResponse)),
    get: async (req, res) => {
      const building = await service.get(req.validated.params.id);
      if (!building) throw new NotFoundError('Building not found', 'BUILDING_NOT_FOUND');
      return res.json(toBuildingResponse(building));
    },
    rooms: async (req, res) => res.json((await service.rooms(req.validated.params.id)).map(toRoomResponse)),
    create: async (req, res) => {
      const building = await service.create(req.validated.body);
      return res.location(`/api/buildings/${building.id}`).status(201).json(toBuildingResponse(building));
    },
  };
}

module.exports = { createBuildingsController };
