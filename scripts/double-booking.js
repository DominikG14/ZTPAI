require('dotenv').config();

const knex = require('../src/db/knex');

const apiUrl = process.env.API_URL || 'http://127.0.0.1:3000';
const roomId = Number(process.env.ROOM_ID || 1);
async function main() {
  let startTime;
  if (process.env.START_TIME) {
    startTime = new Date(process.env.START_TIME);
  } else {
    // Pick a free future interval so this demo can be rerun without colliding
    // with earlier demo reservations or seeded bookings.
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const offsetMs = (30 + Math.random() * 3650) * 24 * 60 * 60 * 1000;
      const candidate = new Date(Date.now() + offsetMs);
      const candidateEnd = new Date(candidate.getTime() + 60 * 60 * 1000);
      const conflict = await knex('reservations')
        .where({ room_id: roomId, status: 'CONFIRMED' })
        .where('start_time', '<', candidateEnd.toISOString())
        .where('end_time', '>', candidate.toISOString())
        .first();
      if (!conflict) {
        startTime = candidate;
        break;
      }
    }
  }
  if (!startTime || Number.isNaN(startTime.getTime())) {
    throw new Error('Could not find a valid future interval; set START_TIME explicitly.');
  }
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
  const body = {
    roomId,
    participants: 1,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
  };

  let accessToken = process.env.ACCESS_TOKEN;
  if (!accessToken) {
    const email = process.env.API_EMAIL || 'admin@example.com';
    const password = process.env.API_PASSWORD || 'Admin12345!';
    const login = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await login.json();
    if (!login.ok || !loginBody.accessToken) {
      throw new Error('Login failed. Set ACCESS_TOKEN or API_EMAIL and API_PASSWORD.');
    }
    accessToken = loginBody.accessToken;
  }

  console.log(`Room: ${roomId}`);
  console.log(`Interval: ${body.startTime} - ${body.endTime}`);

  const results = await Promise.all(Array.from({ length: 10 }, async () => {
    const response = await fetch(`${apiUrl}/api/reservations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
    return { status: response.status, response: await response.json() };
  }));

  results.forEach(({ status, response }, index) => {
    const reservationId = response?.id ?? response?.data?.id;
    console.log(`Request ${index + 1}: ${status}${reservationId ? ` (reservation ${reservationId})` : ''}`);
  });

  const countQuery = knex('reservations')
    .where({ room_id: roomId, status: 'CONFIRMED' })
    .where('start_time', '<', body.endTime)
    .where('end_time', '>', body.startTime)
    .count('* as count');
  const nativeQuery = countQuery.toSQL().toNative();
  const [countRow] = await countQuery;
  console.log(`Count SQL: ${nativeQuery.sql}`);
  console.log(`Count bindings: ${JSON.stringify(nativeQuery.bindings)}`);
  console.log(`CONFIRMED overlapping reservations: ${countRow.count}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => knex.destroy());
