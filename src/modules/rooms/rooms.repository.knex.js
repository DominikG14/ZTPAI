function mapRoom(row) {
  if (!row) return null;
  return {
    id: row.id,
    buildingId: row.building_id,
    name: row.name,
    capacity: row.capacity,
    createdAt: row.created_at,
  };
}

function createRoomsKnexRepository(knex) {
  return {
    async findAll() {
      return (await knex('rooms').select('*').orderBy('id')).map(mapRoom);
    },
    async findById(id) {
      const row = await knex('rooms as r')
        .join('buildings as b', 'b.id', 'r.building_id')
        .select(
          'r.id', 'r.building_id', 'r.name', 'r.capacity', 'r.created_at',
          'b.id as joined_building_id', 'b.name as joined_building_name',
        )
        .where('r.id', Number(id))
        .first();
      const room = mapRoom(row);
      if (room) room.building = { id: row.joined_building_id, name: row.joined_building_name };
      return room;
    },
    async create(data) {
      const [row] = await knex('rooms').insert({
        building_id: data.buildingId,
        name: data.name,
        capacity: data.capacity,
        ...(data.createdAt ? { created_at: data.createdAt } : {}),
      }).returning('*');
      return mapRoom(row);
    },
  };
}

module.exports = { createRoomsKnexRepository, mapRoom };
