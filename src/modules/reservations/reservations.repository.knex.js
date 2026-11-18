function mapReservation(row) {
  if (!row) return null;
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    ...(row.joined_user_id ? { user: { id: row.joined_user_id, email: row.joined_user_email } } : {}),
    participants: row.participants,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
  };
}

function createReservationsKnexRepository(knex) {
  const insertReservation = async (query, data) => {
    const [row] = await query('reservations').insert({
      room_id: data.roomId,
      user_id: data.userId,
      participants: data.participants,
      start_time: data.startTime,
      end_time: data.endTime,
      status: data.status,
      created_at: data.createdAt,
      cancelled_at: data.cancelledAt,
    }).returning('*');
    const user = await query('users').select('id', 'email').where({ id: row.user_id }).first();
    return mapReservation({ ...row, joined_user_id: user?.id, joined_user_email: user?.email });
  };

  const withRoomAndBuilding = () => knex('reservations as res')
    .join('rooms as room', 'room.id', 'res.room_id')
    .join('buildings as building', 'building.id', 'room.building_id')
    .join('users as owner', 'owner.id', 'res.user_id')
    .select(
      'res.id', 'res.room_id', 'res.user_id', 'res.participants',
      'res.start_time', 'res.end_time', 'res.status', 'res.cancelled_at', 'res.created_at',
      'owner.id as joined_user_id', 'owner.email as joined_user_email',
      'room.id as joined_room_id', 'room.name as joined_room_name',
      'room.capacity as joined_room_capacity', 'room.building_id as joined_room_building_id',
      'building.id as joined_building_id', 'building.name as joined_building_name',
    );

  const mapWithRoom = (row) => {
    const reservation = mapReservation(row);
    if (reservation) {
      reservation.room = {
        id: row.joined_room_id,
        name: row.joined_room_name,
        capacity: row.joined_room_capacity,
        buildingId: row.joined_room_building_id,
        building: { id: row.joined_building_id, name: row.joined_building_name },
      };
    }
    return reservation;
  };

  const applyFilters = (query, filters) => {
    if (filters.roomId !== undefined) query.where('res.room_id', filters.roomId);
    if (filters.buildingId !== undefined) query.where('room.building_id', filters.buildingId);
    if (filters.status !== undefined) query.where('res.status', filters.status);
    if (filters.from !== undefined) query.where('res.end_time', '>', filters.from);
    if (filters.to !== undefined) query.where('res.start_time', '<', filters.to);
    return query;
  };

  return {
    async findAll(filters = {}) {
      const countQuery = applyFilters(
        knex('reservations as res').join('rooms as room', 'room.id', 'res.room_id'),
        filters,
      )
        .countDistinct('res.id as total');

      const sortMap = {
        startTime: 'res.start_time',
        createdAt: 'res.created_at',
        participants: 'res.participants',
      };
      const descending = filters.sort.startsWith('-');
      const sortField = descending ? filters.sort.slice(1) : filters.sort;
      const offset = (filters.page - 1) * filters.limit;
      const dataQuery = applyFilters(withRoomAndBuilding(), filters)
        .orderBy(sortMap[sortField], descending ? 'desc' : 'asc')
        .orderBy('res.id', 'asc')
        .limit(filters.limit)
        .offset(offset);

      const [countRows, rows] = await Promise.all([countQuery, dataQuery]);
      const countRow = countRows[0];
      const total = Number(countRow.total);
      return {
        data: rows.map(mapWithRoom),
        meta: {
          page: filters.page,
          limit: filters.limit,
          total,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    },
    async findById(id) {
      return mapWithRoom(await withRoomAndBuilding().where('res.id', Number(id)).first());
    },
    async findConflicts(roomId, startTime, endTime) {
      return knex('reservations')
        .where({ room_id: Number(roomId), status: 'CONFIRMED' })
        .where('start_time', '<', endTime)
        .where('end_time', '>', startTime)
        .first()
        .then(Boolean);
    },
    async withRoomLock(roomId, callback) {
      return knex.transaction(async (trx) => {
        const room = await trx('rooms').where({ id: Number(roomId) }).forUpdate().first();
        const findConflicts = async (startTime, endTime) => Boolean(await trx('reservations')
          .where({ room_id: Number(roomId), status: 'CONFIRMED' })
          .where('start_time', '<', endTime)
          .where('end_time', '>', startTime)
          .first());
        const create = (data) => insertReservation(trx, data);
        return callback({
          room: room ? require('../rooms/rooms.repository.knex').mapRoom(room) : null,
          findConflicts,
          create,
        });
      });
    },
    async create(data) {
      return insertReservation(knex, data);
    },
    async cancel(id, cancelledAt) {
      await knex('reservations').where({ id: Number(id) })
        .update({ status: 'CANCELLED', cancelled_at: cancelledAt }).returning('*');
      return mapWithRoom(await withRoomAndBuilding().where('res.id', Number(id)).first());
    },
  };
}

module.exports = { createReservationsKnexRepository, mapReservation };
