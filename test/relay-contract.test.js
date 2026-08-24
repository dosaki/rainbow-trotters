import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startRelay } from '../scripts/relay.mjs';

const settle = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const peer = (url) => new Promise((res) => {
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    ws.seen = [];
    ws.onmessage = (e) => {
        const m = typeof e.data === 'string' ? e.data : `bin:${new TextDecoder().decode(e.data)}`;
        if (typeof e.data === 'string' && m[0] === '@' && !ws.rid) {
            ws.rid = m.slice(1);
        }
        ws.seen.push(m);
    };
    ws.onopen = () => res(ws);
});

const idOf = (ws) => ws.rid;
const drain = (...all) => all.forEach((ws) => { ws.seen = []; });

const withRelay = async (fn) => {
    const relay = await startRelay(0);
    try {
        await fn(`ws://localhost:${relay.port}`);
    } finally {
        await relay.close();
    }
};

test('a room is the url path, and separate paths do not mix', async () => {
    await withRelay(async (base) => {
        const a = await peer(`${base}/game`);
        const b = await peer(`${base}/game/ABCD`);
        await settle();
        drain(a, b);

        a.send('from-parent');
        await settle();
        assert.deepEqual(b.seen, [], 'a sub room must not receive the parent room traffic');

        b.send('from-child');
        await settle();
        assert.deepEqual(a.seen, [], 'and the parent must not receive the sub room traffic');
    });
});

test('a joiner is told its own id and nothing about who is already here', async () => {
    await withRelay(async (base) => {
        const a = await peer(`${base}/r`);
        await settle();
        const b = await peer(`${base}/r`);
        await settle();

        assert.equal(b.seen.length, 1, 'the joiner gets exactly one message');
        assert.equal(b.seen[0][0], '@', 'and it is its own id');
        assert.equal(idOf(b).length, 21, 'ids are 21 characters, as the live relay issues');
        assert.ok(a.seen.includes(`+${idOf(b)}`), 'the sitting peer is told about the joiner');
    });
});

test('a broadcast reaches everyone except the sender', async () => {
    await withRelay(async (base) => {
        const a = await peer(`${base}/r`);
        const b = await peer(`${base}/r`);
        const c = await peer(`${base}/r`);
        await settle();
        drain(a, b, c);

        a.send('hello');
        await settle();
        assert.deepEqual(a.seen, [], 'the sender gets no echo');
        assert.deepEqual(b.seen, ['hello']);
        assert.deepEqual(c.seen, ['hello']);
    });
});

test('a direct message reaches one peer with the address stripped', async () => {
    await withRelay(async (base) => {
        const a = await peer(`${base}/r`);
        const b = await peer(`${base}/r`);
        const c = await peer(`${base}/r`);
        await settle();
        drain(a, b, c);

        a.send(`@${idOf(b)}|for-b-only`);
        await settle();
        assert.deepEqual(b.seen, ['for-b-only'], 'payload arrives without the address prefix');
        assert.deepEqual(c.seen, [], 'and nobody else sees it');
    });
});

test('a direct message to an unknown id reaches nobody', async () => {
    await withRelay(async (base) => {
        const a = await peer(`${base}/r`);
        const b = await peer(`${base}/r`);
        await settle();
        drain(a, b);

        a.send('@nobody-at-all|lost');
        await settle();
        assert.deepEqual(b.seen, [], 'an unroutable address must not fall back to a broadcast');
    });
});

test('binary carries the same rules with a utf-8 address prefix', async () => {
    await withRelay(async (base) => {
        const a = await peer(`${base}/r`);
        const b = await peer(`${base}/r`);
        const c = await peer(`${base}/r`);
        await settle();
        drain(a, b, c);

        a.send(new TextEncoder().encode('broad'));
        await settle();
        assert.deepEqual(b.seen, ['bin:broad']);
        drain(b, c);

        a.send(new TextEncoder().encode(`@${idOf(b)}|aimed`));
        await settle();
        assert.deepEqual(b.seen, ['bin:aimed'], 'binary keeps its type and loses its prefix');
        assert.deepEqual(c.seen, []);
    });
});

test('leaving tells the peers that are left', async () => {
    await withRelay(async (base) => {
        const a = await peer(`${base}/r`);
        const b = await peer(`${base}/r`);
        await settle();
        const gone = idOf(b);
        drain(a);

        b.close();
        await settle();
        assert.deepEqual(a.seen, [`-${gone}`]);
    });
});
