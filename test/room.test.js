import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, removePlayer, spawnsFor, startRound, advance, playerList, setReady, allReady, addBot, removeBot, toLobby, cycleMap, stateOf } from '../src/server/room.js';
import { scheduleTurn, helloPayload } from '../src/server/authority.js';
import { MAX_PLAYERS, HUES, COUNTDOWN_TICKS, RESULTS_TICKS, TURN_WINDOW, BODY, ACTIVATE } from '../src/shared/constants.js';
import { bodyInBounds } from '../src/shared/arena.js';
import { PHASE } from '../src/shared/protocol.js';
import { MAPS } from '../src/shared/maps.js';

const roomOf = (n) => {
    const r = createRoom();
    for (let i = 0; i < n; i++) {
        addPlayer(r, null, false);
    }
    return r;
};

const raceRoom = (n = 2) => {
    const r = roomOf(n);
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(r);
    }
    return r;
};

test('players receive distinct hues and release them on leave', () => {
    const r = createRoom();
    const a = addPlayer(r, null, false);
    const b = addPlayer(r, null, false);
    assert.notEqual(a.hue, b.hue);
    assert.ok(HUES.includes(a.hue) && HUES.includes(b.hue));
    removePlayer(r, a.id);
    const c = addPlayer(r, null, false);
    assert.equal(c.hue, a.hue, 'a freed hue is reused');
});

test('the room refuses more than MAX_PLAYERS', () => {
    const r = roomOf(MAX_PLAYERS);
    assert.equal(addPlayer(r, null, false), null);
});

test('spawns fit inside the arena, face inward, and never overlap', () => {
    for (const n of [2, 4, 5, 8]) {
        const spawns = spawnsFor(roomOf(n));
        assert.equal(spawns.length, n);
        for (const s of spawns) {
            assert.ok(bodyInBounds(s.x, s.y), `n=${n}: body at ${s.x},${s.y} hangs off the arena`);
            assert.ok(s.dir >= 0 && s.dir <= 3);
        }
        for (let i = 0; i < spawns.length; i++) {
            for (let j = i + 1; j < spawns.length; j++) {
                const a = spawns[i], b = spawns[j];
                const overlap = Math.abs(a.x - b.x) < BODY && Math.abs(a.y - b.y) < BODY;
                assert.equal(overlap, false, `n=${n}: spawns ${i} and ${j} overlap`);
            }
        }
    }
});

test('a round starts in countdown and reaches race', () => {
    const r = roomOf(2);
    startRound(r);
    assert.equal(r.phase, PHASE.COUNTDOWN);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.RACE);
});

test('the sim does not advance during countdown', () => {
    const r = roomOf(2);
    startRound(r);
    advance(r);
    assert.equal(r.state.tick, 0, 'unicorns hold still until the countdown ends');
});

test('a finished race moves to results and then starts a new round', () => {
    const r = raceRoom(2);
    for (const u of r.state.unicorns) {
        u.alive = false;
        u.deathTick = r.state.tick;
    }
    advance(r);
    assert.equal(r.phase, PHASE.RESULTS);
    const seed = r.seed;
    for (let i = 0; i < RESULTS_TICKS; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.COUNTDOWN);
    assert.notEqual(r.seed, seed, 'each round gets a fresh seed');
});

test('the turn log is cleared between rounds', () => {
    const r = roomOf(2);
    startRound(r);
    r.turnLog.push([1, 0, 1]);
    startRound(r);
    assert.equal(r.turnLog.length, 0);
});

test('a disconnect kills the unicorn instead of leaving it coasting', () => {
    const r = raceRoom(2);
    advance(r);
    removePlayer(r, 0);
    assert.equal(r.state.unicorns.find((u) => u.id === 0).alive, false);
    assert.equal(r.players.has(0), false);
});

test('a turn claimed slightly in the future lands on exactly that tick', () => {
    const r = raceRoom();
    const claimed = r.state.tick + 3;
    assert.equal(scheduleTurn(r, r.players.get(0), 1, claimed), claimed);
});

test('a turn claimed in the past lands on the soonest tick, never dropped', () => {
    const r = raceRoom();
    const p = r.players.get(0);
    assert.equal(scheduleTurn(r, p, 1, r.state.tick - 5), r.state.tick,
        'the soonest slot is the tick the next advance produces');
    const before = r.turnLog.length;
    advance(r);
    assert.equal(r.turnLog.length - before, 1, 'and it is applied by that very advance');
});

test('a wildly out-of-window claim clamps rather than being ignored', () => {
    const r = raceRoom();
    const landed = scheduleTurn(r, r.players.get(0), 1, r.state.tick + TURN_WINDOW * 100);
    assert.equal(landed, r.state.tick, 'degrades to input delay, never loses control');
});

test('activation is accepted as an input, garbage is not', () => {
    const r = raceRoom();
    const p = r.players.get(0);
    assert.ok(scheduleTurn(r, p, ACTIVATE, r.state.tick + 1) > 0, 'ACTIVATE must be schedulable');
    assert.equal(scheduleTurn(r, p, 9, r.state.tick + 1), -1);
    assert.equal(scheduleTurn(r, p, -1, r.state.tick + 1), -1);
    assert.equal(scheduleTurn(r, p, 1.5, r.state.tick + 1), -1);
});

test('a turn scheduled ahead waits for its tick and then lands', () => {
    const r = raceRoom();
    const p = r.players.get(0);
    const target = scheduleTurn(r, p, 1, r.state.tick + 3);
    while (r.state.tick < target) {
        advance(r);
        assert.ok(p.pending.some(([t, i]) => t === target && i === 1),
            `still queued at tick ${r.state.tick}`);
    }
    advance(r);
    assert.equal(p.pending.length, 0, 'consumed once its tick arrived');
    assert.ok(r.turnLog.some(([t, id, d]) => t === target && id === 0 && d === 1),
        `turn should be logged at tick ${target}, log has ${JSON.stringify(r.turnLog)}`);
});

test('hello carries everything a joiner needs to rebuild the arena', () => {
    const r = raceRoom();
    r.turnLog.push([1, 0, 1]);
    const [yourId, tick, seed, phase, startTick, players, turnLog] = helloPayload(r, r.players.get(1));
    assert.equal(yourId, 1);
    assert.equal(seed, r.seed);
    assert.equal(tick, r.state.tick);
    assert.equal(phase, r.phase);
    assert.equal(typeof startTick, 'number');
    assert.equal(players.length, r.players.size);
    assert.ok(players.some(([id]) => id === 0) && players.some(([id]) => id === 1));
    assert.deepEqual(turnLog, r.turnLog);
});

test('each tick is broadcast to every connected player', () => {
    const r = createRoom();
    const sent = [];
    const fakeSocket = () => ({ emit: (ev, payload) => sent.push([ev, payload]), on: () => {} });
    addPlayer(r, fakeSocket(), false);
    addPlayer(r, fakeSocket(), false);
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS + 3; i++) {
        advance(r);
    }
    const ticks = sent.filter(([ev]) => ev === 'k');
    assert.equal(ticks.length, 6, 'three race ticks, each to both players');
    assert.equal(typeof ticks[0][1][0], 'number');
});

test('player ids stay within MAX_PLAYERS however many people come and go', () => {
    const r = createRoom();
    for (let i = 0; i < 40; i++) {
        const p = addPlayer(r, null, false);
        assert.ok(p, `run out of slots after ${i} cycles`);
        assert.ok(p.id >= 0 && p.id < MAX_PLAYERS,
            `id ${p.id} is outside the layer array the client indexes with it`);
        removePlayer(r, p.id);
    }
});

test('a full room still refuses, and recovers when someone leaves', () => {
    const r = createRoom();
    const ids = [];
    for (let i = 0; i < MAX_PLAYERS; i++) {
        ids.push(addPlayer(r, null, false).id);
    }
    assert.equal(new Set(ids).size, MAX_PLAYERS, 'every seat is a distinct slot');
    assert.equal(addPlayer(r, null, false), null);
    removePlayer(r, ids[3]);
    const back = addPlayer(r, null, false);
    assert.equal(back.id, ids[3], 'the freed slot is handed straight back');
});

test('a room knows its code, whether it is public, and who hosts it', () => {
    const r = createRoom('PONY', true);
    assert.equal(r.code, 'PONY');
    assert.equal(r.open, true);
    assert.equal(r.hostId, -1, 'no host until someone joins');
    assert.equal(r.phase, PHASE.LOBBY, 'a new room waits in its lobby');
});

test('the first human to join becomes the host', () => {
    const r = createRoom('PONY', true);
    const a = addPlayer(r, null, false, 'Tiago');
    assert.equal(r.hostId, a.id);
    const b = addPlayer(r, null, false, 'Ana');
    assert.equal(r.hostId, a.id, 'joining does not steal the host');
    assert.equal(b.name, 'Ana');
});

test('a bot never becomes host', () => {
    const r = createRoom('PONY', true);
    addPlayer(r, null, true, '');
    assert.equal(r.hostId, -1);
});

test('names are sanitised on the way in', () => {
    const r = createRoom('PONY', true);
    const p = addPlayer(r, null, false, '   Sparkle\n  ');
    assert.equal(p.name, 'Sparkle');
    const q = addPlayer(r, null, false, '');
    assert.equal(q.name, `Unicorn ${q.id + 1}`);
});

test('humans start unready and bots start ready', () => {
    const r = createRoom('PONY', true);
    const human = addPlayer(r, null, false, 'A');
    const bot = addPlayer(r, null, true, '');
    assert.equal(human.ready, false);
    assert.equal(bot.ready, true);
    assert.equal(allReady(r), false);
    setReady(r, human.id, true);
    assert.equal(allReady(r), true, 'bots do not hold up a start');
});

test('an empty room is never ready to start', () => {
    const r = createRoom('PONY', true);
    assert.equal(allReady(r), false, 'nobody present is not everybody ready');
    addPlayer(r, null, true, '');
    assert.equal(allReady(r), false, 'bots alone cannot start a game');
});

test('the host adds and removes bots up to the player cap', () => {
    const r = createRoom('PONY', true);
    addPlayer(r, null, false, 'A');
    for (let i = 0; i < MAX_PLAYERS - 1; i++) {
        assert.ok(addBot(r), `bot ${i}`);
    }
    assert.equal(addBot(r), null, 'cannot exceed MAX_PLAYERS');
    assert.equal(removeBot(r), true);
    assert.ok(addBot(r), 'a freed seat can be refilled');
});

test('removeBot refuses when there are no bots', () => {
    const r = createRoom('PONY', true);
    addPlayer(r, null, false, 'A');
    assert.equal(removeBot(r), false);
});

test('returning to the lobby resets scores and readiness', () => {
    const r = createRoom('PONY', true);
    const a = addPlayer(r, null, false, 'A');
    setReady(r, a.id, true);
    a.wins = 2;
    toLobby(r);
    assert.equal(r.phase, PHASE.LOBBY);
    assert.equal(a.wins, 0);
    assert.equal(a.ready, false);
    assert.equal(r.rounds, 0);
});

test('the player list carries name, ready and wins', () => {
    const r = createRoom('PONY', true);
    const a = addPlayer(r, null, false, 'Tiago');
    setReady(r, a.id, true);
    a.wins = 2;
    const [row] = playerList(r);
    assert.deepEqual(row, [a.id, a.hue, 0, 'Tiago', 1, 2]);
});

test('the host role passes on when the host leaves', () => {
    const r = createRoom('PONY', true);
    const a = addPlayer(r, null, false, 'A');
    addPlayer(r, null, true, '');
    const c = addPlayer(r, null, false, 'C');
    removePlayer(r, a.id);
    assert.equal(r.hostId, c.id, 'a bot must not inherit it');
});

test('a new room starts on the open map', () => {
    assert.equal(createRoom().map, 0);
});

test('cycling the map wraps in both directions', () => {
    const r = createRoom();
    for (let i = 1; i < MAPS.length; i++) {
        cycleMap(r, 1);
        assert.equal(r.map, i);
    }
    cycleMap(r, 1);
    assert.equal(r.map, 0, 'forward past the end wraps to the start');
    cycleMap(r, -1);
    assert.equal(r.map, MAPS.length - 1, 'backward past the start wraps to the end');
});

test('the state message carries the map so the lobby can name it', () => {
    const r = createRoom('PONY', false);
    cycleMap(r, 1);
    assert.equal(stateOf(r)[4], 1);
});

test('a round is built on the room map and announces it', () => {
    const r = createRoom();
    const sent = [];
    const fakeSocket = () => ({ emit: (ev, payload) => sent.push([ev, payload]), on: () => {} });
    addPlayer(r, fakeSocket(), false);
    addPlayer(r, fakeSocket(), false);
    cycleMap(r, 1);
    cycleMap(r, 1);
    startRound(r);
    assert.equal(r.state.map.n, 'Rings', 'the simulation was built on the chosen map');
    const round = sent.find(([ev]) => ev === 'r');
    assert.ok(round, 'a round message went out');
    assert.equal(round[1][3], 2, 'and it carries the map index');
});

test('hello carries the map, so a mid-round joiner replays the right arena', () => {
    const r = roomOf(2);
    cycleMap(r, 1);
    startRound(r);
    const p = [...r.players.values()][0];
    assert.equal(helloPayload(r, p)[9], 1);
});
