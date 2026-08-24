import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createRoom, addPlayer, addBot, startRound, advance, awardRound, gameResult,
} from '../src/client/host/room.js';
import { WINS_TO_TAKE, MAX_ROUNDS, COUNTDOWN_TICKS } from '../src/shared/constants.js';

const raced = () => {
    const r = createRoom('PONY', false);
    addPlayer(r, null, false, 'A');
    addBot(r);
    addBot(r);
    startRound(r);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(r);
    }
    return r;
};

test('the last unicorn alive takes the round', () => {
    const r = raced();
    const [alive, ...rest] = r.state.unicorns;
    for (const u of rest) {
        u.alive = false;
        u.deathTick = r.state.tick;
    }
    assert.equal(awardRound(r), alive.id);
    assert.equal(r.players.get(alive.id).wins, 1);
});

test('when every human is out, the win goes to the survivor with the most cells', () => {
    const r = raced();
    const human = r.state.unicorns.find((u) => u.id === 0);
    human.alive = false;
    human.deathTick = r.state.tick;
    const [b1, b2] = r.state.unicorns.filter((u) => u.id !== 0);
    b1.cells = 10;
    b2.cells = 99;
    assert.equal(awardRound(r), b2.id,
        'without this a solo player who keeps crashing never scores and the game never ends');
    assert.equal(r.players.get(b2.id).wins, 1);
});

test('a mutual crash scores nobody', () => {
    const r = raced();
    for (const u of r.state.unicorns) {
        u.alive = false;
        u.deathTick = r.state.tick;
    }
    assert.equal(awardRound(r), -1);
    for (const p of r.players.values()) {
        assert.equal(p.wins, 0);
    }
});

test('a game is not over until someone reaches WINS_TO_TAKE', () => {
    const r = raced();
    const p = r.players.get(0);
    p.wins = WINS_TO_TAKE - 1;
    assert.equal(gameResult(r), null);
    p.wins = WINS_TO_TAKE;
    assert.deepEqual(gameResult(r), { winner: 0, wins: WINS_TO_TAKE });
});

test('a game ends at MAX_ROUNDS however the score stands', () => {
    const r = raced();
    r.rounds = MAX_ROUNDS;
    r.players.get(1).wins = 2;
    r.players.get(0).wins = 1;
    assert.deepEqual(gameResult(r), { winner: 1, wins: 2 },
        'repeated draws would otherwise stall a game forever');
});

test('a cap finish with equal wins is broken by cells painted', () => {
    const r = raced();
    r.rounds = MAX_ROUNDS;
    r.players.get(0).wins = 1;
    r.players.get(1).wins = 1;
    r.state.unicorns.find((u) => u.id === 0).cells = 5;
    r.state.unicorns.find((u) => u.id === 1).cells = 500;
    assert.equal(gameResult(r).winner, 1);
});

test('awarding a round counts it, even a scoreless one', () => {
    const r = raced();
    assert.equal(r.rounds, 0);
    for (const u of r.state.unicorns) {
        u.alive = false;
        u.deathTick = r.state.tick;
    }
    awardRound(r);
    assert.equal(r.rounds, 1, 'a draw still counts toward the cap, or a game could stall');
});
