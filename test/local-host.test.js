import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EV, MODE, PHASE, SOLO_BOTS, TICK_MS, COUNTDOWN_TICKS } from '#shared';
import { createLocalHost } from '../src/client/host/local.js';

const noNetwork = (t) => {
    const real = globalThis.WebSocket;
    const opened = [];
    globalThis.WebSocket = class {
        constructor(url) {
            opened.push(url);
        }
        send() {}
        close() {}
    };
    t.after(() => { globalThis.WebSocket = real; });
    return opened;
};

const solo = (t, name = 'Tester') => {
    const seen = [];
    const record = (ev) => (payload) => seen.push([ev, payload]);
    const host = createLocalHost({
        [EV.HELLO]: record(EV.HELLO),
        [EV.STATE]: record(EV.STATE),
        [EV.ROUND]: record(EV.ROUND),
        [EV.TICK]: record(EV.TICK),
        [EV.PONG]: record(EV.PONG),
    });
    t.after(() => host.close());
    host.send(EV.MENU, [MODE.SOLO, name, '']);
    return { host, of: (ev) => seen.filter(([e]) => e === ev) };
};

test('single-player opens no socket at all', (t) => {
    const opened = noNetwork(t);
    const { of } = solo(t);
    assert.deepEqual(opened, [], 'solo must not reach for the network');
    assert.equal(of(EV.HELLO).length, 1, 'and it still gets its hello');
});

test('the solo lobby seats the player plus the bots', (t) => {
    const { of } = solo(t, 'Tiago');
    assert.equal(of(EV.HELLO).length, 1, 'the hello lands first');
    const players = of(EV.STATE)[0][1][3];
    assert.equal(players.length, 1 + SOLO_BOTS);
    assert.equal(players.filter(([, , bot]) => bot).length, SOLO_BOTS);

    const human = players.find(([, , bot]) => !bot);
    assert.equal(human[3], 'Tiago', 'the name reached the room');
    assert.equal(human[4], 0, 'and the human is not pre-readied');
});

test('a solo room shows no code, so there is nobody to invite', (t) => {
    const { of } = solo(t);
    const state = of(EV.STATE)[0][1];
    assert.equal(state[0], PHASE.LOBBY);
    assert.equal(state[1], '', 'a solo lobby has no code');
});

test('readying up is recorded without any network', (t) => {
    const opened = noNetwork(t);
    const { host, of } = solo(t);
    host.send(EV.READY, []);

    const state = of(EV.STATE).at(-1)[1];
    assert.equal(state[3].find(([, , bot]) => !bot)[4], 1, 'the human is ready');
    assert.deepEqual(opened, [], 'still no socket');
});

test('input after quitting is ignored rather than throwing', (t) => {
    const { host } = solo(t);
    host.send(EV.QUIT, []);
    host.send(EV.READY, []);
    assert.ok(true);
});

test('a ping is answered locally, so the clock has something to sync to', (t) => {
    const { host, of } = solo(t);
    host.send(EV.PING, [1234]);
    const pong = of(EV.PONG);
    assert.equal(pong.length, 1);
    assert.equal(pong[0][1][0], 1234, 'the client stamp comes back untouched');
});

test('the map can be cycled in a solo lobby', (t) => {
    const { host, of } = solo(t);
    const before = of(EV.STATE).at(-1)[1][4];
    host.send(EV.MAP, [1]);
    const after = of(EV.STATE).at(-1)[1][4];
    assert.notEqual(after, before, 'a solo player hosts their own room');
});

test('bots can be added and removed in a solo lobby', (t) => {
    const { host, of } = solo(t);
    const count = () => of(EV.STATE).at(-1)[1][3].filter(([, , bot]) => bot).length;
    const start = count();
    host.send(EV.BOT, [-1]);
    assert.equal(count(), start - 1);
    host.send(EV.BOT, [1]);
    assert.equal(count(), start);
});

test('the round advances on the local clock with no network', async (t) => {
    const opened = noNetwork(t);
    const { host, of } = solo(t);
    host.send(EV.READY, []);
    await new Promise((r) => setTimeout(r, TICK_MS * (COUNTDOWN_TICKS + 10)));

    assert.ok(of(EV.ROUND).length >= 1, 'a round started');
    assert.ok(of(EV.TICK).length >= 1, 'and the simulation is being driven');
    assert.deepEqual(opened, [], 'a whole round played with the network untouched');
});
