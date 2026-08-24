import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EV, PHASE, MAX_PLAYERS, TICK_MS, COUNTDOWN_TICKS } from '#shared';
import { createDemo } from '../src/client/host/demo.js';

const watch = (t) => {
    const seen = [];
    const demo = createDemo({
        [EV.ROUND]: (p) => seen.push([EV.ROUND, p]),
        [EV.TICK]: (p) => seen.push([EV.TICK, p]),
        [EV.STATE]: (p) => seen.push([EV.STATE, p]),
    });
    t.after(() => demo.stop());
    return { demo, of: (ev) => seen.filter(([e]) => e === ev) };
};

test('the menu game starts on its own with no human in the room', async (t) => {
    const { of } = watch(t);
    await new Promise((r) => setTimeout(r, TICK_MS * 4));

    const round = of(EV.ROUND);
    assert.equal(round.length, 1, 'a bots-only room starts without anyone readying up');
    assert.equal(round[0][1][2].length, MAX_PLAYERS, 'every seat is a bot');
});

test('the menu game drives the simulation', async (t) => {
    const { of } = watch(t);
    await new Promise((r) => setTimeout(r, TICK_MS * (COUNTDOWN_TICKS + 10)));
    assert.ok(of(EV.TICK).length > 3, 'ticks are being broadcast to the watcher');
});

test('stopping the demo stops the clock', async (t) => {
    const { demo, of } = watch(t);
    await new Promise((r) => setTimeout(r, TICK_MS * (COUNTDOWN_TICKS + 6)));
    demo.stop();
    const settled = of(EV.TICK).length;
    await new Promise((r) => setTimeout(r, TICK_MS * 10));
    assert.equal(of(EV.TICK).length, settled, 'a stopped demo must not keep simulating');
});

test('a real room still waits for its humans', async () => {
    const { createRoom, addBot, allReady } = await import('../src/client/host/room.js');
    const r = createRoom('PONY', false);
    addBot(r);
    addBot(r);
    assert.equal(allReady(r), false, 'bots alone must never start a real game');
});
