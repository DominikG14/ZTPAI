exports.up = async function up(knex) {
  await knex.schema.createTable('audit_log', (table) => {
    table.increments('id').primary();
    table.string('event_type', 100).notNullable().index();
    table.jsonb('payload').notNullable();
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now()).index();
  });
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('audit_log');
};
