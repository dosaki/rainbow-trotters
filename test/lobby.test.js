import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createRegistry, makeCode, createLobby, joinByCode, autoJoin, dropPlayer,
} from '../src/server/lobby.js';
import { addPlayer, addBot } from '../src/server/room.js';
import { MAX_PLAYERS } from '../src/shared/constants.js';
import { ERR, PHASE } from '../src/shared/protocol.js';

test('codes are four unambiguous letters', () => {
    const rooms = createRegistry();
    for (let i = 0; i < 200; i++) {
        const c = makeCode(rooms);
        assert.match(c, /^[A-Z]{4}$/);
        assert.equal(/[IO]/.test(c), false, `${c} contains a letter mistakable for a digit`);
    }
});

test('a code is never handed out twice', () => {
    const rooms = createRegistry();
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
        const r = createLobby(rooms, false);
        assert.equal(seen.has(r.code), false, `${r.code} was reused`);
        seen.add(r.code);
    }
    assert.equal(rooms.size, 50);
});

test('joining by code is case-insensitive and tolerates stray spaces', () => {
    const rooms = createRegistry();
    const r = createLobby(rooms, false);
    assert.equal(joinByCode(rooms, r.code.toLowerCase()), r);
    assert.equal(joinByCode(rooms, ` ${r.code} `), r);
});

test('an unknown code reports NO_ROOM rather than throwing', () => {
    const rooms = createRegistry();
    assert.equal(joinByCode(rooms, 'ZZZZ'), ERR.NO_ROOM);
    assert.equal(joinByCode(rooms, ''), ERR.NO_ROOM);
    assert.equal(joinByCode(rooms, null), ERR.NO_ROOM);
    assert.equal(joinByCode(rooms, undefined), ERR.NO_ROOM);
});

test('a full room reports FULL', () => {
    const rooms = createRegistry();
    const r = createLobby(rooms, false);
    for (let i = 0; i < MAX_PLAYERS; i++) {
        addPlayer(r, null, false, 'x');
    }
    assert.equal(joinByCode(rooms, r.code), ERR.FULL);
});

test('auto-join creates a public room when there are none', () => {
    const rooms = createRegistry();
    const r = autoJoin(rooms);
    assert.equal(r.open, true);
    assert.equal(rooms.size, 1);
});

test('auto-join never returns a private room', () => {
    const rooms = createRegistry();
    const priv = createLobby(rooms, false);
    addPlayer(priv, null, false, 'x');
    const r = autoJoin(rooms);
    assert.notEqual(r, priv);
    assert.equal(r.open, true);
});

test('auto-join prefers the fullest room that is still in its lobby', () => {
    const rooms = createRegistry();
    const quiet = createLobby(rooms, true);
    addPlayer(quiet, null, false, 'a');
    const busy = createLobby(rooms, true);
    addPlayer(busy, null, false, 'b');
    addPlayer(busy, null, false, 'c');
    assert.equal(autoJoin(rooms), busy);
});

test('auto-join prefers a waiting room over a busier one already playing', () => {
    const rooms = createRegistry();
    const playing = createLobby(rooms, true);
    for (let i = 0; i < 4; i++) {
        addPlayer(playing, null, false, 'x');
    }
    playing.phase = PHASE.RACE;
    const waiting = createLobby(rooms, true);
    addPlayer(waiting, null, false, 'y');
    assert.equal(autoJoin(rooms), waiting, 'you would rather play than watch');
});

test('auto-join skips full rooms', () => {
    const rooms = createRegistry();
    const full = createLobby(rooms, true);
    for (let i = 0; i < MAX_PLAYERS; i++) {
        addPlayer(full, null, false, 'x');
    }
    const r = autoJoin(rooms);
    assert.notEqual(r, full);
});

test('a room is destroyed when its last human leaves', () => {
    const rooms = createRegistry();
    const r = createLobby(rooms, true);
    const a = addPlayer(r, null, false, 'a');
    dropPlayer(rooms, r, a.id);
    assert.equal(rooms.size, 0);
});

test('bots do not keep an abandoned room alive', () => {
    const rooms = createRegistry();
    const r = createLobby(rooms, true);
    const a = addPlayer(r, null, false, 'a');
    addBot(r);
    addBot(r);
    dropPlayer(rooms, r, a.id);
    assert.equal(rooms.size, 0, 'auto-join would otherwise hand out a bot-only room');
});

test('a room survives while another human remains, and the host moves', () => {
    const rooms = createRegistry();
    const r = createLobby(rooms, true);
    const a = addPlayer(r, null, false, 'a');
    const b = addPlayer(r, null, false, 'b');
    assert.equal(r.hostId, a.id);
    dropPlayer(rooms, r, a.id);
    assert.equal(rooms.size, 1);
    assert.equal(r.hostId, b.id, 'the host role passes on');
});
