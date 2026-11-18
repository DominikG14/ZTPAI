const defaultRooms = [
  { id: 1, buildingId: 1, name: 'A101', capacity: 30 },
  { id: 2, buildingId: 1, name: 'B202', capacity: 15 },
  { id: 3, buildingId: 1, name: 'C303', capacity: 50 },
  { id: 4, buildingId: 2, name: 'D404', capacity: 20 },
  { id: 5, buildingId: 2, name: 'E505', capacity: 25 },
];

function createRoomsRepositoryMemory(initialRooms = defaultRooms) {
  const rooms = initialRooms.map((room) => ({ ...room }));
  let nextId = rooms.reduce((max, r) => Math.max(max, r.id || 0), 0) + 1;

  async function findAll() { return rooms.map((room) => ({ ...room })); }
  async function findById(id) {
    const room = rooms.find((item) => item.id === Number(id));
    if (!room) return null;
    let building = null;
    try {
      building = await require('../buildings/buildings.repository.memory').findById(room.buildingId);
    } catch (_) {}
    return { ...room, building: building ? { id: building.id, name: building.name } : null };
  }

  async function findByBuildingId(buildingId) {
    return rooms.filter((room) => room.buildingId === Number(buildingId)).map((room) => ({ ...room }));
  }

  async function create(data) {
    const room = { id: nextId++, ...data };
    rooms.push(room);
    return { ...room };
  }

  return { findAll, findById, findByBuildingId, create, _rooms: rooms };
}

const defaultInstance = createRoomsRepositoryMemory();

module.exports = { ...defaultInstance, createRoomsRepositoryMemory };
