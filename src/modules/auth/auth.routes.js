const express = require('express');
const { validate } = require('../../middleware/validate');
const { registerSchema, loginSchema } = require('./auth.schemas');
const { requireAuth } = require('./auth.middleware');

function createAuthRouter(controller) {
  const router = express.Router();
  router.post('/register', validate({ body: registerSchema }), controller.register);
  router.post('/login', validate({ body: loginSchema }), controller.login);
  router.get('/me', requireAuth, controller.me);
  return router;
}

module.exports = { createAuthRouter };
