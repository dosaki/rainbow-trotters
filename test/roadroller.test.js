import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const tmp = mkdtempSync(join(tmpdir(), 'rr-'));
const out = join(tmp, 'client.js');
execFileSync('./node_modules/.bin/roadroller', ['-q', 'public/client.js', '-o', out]);

const PLAIN = readFileSync('public/client.js', 'utf8');
const PACKED = readFileSync(out, 'utf8');

test('the packed bundle is valid JavaScript', () => {
    assert.doesNotThrow(() => new vm.Script(PACKED), 'roadroller emitted something unparseable');
});

test('the packed bundle is safe to inline in index.html', () => {
    for (const hazard of ['</script', '<!--']) {
        assert.ok(!PACKED.includes(hazard),
            `the packed bundle contains ${hazard}, inlining it would end the tag early and the game would never run`);
    }
});

test('packing actually shrank the bundle', () => {
    assert.ok(PACKED.length < PLAIN.length,
        `no smaller (${PLAIN.length} -> ${PACKED.length}), roadroller is a no-op or a loss here`);
});

test('the decoder ends terminated, so concatenating onto it is safe', () => {
    assert.doesNotThrow(() => new vm.Script(`${PACKED}\n(() => 1)()`),
        'the packed file ends in an unterminated call expression');
});
