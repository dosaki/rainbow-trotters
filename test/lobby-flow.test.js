import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createRoom, addPlayer, addBot, advance, setReady, allReady, cycleMap,
} from '../src/client/host/room.js';
import { PHASE } from '../src/shared/protocol.js';
import { COUNTDOWN_TICKS, RESULTS_TICKS, WINS_TO_TAKE } from '../src/shared/constants.js';

const lobbyWith = (humans, bots) => {
    const r = createRoom('PONY', false);
    const ps = [];
    for (let i = 0; i < humans; i++) {
        ps.push(addPlayer(r, null, false, `H${i}`));
    }
    for (let i = 0; i < bots; i++) {
        addBot(r);
    }
    return { r, ps };
};

test('a lobby sits still and burns no ticks', () => {
    const { r } = lobbyWith(2, 1);
    for (let i = 0; i < 200; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.LOBBY);
    assert.equal(r.state, null, 'no simulation exists until a game starts');
});

test('a game starts once every human is ready', () => {
    const { r, ps } = lobbyWith(2, 1);
    setReady(r, ps[0].id, true);
    advance(r);
    assert.equal(r.phase, PHASE.LOBBY, 'one holdout blocks the start');
    setReady(r, ps[1].id, true);
    advance(r);
    assert.equal(r.phase, PHASE.COUNTDOWN);
    assert.ok(r.state, 'a round exists now');
});

test('a finished round starts the next one without leaving the game', () => {
    const { r, ps } = lobbyWith(1, 2);
    setReady(r, ps[0].id, true);
    advance(r);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.RACE);
    for (const u of r.state.unicorns) {
        u.alive = false;
        u.deathTick = r.state.tick;
    }
    advance(r);
    assert.equal(r.phase, PHASE.RESULTS);
    for (let i = 0; i < RESULTS_TICKS; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.COUNTDOWN, 'straight into the next round');
    assert.equal(r.rounds, 1);
});

test('reaching three wins returns everyone to the lobby with scores cleared', () => {
    const { r, ps } = lobbyWith(1, 2);
    setReady(r, ps[0].id, true);
    advance(r);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(r);
    }
    r.players.get(ps[0].id).wins = WINS_TO_TAKE - 1;
    for (const u of r.state.unicorns) {
        if (u.id !== ps[0].id) {
            u.alive = false;
            u.deathTick = r.state.tick;
        }
    }
    advance(r);
    assert.equal(r.phase, PHASE.RESULTS);
    for (let i = 0; i < RESULTS_TICKS; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.LOBBY);
    assert.equal(r.players.get(ps[0].id).wins, 0, 'scores reset for the next game');
    assert.equal(r.players.get(ps[0].id).ready, false, 'and you ready up again');
});

test('ready clears for everyone when somebody joins a waiting lobby', () => {
    const { r, ps } = lobbyWith(2, 0);
    setReady(r, ps[0].id, true);
    setReady(r, ps[1].id, true);
    addPlayer(r, null, false, 'late');
    assert.equal(r.players.get(ps[0].id).ready, false, 'existing players are un-readied');
    assert.equal(r.players.get(ps[1].id).ready, false);
    assert.equal(allReady(r), false, 'a late arrival must not be dragged into an instant start');
});

test('joining a room that is already playing does not disturb it', () => {
    const { r, ps } = lobbyWith(1, 2);
    setReady(r, ps[0].id, true);
    advance(r);
    for (let i = 0; i < COUNTDOWN_TICKS + 3; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.RACE);
    const tickBefore = r.state.tick;
    addPlayer(r, null, false, 'late');
    advance(r);
    assert.equal(r.phase, PHASE.RACE, 'the race carries on');
    assert.equal(r.state.tick, tickBefore + 1);
});

test('returning to the lobby is announced, not just performed', () => {
    const sent = [];
    const socket = { deliver: (ev, payload) => sent.push([ev, payload]) };
    const r = createRoom('PONY', false);
    const me = addPlayer(r, socket, false, 'Tiago');
    for (let i = 0; i < 3; i++) {
        addBot(r);
    }
    setReady(r, me.id, true);

    for (let i = 0; i < 200000; i++) {
        advance(r);
        if (r.phase === PHASE.RACE && r.state) {
            const u = r.state.unicorns.find((x) => x.id === me.id);
            if (u && u.alive && r.state.tick > 3) {
                u.alive = false;
                u.deathTick = r.state.tick;
            }
        }
        if (r.phase === PHASE.LOBBY && r.rounds === 0 && sent.length) break;
    }

    assert.equal(r.phase, PHASE.LOBBY, 'setup: the game should have finished');
    const lobbyState = sent.filter(([ev, p]) => ev === 's' && p[0] === PHASE.LOBBY);
    assert.ok(lobbyState.length > 0,
        'the client is never told the game ended, so it sits on the finished arena forever');
});

test('the chosen map survives a whole game and the return to the lobby', () => {
    const { r, ps } = lobbyWith(1, 3);
    cycleMap(r, 1);
    setReady(r, ps[0].id, true);
    advance(r);
    assert.equal(r.state.map.n, 'Pillars', 'the first round uses it');
    for (let i = 0; i < 40000 && r.phase !== PHASE.LOBBY; i++) {
        advance(r);
    }
    assert.equal(r.phase, PHASE.LOBBY, 'the game finished');
    assert.equal(r.map, 1, 'the choice was reset along with the scores');
});
