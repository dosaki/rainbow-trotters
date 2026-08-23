import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';
import { createSandbox } from '../scripts/harness.mjs';
import { createState, tickSim } from '../src/shared/sim.js';
import { hashGrid } from '../src/shared/arena.js';
import { ACTIVATE } from '../src/shared/constants.js';

const tmp = mkdtempSync(join(tmpdir(), 'rr-'));
const pack = (name) => {
    const out = join(tmp, name);
    execFileSync('./node_modules/.bin/roadroller', ['-q', `public/${name}`, '-o', out]);
    return readFileSync(out, 'utf8');
};
const plain = (name) => readFileSync(`public/${name}`, 'utf8');

const SERVER = `${pack('server.js')};`;
const CLIENT = pack('client.js');

const SPAWNS = [
    { id: 0, x: 30, y: 30, dir: 0 },
    { id: 1, x: 194, y: 30, dir: 1 },
    { id: 2, x: 194, y: 194, dir: 2 },
    { id: 3, x: 30, y: 194, dir: 3 },
];

const LOG = [];
for (let t = 1; t < 400; t++) {
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
const runRound = (sim) => {
    const s = sim.createState(1234, SPAWNS);
    for (let t = 0; t < TICKS; t++) {
        sim.tickSim(s, LOG.filter(([lt]) => lt === s.tick).map(([, id, d]) => [id, d]));
    }
    return s;
};

const boot = (extra) => {
    const { sandbox, dispose } = createSandbox(extra);
    vm.runInNewContext(SERVER, sandbox);
    return { sandbox, dispose };
};

test('the packed server decodes and publishes the simulation', () => {
    const { sandbox, dispose } = boot();
    try {
        assert.equal(typeof sandbox.S, 'object',
            'the decoder ran but never assigned S, the client would load a blank global');
        assert.equal(typeof sandbox.S.createState, 'function');
        assert.equal(typeof sandbox.S.tickSim, 'function');
        assert.equal(sandbox.S.BODY, 3);
    } finally {
        dispose();
    }
});

test('the packed server exports an io handler', () => {
    const { sandbox, dispose } = boot({ storage: {}, io: {} });
    try {
        const exported = sandbox.module.exports;
        const handler = typeof exported === 'function' ? exported : exported.io;
        assert.equal(typeof handler, 'function', 'the host would find no connection handler');
    } finally {
        dispose();
    }
});

test('the packed simulation agrees with the source, tick for tick', () => {
    const { sandbox, dispose } = boot();
    try {
        const packed = runRound(sandbox.S);
        const source = runRound({ createState, tickSim });

        assert.equal(hashGrid(packed.grid), hashGrid(source.grid),
            'the packed arena diverged from the source, every client would desync');
        assert.equal(packed.tick, source.tick);
        const riders = (s) => Array.from(s.unicorns,
            (u) => [u.id, u.x, u.y, u.dir, u.alive, u.deathTick, u.cells, u.held, u.power]);
        assert.deepEqual(riders(packed), riders(source));

        const sparkle = (s) => Array.from(s.sparkles, (k) => [k.i, k.type, k.x, k.y]);
        assert.deepEqual(sparkle(packed), sparkle(source), 'the packed rng diverged');
        assert.equal(packed.nextSparkle, source.nextSparkle);

        const painted = source.grid.reduce((n, v) => n + (v ? 1 : 0), 0);
        assert.ok(painted > 500, `only ${painted} cells painted, the comparison proves nothing`);
        assert.ok(source.unicorns.some((u) => !u.alive), 'nobody crashed, so death went uncompared');
        assert.ok(source.unicorns.some((u) => u.alive), 'everyone crashed, so most of the round went uncompared');
        assert.ok(source.sparkles.length, 'no sparkle spawned, so the rng went uncompared');
    } finally {
        dispose();
    }
});

test('the guard survives packing, a browser gets S and starts no server', () => {
    const box = { console, document: {}, module: {} };
    vm.runInNewContext(SERVER, box);
    assert.ok(box.S && box.S.createState, 'the client still needs the sim from this file');
    assert.equal(box.module.exports, undefined,
        'packing lost the guard, every browser would run a second server, ticking forever');
});

test('the packed server is terminated, so concatenating onto it is safe', () => {
    const { sandbox, dispose } = createSandbox();
    try {
        vm.runInNewContext(`${SERVER}\n(() => { globalThis.ok = 1; })()`, sandbox);
        assert.equal(sandbox.ok, 1, 'the packed file ends in an unterminated call expression');
    } finally {
        dispose();
    }
});

test('the packed client parses and is safe to inline in index.html', () => {
    assert.doesNotThrow(() => new vm.Script(CLIENT), 'the packed client is not valid JavaScript');
    for (const hazard of ['</script', '<!--']) {
        assert.ok(!CLIENT.includes(hazard),
            `the packed client contains ${hazard}, inlining it would end the tag early and the game would never run`);
    }
});

test('packing actually shrank both bundles', () => {
    for (const [name, packed] of [['server.js', SERVER], ['client.js', CLIENT]]) {
        const before = plain(name).length;
        assert.ok(packed.length < before,
            `${name} got no smaller (${before} -> ${packed.length}), roadroller is a no-op or a loss here`);
    }
});
