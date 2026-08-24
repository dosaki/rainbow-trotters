import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PHASE } from '#shared';
import { createRoom, addPlayer, setReady, advance, holding } from '../src/client/host/room.js';

const link = () => ({ deliver: () => {} });

const readyRoom = (howMany = 1) => {
    const r = createRoom('PONY', false);
    for (let i = 0; i < howMany; i++) {
        const p = addPlayer(r, link(), false, `P${i}`);
        setReady(r, p.id, true);
    }
    return r;
};

test('a held lobby does not start even with everyone present ready', () => {
    const r = readyRoom(1);
    r.expect = 2;
    r.holdUntil = Date.now() + 10000;

    for (let i = 0; i < 5; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.LOBBY, 'the round started while a player was still expected');
});

test('the hold gives up after its window and lets the game start', () => {
    const r = readyRoom(1);
    r.expect = 2;
    r.holdUntil = Date.now() - 1;

    advance(r);
    assert.equal(r.phase, PHASE.COUNTDOWN, 'a missing player must not block a room forever');
    assert.equal(r.holdUntil, 0, 'and the hold is cleared once it has expired');
});

test('the hold ends the moment the expected players arrive', () => {
    const r = readyRoom(1);
    r.expect = 2;
    r.holdUntil = Date.now() + 10000;
    advance(r);
    assert.equal(r.phase, PHASE.LOBBY);

    const late = addPlayer(r, link(), false, 'Late');
    assert.equal(holding(r), false, 'the room is whole again, so there is nothing to wait for');
    assert.equal(r.holdUntil, 0);

    for (const p of r.players.values()) {
        setReady(r, p.id, true);
    }
    advance(r);
    assert.equal(r.phase, PHASE.COUNTDOWN);
    assert.ok(late, 'the latecomer is seated');
});

test('a latecomer un-readies the room, so nobody is dropped into a round they did not accept', () => {
    const r = readyRoom(1);
    addPlayer(r, link(), false, 'Late');
    advance(r);
    assert.equal(r.phase, PHASE.LOBBY, 'the existing player must re-confirm after someone joins');
});

test('a lobby with nobody expected is never held', () => {
    const r = readyRoom(1);
    assert.equal(holding(r), false);
    advance(r);
    assert.equal(r.phase, PHASE.COUNTDOWN);
});

test('holding never blocks an unready lobby from staying put', () => {
    const r = createRoom('PONY', false);
    addPlayer(r, link(), false, 'A');
    r.expect = 2;
    r.holdUntil = Date.now() + 10000;
    advance(r);
    assert.equal(r.phase, PHASE.LOBBY, 'unready and held are both reasons to stay in the lobby');
});
