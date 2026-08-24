import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tickSim, aliveCount, unicornById } from '../src/shared/sim.js';
import { cellAt } from '../src/shared/arena.js';
import { W, H, BODY, HALF, LHALF, STEP_COST, STEP_GAIN, TICK_MS } from '../src/shared/constants.js';

const STEP_TICKS = STEP_COST / STEP_GAIN;

const spawn = (over = []) => createState(1, [
    { id: 0, x: 10, y: 10, dir: 0 },
    ...over,
]);

const run = (s, ticks, turns = []) => {
    for (let i = 0; i < ticks; i++) {
        tickSim(s, i === 0 ? turns : []);
    }
};

test('the tick rate and the movement speed are independent', () => {
    assert.equal(STEP_TICKS, 2);
    assert.equal(1000 / TICK_MS / STEP_TICKS, 20);
});

test('a unicorn advances one cell every STEP_TICKS and paints its leading face', () => {
    const s = spawn();
    tickSim(s, []);
    assert.equal(unicornById(s, 0).x, 10, 'accumulating, not yet moved');
    tickSim(s, []);
    const u = unicornById(s, 0);
    assert.equal(u.x, 11);
    assert.equal(u.y, 10);
    for (const y of [9, 10, 11]) {
        assert.equal(cellAt(s.grid, 12, y), 1, `face cell (12,${y})`);
    }
    assert.equal(s.tick, 2);
});

test('the spawn footprint is painted, not just the centre', () => {
    const s = spawn();
    for (let y = 9; y <= 11; y++) {
        for (let x = 9; x <= 11; x++) {
            assert.equal(cellAt(s.grid, x, y), 1, `spawn cell (${x},${y})`);
        }
    }
});

test('the trail is a continuous band with no gaps behind the body', () => {
    const s = spawn();
    run(s, 8);
    const u = unicornById(s, 0);
    assert.equal(u.x, 10 + 8 / STEP_TICKS);
    for (let x = 10 - LHALF; x <= u.x + LHALF; x++) {
        for (let y = 10 - HALF; y <= 10 + HALF; y++) {
            assert.equal(cellAt(s.grid, x, y), 1, `band cell (${x},${y})`);
        }
    }
    assert.equal(cellAt(s.grid, u.x + LHALF + 1, 10), 0, 'and nothing painted beyond it');
});

test('turns apply at the start of the tick they arrive on', () => {
    const s = spawn();
    tickSim(s, [[0, 1]]);
    assert.equal(unicornById(s, 0).dir, 1, 'the heading changes immediately');
    tickSim(s, []);
    const u = unicornById(s, 0);
    assert.equal(u.x, 10);
    assert.equal(u.y, 11);
});

test('a reversing turn is ignored', () => {
    const s = spawn();
    run(s, STEP_TICKS, [[0, 2]]);
    assert.equal(unicornById(s, 0).x, 11);
});

test('looping back into your own band kills you', () => {
    const s = spawn();
    const plan = { 12: 1, 20: 2, 30: 3 };
    let t = 0;
    while (unicornById(s, 0).alive && t < 200) {
        t++;
        tickSim(s, plan[t] === undefined ? [] : [[0, plan[t]]]);
    }
    assert.equal(unicornById(s, 0).alive, false, 'a closed loop must end in a crash');
    assert.ok(t < 200, `died at tick ${t}`);
});

test('the whole body must fit inside the arena, not just the centre', () => {
    const last = W - 1 - LHALF;
    const s = createState(1, [{ id: 0, x: last - 1, y: LHALF + 3, dir: 0 }]);
    run(s, STEP_TICKS);
    assert.equal(unicornById(s, 0).alive, true, `centre ${last} still fits`);
    assert.equal(unicornById(s, 0).x, last);
    run(s, STEP_TICKS);
    assert.equal(unicornById(s, 0).alive, false, 'one more would hang the body over the edge');
    assert.equal(aliveCount(s), 0);
});

test('two unicorns whose bodies overlap both die, even landing on different cells', () => {
    const gap = LHALF * 2 + 3;
    const s = createState(1, [
        { id: 0, x: 10, y: 40, dir: 0 },
        { id: 1, x: 10 + gap, y: 40, dir: 2 },
    ]);
    run(s, STEP_TICKS);
    assert.equal(unicornById(s, 0).alive, true, 'one step apart they are still clear');
    assert.equal(unicornById(s, 1).alive, true);
    run(s, STEP_TICKS);
    assert.equal(unicornById(s, 0).alive, false);
    assert.equal(unicornById(s, 1).alive, false);
});

test('a dead unicorn stops moving but its trail stays lethal', () => {
    const s = createState(1, [
        { id: 0, x: 30, y: 5, dir: 2 },
        { id: 1, x: 40, y: 40, dir: 0 },
    ]);
    run(s, STEP_TICKS * 30);
    const dead = unicornById(s, 0);
    assert.equal(dead.alive, false);
    const at = { x: dead.x, y: dead.y };
    run(s, STEP_TICKS * 2);
    assert.deepEqual({ x: dead.x, y: dead.y }, at);
    assert.equal(cellAt(s.grid, 30, 5), 1, 'the wreck is still a wall beyond the blast');
});

test('painting is independent of the order unicorns are listed in', () => {
    const mk = (order) => {
        const s = createState(1, order);
        run(s, 10);
        return s.grid.join(',');
    };
    const a = [{ id: 0, x: 10, y: 10, dir: 0 }, { id: 1, x: 40, y: 40, dir: 1 }];
    assert.equal(mk(a), mk([a[1], a[0]]));
});

test('a body is BODY cells across and HALF is consistent with it', () => {
    assert.equal(BODY, HALF * 2 + 1);
    assert.ok(W >= BODY * 8 && H >= BODY * 8);
});
