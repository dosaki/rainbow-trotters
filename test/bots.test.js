import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tickSim, unicornById, aliveCount } from '../src/shared/sim.js';
import { createArena, paint, spawnSlot } from '../src/shared/arena.js';
import { rngFrom } from '../src/shared/rng.js';
import { freeAhead, openness } from '../src/server/bots/vision.js';
import { botInputs } from '../src/server/bots/bot.js';
import { createRoom, addPlayer, addHuman, addBot, startRound, advance, playerList, humansIn } from '../src/server/room.js';
import { MIN_PLAYERS, MAX_PLAYERS, ACTIVATE, GHOST, BODY, W, H, COUNTDOWN_TICKS } from '../src/shared/constants.js';
import { PHASE } from '../src/shared/protocol.js';

const wall = (g, x, y0, y1, id = 5) => {
    for (let y = y0; y <= y1; y++) {
        paint(g, x, y, id);
    }
};

test('freeAhead counts steps and stops at a wall', () => {
    const g = createArena();
    wall(g, 13, 30, 50);
    assert.equal(freeAhead(g, 10, 40, 0, 10), 1);
});

test('freeAhead refuses a gap narrower than the body', () => {
    const g = createArena();
    for (let y = 0; y < H; y++) {
        if (y !== 40) {
            paint(g, 13, y, 5);
        }
    }
    assert.equal(freeAhead(g, 10, 40, 0, 10), 1, 'a 1-cell hole is not a way through');
});

test('freeAhead stops at the arena edge before the body hangs off', () => {
    const g = createArena();
    const n = freeAhead(g, W - 6, 40, 0, 20);
    assert.ok(n >= 1 && n <= 4, `expected to run out near the wall, got ${n}`);
});

test('openness prefers the roomier side', () => {
    const g = createArena();
    wall(g, 14, 0, 90);
    assert.ok(openness(g, 10, 40, 3) > openness(g, 10, 40, 0));
});

test('openness rejects a direction that is blocked right now', () => {
    const g = createArena();
    wall(g, 12, 30, 50);
    assert.equal(openness(g, 10, 40, 0), -1);
});

test('a bot facing a wall turns rather than driving into it', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    wall(s.grid, 14, 0, 90);
    const out = botInputs(s, unicornById(s, 0), rngFrom(1));
    const dir = out.find((i) => i !== ACTIVATE);
    assert.ok(dir === 1 || dir === 3, `expected a turn, got ${JSON.stringify(out)}`);
});

test('a bot in open space usually holds its course', () => {
    const s = createState(1, [{ id: 0, x: 112, y: 112, dir: 0 }]);
    const rng = rngFrom(5);
    let holds = 0;
    for (let i = 0; i < 50; i++) {
        if (botInputs(s, unicornById(s, 0), rng).length === 0) {
            holds++;
        }
    }
    assert.ok(holds > 30, `bot is too twitchy: held only ${holds}/50`);
});

test('a bot never chooses an illegal reversal', () => {
    const s = createState(1, [{ id: 0, x: 112, y: 112, dir: 0 }]);
    const rng = rngFrom(3);
    for (let i = 0; i < 300; i++) {
        for (const input of botInputs(s, unicornById(s, 0), rng)) {
            assert.notEqual(input, 2, 'never reverses');
        }
    }
});

test('a bot spends a banked escape when boxed in, not in open space', () => {
    const boxed = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    unicornById(boxed, 0).held = GHOST;
    wall(boxed.grid, 12, 0, 90);
    assert.ok(botInputs(boxed, unicornById(boxed, 0), rngFrom(1)).includes(ACTIVATE),
        'should spend an escape with a wall in its face');

    const open = createState(1, [{ id: 0, x: 112, y: 112, dir: 0 }]);
    unicornById(open, 0).held = GHOST;
    const rng = rngFrom(1);
    let spent = 0;
    for (let i = 0; i < 40; i++) {
        if (botInputs(open, unicornById(open, 0), rng).includes(ACTIVATE)) {
            spent++;
        }
    }
    assert.equal(spent, 0, 'must not burn an escape in open space');
});

test('bots survive a long while instead of dying instantly', () => {
    const spawns = Array.from({ length: 4 }, (_, i) => ({ id: i, ...spawnSlot(i, 4) }));
    const s = createState(77, spawns);
    const rng = rngFrom(77);
    let t = 0;
    while (aliveCount(s) > 1 && t < 3600) {
        const turns = [];
        for (const u of s.unicorns) {
            if (!u.alive) continue;
            for (const input of botInputs(s, u, rng)) {
                turns.push([u.id, input]);
            }
        }
        tickSim(s, turns);
        t++;
    }
    assert.ok(t > 200, `bots died after only ${t} ticks, they should last longer`);
});

test('a human joining a bot-filled room evicts a bot rather than being refused', () => {
    const r = createRoom();
    for (let i = 0; i < MIN_PLAYERS; i++) {
        addBot(r);
    }
    for (let i = 0; i < MAX_PLAYERS - MIN_PLAYERS; i++) {
        assert.ok(addHuman(r, null), `human ${i} should get a seat`);
    }
    assert.equal(r.players.size, MAX_PLAYERS);
    const botsBefore = [...r.players.values()].filter((p) => p.bot).length;
    assert.ok(botsBefore > 0, 'setup: expected bots still present');
    assert.ok(addHuman(r, null), 'a human must never be turned away while a bot holds a seat');
    assert.equal(r.players.size, MAX_PLAYERS);
    assert.equal([...r.players.values()].filter((p) => p.bot).length, botsBefore - 1);
});

test('a full room of humans refuses another human', () => {
    const r = createRoom();
    for (let i = 0; i < MAX_PLAYERS; i++) {
        addHuman(r, null);
    }
    assert.equal([...r.players.values()].filter((p) => p.bot).length, 0);
    assert.equal(addHuman(r, null), null);
});

test('a round starts with exactly who is in the room', () => {
    const r = createRoom();
    addPlayer(r, null, false, 'A');
    addBot(r);
    startRound(r);
    assert.equal(r.state.unicorns.length, 2,
        'bots are the host\'s business now; nothing tops the room up behind their back');
});

test('a lone human plus bots produces a real race, not an instant draw', () => {
    const r = createRoom();
    addPlayer(r, null, false, 'A');
    for (let i = 0; i < 3; i++) {
        addBot(r);
    }
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS + 200; i++) {
        advance(r);
    }
    assert.ok(r.state.tick > 100, `race ended after only ${r.state.tick} ticks`);
});

test('a turn and an activation aimed at the same tick both survive', () => {
    const r = createRoom();
    const p = addPlayer(r, null, false, 'A');
    addBot(r);
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(r);
    }
    p.pending.push([r.state.tick, 1], [r.state.tick, ACTIVATE]);
    const before = r.turnLog.length;
    advance(r);
    assert.equal(r.turnLog.length - before, 2, 'a single pending slot would have dropped one');
});

test('a round ends the moment every human is out, rather than letting bots race on', () => {
    const r = createRoom();
    const human = addHuman(r, null);
    for (let i = 0; i < 3; i++) {
        addBot(r);
    }
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(r);
    }
    const me = r.state.unicorns.find((u) => u.id === human.id);
    me.alive = false;
    me.deathTick = r.state.tick;
    const aliveBots = r.state.unicorns.filter((u) => u.alive).length;
    assert.ok(aliveBots >= 2, 'setup: bots should still be racing');
    advance(r);
    assert.equal(r.phase, PHASE.RESULTS, 'a bots-only race is entertainment for nobody');
});

test('a round with a human still alive keeps going', () => {
    const r = createRoom();
    addHuman(r, null);
    for (let i = 0; i < 3; i++) {
        addBot(r);
    }
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS + 5; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.RACE);
});

test('an empty room does not end rounds instantly', () => {
    const r = createRoom();
    for (let i = 0; i < 3; i++) {
        addBot(r);
    }
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS + 30; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.RACE, 'with nobody watching the rule must not apply');
});

test('the player list tells the client which unicorns are filler', () => {
    const r = createRoom();
    addHuman(r, null);
    startRound(r);
    const list = playerList(r);
    assert.equal(list.length, r.players.size);
    const [id, hue, bot, name, ready, wins] = list[0];
    assert.deepEqual([id, bot, ready, wins], [0, 0, 0, 0], 'the human is not flagged as a bot');
    assert.ok(typeof hue === 'number' && typeof name === 'string');
    assert.ok(list.slice(1).every(([, , b]) => b === 1));
    assert.deepEqual([...humansIn(r)], [0], 'only racing humans keep a round alive');
});

test('someone who joins mid-race does not count as a racing human', () => {
    const r = createRoom();
    const first = addHuman(r, null);
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(r);
    }
    const late = addHuman(r, null);
    assert.ok(late, 'setup: a second human should get a seat');
    assert.equal(humansIn(r).has(late.id), false, 'they have no unicorn this round');
    assert.equal(humansIn(r).has(first.id), true);
});
