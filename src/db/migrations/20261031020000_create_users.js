/** @param {import('knex').Knex} knex */
exports.up = async function up(knex) {
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email', 254).notNullable().unique('users_email_unique');
    table.string('password_hash', 60).notNullable();
    table.string('role', 20).notNullable().defaultTo('USER');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.check("role IN ('USER', 'ADMIN')", [], 'users_role_allowed');
  });
};

/** @param {import('knex').Knex} knex */
exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('users');
};
