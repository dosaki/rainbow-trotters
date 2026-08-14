export const sendTo = (player, ev, payload) => {
    if (player.socket) {
        player.socket.emit(ev, payload);
    }
};

export const broadcast = (room, ev, payload) => {
    for (const p of room.players.values()) {
        sendTo(p, ev, payload);
    }
};
