/** @param {import('knex').Knex} knex */
exports.seed = async function seed(knex) {
  const bcrypt = require('bcryptjs');
  const now = Date.now();
  const createdAt = new Date(now - 24 * 60 * 60 * 1000);
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@example.com').trim().toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin12345!';
  await knex.transaction(async (trx) => {
    await trx.raw('TRUNCATE TABLE reservations, rooms, buildings, users RESTART IDENTITY CASCADE');
    const seededUsers = await trx('users').insert([{
      email: adminEmail,
      password_hash: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
      created_at: createdAt,
    }, {
      email: 'jan.kowalski@example.com',
      password_hash: await bcrypt.hash('User12345!', 10),
      role: 'USER',
      created_at: createdAt,
    }]).returning('*');
    const demoUser = seededUsers.find((user) => user.role === 'USER');

    const buildings = await trx('buildings').insert([
      { name: 'Budynek A', address: 'ul. Warszawska 24, Kraków', created_at: createdAt },
      { name: 'Budynek B', address: 'ul. Długa 12, Kraków', created_at: createdAt },
    ]).returning('*');

    const rooms = await trx('rooms').insert([
      { building_id: buildings[0].id, name: '101', capacity: 30, created_at: createdAt },
      { building_id: buildings[0].id, name: '102', capacity: 15, created_at: createdAt },
      { building_id: buildings[0].id, name: '103', capacity: 50, created_at: createdAt },
      { building_id: buildings[1].id, name: '201', capacity: 20, created_at: createdAt },
      { building_id: buildings[1].id, name: '202', capacity: 25, created_at: createdAt },
    ]).returning('*');

    const reservation = (room, suffix, start, end, status = 'CONFIRMED', cancelledAt = null) => ({
      room_id: room.id,
      user_id: demoUser.id,
      participants: Math.min(8, room.capacity),
      start_time: new Date(start),
      end_time: new Date(end),
      status,
      cancelled_at: cancelledAt ? new Date(cancelledAt) : null,
      created_at: createdAt,
    });

    await trx('reservations').insert([
      reservation(rooms[0], 'future A', now + 24 * 60 * 60 * 1000, now + 25 * 60 * 60 * 1000),
      reservation(rooms[1], 'future B', now + 48 * 60 * 60 * 1000, now + 49 * 60 * 60 * 1000, 'CANCELLED', now - 60 * 60 * 1000),
      reservation(rooms[2], 'already started', now - 60 * 60 * 1000, now + 60 * 60 * 1000),
      reservation(rooms[3], 'future C', now + 72 * 60 * 60 * 1000, now + 73 * 60 * 60 * 1000),
      reservation(rooms[4], 'future D', now + 96 * 60 * 60 * 1000, now + 97 * 60 * 60 * 1000),
    ]);
  });
};
