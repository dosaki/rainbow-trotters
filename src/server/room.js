import {
    createState, tickSim, roundOver, spawnSlot, rngFrom,
    HUES, MAX_PLAYERS, MIN_PLAYERS, PHASE, EV,
} from '#shared';
import { enterPhase, phaseLength } from './round.js';
import { broadcast } from './broadcast.js';
import { botInputs } from './bots/bot.js';

export const createRoom = () => ({
    players: new Map(),
    slots: Array.from({ length: MAX_PLAYERS }, (_, i) => i),
    seed: 0,
    tick: 0,
    state: null,
    phase: PHASE.RESULTS,
    phaseTick: 0,
    turnLog: [],
    roster: [],
    botRng: rngFrom(1),
});

export const addPlayer = (room, socket, isBot) => {
    if (!room.slots.length) return null;
    const slot = room.slots.shift();
    const player = {
        id: slot,
        hue: HUES[slot],
        socket,
        bot: !!isBot,
        pending: [],
    };
    room.players.set(player.id, player);
    return player;
};

export const removePlayer = (room, id) => {
    const p = room.players.get(id);
    if (!p) return;
    room.slots.unshift(p.id);
    room.players.delete(id);
    const u = room.state && room.state.unicorns.find((x) => x.id === id);
    if (u && u.alive) {
        u.alive = false;
        u.deathTick = room.state.tick;
    }
};

export const addHuman = (room, socket) => {
    if (room.players.size >= MAX_PLAYERS) {
        const bot = [...room.players.values()].find((p) => p.bot);
        if (!bot) return null;
        removePlayer(room, bot.id);
    }
    return addPlayer(room, socket, false);
};

export const backfill = (room) => {
    while (room.players.size < MIN_PLAYERS) {
        if (!addPlayer(room, null, true)) break;
    }
};

export const playerList = (room) =>
    [...room.players.values()].map((p) => [p.id, p.hue, p.bot ? 1 : 0]);

export const humansIn = (room) => {
    const ids = new Set();
    for (const [id, , bot] of room.roster) {
        if (!bot) {
            ids.add(id);
        }
    }
    return ids;
};

export const spawnsFor = (room) => {
    const ids = [...room.players.keys()];
    return ids.map((id, i) => ({ id, ...spawnSlot(i, ids.length) }));
};

export const startRound = (room) => {
    backfill(room);
    room.seed = (Math.random() * 0x7fffffff) | 0;
    room.turnLog.length = 0;
    room.state = createState(room.seed, spawnsFor(room));
    room.roster = playerList(room);
    enterPhase(room, PHASE.COUNTDOWN);
    broadcast(room, EV.ROUND, [room.seed, room.tick, room.roster]);
};

export const advance = (room) => {
    room.tick++;
    room.phaseTick++;

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
            enterPhase(room, PHASE.RESULTS);
        }
        return;
    }

    if (room.phaseTick < phaseLength(room.phase)) return;
    if (room.phase === PHASE.COUNTDOWN) {
        enterPhase(room, PHASE.RACE);
    }
    else startRound(room);
};
