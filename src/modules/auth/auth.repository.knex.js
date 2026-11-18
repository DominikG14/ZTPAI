function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
  };
}

function createAuthKnexRepository(knex) {
  return {
    async findByEmail(email) {
      const row = await knex('users').where({ email }).first();
      return row ? {
        id: row.id,
        email: row.email,
        role: row.role,
        createdAt: row.created_at,
        passwordHash: row.password_hash,
      } : null;
    },
    async findById(id) {
      const row = await knex('users').where({ id: Number(id) }).first();
      return mapUser(row);
    },
    async create({ email, passwordHash, role = 'USER' }) {
      const [row] = await knex('users').insert({
        email,
        password_hash: passwordHash,
        role,
      }).returning(['id', 'email', 'role', 'created_at']);
      return mapUser(row);
    },
  };
}

module.exports = { createAuthKnexRepository };
