import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, tickSim, unicornById } from '../src/shared/sim.js';
import { hashGrid, paint } from '../src/shared/arena.js';
import { createPredictor } from '../src/client/net/prediction.js';
import { ACTIVATE, GHOST, SPEED, BODY, STEP_COST, STEP_GAIN } from '../src/shared/constants.js';

const cells = (ticks) => Math.floor(ticks * STEP_GAIN / STEP_COST);

const base = () => createState(1, [
    { id: 0, x: 40, y: 40, dir: 0 },
    { id: 1, x: 180, y: 180, dir: 2 },
]);

test('predicting zero ticks ahead returns the confirmed position', () => {
    const s = base();
    const p = createPredictor(0);
    const r = p.advance(s, s.tick);
    assert.equal(r.x, 40);
    assert.equal(r.y, 40);
    assert.equal(r.cells.length, 0);
});

test('prediction advances only your own unicorn', () => {
    const s = base();
    const p = createPredictor(0);
    const r = p.advance(s, s.tick + 5);
    assert.equal(r.x, 40 + cells(5));
    assert.equal(r.cells.length, cells(5) * BODY, 'a body-wide frontier per cell advanced');
    assert.equal(s.unicorns[1].x, 180, 'remote unicorns are untouched');
});

test('prediction never mutates the authoritative grid', () => {
    const s = base();
    const before = hashGrid(s.grid);
    const p = createPredictor(0);
    p.turn(1, s.tick + 2);
    p.advance(s, s.tick + 10);
    assert.equal(hashGrid(s.grid), before, 'speculative cells must not be painted');
});

test('a pending turn applies at the tick it claims', () => {
    const s = base();
    const p = createPredictor(0);
    p.turn(1, s.tick + 3);
    const r = p.advance(s, s.tick + 6);
    assert.equal(r.x, 40 + cells(3), 'cells east before the turn');
    assert.equal(r.y, 40 + cells(6) - cells(3), 'cells south after it');
});

test('reconciling drops inputs the server has ticked past', () => {
    const s = base();
    const p = createPredictor(0);
    p.turn(1, s.tick + 2);
    p.turn(0, s.tick + 9);
    assert.equal(p.pending.length, 2);
    p.reconcile(s.tick + 2);
    assert.equal(p.pending.length, 1, 'only the still-future one survives');
});

test('a mispredicted turn recomputes cleanly from the confirmed state', () => {
    const s = base();
    const p = createPredictor(0);
    p.turn(1, s.tick + 1);
    p.advance(s, s.tick + 4);

    tickSim(s, []);
    tickSim(s, []);
    p.reconcile(s.tick);
    tickSim(s, [[0, 1]]);

    const r = p.advance(s, s.tick + 4);
    assert.equal(p.pending.length, 0);
    assert.equal(r.dir, 1);
    assert.ok(r.y > unicornById(s, 0).y, 'prediction resumes from server truth and moves on');
});

test('prediction collides as a body, not a point', () => {
    const s = base();
    for (let y = 39; y <= 41; y++) {
        paint(s.grid, 44, y, 9);
    }
    const p = createPredictor(0);
    const r = p.advance(s, s.tick + 8);
    assert.equal(r.alive, false);
    assert.ok(r.x < 44, `stopped at ${r.x}, should not have reached the wall`);
});

test('a one-cell gap does not fool the predictor', () => {
    const s = base();
    for (let y = 0; y < 224; y++) {
        if (y !== 40) {
            paint(s.grid, 44, y, 9);
        }
    }
    const p = createPredictor(0);
    const r = p.advance(s, s.tick + 10);
    assert.equal(r.alive, false, 'a 3-wide body cannot thread a 1-cell hole');
});

test('activation is predicted, so ghosting through a wall does not show a phantom death', () => {
    const s = base();
    for (let y = 30; y <= 50; y++) {
        paint(s.grid, 44, y, 9);
    }
    const u = unicornById(s, 0);
    u.held = GHOST;

    const naive = createPredictor(0);
    assert.equal(naive.advance(s, s.tick + 14).alive, false, 'without spending it, you crash');

    const p = createPredictor(0);
    p.turn(ACTIVATE, s.tick);
    const r = p.advance(s, s.tick + 14);
    assert.equal(r.alive, true, 'spending Ghost must be predicted, or you see a death that never happened');
    assert.equal(r.power, GHOST);
    assert.equal(r.held, 0);
    assert.ok(r.x > 44, `and you come out the far side, got x=${r.x}`);
});

test('a predicted ghost paints nothing', () => {
    const s = base();
    unicornById(s, 0).held = GHOST;
    const p = createPredictor(0);
    p.turn(ACTIVATE, s.tick);
    assert.equal(p.advance(s, s.tick + 5).cells.length, 0);
});

test('activating with nothing held changes nothing', () => {
    const s = base();
    const p = createPredictor(0);
    p.turn(ACTIVATE, s.tick);
    const r = p.advance(s, s.tick + 4);
    assert.equal(r.power, 0);
    assert.equal(r.x, 40 + cells(4));
});

test('prediction is bounded, so a drifted clock cannot hang the frame', () => {
    const s = base();
    const p = createPredictor(0);
    const r = p.advance(s, s.tick + 100000);
    assert.ok(r.cells.length <= 30 * BODY, `predicted ${r.cells.length} cells, unbounded`);
});

test('a dead unicorn predicts nothing', () => {
    const s = base();
    unicornById(s, 0).alive = false;
    const p = createPredictor(0);
    const r = p.advance(s, s.tick + 5);
    assert.equal(r.alive, false);
    assert.equal(r.cells.length, 0);
});

test('an input claimed for the far end of the horizon still shows', () => {
    const s = base();
    const p = createPredictor(0);
    const lead = 3;
    p.turn(1, s.tick + lead);
    const r = p.advance(s, s.tick + lead + 1);
    assert.equal(r.dir, 1, 'a turn claimed at the horizon was never simulated');
});

test('a past-due input applies on the first simulated tick rather than vanishing', () => {
    const s = base();
    const p = createPredictor(0);
    p.turn(1, s.tick - 2);
    const r = p.advance(s, s.tick + 4);
    assert.equal(r.dir, 1, 'the input was skipped entirely');
    assert.equal(r.y, s.unicorns[0].y + cells(4));
});

test('inputs survive until the confirmed simulation reaches them', () => {
    const s = base();
    const p = createPredictor(0);
    p.turn(1, s.tick + 5);
    p.reconcile(s.tick);
    assert.equal(p.pending.length, 1, 'reconciling against confirmed state keeps it');
    assert.equal(p.advance(s, s.tick + 6).dir, 1);
});

test('prediction lands exactly where the simulation does', () => {
    for (const ticks of [1, 2, 3, 5, 8, 13, 21]) {
        const sim = base();
        const pred = base();
        const p = createPredictor(0);
        const got = p.advance(pred, pred.tick + ticks);
        for (let i = 0; i < ticks; i++) {
            tickSim(sim, []);
        }
        const truth = unicornById(sim, 0);
        assert.equal(got.x, truth.x, `x diverged after ${ticks} ticks`);
        assert.equal(got.y, truth.y, `y diverged after ${ticks} ticks`);
    }
});

test('prediction matches the simulation while boosted too', () => {
    const ticks = 16;
    const sim = base();
    const pred = base();
    unicornById(sim, 0).power = SPEED;
    unicornById(sim, 0).powerTicks = 200;
    unicornById(pred, 0).power = SPEED;
    unicornById(pred, 0).powerTicks = 200;
    const got = createPredictor(0).advance(pred, pred.tick + ticks);
    for (let i = 0; i < ticks; i++) {
        tickSim(sim, []);
    }
    assert.equal(got.x, unicornById(sim, 0).x, 'boosted prediction diverged');
});

test('prediction matches the simulation after a turn', () => {
    const ticks = 12;
    const sim = base();
    const pred = base();
    const p = createPredictor(0);
    p.turn(1, pred.tick + 3);
    const got = p.advance(pred, pred.tick + ticks);
    for (let i = 0; i < ticks; i++) {
        tickSim(sim, i === 3 ? [[0, 1]] : []);
    }
    const truth = unicornById(sim, 0);
    assert.equal(got.x, truth.x);
    assert.equal(got.y, truth.y);
});
