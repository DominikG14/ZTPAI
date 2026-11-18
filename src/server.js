const { createApp } = require('./app');
require('dotenv').config();

let repositories;
if (process.env.REPOSITORY === 'memory') {
  repositories = {
    buildingsRepo: require('./modules/buildings/buildings.repository.memory'),
    roomsRepo: require('./modules/rooms/rooms.repository.memory'),
    reservationsRepo: require('./modules/reservations/reservations.repository.memory'),
    usersRepo: require('./modules/auth/auth.repository.memory'),
  };
} else {
  const knex = require('./db/knex');
  repositories = {
    buildingsRepo: require('./modules/buildings/buildings.repository.knex').createBuildingsKnexRepository(knex),
    roomsRepo: require('./modules/rooms/rooms.repository.knex').createRoomsKnexRepository(knex),
    reservationsRepo: require('./modules/reservations/reservations.repository.knex').createReservationsKnexRepository(knex),
    usersRepo: require('./modules/auth/auth.repository.knex').createAuthKnexRepository(knex),
  };
}

const PORT = Number(process.env.PORT) || 3000;
createApp(repositories).listen(PORT, () => console.log(`Server is running on port ${PORT}`));
