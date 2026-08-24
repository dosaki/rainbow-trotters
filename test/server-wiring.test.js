import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, addPlayer, stateOf } from '../src/client/host/room.js';
import { helloPayload } from '../src/client/host/authority.js';
import { PHASE } from '../src/shared/protocol.js';

test('hello tells a joiner which room they are in and who hosts it', () => {
    const r = createRoom('PONY', false);
    const p = addPlayer(r, null, false, 'Tiago');
    const msg = helloPayload(r, p);
    assert.equal(msg[0], p.id);
    assert.equal(msg[7], r.code, 'the code is needed to show and to share');
    assert.equal(msg[8], r.hostId);
});

test('joining a room that is mid-game leaves you out of the current round', () => {
    const r = createRoom('PONY', true);
    const first = addPlayer(r, null, false, 'A');
    r.roster = [[first.id, first.hue, 0, 'A', 1, 0]];
    r.phase = PHASE.RACE;
    const late = addPlayer(r, null, false, 'B');
    const msg = helloPayload(r, late);
    assert.deepEqual(msg[5], r.roster,
        'hello carries the round roster, not the live list: a joiner who spawned a unicorn the server does not have would desync from its first tick');
    assert.equal(msg[5].some(([id]) => id === late.id), false, 'they sit this round out');
});

test('a state message carries the phase, code, host and everyone in the room', () => {
    const r = createRoom('PONY', true);
    const a = addPlayer(r, null, false, 'A');
    addPlayer(r, null, true, '');
    const [phase, code, hostId, players] = stateOf(r);
    assert.equal(phase, PHASE.LOBBY);
    assert.equal(code, r.code);
    assert.equal(hostId, a.id);
    assert.equal(players.length, 2);
    assert.equal(players[0][3], 'A', 'names ride the player list');
});
