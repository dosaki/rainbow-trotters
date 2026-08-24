import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const html = () => readFileSync('public/index.html', 'utf8');
const client = () => readFileSync('public/client.js', 'utf8');

test('the build produces one page and one bundle', () => {
    for (const f of ['index.html', 'client.js']) {
        assert.ok(existsSync(`public/${f}`), `missing public/${f}`);
    }
    for (const gone of ['server.js', 'shared.js']) {
        assert.ok(!existsSync(`public/${gone}`),
            `${gone} is back, the entry ships as a single bundle now`);
    }
});

test('the page loads nothing from outside the zip', () => {
    const refs = [...html().matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(refs.length > 0, 'the page references at least the bundle');
    for (const r of refs) {
        assert.ok(!/^([a-z]+:)?\/\//i.test(r),
            `${r} is an external resource, which the rules forbid`);
    }
});

test('the sim rides inside the bundle rather than being fetched', () => {
    const src = client();
    for (const marker of ['Pillars', 'Rings']) {
        assert.ok(src.includes(marker),
            `${marker} is missing, the sim is no longer bundled with the client`);
    }
});

test('nothing reaches for socket.io any more', () => {
    assert.ok(!html().includes('socket.io'), 'the page still asks for socket.io');
    assert.ok(!client().includes('socket.io'), 'the bundle still references socket.io');
});

test('the relay address is the one the competition issued', () => {
    assert.ok(client().includes('relay.js13kgames.com'),
        'the shipped bundle must point at the real relay');
});

test('every script tag in the packaged page is closed', () => {
    const page = html();
    const open = (page.match(/<script\b/gi) || []).length;
    const close = (page.match(/<\/script\s*>/gi) || []).length;
    assert.equal(open, close, 'an unterminated inline script is parsed but never executed');
});
