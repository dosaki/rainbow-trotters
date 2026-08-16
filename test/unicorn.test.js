import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUnicorn, isLegalTurn, applyTurn, stepsThisTick } from '../src/shared/unicorn.js';
import { SPEED, POWER_TICKS, STEP_COST, STEP_GAIN, STEP_GAIN_BOOST, TICK_MS } from '../src/shared/constants.js';

test('a new unicorn starts alive with a zeroed accumulator', () => {
    const u = createUnicorn(3, 10, 20, 1);
    assert.equal(u.id, 3);
    assert.equal(u.x, 10);
    assert.equal(u.y, 20);
    assert.equal(u.dir, 1);
    assert.equal(u.acc, 0);
    assert.equal(u.power, 0);
    assert.equal(u.alive, true);
    assert.equal(u.deathTick, -1);
    assert.equal(u.cells, 0);
});

test('a 180 degree reversal is illegal, everything else is legal', () => {
    assert.equal(isLegalTurn(0, 2), false);
    assert.equal(isLegalTurn(1, 3), false);
    assert.equal(isLegalTurn(2, 0), false);
    assert.equal(isLegalTurn(3, 1), false);
    assert.equal(isLegalTurn(0, 1), true);
    assert.equal(isLegalTurn(0, 3), true);
    assert.equal(isLegalTurn(0, 0), true);
});

test('applyTurn rejects a reversal without changing direction', () => {
    const u = createUnicorn(0, 0, 0, 0);
    assert.equal(applyTurn(u, 2), false);
    assert.equal(u.dir, 0);
    assert.equal(applyTurn(u, 1), true);
    assert.equal(u.dir, 1);
});

test('an unboosted unicorn moves one cell every two ticks', () => {
    const u = createUnicorn(0, 0, 0, 0);
    const pattern = Array.from({ length: 8 }, () => stepsThisTick(u));
    assert.deepEqual(pattern, [0, 1, 0, 1, 0, 1, 0, 1]);
});

test('unboosted speed is 20 cells per second whatever the tick rate', () => {
    const u = createUnicorn(0, 0, 0, 0);
    const ticks = Math.round(1000 / TICK_MS);
    let cells = 0;
    for (let i = 0; i < ticks; i++) {
        cells += stepsThisTick(u);
    }
    assert.equal(cells, 20);
});

test('a boosted unicorn moves six cells every eight ticks', () => {
    const u = createUnicorn(0, 0, 0, 0);
    u.power = SPEED;
    u.powerTicks = POWER_TICKS;
    const pattern = Array.from({ length: 8 }, () => stepsThisTick(u));
    assert.deepEqual(pattern, [0, 1, 1, 1, 0, 1, 1, 1]);
    assert.equal(pattern.reduce((a, b) => a + b), STEP_GAIN_BOOST);
});

test('a unicorn never advances more than one cell in a tick', () => {
    const u = createUnicorn(0, 0, 0, 0);
    u.power = SPEED;
    u.powerTicks = POWER_TICKS;
    assert.ok(STEP_GAIN_BOOST < STEP_COST, 'boosted gain below cost is what removes double-steps');
    for (let i = 0; i < 200; i++) {
        assert.ok(stepsThisTick(u) <= 1);
    }
});

test('a boost is exactly +50% over its full duration', () => {
    const plain = createUnicorn(0, 0, 0, 0);
    const fast = createUnicorn(1, 0, 0, 0);
    fast.power = SPEED;
    fast.powerTicks = POWER_TICKS;
    let a = 0, b = 0;
    for (let i = 0; i < POWER_TICKS; i++) {
        a += stepsThisTick(plain);
        b += stepsThisTick(fast);
    }
    assert.equal(a, POWER_TICKS * STEP_GAIN / STEP_COST);
    assert.equal(b, POWER_TICKS * STEP_GAIN_BOOST / STEP_COST);
    assert.equal(b / a, STEP_GAIN_BOOST / STEP_GAIN);
    assert.equal(b / a, 1.5);
});
