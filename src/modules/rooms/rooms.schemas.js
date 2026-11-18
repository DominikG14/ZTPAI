const { z } = require('zod');

const positiveInteger = z.coerce.number().int().positive();
const roomParamsSchema = z.object({ id: positiveInteger });
const createRoomSchema = z.object({
  buildingId: positiveInteger,
  name: z.string().trim().min(1).max(100),
  capacity: z.number().int().positive(),
}).strict();

module.exports = { roomParamsSchema, createRoomSchema };
