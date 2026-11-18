const defaultStartedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
const defaultStartedEnd = new Date(Date.now() + 60 * 60 * 1000).toISOString();
const defaultReservations = [
  { id: 1, roomId: 1, userId: 2, participants: 20, startTime: '2026-10-11T10:00:00.000Z', endTime: '2026-10-11T12:00:00.000Z', status: 'CONFIRMED', createdAt: '2026-10-08T15:00:00.000Z', cancelledAt: null },
  { id: 2, roomId: 1, userId: 2, participants: 15, startTime: '2026-10-12T10:00:00.000Z', endTime: '2026-10-12T11:00:00.000Z', status: 'CONFIRMED', createdAt: '2026-10-08T15:00:00.000Z', cancelledAt: null },
  { id: 3, roomId: 2, userId: 2, participants: 10, startTime: '2026-10-15T10:00:00.000Z', endTime: '2026-10-15T11:00:00.000Z', status: 'CONFIRMED', createdAt: '2026-10-08T15:00:00.000Z', cancelledAt: null },
  { id: 4, roomId: 2, userId: 2, participants: 5, startTime: defaultStartedAt, endTime: defaultStartedEnd, status: 'CONFIRMED', createdAt: defaultStartedAt, cancelledAt: null, internalNote: 'seed reservation: already started' },
];

function createReservationsRepositoryMemory({ roomsRepository, usersRepository, initialReservations = defaultReservations } = {}) {
  const reservations = initialReservations.map((item) => ({ ...item }));
  let nextId = reservations.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;

  const getRoomsRepo = () => {
    if (roomsRepository) {
      if (Array.isArray(roomsRepository)) {
        return {
          findById: async (id) => roomsRepository.find((r) => r.id === Number(id)) || null,
          findByBuildingId: async (bId) => roomsRepository.filter((r) => r.buildingId === Number(bId)),
        };
      }
      return roomsRepository;
    }
    return require('../rooms/rooms.repository.memory');
  };

  const getUsersRepo = () => usersRepository || require('../auth/auth.repository.memory');

  async function withRoomAndBuilding(reservation) {
    const roomsRepo = getRoomsRepo();
    const usersRepo = getUsersRepo();
    const room = await roomsRepo.findById(reservation.roomId);
    const user = await usersRepo.findById(reservation.userId);
    return { ...reservation, ...(room ? { room } : {}), ...(user ? { user } : {}) };
  }

  async function findAll(filters = {}) {
    const roomsRepo = getRoomsRepo();
    let filtered = reservations.filter((item) => {
      if (filters.roomId !== undefined && item.roomId !== filters.roomId) return false;
      if (filters.status !== undefined && item.status !== filters.status) return false;
      if (filters.from !== undefined && new Date(item.endTime) <= new Date(filters.from)) return false;
      if (filters.to !== undefined && new Date(item.startTime) >= new Date(filters.to)) return false;
      return true;
    });
    if (filters.buildingId !== undefined) {
      const buildingRooms = await roomsRepo.findByBuildingId(filters.buildingId);
      const roomIds = new Set(buildingRooms.map((room) => room.id));
      filtered = filtered.filter((item) => roomIds.has(item.roomId));
    }

    const total = filtered.length;
    const descending = filters.sort?.startsWith('-') ?? false;
    const sortField = descending ? filters.sort.slice(1) : (filters.sort || 'startTime');
    const keys = { startTime: 'startTime', createdAt: 'createdAt', participants: 'participants' };
    filtered = [...filtered].sort((a, b) => {
      const left = a[keys[sortField]];
      const right = b[keys[sortField]];
      const compared = typeof left === 'number' ? left - right : new Date(left).getTime() - new Date(right).getTime();
      return (descending ? -compared : compared) || a.id - b.id;
    });
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    const pageItems = filtered.slice(offset, offset + limit);
    return {
      data: await Promise.all(pageItems.map(withRoomAndBuilding)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async function findById(id) {
    const item = reservations.find((reservation) => reservation.id === Number(id));
    return item ? withRoomAndBuilding(item) : null;
  }

  async function findConflicts(roomId, startTime, endTime) {
    return reservations.some((item) =>
      item.roomId === Number(roomId) &&
      item.status === 'CONFIRMED' &&
      new Date(startTime) < new Date(item.endTime) &&
      new Date(endTime) > new Date(item.startTime)
    );
  }

  async function create(data) {
    const item = { id: nextId++, ...data };
    reservations.push(item);
    return withRoomAndBuilding(item);
  }

  async function withRoomLock(roomId, callback) {
    const roomsRepo = getRoomsRepo();
    const room = await roomsRepo.findById(roomId);
    return callback({
      room,
      findConflicts: (startTime, endTime) => findConflicts(roomId, startTime, endTime),
      create,
    });
  }

  async function cancel(id, cancelledAt) {
    const item = reservations.find((reservation) => reservation.id === Number(id));
    if (!item) return null;
    if (item.status !== 'CANCELLED') {
      item.status = 'CANCELLED';
      item.cancelledAt = cancelledAt;
    }
    return withRoomAndBuilding(item);
  }

  return {
    findAll,
    findById,
    findConflicts,
    withRoomLock,
    create,
    cancel,
    _reservations: reservations,
  };
}

const defaultInstance = createReservationsRepositoryMemory();

module.exports = {
  ...defaultInstance,
  createReservationsRepositoryMemory,
};
