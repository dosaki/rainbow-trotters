import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { createSandbox } from '../scripts/harness.mjs';

test('the build produces all four public files', () => {
    for (const f of ['index.html', 'shared.js', 'client.js', 'server.js']) {
        assert.ok(existsSync(`public/${f}`), `missing public/${f}`);
    }
});

test('shared.js publishes S, and survives being concatenated', async () => {
    const vm = await import('node:vm');
    const shared = readFileSync('public/shared.js', 'utf8');
    const box = { console };
    vm.runInNewContext(shared, box);
    assert.equal(typeof box.S, 'object', 'shared.js must publish S');
    assert.ok(box.S.createState, 'and it must be the simulation');

    const after = { console };
    vm.runInNewContext(`${shared}\n(() => { globalThis.ok = 1; })()`, after);
    assert.equal(after.ok, 1, 'shared.js is not safe to concatenate');
});

test('the sim is bundled exactly once, not copied into client and server', () => {
    const shared = statSync('public/shared.js').size;

    const server = readFileSync('public/server.js', 'utf8');
    assert.match(server, /\bS\b/, 'server.js should reference the global S');

    assert.ok(!server.includes('Unicorn '),
        'server.js contains a string that only exists in the sim, check the webpack externals');

    assert.ok(statSync('public/client.js').size < shared * 2,
        'client.js looks like it inlined the sim');
});

test('server.js uses no global the sandbox does not provide', () => {
    const src = readFileSync('public/server.js', 'utf8');
    for (const banned of ['require(', 'process.', 'globalThis.', '__dirname', 'window.']) {
        assert.ok(!src.includes(banned), `server.js references ${banned}, which the sandbox lacks`);
    }
});

test('server.js exports an io handler the harness can find', async () => {
    const vm = await import('node:vm');
    const { sandbox, dispose } = createSandbox({ storage: {}, io: {} });
    try {
        const shared = readFileSync('public/shared.js', 'utf8');
        const server = readFileSync('public/server.js', 'utf8');
        vm.runInNewContext(shared + '\n' + server, sandbox);
        const exported = sandbox.module.exports;
        const handler = typeof exported === 'function' ? exported : exported.io;
        assert.equal(typeof handler, 'function', 'the harness would find no connection handler');
    } finally {
        dispose();
    }
});

test('shared.js exposes the simulation to the server side of the sandbox', async () => {
    const vm = await import('node:vm');
    const { sandbox, dispose } = createSandbox();
    try {
        vm.runInNewContext(readFileSync('public/shared.js', 'utf8'), sandbox);
        assert.equal(typeof sandbox.S.createState, 'function');
        assert.equal(typeof sandbox.S.tickSim, 'function');
        assert.equal(sandbox.S.BODY, 3);
    } finally {
        dispose();
    }
});

test('index.html keeps shared.js as a separate tag and closes every script', () => {
    const html = readFileSync('public/index.html', 'utf8');
    assert.match(html, /<script src="shared\.js" data-keep><\/script>/);
    const open = (html.match(/<script\b/gi) || []).length;
    const close = (html.match(/<\/script\s*>/gi) || []).length;
    assert.equal(open, close, 'an unterminated inline script is parsed but never executed');
});
