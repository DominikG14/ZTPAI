const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

function legacyEmail(owner) {
  const normalized = owner.trim().toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) return normalized;
  const slug = owner.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'owner';
  const digest = crypto.createHash('sha256').update(owner).digest('hex').slice(0, 10);
  return `legacy-${slug}-${digest}@legacy.invalid`;
}

/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.alterTable('reservations', (table) => {
    table.integer('user_id').nullable()
      .references('id').inTable('users').onDelete('RESTRICT').onUpdate('CASCADE');
  });

  const existingUsers = await knex('users').select('id', 'email');
  const usersByEmail = new Map(existingUsers.map((user) => [user.email.toLowerCase(), user.id]));
  const owners = await knex('reservations').distinct('reserved_by').select('reserved_by');

  for (const { reserved_by: owner } of owners) {
    const email = legacyEmail(owner);
    let userId = usersByEmail.get(email);
    if (!userId) {
      const earliestReservation = await knex('reservations')
        .where({ reserved_by: owner })
        .min('created_at as created_at')
        .first();
      const randomPassword = crypto.randomBytes(48).toString('base64url');
      const [user] = await knex('users').insert({
        email,
        password_hash: await bcrypt.hash(randomPassword, 10),
        role: 'USER',
        created_at: earliestReservation?.created_at || knex.fn.now(),
      }).returning(['id', 'email']);
      userId = user.id;
      usersByEmail.set(user.email.toLowerCase(), userId);
    }
    await knex('reservations').where({ reserved_by: owner }).update({ user_id: userId });
  }

  await knex.schema.alterTable('reservations', (table) => {
    table.integer('user_id').notNullable().alter();
    table.dropColumn('reserved_by');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.alterTable('reservations', (table) => {
    table.string('reserved_by', 100).nullable();
  });
  await knex.raw('UPDATE reservations AS res SET reserved_by = left(users.email, 100) FROM users WHERE users.id = res.user_id');
  await knex.schema.alterTable('reservations', (table) => {
    table.string('reserved_by', 100).notNullable().alter();
    table.dropForeign(['user_id']);
    table.dropColumn('user_id');
  });
};
