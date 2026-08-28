import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toastText, clearToast } from '../src/client/ui/toast.js';

const fakeStore = () => {
    const map = new Map();
    globalThis.localStorage = {
        getItem: (k) => (map.has(k) ? map.get(k) : null),
        setItem: (k, v) => map.set(k, String(v)),
    };
    return map;
};

const freshModule = async () => {
    const url = `../src/client/achievements.js?x=${Math.random()}`;
    return import(url);
};

test('an award toasts its name the first time and never again', async (t) => {
    const store = fakeStore();
    t.after(() => { delete globalThis.localStorage; });
    const { award } = await freshModule();

    award('s');
    assert.match(toastText(), /Snake/, 'the player is told what they earned');

    award('s');
    assert.equal(store.get('rt.a'), 's', 'the same award is not stored twice');
});

test('awards survive a reload, so a toast is never repeated across sessions', async (t) => {
    const store = fakeStore();
    t.after(() => { delete globalThis.localStorage; });
    store.set('rt.a', 'wt');
    clearToast();

    const { award } = await freshModule();
    award('w');
    assert.equal(toastText(), '', 'nothing new to announce');
    assert.equal(store.get('rt.a'), 'wt', 'and nothing appended');

    award('o');
    assert.equal(store.get('rt.a'), 'wto', 'a genuinely new award still lands');
});

test('storage that throws does not stop the game', async (t) => {
    globalThis.localStorage = {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); },
    };
    t.after(() => { delete globalThis.localStorage; });

    const { award } = await freshModule();
    assert.doesNotThrow(() => award('t'), 'private browsing must not crash the round');
});

test('the wavedash sink maps to registered ids and skips what is already unlocked', async () => {
    const calls = [];
    const unlocked = new Set(['sd']);
    globalThis.Wavedash = {
        getAchievement: (k) => unlocked.has(k),
        setAchievement: (k, now) => { calls.push([k, now]); return true; },
    };

    const { award } = await import('../src/client/achievements-wavedash.js');
    award('s');
    assert.deepEqual(calls, [], 'already unlocked, so no write');

    award('t');
    assert.deepEqual(calls, [['tmc', true]],
        'the readable id the wavedash dashboard registers, stored immediately');

    delete globalThis.Wavedash;
});

test('every js13k award id has a wavedash id behind it', async () => {
    const local = await import('../src/client/achievements.js');
    const remote = await import('../src/client/achievements-wavedash.js');
    void local;
    void remote;
    const src = await import('node:fs').then((fs) => fs.readFileSync('src/client/achievements.js', 'utf8'));
    const wd = await import('node:fs').then((fs) => fs.readFileSync('src/client/achievements-wavedash.js', 'utf8'));
    const ids = [...src.matchAll(/^\s{4}(\w):/gm)].map((m) => m[1]);
    assert.equal(ids.length, 4);
    for (const id of ids) {
        assert.match(wd, new RegExp(`^\\s{4}${id}:`, 'm'),
            `id ${id} toasts locally but would silently do nothing on wavedash`);
    }
});
