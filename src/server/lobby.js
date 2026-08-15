import { MAX_PLAYERS, ERR, PHASE } from '#shared';
import { createRoom, removePlayer } from './room.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LEN = 4;

export const createRegistry = () => new Map();

export const makeCode = (rooms) => {
    for (;;) {
        let c = '';
        for (let i = 0; i < CODE_LEN; i++) {
            c += ALPHABET[(Math.random() * ALPHABET.length) | 0];
        }
        if (!rooms.has(c)) return c;
    }
};

export const createLobby = (rooms, open) => {
    const room = createRoom(makeCode(rooms), !!open);
    rooms.set(room.code, room);
    return room;
};

export const joinByCode = (rooms, code) => {
    const key = String(code == null ? '' : code).trim().toUpperCase();
    const room = rooms.get(key);
    if (!room) return ERR.NO_ROOM;
    if (room.players.size >= MAX_PLAYERS) return ERR.FULL;
    return room;
};

export const autoJoin = (rooms) => {
    let best = null, bestScore = -1;
    for (const room of rooms.values()) {
        if (!room.open || room.players.size >= MAX_PLAYERS) continue;
        const score = room.players.size + (room.phase === PHASE.LOBBY ? 100 : 0);
        if (score > bestScore) {
            bestScore = score;
            best = room;
        }
    }
    return best || createLobby(rooms, true);
};

export const dropPlayer = (rooms, room, id) => {
    removePlayer(room, id);
    for (const p of room.players.values()) {
        if (!p.bot) return;
    }
    rooms.delete(room.code);
};
