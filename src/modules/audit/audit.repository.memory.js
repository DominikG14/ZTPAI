function createAuditRepositoryMemory() {
  const entries = [];
  let nextId = 1;
  return {
    async record(eventType, payload) {
      const entry = { id: nextId++, eventType, payload, createdAt: new Date().toISOString() };
      entries.push(entry);
      return entry;
    },
    async list({ eventType, page, limit }) {
      const filtered = entries.filter((entry) => !eventType || entry.eventType === eventType)
        .slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id);
      const total = filtered.length;
      return {
        data: filtered.slice((page - 1) * limit, page * limit),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    },
  };
}

module.exports = { createAuditRepositoryMemory };
