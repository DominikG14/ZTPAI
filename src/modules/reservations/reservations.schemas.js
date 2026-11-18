const { z } = require('zod');

const positiveInteger = z.coerce.number().int().positive();
const isoDateTime = z.string().datetime({ offset: true }).transform((value) => new Date(value).toISOString());
const sortFields = ['startTime', '-startTime', 'createdAt', '-createdAt', 'participants', '-participants'];
const createReservationSchema = z.object({
  roomId: positiveInteger,
  participants: z.number().int().positive(),
  startTime: isoDateTime,
  endTime: isoDateTime,
}).strict();

const reservationParamsSchema = z.object({ id: positiveInteger });
const reservationQuerySchema = z.object({
  roomId: positiveInteger.optional(),
  buildingId: positiveInteger.optional(),
  status: z.enum(['CONFIRMED', 'CANCELLED']).optional(),
  from: isoDateTime.optional(),
  to: isoDateTime.optional(),
  page: positiveInteger.default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(sortFields).default('startTime'),
}).strict().superRefine((query, context) => {
  if (query.from && query.to && new Date(query.from) > new Date(query.to)) {
    context.addIssue({ code: 'custom', path: ['to'], message: 'to must be greater than or equal to from' });
  }
});

module.exports = { createReservationSchema, reservationParamsSchema, reservationQuerySchema };
