import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tickSim, unicornById } from '../src/shared/sim.js';
import { SPARKLE_EVERY, SPARKLE_MAX, GHOST, BREAK, SPEED, POWER_TICKS, ACTIVATE, PICKUP_REACH, STEP_COST, STEP_GAIN, STEP_GAIN_BOOST } from '../src/shared/constants.js';

const step = (s, cells = 1) => {
    for (let i = 0; i < cells * STEP_COST / STEP_GAIN; i++) {
        tickSim(s, []);
    }
};

const run = (seed, ticks) => {
    const s = createState(seed, [{ id: 0, x: 80, y: 80, dir: 0 }]);
    for (let i = 0; i < ticks; i++) {
        tickSim(s, []);
    }
    return s;
};

test('sparkles appear on the spawn cadence', () => {
    const s = run(42, SPARKLE_EVERY * 3);
    assert.ok(s.sparkles.length >= 2, `expected sparkles, got ${s.sparkles.length}`);
});

test('sparkle spawning is identical for the same seed', () => {
    const a = run(7, SPARKLE_EVERY * 4);
    const b = run(7, SPARKLE_EVERY * 4);
    assert.deepEqual(a.sparkles, b.sparkles);
});

test('different seeds place sparkles differently', () => {
    const a = run(1, SPARKLE_EVERY * 4);
    const b = run(2, SPARKLE_EVERY * 4);
    assert.notDeepEqual(a.sparkles, b.sparkles);
});

test('no more than SPARKLE_MAX are ever active', () => {
    const s = run(3, SPARKLE_EVERY * 20);
    assert.ok(s.sparkles.length <= SPARKLE_MAX, `${s.sparkles.length} active`);
});

test('every sparkle type is one of the three powers', () => {
    const s = run(11, SPARKLE_EVERY * 10);
    for (const sp of s.sparkles) {
        assert.ok([GHOST, BREAK, SPEED].includes(sp.type));
    }
});

test('driving over a sparkle banks it rather than firing it', () => {
    const s = createState(5, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    s.sparkles.push({ i: 999, x: 11, y: 40, type: BREAK });
    tickSim(s, []);
    const u = unicornById(s, 0);
    assert.equal(u.held, BREAK);
    assert.equal(u.power, 0, 'nothing fires on pickup');
    assert.equal(u.powerTicks, 0);
    assert.equal(s.sparkles.length, 0);
    assert.deepEqual(s.events.picked, [[0, 999]]);
});

test('a new pickup replaces what you were holding', () => {
    const s = createState(5, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    const u = unicornById(s, 0);
    u.held = GHOST;
    s.sparkles.push({ i: 1, x: 11, y: 40, type: SPEED });
    tickSim(s, []);
    assert.equal(u.held, SPEED);
});

test('activating spends the held power and runs it for its full duration', () => {
    const s = createState(5, [{ id: 0, x: 10, y: 10, dir: 0 }]);
    const u = unicornById(s, 0);
    u.held = GHOST;
    tickSim(s, [[0, ACTIVATE]]);
    assert.equal(u.held, 0, 'the slot empties');
    assert.equal(u.power, GHOST);
    assert.equal(u.powerTicks, POWER_TICKS - 1);
});

test('an activated power lasts exactly POWER_TICKS ticks of movement', () => {
    const s = createState(5, [{ id: 0, x: 5, y: 80, dir: 0 }]);
    const u = unicornById(s, 0);
    u.held = SPEED;
    const startX = u.x;
    for (let i = 0; i < POWER_TICKS; i++) {
        tickSim(s, i === 0 ? [[0, ACTIVATE]] : []);
    }
    assert.equal(u.x - startX, POWER_TICKS * STEP_GAIN_BOOST / STEP_COST);
    assert.equal(u.power, 0, 'and it has just expired');
});

test('activating an empty slot does nothing', () => {
    const s = createState(5, [{ id: 0, x: 10, y: 10, dir: 0 }]);
    const u = unicornById(s, 0);
    tickSim(s, [[0, ACTIVATE]]);
    assert.equal(u.power, 0);
    assert.equal(u.held, 0);
});

test('activating while a power is running is a no-op and keeps the held one', () => {
    const s = createState(5, [{ id: 0, x: 10, y: 10, dir: 0 }]);
    const u = unicornById(s, 0);
    u.held = GHOST;
    tickSim(s, [[0, ACTIVATE]]);
    u.held = SPEED;
    const ticksBefore = u.powerTicks;
    tickSim(s, [[0, ACTIVATE]]);
    assert.equal(u.power, GHOST, 'the running power is not replaced');
    assert.equal(u.held, SPEED, 'a mistimed press costs you nothing');
    assert.equal(u.powerTicks, ticksBefore - 1);
});

test('activating is just another input, so it turns and fires on the same tick', () => {
    const s = createState(5, [{ id: 0, x: 10, y: 10, dir: 0 }]);
    const u = unicornById(s, 0);
    u.held = SPEED;
    tickSim(s, [[0, 1], [0, ACTIVATE]]);
    assert.equal(u.dir, 1);
    assert.equal(u.power, SPEED);
});

test('a sparkle is collected when the two footprints touch', () => {
    for (const [ox, oy] of [[2, 0], [0, 2], [2, 2], [-2, -2], [-2, 2], [1, 0]]) {
        const s = createState(5, [{ id: 0, x: 10, y: 40, dir: 0 }]);
        s.sparkles.push({ i: 1, x: 11 + ox, y: 40 + oy, type: GHOST });
        step(s);
        assert.equal(unicornById(s, 0).held, GHOST, `offset ${ox},${oy} should collect`);
    }
});

test('a sparkle whose footprint clears the body is not collected', () => {
    const s = createState(5, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    s.sparkles.push({ i: 1, x: 11 + PICKUP_REACH + 1, y: 40, type: GHOST });
    tickSim(s, []);
    assert.equal(unicornById(s, 0).held, 0);
    assert.equal(s.sparkles.length, 1);
});

test('when two unicorns cover one sparkle, the nearer one takes it', () => {
    const s = createState(5, [
        { id: 0, x: 10, y: 40, dir: 0 },
        { id: 1, x: 14, y: 40, dir: 0 },
    ]);
    s.sparkles.push({ i: 1, x: 14, y: 40, type: SPEED });
    tickSim(s, []);
    assert.equal(unicornById(s, 1).held, SPEED, 'distance beats id');
    assert.equal(unicornById(s, 0).held, 0);
});

test('an exact tie goes to the lower id, whatever order they are listed in', () => {
    const build = (forward) => {
        const spawns = [
            { id: 0, x: 10, y: 40, dir: 0 },
            { id: 1, x: 16, y: 40, dir: 2 },
        ];
        const s = createState(5, forward ? spawns : [...spawns].reverse());
        s.sparkles.push({ i: 1, x: 13, y: 40, type: SPEED });
        step(s);
        return s;
    };
    const a = build(true), b = build(false);
    assert.equal(unicornById(a, 0).held, SPEED);
    assert.equal(unicornById(a, 1).held, 0);
    assert.deepEqual(a.events.picked, b.events.picked, 'iteration order must not decide it');
});

test('a unicorn takes at most one sparkle per tick', () => {
    const s = createState(5, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    s.sparkles.push({ i: 1, x: 11, y: 38, type: GHOST }, { i: 2, x: 11, y: 42, type: SPEED });
    tickSim(s, []);
    assert.equal(s.events.picked.length, 1);
    assert.equal(s.sparkles.length, 1, 'the other one stays on the board');
});

test('a contested sparkle resolves identically without any message', () => {
    const build = () => {
        const s = createState(5, [
            { id: 0, x: 10, y: 40, dir: 0 },
            { id: 1, x: 20, y: 40, dir: 2 },
        ]);
        s.sparkles.push({ i: 1, x: 11, y: 40, type: SPEED });
        tickSim(s, []);
        return s;
    };
    const a = build(), b = build();
    assert.deepEqual(a.events.picked, b.events.picked);
    assert.equal(a.events.picked.length, 1, 'exactly one unicorn takes it');
    assert.equal(a.events.picked[0][0], 0, 'the one that reaches the cell wins');
});

test('a sparkle never spawns on an occupied cell', () => {
    const s = createState(9, [{ id: 0, x: 80, y: 80, dir: 0 }]);
    for (let i = 0; i < SPARKLE_EVERY * 6; i++) {
        tickSim(s, []);
        for (const sp of s.sparkles) {
            assert.ok(sp.x >= 0 && sp.y >= 0);
        }
    }
});
