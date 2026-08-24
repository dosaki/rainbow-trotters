import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCode, cleanCode } from '../src/client/host/code.js';

test('codes are four unambiguous letters', () => {
    for (let i = 0; i < 200; i++) {
        const c = makeCode();
        assert.match(c, /^[A-Z]{4}$/);
        assert.equal(/[IO]/.test(c), false, `${c} contains a letter mistakable for a digit`);
    }
});

test('codes are spread across the alphabet rather than clustering', () => {
    const seen = new Set();
    for (let i = 0; i < 400; i++) {
        seen.add(makeCode());
    }
    assert.ok(seen.size > 380, `only ${seen.size} distinct codes in 400 draws`);
});

test('a typed code is case-insensitive and tolerates stray spaces', () => {
    assert.equal(cleanCode('  pony '), 'PONY');
    assert.equal(cleanCode('PoNy'), 'PONY');
});

test('a missing code cleans to empty rather than throwing', () => {
    assert.equal(cleanCode(null), '');
    assert.equal(cleanCode(undefined), '');
    assert.equal(cleanCode(''), '');
});
