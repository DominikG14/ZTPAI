function createRoomsController(service) {
  const { NotFoundError, ForbiddenError } = require('../../errors/app-error');
  const { toRoomResponse } = require('./rooms.dto');
  return {
    list: async (_req, res) => res.json((await service.list()).map(toRoomResponse)),
    get: async (req, res) => {
      const room = await service.get(req.validated.params.id);
      if (!room) throw new NotFoundError('Room not found', 'ROOM_NOT_FOUND');
      return res.json(toRoomResponse(room));
    },
    create: async (req, res) => {
      if (req.user?.role !== 'ADMIN') {
        throw new ForbiddenError('Only admins can create rooms', 'FORBIDDEN');
      }
      const room = await service.create(req.validated.body);
      return res.location(`/api/rooms/${room.id}`).status(201).json(toRoomResponse(room));
    },
  };
}

module.exports = { createRoomsController };
