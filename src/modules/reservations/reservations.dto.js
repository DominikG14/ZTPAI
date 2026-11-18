function toReservationResponse(reservation) {
  const response = {
    id: reservation.id,
    ...(reservation.user ? { user: { id: reservation.user.id, email: reservation.user.email } } : {}),
    participants: reservation.participants,
    startTime: reservation.startTime ? new Date(reservation.startTime).toISOString() : null,
    endTime: reservation.endTime ? new Date(reservation.endTime).toISOString() : null,
    status: reservation.status,
    createdAt: reservation.createdAt ? new Date(reservation.createdAt).toISOString() : null,
    cancelledAt: reservation.cancelledAt ? new Date(reservation.cancelledAt).toISOString() : null,
  };
  if (reservation.room) {
    response.room = {
      id: reservation.room.id,
      name: reservation.room.name,
      building: {
        id: reservation.room.building.id,
        name: reservation.room.building.name,
      },
    };
  } else {
    response.roomId = reservation.roomId;
  }
  return response;
}

module.exports = { toReservationResponse };
