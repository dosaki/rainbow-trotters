import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createArena, idx, inBounds, cellAt, paint, clearCell, clearOwner, hashGrid,
    paintBody, bodyInBounds, frontier,
} from '../src/shared/arena.js';
import { W, H, BODY, HALF } from '../src/shared/constants.js';

test('a fresh arena is empty', () => {
    const g = createArena();
    assert.equal(g.length, W * H);
    assert.ok(g.every((v) => v === 0));
});

test('paint stores playerId + 1 so that 0 stays "empty"', () => {
    const g = createArena();
    paint(g, 5, 9, 0);
    assert.equal(cellAt(g, 5, 9), 1);
    assert.equal(g[idx(5, 9)], 1);
});

test('bounds', () => {
    assert.ok(inBounds(0, 0) && inBounds(W - 1, H - 1));
    assert.ok(!inBounds(-1, 0) && !inBounds(0, H) && !inBounds(W, 0));
});

test('clearCell empties one cell only', () => {
    const g = createArena();
    paint(g, 1, 1, 3);
    paint(g, 2, 1, 3);
    clearCell(g, 1, 1);
    assert.equal(cellAt(g, 1, 1), 0);
    assert.equal(cellAt(g, 2, 1), 4);
});

test('clearOwner removes only that player and reports what it cleared', () => {
    const g = createArena();
    paint(g, 0, 0, 2);
    paint(g, 1, 0, 2);
    paint(g, 2, 0, 5);
    const cleared = clearOwner(g, 2);
    assert.deepEqual(cleared.sort((a, b) => a - b), [idx(0, 0), idx(1, 0)]);
    assert.equal(cellAt(g, 0, 0), 0);
    assert.equal(cellAt(g, 2, 0), 6);
});

test('paintBody fills the whole BODY x BODY footprint', () => {
    const g = createArena();
    paintBody(g, 50, 60, 2);
    for (let y = 60 - HALF; y <= 60 + HALF; y++) {
        for (let x = 50 - HALF; x <= 50 + HALF; x++) {
            assert.equal(cellAt(g, x, y), 3, `(${x},${y})`);
        }
    }
    assert.equal(cellAt(g, 50 + HALF + 1, 60), 0, 'and nothing outside it');
});

test('bodyInBounds requires the whole body to fit, not just the centre', () => {
    assert.equal(bodyInBounds(HALF, HALF), true);
    assert.equal(bodyInBounds(HALF - 1, HALF), false);
    assert.equal(bodyInBounds(W - 1 - HALF, H - 1 - HALF), true);
    assert.equal(bodyInBounds(W - HALF, H - 1 - HALF), false);
});

test('the frontier is a BODY-long line one step ahead of the leading face', () => {
    const right = frontier(50, 60, 0);
    assert.equal(right.length, BODY);
    assert.deepEqual(right, [[52, 59], [52, 60], [52, 61]]);

    const down = frontier(50, 60, 1);
    assert.deepEqual(down, [[49, 62], [50, 62], [51, 62]]);

    const left = frontier(50, 60, 2);
    assert.deepEqual(left, [[48, 61], [48, 60], [48, 59]]);

    const up = frontier(50, 60, 3);
    assert.deepEqual(up, [[51, 58], [50, 58], [49, 58]]);
});

test('the frontier never overlaps the body it came from', () => {
    for (let dir = 0; dir < 4; dir++) {
        for (const [cx, cy] of frontier(50, 60, dir)) {
            const inside = Math.abs(cx - 50) <= HALF && Math.abs(cy - 60) <= HALF;
            assert.equal(inside, false, `dir ${dir} frontier cell (${cx},${cy}) is inside the body`);
        }
    }
});

test('hashGrid distinguishes different grids and matches identical ones', () => {
    const a = createArena(), b = createArena();
    assert.equal(hashGrid(a), hashGrid(b));
    paint(a, 10, 10, 1);
    assert.notEqual(hashGrid(a), hashGrid(b));
    paint(b, 10, 10, 1);
    assert.equal(hashGrid(a), hashGrid(b));
});
