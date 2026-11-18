function mapBuilding(row) {
  if (!row) return null;
  return { id: row.id, name: row.name, address: row.address, createdAt: row.created_at };
}

function createBuildingsKnexRepository(knex) {
  return {
    async findAll() {
      const rows = await knex('buildings as b')
        .leftJoin('rooms as r', 'r.building_id', 'b.id')
        .select('b.id', 'b.name', 'b.address', 'b.created_at')
        .count('r.id as rooms_count')
        .groupBy('b.id')
        .orderBy('b.id');
      return rows.map((row) => ({ ...mapBuilding(row), roomsCount: Number(row.rooms_count) }));
    },
    async findById(id) {
      const row = await knex('buildings as b')
        .leftJoin('rooms as r', 'r.building_id', 'b.id')
        .select('b.id', 'b.name', 'b.address', 'b.created_at')
        .count('r.id as rooms_count')
        .where('b.id', Number(id))
        .groupBy('b.id')
        .first();
      return row ? { ...mapBuilding(row), roomsCount: Number(row.rooms_count) } : null;
    },
    async findRooms(id) {
      const rows = await knex('rooms').select('*').where({ building_id: Number(id) }).orderBy('id');
      return rows.map(require('../rooms/rooms.repository.knex').mapRoom);
    },
    async create(data) {
      const [row] = await knex('buildings').insert({
        name: data.name,
        address: data.address,
        ...(data.createdAt ? { created_at: data.createdAt } : {}),
      }).returning('*');
      return mapBuilding(row);
    },
  };
}

module.exports = { createBuildingsKnexRepository, mapBuilding };
