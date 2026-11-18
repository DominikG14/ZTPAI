require('dotenv').config();

const connection = process.env.DATABASE_URL;

if (!connection) {
  throw new Error('DATABASE_URL must be set (copy .env.example to .env).');
}

module.exports = {
  development: {
    client: 'pg',
    connection,
    migrations: { directory: './src/db/migrations' },
    seeds: { directory: './src/db/seeds' },
  },
  test: {
    client: 'pg',
    connection: process.env.TEST_DATABASE_URL || connection.replace(/\/room_booking(\?|$)/, '/room_booking_test$1'),
    migrations: { directory: './src/db/migrations' },
    seeds: { directory: './src/db/seeds' },
  },
};
