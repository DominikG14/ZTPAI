const buildings = [
  { id: 1, name: 'Budynek A', address: 'ul. Warszawska 24, Kraków', createdAt: '2026-10-01T09:00:00.000Z' },
  { id: 2, name: 'Budynek B', address: 'ul. Długa 12, Kraków', createdAt: '2026-10-01T09:00:00.000Z' },
];
let nextId = 3;

async function withRoomsCount(building) {
  const rooms = await require('../rooms/rooms.repository.memory').findByBuildingId(building.id);
  return { ...building, roomsCount: rooms.length };
}
async function findAll() { return Promise.all(buildings.map(withRoomsCount)); }
async function findById(id) {
  const building = buildings.find((item) => item.id === Number(id));
  return building ? withRoomsCount(building) : null;
}
async function findRooms(id) {
  return require('../rooms/rooms.repository.memory').findByBuildingId(id);
}
async function create(data) {
  const building = { id: nextId++, ...data };
  buildings.push(building);
  return { ...building };
}

module.exports = { findAll, findById, findRooms, create };
