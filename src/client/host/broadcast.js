export const sendTo = (room, player, ev, payload) => {
    const link = player && player.link;
    if (!link) return;
    if (link.deliver) {
        link.deliver(ev, payload);
        return;
    }
    if (link.cid && room && room.relay) {
        room.relay.sendTo(link.cid, ev, payload);
    }
};

export const broadcast = (room, ev, payload) => {
    if (room.relay) {
        room.relay.send(ev, payload);
    }
    if (room.watch) {
        room.watch(ev, payload);
    }
    for (const p of room.players.values()) {
        if (p.link && p.link.deliver) {
            p.link.deliver(ev, payload);
        }
    }
};
