import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rngFrom, rngInt } from '../src/shared/rng.js';

test('same seed yields the same sequence', () => {
    const a = rngFrom(12345), b = rngFrom(12345);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
    const a = rngFrom(1), b = rngFrom(2);
    assert.notEqual(a(), b());
});

test('values are uint32', () => {
    const r = rngFrom(7);
    for (let i = 0; i < 200; i++) {
        const v = r();
        assert.ok(Number.isInteger(v) && v >= 0 && v <= 0xffffffff, `bad value ${v}`);
    }
});

test('rngInt stays in range and is uniform enough', () => {
    const r = rngFrom(99);
    const buckets = new Array(8).fill(0);
    for (let i = 0; i < 8000; i++) {
        buckets[rngInt(r, 8)]++;
    }
    assert.equal(buckets.reduce((a, b) => a + b), 8000);
    for (const b of buckets) {
        assert.ok(b > 800 && b < 1200, `skewed bucket ${b}`);
    }
});
