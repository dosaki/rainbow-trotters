import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNet } from '../src/client/net/state.js';
import { drawOverlay } from '../src/client/ui/overlay.js';
import { showToast, toastText, clearToast } from '../src/client/ui/toast.js';
import { COUNTDOWN_TICKS, RESULTS_TICKS, TICK_MS } from '../src/shared/constants.js';

const el = () => ({ textContent: '', style: {} });

const started = (t0) => {
    const net = createNet();
    net.myId = 0;
    net.onRound([1, 0, [[0, 340], [1, 25], [2, 50], [3, 90]]], t0);
    return net;
};

const racing = (t0) => {
    const net = started(t0);
    net.pushTick(1, []);
    net.drain();
    return net;
};

test('the countdown actually counts down', () => {
    const net = started(0);
    const e = el();
    drawOverlay(e, net, 0);
    assert.equal(e.textContent, '3');
    drawOverlay(e, net, 1100);
    assert.equal(e.textContent, '2', 'frozen at 3 means the client is timing off a tick that never advances');
    drawOverlay(e, net, 2100);
    assert.equal(e.textContent, '1');
    drawOverlay(e, net, COUNTDOWN_TICKS * TICK_MS + 10);
    assert.equal(e.textContent, 'GO');
});

test('a finished round names the outcome instead of a bare string', () => {
    const net = racing(0);
    for (const u of net.state.unicorns) {
        u.alive = false;
        u.deathTick = 0;
    }
    net.noteResult(5000);
    const e = el();
    drawOverlay(e, net, 5000);
    assert.match(e.textContent, /crash/i, `expected an outcome, got "${e.textContent}"`);
});

test('your own win is called out', () => {
    const net = racing(0);
    for (const u of net.state.unicorns) if (u.id !== 0) {
        u.alive = false;
        u.deathTick = 0;
    }
    net.noteResult(5000);
    const e = el();
    drawOverlay(e, net, 5000);
    assert.match(e.textContent, /you win/i);
});

test('the wait for the next round visibly shortens', () => {
    const net = racing(0);
    for (const u of net.state.unicorns) {
        u.alive = false;
        u.deathTick = 0;
    }
    net.noteResult(1000);
    const e = el();
    drawOverlay(e, net, 1000);
    const first = e.textContent;
    drawOverlay(e, net, 1000 + RESULTS_TICKS * TICK_MS - 1200);
    assert.notEqual(e.textContent, first, 'the results screen must show progress, not a frozen string');
    assert.match(first, /\d/, 'and it should say how long is left');
});

test('a live race shows nothing over the arena', () => {
    const net = started(0);
    net.pushTick(1, []);
    net.drain();
    const e = el();
    drawOverlay(e, net, 9999);
    assert.equal(e.textContent, '');
});

test('being dead mid-race says so without claiming the round is over', () => {
    const net = started(0);
    net.pushTick(1, []);
    net.drain();
    net.state.unicorns.find((u) => u.id === 0).alive = false;
    const e = el();
    drawOverlay(e, net, 9999);
    assert.match(e.textContent, /crashed/i);
    assert.doesNotMatch(e.textContent, /next round/i, 'others are still racing');
});

test('a spectator is not told they crashed', () => {
    const net = racing(0);
    net.myId = 99;
    for (const u of net.state.unicorns) {
        u.alive = false;
        u.deathTick = 0;
    }
    net.humans = new Set([0]);
    net.noteResult(1000);
    const e = el();
    drawOverlay(e, net, 1000);
    assert.match(e.textContent, /round over/i);
    assert.doesNotMatch(e.textContent, /you crashed/i);
});

test('a toast reports itself for its duration and then stops', () => {
    showToast('GHOST · press SPACE', 1000, 1400);
    assert.equal(toastText(1000), 'GHOST · press SPACE');
    assert.equal(toastText(2300), 'GHOST · press SPACE');
    assert.equal(toastText(2401), '', 'it must not linger');
    clearToast();
});

test('clearing a toast stops it immediately', () => {
    showToast('SPEED · press SPACE', 1000, 5000);
    clearToast();
    assert.equal(toastText(1001), '', 'leaving a room must not leave a toast pending');
});

test('a pickup never masks the countdown', () => {
    const net = started(0);
    showToast('SPEED · press SPACE', 0);
    const e = el();
    drawOverlay(e, net, 0);
    assert.equal(e.textContent, '3', 'the overlay is a separate layer and still shows the count');
    clearToast();
});

test('a pickup never masks the round outcome', () => {
    const net = racing(0);
    for (const u of net.state.unicorns) {
        u.alive = false;
        u.deathTick = 0;
    }
    net.noteResult(5000);
    showToast('GHOST · press SPACE', 5000);
    const e = el();
    drawOverlay(e, net, 5000);
    assert.match(e.textContent, /crash/i);
    clearToast();
});

test('a live racer sees a clear overlay, whatever the toast is doing', () => {
    const net = racing(0);
    showToast('BREAK · press SPACE', 9999);
    const e = el();
    drawOverlay(e, net, 9999);
    assert.equal(e.textContent, '');
    clearToast();
});
