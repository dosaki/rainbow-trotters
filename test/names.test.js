import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanName } from '../src/shared/names.js';
import { NAME_MAX } from '../src/shared/constants.js';

test('a blank name falls back to a numbered default', () => {
    assert.equal(cleanName('', 0), 'Unicorn 1');
    assert.equal(cleanName('   ', 4), 'Unicorn 5');
    assert.equal(cleanName(null, 2), 'Unicorn 3');
    assert.equal(cleanName(undefined, 2), 'Unicorn 3');
});

test('names are capped at NAME_MAX characters', () => {
    const long = 'x'.repeat(NAME_MAX + 20);
    assert.equal(cleanName(long, 0).length, NAME_MAX);
});

test('control characters are stripped, not escaped', () => {
    assert.equal(cleanName('a\u0000b\u001fc\u007f', 0), 'abc');
    assert.equal(cleanName('\n\tPony\r', 0), 'Pony');
});

test('markup is kept verbatim, it is rendered with textContent, never parsed', () => {
    assert.equal(cleanName('<b>hi', 0), '<b>hi');
});

test('a non-string is coerced rather than throwing', () => {
    assert.equal(cleanName(42, 0), '42');
    assert.ok(cleanName({}, 0).length > 0);
});

test('surrounding whitespace goes but inner spacing stays', () => {
    assert.equal(cleanName('  Rainbow Dash  ', 0), 'Rainbow Dash');
});
