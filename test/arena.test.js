import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createArena, idx, inBounds, cellAt, paint, clearCell, clearOwner, hashGrid,
    paintSquare, trail, bodyInBounds, frontier,
} from '../src/shared/arena.js';
import { W, H, BODY, HALF, LHALF } from '../src/shared/constants.js';

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

test('paintSquare fills a BODY square, the same shape the client draws', () => {
    const g = createArena();
    paintSquare(g, 50, 60, 2);
    for (let y = 60 - HALF; y <= 60 + HALF; y++) {
        for (let x = 50 - HALF; x <= 50 + HALF; x++) {
            assert.equal(cellAt(g, x, y), 3, `(${x},${y})`);
        }
    }
    assert.equal(cellAt(g, 50 + HALF + 1, 60), 0, 'nothing beyond the flank');
    assert.equal(cellAt(g, 50, 60 + HALF + 1), 0, 'nothing beyond the other flank');
});

test('the trail is laid HALF ahead, well inside the frontier that guards it', () => {
    for (const dir of [0, 1, 2, 3]) {
        const laid = trail(50, 60, dir);
        const guard = frontier(50, 60, dir);
        assert.equal(laid.length, BODY, 'a trail row is as wide as the body');
        for (const [tx, ty] of laid) {
            const reach = Math.max(Math.abs(tx - 50), Math.abs(ty - 60));
            assert.ok(reach <= HALF,
                `dir ${dir} lays a cell ${reach} out; anything past HALF is a cell the client never draws`);
        }
        for (const [gx, gy] of guard) {
            assert.ok(!laid.some(([tx, ty]) => tx === gx && ty === gy),
                'the guarded cells are checked before they are ever painted');
        }
    }
});

test('bodyInBounds requires the whole body to fit, not just the centre', () => {
    assert.equal(bodyInBounds(LHALF, HALF, 0), true);
    assert.equal(bodyInBounds(LHALF - 1, HALF, 0), false);
    assert.equal(bodyInBounds(W - 1 - LHALF, H - 1 - HALF, 0), true);
    assert.equal(bodyInBounds(W - LHALF, H - 1 - HALF, 0), false);

    assert.equal(bodyInBounds(HALF, LHALF, 1), true);
    assert.equal(bodyInBounds(HALF - 1, LHALF, 1), false, 'turning sideways needs flank room');
    assert.equal(bodyInBounds(HALF, LHALF - 1, 1), false);
});

test('the frontier is a BODY-long line one step ahead of the leading face', () => {
    for (const [dir, dx, dy] of [[0, 1, 0], [1, 0, 1], [2, -1, 0], [3, 0, -1]]) {
        const line = frontier(50, 60, dir);
        assert.equal(line.length, BODY, `dir ${dir} should be BODY cells wide`);

        const ahead = LHALF + 1;
        const sides = new Set();
        for (const [cx, cy] of line) {
            assert.equal((cx - 50) * dx + (cy - 60) * dy, ahead,
                `(${cx},${cy}) is not one step ahead of the leading face`);
            sides.add((cx - 50) * dy + (cy - 60) * -dx);
        }
        assert.equal(sides.size, BODY, 'the line covers each flank offset exactly once');
        assert.equal(Math.min(...sides), -HALF);
        assert.equal(Math.max(...sides), HALF);
    }
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
