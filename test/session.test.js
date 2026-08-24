import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EV, MODE, PHASE, ERR, MAX_PLAYERS, TICK_MS, COUNTDOWN_TICKS } from '#shared';
import { startRelay } from '../scripts/relay.mjs';
import { createSession } from '../src/client/host/session.js';

const CLAIM_MS = 120;
const settle = (ms = CLAIM_MS * 3) => new Promise((r) => setTimeout(r, ms));

const withRelay = async (fn) => {
    const relay = await startRelay(0);
    const open = [];
    const join = (code, name, opts = {}) => {
        const seen = [];
        const s = createSession(code, {
            [EV.HELLO]: (p) => seen.push([EV.HELLO, p]),
            [EV.STATE]: (p) => seen.push([EV.STATE, p]),
            [EV.ROUND]: (p) => seen.push([EV.ROUND, p]),
            [EV.TICK]: (p) => seen.push([EV.TICK, p]),
            [EV.ERR]: (p) => seen.push([EV.ERR, p]),
        }, { claimMs: CLAIM_MS, base: `ws://localhost:${relay.port}`, holdMs: opts.holdMs });
        s.of = (ev) => seen.filter(([e]) => e === ev);
        s.send(EV.MENU, [MODE.JOIN, name, code]);
        open.push(s);
        return s;
    };
    try {
        await fn(join);
    } finally {
        for (const s of open) {
            s.close();
        }
        await relay.close();
    }
};

test('the first peer into a room ends up hosting it', async () => {
    await withRelay(async (join) => {
        const a = join('AAAA', 'Solo');
        await settle();
        assert.equal(a.isHost, true);
        assert.equal(a.of(EV.HELLO).length, 1, 'the host seats itself and hears its own hello');
    });
});

test('a second peer is seated by the host rather than hosting too', async () => {
    await withRelay(async (join) => {
        const a = join('BBBB', 'Host');
        await settle();
        const b = join('BBBB', 'Guest');
        await settle();

        assert.equal(a.isHost, true);
        assert.equal(b.isHost, false, 'exactly one host');
        assert.equal(b.of(EV.HELLO).length, 1, 'the guest was answered directly');

        const names = a.of(EV.STATE).at(-1)[1][3].map((p) => p[3]);
        assert.deepEqual(names.sort(), ['Guest', 'Host'], 'both are in the room');
    });
});

test('two peers claiming at once settle on a single host', async () => {
    await withRelay(async (join) => {
        const a = join('CCCC', 'One');
        const b = join('CCCC', 'Two');
        await settle(CLAIM_MS * 6);

        const hosts = [a, b].filter((s) => s.isHost);
        assert.equal(hosts.length, 1, 'a tie must not produce two hosts');

        const winner = hosts[0];
        const loser = winner === a ? b : a;
        assert.ok(winner.id < loser.id, 'the lower relay id takes it');
        assert.equal(loser.of(EV.HELLO).length, 1, 'and the loser was seated');
    });
});

test('separate codes are separate games', async () => {
    await withRelay(async (join) => {
        const a = join('DDDD', 'A');
        const b = join('EEEE', 'B');
        await settle();
        assert.equal(a.isHost, true);
        assert.equal(b.isHost, true, 'a different code is a different room');
        assert.equal(a.room.players.size, 1);
        assert.equal(b.room.players.size, 1);
    });
});

test('a guest input reaches the host and nobody else', async () => {
    await withRelay(async (join) => {
        const a = join('FFFF', 'Host');
        await settle();
        const b = join('FFFF', 'Guest');
        const c = join('FFFF', 'Other');
        await settle();

        const before = c.of(EV.STATE).length;
        b.send(EV.READY, []);
        await settle(CLAIM_MS);

        const guest = [...a.room.players.values()].find((p) => p.name === 'Guest');
        assert.ok(guest, 'the guest is seated under its own name');
        assert.equal(guest.ready, true, 'the host applied it');
        assert.ok(c.of(EV.STATE).length > before, 'and announced the result to everyone');
    });
});

test('a leaving guest is dropped from the room', async () => {
    await withRelay(async (join) => {
        const a = join('GGGG', 'Host');
        await settle();
        const b = join('GGGG', 'Guest');
        await settle();
        assert.equal(a.room.players.size, 2);

        b.close();
        await settle();
        assert.equal(a.room.players.size, 1, 'the host noticed the disconnect');
    });
});

test('a game actually runs across the relay', async () => {
    await withRelay(async (join) => {
        const a = join('HHHH', 'Host');
        await settle();
        const b = join('HHHH', 'Guest');
        await settle();

        a.send(EV.BOT, [1]);
        a.send(EV.READY, []);
        b.send(EV.READY, []);
        await new Promise((r) => setTimeout(r, TICK_MS * (COUNTDOWN_TICKS + 12)));

        assert.ok(b.of(EV.ROUND).length >= 1, 'the guest was told a round started');
        assert.ok(b.of(EV.TICK).length >= 1, 'and is receiving the simulation');
    });
});

test('when the host leaves, a guest takes over the room', async () => {
    await withRelay(async (join) => {
        const a = join('IIII', 'Host');
        await settle();
        const b = join('IIII', 'Guest');
        await settle();
        assert.equal(a.isHost, true);
        assert.equal(b.isHost, false);

        a.close();
        await settle(CLAIM_MS * 6);
        assert.equal(b.isHost, true, 'the room survives its host leaving');
        assert.equal(b.room.phase, PHASE.LOBBY, 'and everyone lands back in a lobby');
    });
});

test('a room seats eight players and turns the ninth away', async () => {
    await withRelay(async (join) => {
        const host = join('EIGHT', 'P0');
        await settle();
        const rest = [];
        for (let i = 1; i < MAX_PLAYERS; i++) {
            rest.push(join('EIGHT', `P${i}`));
            await settle(CLAIM_MS);
        }
        await settle(CLAIM_MS * 3);

        assert.equal(host.room.players.size, MAX_PLAYERS, 'all eight seats are taken');
        for (const s of rest) {
            assert.equal(s.of(EV.HELLO).length, 1, 'every one of them was seated');
        }

        const ninth = join('EIGHT', 'P8');
        await settle(CLAIM_MS * 3);
        assert.equal(host.room.players.size, MAX_PLAYERS, 'the room did not overflow');
        assert.deepEqual(ninth.of(EV.ERR).map(([, p]) => p[0]), [ERR.FULL],
            'a ninth player is told the room is full rather than silently ignored');
    });
});

test('a promoted host keeps everyone under their own name', async () => {
    await withRelay(async (join) => {
        const a = join('KEEP', 'Alice');
        await settle();
        const b = join('KEEP', 'Bob');
        const c = join('KEEP', 'Cara');
        await settle(CLAIM_MS * 4);

        a.close();
        await settle(CLAIM_MS * 8);

        const next = [b, c].find((s) => s.isHost);
        const names = [...next.room.players.values()].map((p) => p.name).sort();
        assert.deepEqual(names, ['Bob', 'Cara'], 'a claim carries its name through a promotion');
    });
});

test('a promoted host holds the lobby for the players it still expects', async () => {
    await withRelay(async (join) => {
        const a = join('HOLD', 'Alice', { holdMs: 4000 });
        await settle();
        const b = join('HOLD', 'Bob', { holdMs: 4000 });
        const c = join('HOLD', 'Cara', { holdMs: 4000 });
        await settle(CLAIM_MS * 4);

        c.close();
        a.close();
        await settle(CLAIM_MS * 8);

        assert.equal(b.isHost, true);
        assert.equal(b.room.expect, 2, 'it expects the peer it has not heard from');
        assert.ok(b.room.holdUntil > 0, 'so it holds the lobby rather than starting alone');
    });
});

test('a player who says goodbye is not waited for', async () => {
    await withRelay(async (join) => {
        const a = join('BYE', 'Alice', { holdMs: 9000 });
        await settle();
        const b = join('BYE', 'Bob', { holdMs: 9000 });
        const c = join('BYE', 'Cara', { holdMs: 9000 });
        await settle(CLAIM_MS * 4);

        c.send(EV.QUIT, []);
        await settle(CLAIM_MS * 2);
        a.close();
        await settle(CLAIM_MS * 8);

        assert.equal(b.isHost, true);
        assert.equal(b.room.holdUntil, 0, 'a goodbye means there is nobody left to wait for');
    });
});
