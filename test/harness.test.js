import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startHarness } from '../scripts/harness.mjs';

test('the harness boots the built server and serves the socket.io client', async () => {
    const h = await startHarness('public');
    try {
        assert.equal((await fetch(h.url)).status, 200);
        assert.equal((await fetch(new URL('/socket.io/socket.io.js', h.url))).status, 200,
            'a plain static server would 404 here and report the game dead');
        assert.equal((await fetch(new URL('/shared.js', h.url))).status, 200,
            'shared.js must be reachable as a real file, not inlined away');
    } finally {
        await h.close();
    }
});

test('the sandbox exposes only what the competition harness does', async () => {
    const h = await startHarness('public');
    try {
        const allowed = new Set([
            'console', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval',
            'Buffer', 'storage', 'io', 'module', 'global',
            'S',   // shared.js declares this on evaluation
        ]);
        for (const k of Object.keys(h.sandbox)) {
            assert.ok(allowed.has(k), `sandbox leaked '${k}', the real harness would not provide it`);
        }
        assert.equal(h.sandbox.require, undefined, 'require must not be in scope');
        assert.equal(h.sandbox.process, undefined, 'process must not be in scope');
    } finally {
        await h.close();
    }
});

test('a connection stays roomless until it chooses from the menu', async () => {
    const h = await startHarness('public');
    try {
        const exported = h.sandbox.module.exports;
        const handler = typeof exported === 'function' ? exported : exported.io;
        const sent = [];
        const handlers = {};
        handler({
            emit: (ev, payload) => sent.push([ev, payload]),
            on: (ev, fn) => { handlers[ev] = fn; },
        });
        assert.equal(sent.length, 0, 'connecting alone must not put you in a game');
        assert.ok(handlers.m, 'but the menu handler is listening');

        handlers.m([0, 'Tester', '']);          // MODE.SOLO
        assert.ok(sent.some(([ev]) => ev === 'h'), 'choosing single-player sends a hello');
        const state = sent.find(([ev]) => ev === 's');
        assert.ok(state, 'and the lobby state');

        const [phase, code, , players] = state[1];
        assert.equal(phase, 3, 'PHASE.LOBBY');
        assert.equal(code, '', 'a solo room shows no code, nobody can be invited');
        assert.equal(players.length, 4, 'the player plus SOLO_BOTS bots');
        assert.equal(players.filter(([, , bot]) => bot).length, 3, 'three of them bots');
        assert.equal(players.find(([, , bot]) => !bot)[4], 0,
            'and the human is NOT pre-readied');
    } finally {
        await h.close();
    }
});
