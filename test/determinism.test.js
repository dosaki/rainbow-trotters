import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createState, tickSim, replay } from '../src/shared/sim.js';
import { hashGrid } from '../src/shared/arena.js';
import { ACTIVATE } from '../src/shared/constants.js';

const SPAWNS = [
    { id: 0, x: 30, y: 30, dir: 0 },
    { id: 1, x: 194, y: 30, dir: 1 },
    { id: 2, x: 194, y: 194, dir: 2 },
    { id: 3, x: 30, y: 194, dir: 3 },
];

const LOG = [];
for (let t = 1; t < 1500; t++) {
    for (let id = 0; id < 4; id++) {
        if (t % (19 + id * 7) === 0) {
            LOG.push([t, id, (t + id) % 4]);
        }
        if (t % 53 === id * 7 + 1) {
            LOG.push([t, id, ACTIVATE]);
        }
    }
}

const TICKS = 250;

const runLog = (spawns) => {
    const s = createState(1234, spawns);
    for (let t = 0; t < TICKS; t++) {
        tickSim(s, LOG.filter(([lt]) => lt === s.tick).map(([, id, d]) => [id, d]));
    }
    return s;
};

test('iteration order does not change the outcome', () => {
    const forward = runLog(SPAWNS);
    const reversed = runLog([...SPAWNS].reverse());
    assert.equal(hashGrid(forward.grid), hashGrid(reversed.grid));
    assert.equal(
        forward.unicorns.map((u) => `${u.id}:${u.alive}`).sort().join(),
        reversed.unicorns.map((u) => `${u.id}:${u.alive}`).sort().join(),
    );
});

test('the same log run twice produces identical grids', () => {
    assert.equal(hashGrid(runLog(SPAWNS).grid), hashGrid(runLog(SPAWNS).grid));
});

test('replay reconstructs the live state exactly, the mid-round join path', () => {
    const live = runLog(SPAWNS);
    const joined = replay(1234, SPAWNS, LOG, TICKS);
    assert.equal(hashGrid(joined.grid), hashGrid(live.grid));
    assert.equal(joined.tick, live.tick);
    assert.deepEqual(joined.sparkles, live.sparkles);
    assert.deepEqual(
        joined.unicorns.map((u) => [u.id, u.x, u.y, u.dir, u.alive, u.held, u.power]),
        live.unicorns.map((u) => [u.id, u.x, u.y, u.dir, u.alive, u.held, u.power]),
    );
});

test('replay to a mid-round tick matches the live state at that tick', () => {
    const s = createState(1234, SPAWNS);
    for (let t = 0; t < 137; t++) {
        tickSim(s, LOG.filter(([lt]) => lt === s.tick).map(([, id, d]) => [id, d]));
    }
    const joined = replay(1234, SPAWNS, LOG, 137);
    assert.equal(hashGrid(joined.grid), hashGrid(s.grid));
    assert.equal(joined.tick, 137);
});

test('the fixture is not vacuous, there is a real arena to compare', () => {
    const s = runLog(SPAWNS);
    const painted = s.grid.reduce((n, v) => n + (v ? 1 : 0), 0);
    assert.ok(painted > 500, `only ${painted} cells painted, comparisons above prove nothing`);
    assert.ok(s.unicorns.some((u) => !u.alive), 'nobody crashed, so death is untested');
});

test('replay stays exact across the decay boundary', () => {
    const live = createState(1234, SPAWNS);
    let sweeps = 0;
    const CROSS = 1400;
    for (let t = 0; t < CROSS; t++) {
        tickSim(live, LOG.filter(([lt]) => lt === live.tick).map(([, id, d]) => [id, d]));
        sweeps += live.events.clearedIds.length;
    }
    assert.ok(sweeps > 0, 'the fixture must actually cross a decay boundary');

    const joined = replay(1234, SPAWNS, LOG, CROSS);
    assert.deepEqual(
        joined.unicorns.map((u) => [u.id, u.deathTick, u.x, u.y, u.cells]),
        live.unicorns.map((u) => [u.id, u.deathTick, u.x, u.y, u.cells]),
    );
    assert.equal(joined.dead.length, live.dead.length);
    assert.equal(hashGrid(joined.grid), hashGrid(live.grid));
});

test('nothing under src/shared uses a non-deterministic global', () => {
    const dir = 'src/shared';
    const banned = /\b(Math\.random|Date\.now|performance\.now)\b/;
    const stripComments = (src) => src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/([^:])\/\/.*$/gm, '$1');
    for (const f of readdirSync(dir)) {
        if (!f.endsWith('.js')) continue;
        const src = stripComments(readFileSync(join(dir, f), 'utf8'));
        assert.ok(!banned.test(src), `${f} uses a non-deterministic global`);
    }
});
