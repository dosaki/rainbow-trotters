import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createSandbox } from '../scripts/harness.mjs';

const GUARD = 'typeof document>"u"&&';
const halves = () => {
    const src = readFileSync('public/server.js', 'utf8');
    const at = src.indexOf(GUARD);
    assert.notEqual(at, -1, 'server.js has no guard, the build did not fold the sim in');
    return [src.slice(0, at), src.slice(at + GUARD.length)];
};

test('the build produces all three public files', () => {
    for (const f of ['index.html', 'client.js', 'server.js']) {
        assert.ok(existsSync(`public/${f}`), `missing public/${f}`);
    }
    assert.ok(!existsSync('public/shared.js'), 'the sim belongs inside server.js now');
});

test('server.js publishes S with nothing prepended', async () => {
    const vm = await import('node:vm');
    const { sandbox, dispose } = createSandbox();
    try {
        vm.runInNewContext(readFileSync('public/server.js', 'utf8'), sandbox);
        assert.equal(typeof sandbox.S.createState, 'function');
        assert.equal(typeof sandbox.S.tickSim, 'function');
        assert.equal(sandbox.S.BODY, 3);
    } finally {
        dispose();
    }
});

test('a browser loading server.js gets S and never starts a server', async () => {
    const vm = await import('node:vm');
    const box = { console, document: {}, module: {} };
    vm.runInNewContext(readFileSync('public/server.js', 'utf8'), box);
    assert.ok(box.S && box.S.createState, 'the client still needs the sim from this file');
    assert.equal(box.module.exports, undefined,
        'the guard let the server half run in a browser, it would tick forever');
});

test('server.js is safe to concatenate', async () => {
    const vm = await import('node:vm');
    const { sandbox, dispose } = createSandbox();
    try {
        const src = readFileSync('public/server.js', 'utf8');
        vm.runInNewContext(`${src}\n(() => { globalThis.ok = 1; })()`, sandbox);
        assert.equal(sandbox.ok, 1, 'server.js does not terminate its last statement');
    } finally {
        dispose();
    }
});

test('the sim is bundled exactly once, not copied into the client', () => {
    const [sim, server] = halves();

    assert.match(server, /\bS\b/, 'the server half should reference the global S');
    assert.ok(!server.includes('Unicorn '),
        'the server half contains a string that only exists in the sim, check the webpack externals');

    assert.ok(readFileSync('public/client.js', 'utf8').length < sim.length * 2,
        'client.js looks like it inlined the sim');
});

test('the server half uses no global the sandbox does not provide', () => {
    const [, server] = halves();
    for (const banned of ['require(', 'process.', 'globalThis.', '__dirname', 'window.']) {
        assert.ok(!server.includes(banned), `the server half references ${banned}, which the sandbox lacks`);
    }
});

test('server.js exports an io handler the harness can find', async () => {
    const vm = await import('node:vm');
    const { sandbox, dispose } = createSandbox({ storage: {}, io: {} });
    try {
        vm.runInNewContext(readFileSync('public/server.js', 'utf8'), sandbox);
        const exported = sandbox.module.exports;
        const handler = typeof exported === 'function' ? exported : exported.io;
        assert.equal(typeof handler, 'function', 'the harness would find no connection handler');
    } finally {
        dispose();
    }
});

test('index.html keeps server.js as a separate tag and closes every script', () => {
    const html = readFileSync('public/index.html', 'utf8');
    assert.match(html, /<script src="server\.js" data-keep><\/script>/);
    const open = (html.match(/<script\b/gi) || []).length;
    const close = (html.match(/<\/script\s*>/gi) || []).length;
    assert.equal(open, close, 'an unterminated inline script is parsed but never executed');
});
