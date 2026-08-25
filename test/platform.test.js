import { test } from 'node:test';
import assert from 'node:assert/strict';
import { platformReady } from '../src/client/platform-wavedash.js';
import { platformReady as offPlatform } from '../src/client/platform.js';

const withGlobal = (value, fn) => {
    const had = 'Wavedash' in globalThis;
    const before = globalThis.Wavedash;
    if (value === undefined) {
        delete globalThis.Wavedash;
    }
    else globalThis.Wavedash = value;
    try {
        fn();
    } finally {
        if (had) {
            globalThis.Wavedash = before;
        }
        else delete globalThis.Wavedash;
    }
};

test('with no host sdk it does nothing at all', () => {
    withGlobal(undefined, () => {
        assert.doesNotThrow(platformReady, 'off-platform this must be inert, not an error');
    });
});

test('on a host that provides the sdk it reveals the game exactly once per call', () => {
    const calls = [];
    withGlobal({ init: (...args) => calls.push(args) }, () => {
        platformReady();
        assert.equal(calls.length, 1, 'the game is never revealed without this call');
        assert.deepEqual(calls[0], [], 'init takes no options from us');
    });
});

test('a host object without init is tolerated rather than crashing the game', () => {
    withGlobal({}, () => {
        assert.doesNotThrow(platformReady, 'a partial sdk must not take the game down');
    });
});

test('the module leaves no trace of the host on the game side', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/client/platform-wavedash.js', 'utf8');
    assert.ok(!/^import /m.test(src), 'it pulls in nothing, so it costs nothing off-platform');
    assert.ok(src.includes('globalThis.Wavedash'), 'and reaches the sdk only through the host global');
});

test('the js13k build gets a module that mentions no host at all', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync('src/client/platform.js', 'utf8');
    assert.ok(!/Wavedash/.test(src), 'the default build must carry no trace of the platform');
    withGlobal({ init: () => { throw new Error('the default module must never call out'); } }, () => {
        assert.doesNotThrow(offPlatform);
    });
});
