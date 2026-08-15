export const EV = {
    TURN: 't',      // C->S [input, tick]   input: 0..3 turn, 4 activate
    PING: 'p',      // C->S [clientTime]
    MENU: 'm',      // C->S [mode, name, code]
    READY: 'y',     // C->S []              toggle
    BOT: 'b',       // C->S [delta]         host only, +1 or -1
    MAP: 'a',       // C->S [delta]         host only, cycles the map
    QUIT: 'x',      // C->S []              leave the room, back to the menu
    HELLO: 'h',     // S->C [yourId, tick, seed, phase, startTick, players, turnLog, code, hostId, map]
    TICK: 'k',      // S->C [tick, turns]
    ROUND: 'r',     // S->C [seed, startTick, players, map]
    JOIN: 'j',      // S->C [id, hue, bot, name]
    LEAVE: 'l',     // S->C [id]
    PONG: 'q',      // S->C [clientTime, tick]
    STATE: 's',     // S->C [phase, code, hostId, players, map]
    ERR: 'e',       // S->C [reason]
};

export const PHASE = { COUNTDOWN: 0, RACE: 1, RESULTS: 2, LOBBY: 3 };

export const MODE = { SOLO: 0, AUTO: 1, CREATE: 2, JOIN: 3 };

export const ERR = { NO_ROOM: 1, FULL: 2, GONE: 3 };
