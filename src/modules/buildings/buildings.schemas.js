const { z } = require('zod');

const positiveInteger = z.coerce.number().int().positive();
const buildingParamsSchema = z.object({ id: positiveInteger });
const createBuildingSchema = z.object({
  name: z.string().trim().min(1).max(150),
  address: z.string().trim().min(1).max(255),
}).strict();

module.exports = { buildingParamsSchema, createBuildingSchema };
