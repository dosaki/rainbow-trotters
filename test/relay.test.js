import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRelay } from '../scripts/relay.mjs';
import { connect } from '../src/client/net/relay.js';

const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

const withRelay = async (fn) => {
    const relay = await startRelay(0);
    try {
        await fn(`ws://localhost:${relay.port}`);
    } finally {
        await relay.close();
    }
};

const ready = async (...peers) => {
    for (let i = 0; i < 40 && peers.some((p) => !p.id); i++) {
        await settle(10);
    }
};

test('an event reaches the other peer with its payload and its sender', async () => {
    await withRelay(async (base) => {
        const seen = [];
        const a = connect('R', {}, {}, base);
        const b = connect('R', { t: (payload, from) => seen.push([payload, from]) }, {}, base);
        await ready(a, b);

        a.send('t', [3, 91]);
        await settle();
        assert.deepEqual(seen, [[[3, 91], a.id]]);
    });
});

test('the sender never hears its own broadcast', async () => {
    await withRelay(async (base) => {
        const mine = [];
        const a = connect('R', { t: (p) => mine.push(p) }, {}, base);
        const b = connect('R', {}, {}, base);
        await ready(a, b);

        a.send('t', [1]);
        await settle();
        assert.deepEqual(mine, [], 'the host has to deliver to itself, the relay will not');
    });
});

test('sends made before the socket opens are not lost', async () => {
    await withRelay(async (base) => {
        const seen = [];
        const b = connect('R', { t: (p) => seen.push(p) }, {}, base);
        await ready(b);

        const a = connect('R', {}, {}, base);
        a.send('t', ['queued']);
        assert.equal(a.id, '', 'this send happens before the id has even arrived');

        await ready(a);
        await settle();
        assert.deepEqual(seen, [['queued']], 'the buffered send went out once the socket opened');
    });
});

test('a direct send reaches only the peer it names', async () => {
    await withRelay(async (base) => {
        const toB = [], toC = [];
        const a = connect('R', {}, {}, base);
        const b = connect('R', { t: (p) => toB.push(p) }, {}, base);
        const c = connect('R', { t: (p) => toC.push(p) }, {}, base);
        await ready(a, b, c);

        a.sendTo(b.id, 't', ['private']);
        await settle();
        assert.deepEqual(toB, [['private']]);
        assert.deepEqual(toC, [], 'a catch up payload must not cost every other peer');
    });
});

test('joining and leaving are reported, but presence is not', async () => {
    await withRelay(async (base) => {
        const joins = [], parts = [];
        const a = connect('R', {}, { onJoin: (id) => joins.push(id), onPart: (id) => parts.push(id) }, base);
        await ready(a);

        const b = connect('R', {}, {}, base);
        await ready(b);
        await settle();
        assert.deepEqual(joins, [b.id], 'the sitting peer learns about the joiner');

        b.close();
        await settle();
        assert.deepEqual(parts, [b.id]);
    });
});

test('a stranger sending nonsense into the room cannot throw', async () => {
    await withRelay(async (base) => {
        const seen = [];
        const a = connect('R', { t: (p) => seen.push(p) }, {}, base);
        await ready(a);

        const stranger = new WebSocket(`${base}/R`);
        await new Promise((r) => { stranger.onopen = r; });
        stranger.send('not json at all');
        stranger.send('{"half":');
        await settle();

        stranger.send(JSON.stringify(['t', ['still working'], 'x']));
        await settle();
        assert.deepEqual(seen, [['still working']], 'the socket survived the garbage');
        stranger.close();
    });
});

test('an event with no handler is ignored', async () => {
    await withRelay(async (base) => {
        const a = connect('R', {}, {}, base);
        const b = connect('R', {}, {}, base);
        await ready(a, b);
        a.send('nosuchevent', [1]);
        await settle();
        assert.ok(true, 'reaching here means no handler lookup threw');
    });
});
