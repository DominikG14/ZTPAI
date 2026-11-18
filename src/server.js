const { createApp } = require('./app');
require('dotenv').config();

let repositories;
let knexInstance = null;

if (process.env.REPOSITORY === 'memory') {
  repositories = {
    buildingsRepo: require('./modules/buildings/buildings.repository.memory'),
    roomsRepo: require('./modules/rooms/rooms.repository.memory'),
    reservationsRepo: require('./modules/reservations/reservations.repository.memory'),
    usersRepo: require('./modules/auth/auth.repository.memory'),
  };
} else {
  const knex = require('./db/knex');
  knexInstance = knex;
  repositories = {
    buildingsRepo: require('./modules/buildings/buildings.repository.knex').createBuildingsKnexRepository(knex),
    roomsRepo: require('./modules/rooms/rooms.repository.knex').createRoomsKnexRepository(knex),
    reservationsRepo: require('./modules/reservations/reservations.repository.knex').createReservationsKnexRepository(knex),
    usersRepo: require('./modules/auth/auth.repository.knex').createAuthKnexRepository(knex),
  };
}

const PORT = Number(process.env.PORT) || 3000;
const server = createApp(repositories).listen(PORT, () => console.log(`Server is running on port ${PORT}`));

let isShuttingDown = false;
async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[shutdown] Received ${signal}, starting graceful shutdown...`);

  server.closeIdleConnections?.();
  server.close(async (err) => {
    if (err) {
      console.error('[shutdown] Error closing HTTP server:', err);
      process.exit(1);
    }
    console.log('[shutdown] HTTP server closed.');

    if (knexInstance) {
      try {
        await knexInstance.destroy();
        console.log('[shutdown] Database connection pool closed.');
      } catch (dbErr) {
        console.error('[shutdown] Error closing database pool:', dbErr);
        process.exit(1);
      }
    }

    console.log('[shutdown] Graceful shutdown completed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
