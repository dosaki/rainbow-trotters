export const EV = {
    TURN: 't',      // C->S [input, tick]   input: 0..3 turn, 4 activate
    PING: 'p',      // C->S [clientTime]
    HELLO: 'h',     // S->C [yourId, tick, seed, phase, startTick, players, turnLog]
    TICK: 'k',      // S->C [tick, turns]
    ROUND: 'r',     // S->C [seed, startTick, players]
    JOIN: 'j',      // S->C [id, hue]
    LEAVE: 'l',     // S->C [id]
    PONG: 'q',      // S->C [clientTime, tick]
};

export const PHASE = { COUNTDOWN: 0, RACE: 1, RESULTS: 2 };
