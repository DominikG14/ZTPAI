const bcrypt = require('bcryptjs');
const seededAt = new Date('2026-10-30T00:00:00.000Z').toISOString();
let nextId = 1;
const users = [
  { id: nextId++, email: 'admin@example.com', passwordHash: bcrypt.hashSync('Admin12345!', 10), role: 'ADMIN', createdAt: seededAt },
  { id: nextId++, email: 'jan.kowalski@example.com', passwordHash: bcrypt.hashSync('User12345!', 10), role: 'USER', createdAt: seededAt },
];

module.exports = {
  async findByEmail(email) {
    const user = users.find((item) => item.email === email);
    return user ? { ...user } : null;
  },
  async findById(id) {
    const user = users.find((item) => item.id === Number(id));
    if (!user) return null;
    return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
  },
  async create({ email, passwordHash, role = 'USER' }) {
    if (users.some((user) => user.email === email)) {
      const error = new Error('Duplicate email');
      error.code = '23505';
      error.constraint = 'users_email_unique';
      throw error;
    }
    const user = {
      id: nextId++,
      email,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
  },
};
