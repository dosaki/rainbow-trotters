import {
    createState, tickSim, roundOver, rngFrom, cleanName,
    HUES, MAX_PLAYERS, WINS_TO_TAKE, MAX_ROUNDS, PHASE, EV, startsFor, mapAt, mapCount,
} from '#shared';
import { enterPhase, phaseLength } from './round.js';
import { broadcast } from './broadcast.js';
import { botInputs } from './bots/bot.js';

export const createRoom = (code = '', open = false) => ({
    code,
    open,
    relay: null,
    watch: null,
    demo: false,
    holdUntil: 0,
    expect: 0,
    solo: false,
    hostId: -1,
    rounds: 0,
    players: new Map(),
    slots: Array.from({ length: MAX_PLAYERS }, (_, i) => i),
    seed: 0,
    map: 0,
    custom: '',
    tick: 0,
    state: null,
    phase: PHASE.LOBBY,
    phaseTick: 0,
    turnLog: [],
    roster: [],
    botRng: rngFrom(1),
});

export const addPlayer = (room, link, isBot, name = '') => {
    if (!room.slots.length) return null;
    const slot = room.slots.shift();
    const player = {
        id: slot,
        hue: HUES[slot],
        link,
        bot: !!isBot,
        name: cleanName(isBot ? `Bot ${slot + 1}` : name, slot),
        ready: !!isBot,
        wins: 0,
        pending: [],
    };
    room.players.set(player.id, player);
    if (!isBot && room.hostId < 0) {
        room.hostId = player.id;
    }
    if (!isBot && room.phase === PHASE.LOBBY) {
        for (const q of room.players.values()) {
            if (!q.bot && q !== player) {
                q.ready = false;
            }
        }
    }
    return player;
};

export const removePlayer = (room, id) => {
    const p = room.players.get(id);
    if (!p) return;
    room.slots.unshift(p.id);
    room.players.delete(id);
    if (room.hostId === id) {
        room.hostId = -1;
        for (const q of room.players.values()) {
            if (!q.bot) {
                room.hostId = q.id;
                break;
            }
        }
    }
    const u = room.state && room.state.unicorns.find((x) => x.id === id);
    if (u && u.alive) {
        u.alive = false;
        u.deathTick = room.state.tick;
    }
};

export const addHuman = (room, link) => {
    if (room.players.size >= MAX_PLAYERS) {
        const bot = [...room.players.values()].find((p) => p.bot);
        if (!bot) return null;
        removePlayer(room, bot.id);
    }
    return addPlayer(room, link, false);
};

export const playerList = (room) =>
    [...room.players.values()].map(
        (p) => [p.id, p.hue, p.bot ? 1 : 0, p.name, p.ready ? 1 : 0, p.wins]);

export const humansIn = (room) => {
    const ids = new Set();
    for (const [id, , bot] of room.roster) {
        if (!bot) {
            ids.add(id);
        }
    }
    return ids;
};

export const stateOf = (room) =>
    [room.phase, room.solo ? '' : room.code, room.hostId, playerList(room), room.map, room.custom];

export const setReady = (room, id, on) => {
    const p = room.players.get(id);
    if (p && !p.bot) {
        p.ready = !!on;
    }
};

export const holding = (room, now = Date.now()) => {
    if (!room.holdUntil) return false;
    if (room.players.size >= room.expect || now >= room.holdUntil) {
        room.holdUntil = 0;
        return false;
    }
    return true;
};

export const allReady = (room) => {
    let humans = 0;
    for (const p of room.players.values()) {
        if (p.bot) continue;
        humans++;
        if (!p.ready) return false;
    }
    return humans > 0 || (room.demo && room.players.size > 1);
};

export const addBot = (room) => addPlayer(room, null, true, '');

export const cycleMap = (room, delta) => {
    const n = mapCount(room.custom);
    room.map = ((room.map + (delta > 0 ? 1 : -1)) % n + n) % n;
};

export const removeBot = (room) => {
    for (const p of [...room.players.values()].reverse()) {
        if (!p.bot) continue;
        removePlayer(room, p.id);
        return true;
    }
    return false;
};

export const toLobby = (room) => {
    for (const p of room.players.values()) {
        p.wins = 0;
        p.ready = p.bot;
        p.pending.length = 0;
    }
    room.rounds = 0;
    room.state = null;
    room.turnLog.length = 0;
    room.roster = [];
    enterPhase(room, PHASE.LOBBY);
};

export const awardRound = (room) => {
    room.rounds++;
    const alive = room.state.unicorns.filter((u) => u.alive);
    if (!alive.length) return -1;
    const winner = alive.length === 1
        ? alive[0]
        : alive.reduce((a, b) => (b.cells > a.cells ? b : a));
    const p = room.players.get(winner.id);
    if (p) {
        p.wins++;
    }
    return winner.id;
};

export const gameResult = (room) => {
    let top = null;
    for (const p of room.players.values()) {
        if (!top || p.wins > top.wins) {
            top = p;
        }
    }
    if (!top) return null;
    if (top.wins >= WINS_TO_TAKE) return { winner: top.id, wins: top.wins };
    if (room.rounds < MAX_ROUNDS) return null;

    const cellsOf = (id) => {
        const u = room.state && room.state.unicorns.find((x) => x.id === id);
        return u ? u.cells : 0;
    };
    let win = null;
    for (const p of room.players.values()) {
        if (!win
            || p.wins > win.wins
            || (p.wins === win.wins && cellsOf(p.id) > cellsOf(win.id))) win = p;
    }
    return { winner: win.id, wins: win.wins };
};

export const spawnsFor = (room) =>
    startsFor([...room.players.keys()], mapAt(room.map, room.custom), room.seed);

export const startRound = (room) => {
    room.seed = (Math.random() * 0x7fffffff) | 0;
    room.turnLog.length = 0;
    room.state = createState(room.seed, spawnsFor(room), mapAt(room.map, room.custom));
    room.roster = playerList(room);
    enterPhase(room, PHASE.COUNTDOWN);
    broadcast(room, EV.ROUND, [room.seed, room.tick, room.roster, room.map]);
};

export const startGame = (room) => {
    room.rounds = 0;
    for (const p of room.players.values()) {
        p.wins = 0;
    }
    startRound(room);
};

export const advance = (room) => {
    room.tick++;
    room.phaseTick++;

    if (room.phase === PHASE.LOBBY) {
        if (!holding(room) && allReady(room)) {
            startGame(room);
        }
        return;
    }

    if (room.phase === PHASE.RACE) {
        for (const p of room.players.values()) {
            if (!p.bot) continue;
            const u = room.state.unicorns.find((x) => x.id === p.id);
            if (!u || !u.alive) continue;
            for (const input of botInputs(room.state, u, room.botRng)) {
                p.pending.push([room.state.tick, input]);
            }
        }

        const turns = [];
        for (const p of room.players.values()) {
            for (let n = 0; n < p.pending.length;) {
                const [t, input] = p.pending[n];
                if (t > room.state.tick) {
                    n++;
                    continue;
                }
                turns.push([p.id, input]);
                room.turnLog.push([room.state.tick, p.id, input]);
                p.pending.splice(n, 1);
            }
        }
        tickSim(room.state, turns);
        broadcast(room, EV.TICK, [room.state.tick, turns]);
        if (roundOver(room.state, humansIn(room))) {
            awardRound(room);
            enterPhase(room, PHASE.RESULTS);
        }
        return;
    }

    if (room.phaseTick < phaseLength(room.phase)) return;
    if (room.phase === PHASE.COUNTDOWN) {
        enterPhase(room, PHASE.RACE);
        return;
    }

    if (!gameResult(room)) {
        startRound(room);
        return;
    }

    toLobby(room);
    broadcast(room, EV.STATE, stateOf(room));
};
