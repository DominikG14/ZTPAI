function createAuditRepository(knex) {
  return {
    async record(eventType, payload) {
      const [row] = await knex('audit_log').insert({ event_type: eventType, payload }).returning('*');
      return { id: row.id, eventType: row.event_type, payload: row.payload, createdAt: row.created_at };
    },
    async list({ eventType, page, limit }) {
      let base = knex('audit_log');
      if (eventType) base = base.where({ event_type: eventType });
      const [countRow] = await base.clone().count('* as total');
      const rows = await base.clone().orderBy('created_at', 'desc').orderBy('id', 'desc')
        .limit(limit).offset((page - 1) * limit);
      const total = Number(countRow.total);
      return {
        data: rows.map((row) => ({ id: row.id, eventType: row.event_type, payload: row.payload, createdAt: row.created_at })),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    },
  };
}

module.exports = { createAuditRepository };
