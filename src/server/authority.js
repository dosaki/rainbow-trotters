import { TURN_WINDOW, ACTIVATE } from '#shared';

const MAX_PENDING = 8;

export const scheduleTurn = (room, player, input, claimedTick) => {
    if (!Number.isInteger(input) || input < 0 || input > ACTIVATE) return -1;
    if (!room.state) return -1;
    const now = room.state.tick;
    const wanted = Number.isInteger(claimedTick) ? claimedTick : now;
    const inWindow = wanted >= now - TURN_WINDOW && wanted <= now + TURN_WINDOW;
    const landed = inWindow ? Math.max(wanted, now) : now;
    if (player.pending.length >= MAX_PENDING) {
        player.pending.shift();
    }
    player.pending.push([landed, input]);
    return landed;
};

export const helloPayload = (room, player) => [
    player.id,
    room.state ? room.state.tick : 0,
    room.seed,
    room.phase,
    room.tick,
    room.roster,
    room.turnLog,
    room.code,
    room.hostId,
    room.map,
];
