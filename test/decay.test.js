import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tickSim, roundResult, unicornById } from '../src/shared/sim.js';
import { cellAt, idx, paint } from '../src/shared/arena.js';
import { DECAY_TICKS, ROUND_CAP_TICKS, BLAST, WALL, BODY, HALF, LHALF } from '../src/shared/constants.js';

const dieImmediately = () => {
    const s = createState(1, [{ id: 0, x: 1, y: 40, dir: 2 }]);
    while (unicornById(s, 0).alive && s.tick < 20) {
        tickSim(s, []);
    }
    assert.equal(unicornById(s, 0).alive, false, 'setup: expected an immediate crash');
    return s;
};

test("a dead unicorn's trail stays lethal for DECAY_TICKS then clears in one step", () => {
    const s = dieImmediately();
    const clearAt = unicornById(s, 0).deathTick + DECAY_TICKS;

    paint(s.grid, 100, 100, 0);

    while (s.tick < clearAt) {
        tickSim(s, []);
        assert.equal(s.events.cleared.length, 0, `cleared early at tick ${s.tick}`);
    }
    assert.equal(cellAt(s.grid, 100, 100), 1, 'still lethal right up to the last tick');

    tickSim(s, []);
    assert.equal(cellAt(s.grid, 100, 100), 0, 'cleared at deathTick + DECAY_TICKS');
    assert.ok(s.events.cleared.includes(idx(100, 100)), 'the cells are reported for the renderer');
    assert.deepEqual(s.events.clearedIds, [0], 'and it says WHOSE trail went, not just where');
});

test('a decayed trail is cleared exactly once', () => {
    const s = dieImmediately();
    let sweeps = 0;
    for (let i = 0; i < DECAY_TICKS * 2; i++) {
        tickSim(s, []);
        if (s.events.clearedIds.length) {
            sweeps++;
        }
    }
    assert.equal(sweeps, 1);
});

test('only the dead unicorn s trail is cleared', () => {
    const s = createState(1, [
        { id: 0, x: 1, y: 40, dir: 2 },
        { id: 1, x: 100, y: 100, dir: 0 },
    ]);
    while (unicornById(s, 0).alive && s.tick < 20) {
        tickSim(s, []);
    }
    paint(s.grid, 60, 60, 0);
    paint(s.grid, 61, 60, 1);
    for (let i = 0; i <= DECAY_TICKS; i++) {
        tickSim(s, []);
    }
    assert.equal(cellAt(s.grid, 60, 60), 0, "the dead unicorn's cell went");
    assert.equal(cellAt(s.grid, 61, 60), 2, "the other unicorn's cell stayed");
});

test('the round is live while two or more unicorns survive', () => {
    const s = createState(1, [
        { id: 0, x: 40, y: 40, dir: 0 },
        { id: 1, x: 40, y: 120, dir: 0 },
    ]);
    tickSim(s, []);
    assert.equal(roundResult(s), null);
});

test('the last unicorn alive wins', () => {
    const s = createState(1, [
        { id: 0, x: 1, y: 40, dir: 2 },
        { id: 1, x: 100, y: 100, dir: 0 },
    ]);
    while (roundResult(s) === null && s.tick < 20) {
        tickSim(s, []);
    }
    assert.deepEqual(roundResult(s), { winner: 1, reason: 'last' });
});

test('simultaneous last deaths are a draw', () => {
    const s = createState(1, [
        { id: 0, x: 10, y: 40, dir: 0 },
        { id: 1, x: 16, y: 40, dir: 2 },
    ]);
    while (roundResult(s) === null && s.tick < 20) {
        tickSim(s, []);
    }
    assert.deepEqual(roundResult(s), { winner: -1, reason: 'draw' });
});

test('the three-minute cap awards the round on cells painted', () => {
    const s = createState(1, [
        { id: 0, x: 40, y: 40, dir: 0 },
        { id: 1, x: 40, y: 120, dir: 0 },
    ]);
    s.tick = ROUND_CAP_TICKS;
    unicornById(s, 1).cells = 500;
    unicornById(s, 0).cells = 499;
    assert.deepEqual(roundResult(s), { winner: 1, reason: 'cap' });
});

test('the cap does not fire before its time', () => {
    const s = createState(1, [
        { id: 0, x: 40, y: 40, dir: 0 },
        { id: 1, x: 40, y: 120, dir: 0 },
    ]);
    s.tick = ROUND_CAP_TICKS - 1;
    assert.equal(roundResult(s), null);
});

const dieAt = (x, y, prep) => {
    const s = createState(1, [{ id: 0, x, y, dir: 0 }]);
    const face = x + LHALF + 1;
    for (let ax = face; ax <= face + BODY; ax++) {
        for (let ay = y - BODY; ay <= y + BODY; ay++) {
            paint(s.grid, ax, ay, 3);
        }
    }
    if (prep) prep(s);
    while (s.unicorns[0].alive) tickSim(s, []);
    return s;
};

test('a death destroys the trails around it', () => {
    const s = dieAt(60, 60, (g) => {
        paint(g.grid, 60, 56, 4);
        paint(g.grid, 64, 63, 5);
    });
    assert.equal(s.unicorns[0].alive, false);
    assert.equal(cellAt(s.grid, 60, 56), 0, 'a nearby trail is gone');
    assert.equal(cellAt(s.grid, 64, 63), 0, 'and so is another owner\'s');
});

test('a death leaves trails beyond its blast alone', () => {
    const far = 60 + BLAST + 4;
    const s = dieAt(60, 60, (g) => paint(g.grid, far, 60, 4));
    assert.equal(cellAt(s.grid, far, 60), 5, 'out of range, still standing');
});

test('the blast is round, so the corners of its reach survive', () => {
    const s = dieAt(60, 60, (g) => paint(g.grid, 60 + BLAST, 60 + BLAST, 4));
    assert.equal(cellAt(s.grid, 60 + BLAST, 60 + BLAST), 5, 'a corner is outside a circle');
});

test('a death does not destroy obstacles', () => {
    const s = dieAt(60, 60, (g) => paint(g.grid, 60, 58, WALL));
    assert.equal(cellAt(s.grid, 60, 58), WALL + 1, 'scenery outlives whoever hits it');
});

test('every destroyed cell is reported, or the client keeps drawing it', () => {
    const s = dieAt(60, 60, (g) => paint(g.grid, 60, 56, 4));
    assert.ok(s.events.broken.includes(idx(60, 56)),
        'an unreported cell stays on screen while being empty in the grid');
    assert.ok(s.events.broken.every((i) => s.grid[i] === 0), 'and every reported cell is really clear');
});
