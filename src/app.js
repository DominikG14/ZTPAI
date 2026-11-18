const express = require('express');
const { createRoomsService } = require('./modules/rooms/rooms.service');
const { createRoomsController } = require('./modules/rooms/rooms.controller');
const { createRoomsRouter } = require('./modules/rooms/rooms.routes');
const { createReservationsService } = require('./modules/reservations/reservations.service');
const { createReservationsController } = require('./modules/reservations/reservations.controller');
const { createReservationsRouter } = require('./modules/reservations/reservations.routes');
const { createBuildingsService } = require('./modules/buildings/buildings.service');
const { createBuildingsController } = require('./modules/buildings/buildings.controller');
const { createBuildingsRouter } = require('./modules/buildings/buildings.routes');
const { errorHandler } = require('./errors/error-handler');
const { AppError } = require('./errors/app-error');
const { requestLogger } = require('./middleware/request-logger');
const { createAuthService } = require('./modules/auth/auth.service');
const { createAuthController } = require('./modules/auth/auth.controller');
const { createAuthRouter } = require('./modules/auth/auth.routes');
const defaultMemoryUsersRepo = require('./modules/auth/auth.repository.memory');
const { requireAuth } = require('./modules/auth/auth.middleware');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./docs/swagger');

function createApp({ buildingsRepo, roomsRepo, reservationsRepo, usersRepo = defaultMemoryUsersRepo }) {
  if (!buildingsRepo || !roomsRepo || !reservationsRepo) {
    throw new Error('createApp requires building, room, and reservation repositories.');
  }
  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
  app.use('/api/auth', createAuthRouter(createAuthController(createAuthService(usersRepo))));
  app.use((req, res, next) => (req.path === '/api/docs' || req.path.startsWith('/api/docs/'))
    ? next()
    : requireAuth(req, res, next));
  app.use('/api/buildings', createBuildingsRouter(createBuildingsController(createBuildingsService(buildingsRepo))));
  app.use('/api/rooms', createRoomsRouter(createRoomsController(createRoomsService(roomsRepo, buildingsRepo))));
  app.use('/api/reservations', createReservationsRouter(createReservationsController(createReservationsService({ reservationRepository: reservationsRepo }))));
  app.get('/api/debug/crash', (_req, _res) => { throw new Error('boom'); });
  app.use((req, _res, next) => next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, { code: 'NOT_FOUND', statusCode: 404 })));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
