function toRoomResponse(room) {
  const response = {
    id: room.id,
    name: room.name,
    capacity: room.capacity,
  };
  if (room.building) response.building = { id: room.building.id, name: room.building.name };
  else response.buildingId = room.buildingId;
  return response;
}

module.exports = { toRoomResponse };
