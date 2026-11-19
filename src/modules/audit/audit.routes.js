const express = require('express');
const { z } = require('zod');
const { validate } = require('../../middleware/validate');
const { AppError } = require('../../errors/app-error');

const querySchema = z.object({
  eventType: z.string().min(1).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).strict();

function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'ADMIN') return next(new AppError('Administrator role required', { code: 'FORBIDDEN', statusCode: 403 }));
  return next();
}

function createAuditRouter(auditRepository) {
  const router = express.Router();
  router.get('/', requireAdmin, validate({ query: querySchema }), async (req, res) => {
    res.json(await auditRepository.list(req.validated.query));
  });
  return router;
}

module.exports = { createAuditRouter };
