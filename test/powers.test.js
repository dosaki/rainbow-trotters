import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tickSim, unicornById } from '../src/shared/sim.js';
import { grantPower, breakSwath, isGhost } from '../src/shared/powers.js';
import { cellAt, paint, createArena, idx } from '../src/shared/arena.js';
import { GHOST, BREAK, SPEED, POWER_TICKS, BODY, HALF, LHALF, STEP_COST, STEP_GAIN, WALL, TICK_MS } from '../src/shared/constants.js';

const STEP_TICKS = STEP_COST / STEP_GAIN;
const step = (s, cells = 1) => {
    for (let i = 0; i < cells * STEP_TICKS; i++) {
        tickSim(s, []);
    }
};

const wallAt = (grid, x, y0, y1, id = 5) => {
    for (let y = y0; y <= y1; y++) {
        paint(grid, x, y, id);
    }
};

const AHEAD = LHALF + 1;
const band = (mid) => {
    const out = [];
    for (let y = mid - HALF; y <= mid + HALF; y++) {
        out.push(y);
    }
    return out;
};

test('a power lasts three seconds, whatever the tick rate', () => {
    assert.equal(POWER_TICKS * TICK_MS, 3000);
});

test('granting a power replaces whatever was active', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 10, dir: 0 }]);
    const u = unicornById(s, 0);
    grantPower(u, GHOST);
    assert.equal(u.power, GHOST);
    assert.equal(u.powerTicks, POWER_TICKS);
    u.powerTicks = 5;
    grantPower(u, SPEED);
    assert.equal(u.power, SPEED);
    assert.equal(u.powerTicks, POWER_TICKS);
});

test('a power expires after exactly POWER_TICKS ticks', () => {
    const s = createState(1, [{ id: 0, x: 5, y: 5, dir: 1 }]);
    const u = unicornById(s, 0);
    grantPower(u, GHOST);
    for (let i = 0; i < POWER_TICKS - 1; i++) {
        tickSim(s, []);
    }
    assert.equal(isGhost(u), true);
    tickSim(s, []);
    assert.equal(u.power, 0);
});

test('ghost passes through a wall and paints nothing while doing it', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    wallAt(s.grid, 12, 38, 42);
    const u = unicornById(s, 0);
    grantPower(u, GHOST);
    step(s);
    assert.equal(u.alive, true);
    assert.equal(u.x, 11);
    assert.equal(cellAt(s.grid, 12, 40), 6, "the other player's wall must survive");
    step(s);
    assert.equal(cellAt(s.grid, 13, 40), 0, 'ghosting leaves no trail');
});

test('ghost expiring inside a wall does not itself kill; the next step decides', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    const u = unicornById(s, 0);
    wallAt(s.grid, 10 + AHEAD, 40 - BODY, 40 + BODY);
    wallAt(s.grid, 11 + AHEAD, 40 - BODY, 40 + BODY);
    grantPower(u, GHOST);
    u.powerTicks = STEP_TICKS;
    step(s);
    assert.equal(u.alive, true, 'survives the ghosted move into the wall');
    assert.equal(u.power, 0);
    step(s);
    assert.equal(u.alive, false, 'the next step collides normally');
});

test('ghost expiring inside a wall lets you escape into free space', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    const u = unicornById(s, 0);
    wallAt(s.grid, 10 + AHEAD, 40 - BODY, 40 + BODY);
    grantPower(u, GHOST);
    u.powerTicks = STEP_TICKS;
    step(s);
    assert.equal(u.power, 0);
    step(s);
    assert.equal(u.alive, true);
    assert.equal(cellAt(s.grid, 11 + AHEAD, 40), 1, 'painting resumes on escape');
});

test('breakSwath clears two body-widths of flank on each side of the leading face', () => {
    const g = createArena();
    const reach = HALF + BODY * 2;
    for (let y = 40 - reach; y <= 40 + reach; y++) {
        paint(g, 10 + AHEAD, y, 4);
    }
    const cleared = breakSwath(g, 10, 40, 0);
    assert.equal(cleared.length, reach * 2 + 1);
    for (let y = 40 - reach; y <= 40 + reach; y++) {
        assert.equal(cellAt(g, 10 + AHEAD, y), 0, `cleared (${10 + AHEAD},${y})`);
    }
    assert.ok(cleared.includes(idx(10 + AHEAD, 40)));
    const flank = (cleared.length - BODY) / 2;
    assert.equal(flank, BODY * 2, 'a follower needs room to steer, not just to fit');
});

test('the corridor is wide enough for another body to follow through', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    const u = unicornById(s, 0);
    for (let y = 20; y <= 60; y++) {
        paint(s.grid, 10 + AHEAD, y, 4);
    }
    grantPower(u, BREAK);
    step(s);
    const trail = band(40);
    for (let y = 40 - HALF - 1; y <= 40 + HALF + 1; y++) {
        if (trail.includes(y)) continue;
        assert.equal(cellAt(s.grid, 10 + AHEAD, y), 0, `flank (${10 + AHEAD},${y}) must be open`);
    }
    let above = 0;
    for (let y = 40 - HALF - 1; y >= 20 && cellAt(s.grid, 10 + AHEAD, y) === 0; y--) {
        above++;
    }
    assert.ok(above >= BODY, `only ${above} clear cells above the trail; need ${BODY}`);
});

test('wall break paints its own trail down the middle of the corridor', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    const u = unicornById(s, 0);
    for (let y = 20; y <= 60; y++) {
        paint(s.grid, 10 + AHEAD, y, 4);
    }
    grantPower(u, BREAK);
    step(s);
    assert.equal(u.alive, true);
    for (const y of band(40)) {
        assert.equal(cellAt(s.grid, 10 + AHEAD, y), 1, 'own trail stands in it');
    }
    assert.ok(s.events.broken.length >= BODY);
});

test('wall break destroys your own trail too', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    const u = unicornById(s, 0);
    paint(s.grid, 10 + AHEAD, 40 + HALF + 2, 0);
    grantPower(u, BREAK);
    step(s);
    assert.equal(cellAt(s.grid, 10 + AHEAD, 40 + HALF + 2), 0);
});

test('the arena boundary is not destructible', () => {
    const s = createState(1, [{ id: 0, x: LHALF + 1, y: 40, dir: 2 }]);
    const u = unicornById(s, 0);
    grantPower(u, BREAK);
    step(s);
    assert.equal(u.x, LHALF);
    step(s);
    assert.equal(u.alive, false, 'breaking does not let you leave the arena');
});

test('a boosted unicorn still cannot pass through a wall', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 40, dir: 0 }]);
    const u = unicornById(s, 0);
    grantPower(u, SPEED);
    wallAt(s.grid, 16, 20, 60, 7);
    for (let i = 0; i < 40 && u.alive; i++) {
        tickSim(s, []);
    }
    assert.equal(u.alive, false);
    assert.ok(u.x < 16, 'it died at the wall rather than crossing it');
    assert.equal(cellAt(s.grid, 16, 60), 8, 'and carved no hole beyond its death blast');
});

test('no unicorn ever advances more than one cell in a tick', () => {
    const s = createState(1, [{ id: 0, x: 10, y: 112, dir: 0 }]);
    const u = unicornById(s, 0);
    grantPower(u, SPEED);
    let prev = u.x;
    for (let i = 0; i < POWER_TICKS; i++) {
        tickSim(s, []);
        assert.ok(u.x - prev <= 1, `jumped ${u.x - prev} cells in one tick`);
        prev = u.x;
    }
});

const blockAt = (grid, x0, y0) => {
    for (let y = y0; y < y0 + 8; y++) {
        for (let x = x0; x < x0 + 8; x++) {
            paint(grid, x, y, WALL);
        }
    }
};

const runInto = (power) => {
    const s = createState(1, [{ id: 0, x: 30, y: 30, dir: 0 }]);
    blockAt(s.grid, 50, 26);
    const u = s.unicorns[0];
    if (power) {
        grantPower(u, power);
    }
    for (let t = 0; t < 60 && u.alive; t++) {
        tickSim(s, []);
    }
    return { s, u };
};

test('driving into an obstacle kills you', () => {
    const { u } = runInto(0);
    assert.equal(u.alive, false);
    assert.ok(u.x < 50, 'died at the wall, not past it');
});

test('Wall Break stops at an obstacle instead of carving it', () => {
    const { s, u } = runInto(BREAK);
    assert.equal(u.alive, false, 'a breaker does not phase through scenery');
    assert.equal(cellAt(s.grid, 52, 30), WALL + 1, 'the wall is still standing');
});

test('Ghost passes through an obstacle without destroying it', () => {
    const s = createState(1, [{ id: 0, x: 30, y: 30, dir: 0 }]);
    blockAt(s.grid, 50, 26);
    const u = s.unicorns[0];
    grantPower(u, GHOST);
    for (let t = 0; t < 80; t++) {
        tickSim(s, []);
    }
    assert.equal(u.alive, true);
    assert.ok(u.x > 58, 'ghosted clean through');
    assert.equal(cellAt(s.grid, 52, 30), WALL + 1, 'the wall is untouched');
});

test('breakSwath carves trail cells but leaves wall cells standing', () => {
    const g = createArena();
    const face = 30 + LHALF + 1;
    paint(g, face, 30 - 2, 3);
    paint(g, face, 30 + 2, WALL);
    const cleared = breakSwath(g, 30, 30, 0);
    assert.equal(cellAt(g, face, 30 - 2), 0, 'the trail was carved');
    assert.equal(cellAt(g, face, 30 + 2), WALL + 1, 'the wall was not');
    assert.ok(!cleared.includes(idx(face, 30 + 2)),
        'a wall index must not be reported as cleared, or the client erases it');
    assert.ok(cleared.includes(idx(face, 30 - 2)));
});

test('a decaying trail leaves obstacles untouched', () => {
    const s = createState(1, [{ id: 0, x: 30, y: 30, dir: 0 }]);
    blockAt(s.grid, 50, 26);
    for (let t = 0; t < 500; t++) {
        tickSim(s, []);
    }
    assert.equal(cellAt(s.grid, 52, 30), WALL + 1,
        'clearOwner only ever runs for ids 0..7, so nothing clears owner 8');
});
