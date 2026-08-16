import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    BLOCK, SPAN, DESIGN, MAPS, paintShape, paintMap, startPoints, startsFor, mapAt, mapCount, parseMap,
    QUARTER, HALF_H, HALF_V, FULL, symOf, colsOf, rowsOf,
} from '../src/shared/maps.js';
import { createArena, cellAt, spawnSlot, hashGrid } from '../src/shared/arena.js';
import { createState, replay, tickSim } from '../src/shared/sim.js';
import { WALL, W, H, MAX_PLAYERS, MIN_PLAYERS, BODY, DIRS } from '../src/shared/constants.js';
import { bodyInBounds } from '../src/shared/arena.js';

const oneBlock = (rx, ry) =>
    Array.from({ length: DESIGN }, (_, y) =>
        Array.from({ length: DESIGN }, (_, x) => (x === rx && y === ry ? '#' : '.')).join(''));

const solidCount = (grid) => {
    let n = 0;
    for (let i = 0; i < grid.length; i++) {
        if (grid[i] === WALL + 1) {
            n++;
        }
    }
    return n;
};

test('the quarter tiles the arena exactly', () => {
    assert.equal(SPAN * BLOCK, W);
    assert.equal(SPAN * BLOCK, H);
    assert.equal(DESIGN, SPAN / 2 - 2, 'two safe rings on the arena-edge side');
});

test('one block in the quarter becomes four blocks in the arena', () => {
    const g = createArena();
    paintShape(g, oneBlock(0, 0));
    assert.equal(solidCount(g), 4 * BLOCK * BLOCK);
});

test('the four blocks sit at positions mirrored about the arena mid-lines', () => {
    const g = createArena();
    paintShape(g, oneBlock(3, 5));
    for (const [bx, by] of [[5, 7], [22, 7], [5, 20], [22, 20]]) {
        assert.equal(cellAt(g, bx * BLOCK, by * BLOCK), WALL + 1,
            `expected a wall at block ${bx},${by}`);
    }
    assert.equal(solidCount(g), 4 * BLOCK * BLOCK);
});

test('a block reaching the centre line joins its own mirror image', () => {
    const g = createArena();
    paintShape(g, oneBlock(DESIGN - 1, DESIGN - 1));
    assert.equal(cellAt(g, W / 2 - 1, H / 2 - 1), WALL + 1);
    assert.equal(cellAt(g, W / 2, H / 2), WALL + 1);
});

test('the two rings nearest the arena edge can never be drawn on', () => {
    const edge = 2 * BLOCK;
    for (let i = 0; i < MAPS.length; i++) {
        const g = createArena();
        paintMap(g, MAPS[i]);
        for (let x = 0; x < W; x++) {
            for (let y = 0; y < H; y++) {
                if (x >= edge && y >= edge && x < W - edge && y < H - edge) continue;
                assert.equal(cellAt(g, x, y), 0, `map ${i} touched ${x},${y}`);
            }
        }
    }
});

test('every spawn footprint is clear on every map', () => {
    for (let i = 0; i < MAPS.length; i++) {
        const g = createArena();
        paintMap(g, MAPS[i]);
        for (let n = MIN_PLAYERS; n <= MAX_PLAYERS; n++) {
            for (let k = 0; k < n; k++) {
                const s = spawnSlot(k, n);
                for (let oy = -1; oy <= 1; oy++) {
                    for (let ox = -1; ox <= 1; ox++) {
                        assert.equal(cellAt(g, s.x + ox, s.y + oy), 0,
                            `map ${i} blocks spawn ${k} of ${n}`);
                    }
                }
            }
        }
    }
});

test('the open map paints nothing', () => {
    const g = createArena();
    paintMap(g, MAPS[0]);
    assert.equal(solidCount(g), 0);
    assert.equal(mapAt(0, '').n, 'Open');
});

test('every other map paints something, and they differ from each other', () => {
    const counts = MAPS.map((_, i) => {
        const g = createArena();
        paintMap(g, MAPS[i]);
        return solidCount(g);
    });
    for (let i = 1; i < MAPS.length; i++) {
        assert.ok(counts[i] > 0, `${MAPS[i].n} is empty`);
    }
    const shapes = MAPS.filter((m) => m.q).map((m) => m.q.join('|'));
    assert.equal(new Set(shapes).size, shapes.length, 'two maps have identical layouts');
});

test('every bitmap matches the size its symmetry demands', () => {
    for (const m of MAPS) {
        assert.ok(m.n, 'a map needs a name');
        if (!m.q) continue;
        const sym = symOf(m);
        const want = `${colsOf(sym)} wide x ${rowsOf(sym)} tall for symmetry ${sym}`;
        assert.equal(m.q.length, rowsOf(sym), `${m.n}: ${m.q.length} rows, wants ${want}`);
        for (const row of m.q) {
            assert.equal(row.length, colsOf(sym), `${m.n}: a row is ${row.length} long, wants ${want}`);
            assert.ok(/^[.#o]+$/.test(row), `${m.n}: unexpected characters in "${row}"`);
        }
    }
});

test('an out-of-range index falls back to the open map rather than throwing', () => {
    const g = createArena();
    paintMap(g, mapAt(99, ''));
    assert.equal(solidCount(g), 0);
    assert.equal(mapAt(99, '').n, 'Open');
});

const SPAWNS = [
    { id: 0, x: 30, y: 30, dir: 0 },
    { id: 1, x: 194, y: 30, dir: 1 },
    { id: 2, x: 194, y: 194, dir: 2 },
    { id: 3, x: 30, y: 194, dir: 3 },
];

test('a state remembers which map it was built with', () => {
    assert.equal(createState(7, SPAWNS, MAPS[2]).map, MAPS[2]);
    assert.equal(createState(7, SPAWNS).map, null, 'no map is the default');
});

test('the same seed and map produce an identical arena', () => {
    const a = createState(7, SPAWNS, MAPS[2]);
    const b = createState(7, SPAWNS, MAPS[2]);
    assert.equal(hashGrid(a.grid), hashGrid(b.grid));
});

test('a different map produces a different arena', () => {
    const open = createState(7, SPAWNS, MAPS[0]);
    const pillars = createState(7, SPAWNS, MAPS[1]);
    assert.notEqual(hashGrid(open.grid), hashGrid(pillars.grid));
});

test('a joiner replaying with the same map lands on the same arena', () => {
    const log = [[3, 0, 1], [9, 1, 2], [14, 2, 3], [20, 3, 0]];
    const live = createState(7, SPAWNS, MAPS[2]);
    const byTick = new Map();
    for (const [t, id, dir] of log) {
        if (!byTick.has(t)) {
            byTick.set(t, []);
        }
        byTick.get(t).push([id, dir]);
    }
    while (live.tick < 60) {
        tickSim(live, byTick.get(live.tick) || []);
    }

    const joined = replay(7, SPAWNS, log, 60, MAPS[2]);
    assert.equal(hashGrid(joined.grid), hashGrid(live.grid));
});

test('a joiner replaying with the WRONG map does NOT match', () => {
    const log = [[3, 0, 1], [9, 1, 2], [14, 2, 3], [20, 3, 0]];
    const right = replay(7, SPAWNS, log, 60, MAPS[2]);
    const wrong = replay(7, SPAWNS, log, 60, MAPS[1]);
    assert.notEqual(hashGrid(wrong.grid), hashGrid(right.grid));
});

const ids = (n) => Array.from({ length: n }, (_, i) => i);

test('starts are reflected exactly as far as the symmetry says', () => {
    for (let i = 1; i < MAPS.length; i++) {
        const m = MAPS[i], sym = symOf(m), pts = startPoints(m);
        const copies = sym === QUARTER ? 4 : sym === FULL ? 1 : 2;
        assert.equal(pts.length % copies, 0,
            `${m.n}: ${pts.length} starts is not a whole number of marks at symmetry ${sym}`);
        const xs = new Set(pts.map((p) => p.x));
        const ys = new Set(pts.map((p) => p.y));
        if (sym & HALF_H) {
            for (const x of xs) {
                assert.ok(xs.has(W - x), `${m.n}: no mirror of x=${x}`);
            }
        }
        if (sym & HALF_V) {
            for (const y of ys) {
                assert.ok(ys.has(H - y), `${m.n}: no mirror of y=${y}`);
            }
        }
    }
});

test('every map names at least enough starts to seat a full arena', () => {
    for (let i = 1; i < MAPS.length; i++) {
        assert.ok(startPoints(MAPS[i]).length >= MAX_PLAYERS,
            `${MAPS[i].n} names only ${startPoints(MAPS[i]).length}`);
    }
});

test('no start sits inside a wall, or close enough to touch one', () => {
    for (let i = 1; i < MAPS.length; i++) {
        const g = createArena();
        paintMap(g, MAPS[i]);
        for (const p of startPoints(MAPS[i])) {
            assert.ok(bodyInBounds(p.x, p.y), `${MAPS[i].n}: body off the arena at ${p.x},${p.y}`);
            for (let oy = -1; oy <= 1; oy++) {
                for (let ox = -1; ox <= 1; ox++) {
                    assert.equal(cellAt(g, p.x + ox, p.y + oy), 0,
                        `${MAPS[i].n}: start at ${p.x},${p.y} is buried`);
                }
            }
        }
    }
});

test('every start faces a clear run, not a wall a moment away', () => {
    const MIN = 24;
    for (let i = 1; i < MAPS.length; i++) {
        const g = createArena();
        paintMap(g, MAPS[i]);
        for (const p of startPoints(MAPS[i])) {
            const [dx, dy] = DIRS[p.dir];
            let run = 0;
            for (;;) {
                run++;
                const x = p.x + dx * (run + 1), y = p.y + dy * (run + 1);
                if (!bodyInBounds(x, y)) break;
                let hit = false;
                for (let o = -1; o <= 1; o++) {
                    const cx = dy ? x + o : x, cy = dy ? y : y + o;
                    if (cellAt(g, cx, cy) !== 0) {
                        hit = true;
                    }
                }
                if (hit) break;
            }
            assert.ok(run >= MIN,
                `${MAPS[i].n}: start at ${p.x},${p.y} facing ${p.dir} has only ${run} cells`);
        }
    }
});

test('starts never overlap, however many players there are', () => {
    for (let i = 0; i < MAPS.length; i++) {
        for (const n of [2, 4, 5, 8]) {
            const ss = startsFor(ids(n), MAPS[i], 12345);
            assert.equal(ss.length, n);
            for (let a = 0; a < n; a++) {
                for (let b = a + 1; b < n; b++) {
                    const p = ss[a], q = ss[b];
                    assert.ok(Math.abs(p.x - q.x) >= BODY || Math.abs(p.y - q.y) >= BODY,
                        `${MAPS[i].n} n=${n}: ${p.id} and ${q.id} overlap`);
                }
            }
        }
    }
});

test('the same seed and map seat everyone identically on both sides', () => {
    assert.deepEqual(startsFor(ids(6), MAPS[2], 777), startsFor(ids(6), MAPS[2], 777));
});

test('a different seed seats them differently', () => {
    const same = [];
    for (let seed = 1; seed < 40; seed++) {
        same.push(JSON.stringify(startsFor(ids(4), MAPS[2], seed)));
    }
    assert.ok(new Set(same).size > 1, 'every seed produced the same seating');
});

test('the open map falls back to the perimeter ring', () => {
    assert.equal(startPoints(MAPS[0]).length, 0);
    const ss = startsFor(ids(4), MAPS[0], 99);
    assert.equal(ss.length, 4);
    for (const s of ss) {
        assert.ok(bodyInBounds(s.x, s.y));
    }
});

test('too few candidates for the players falls back rather than stacking them', () => {
    const ss = startsFor(ids(MAX_PLAYERS), MAPS[1], 5);
    assert.equal(ss.length, MAX_PLAYERS);
    for (let a = 0; a < ss.length; a++) {
        for (let b = a + 1; b < ss.length; b++) {
            assert.ok(Math.abs(ss[a].x - ss[b].x) >= BODY || Math.abs(ss[a].y - ss[b].y) >= BODY);
        }
    }
});

const grid = (rows, sym) => { const g = createArena(); paintShape(g, rows, sym); return g; };
const solid = (g) => {
    let n = 0;
    for (let i = 0; i < g.length; i++) {
        if (g[i] === WALL + 1) {
            n++;
        }
    }
    return n;
};
const shape = (sym, rx, ry) =>
    Array.from({ length: rowsOf(sym) }, (_, y) =>
        Array.from({ length: colsOf(sym) }, (_, x) => (x === rx && y === ry ? '#' : '.')).join(''));

test('the four symmetries have the authored sizes they claim', () => {
    assert.deepEqual([colsOf(QUARTER), rowsOf(QUARTER)], [12, 12]);
    assert.deepEqual([colsOf(HALF_H), rowsOf(HALF_H)], [12, 24], 'left half: half as wide');
    assert.deepEqual([colsOf(HALF_V), rowsOf(HALF_V)], [24, 12], 'top half: half as tall');
    assert.deepEqual([colsOf(FULL), rowsOf(FULL)], [24, 24]);
    for (const sym of [QUARTER, HALF_H, HALF_V, FULL]) {
        const copies = sym === QUARTER ? 4 : sym === FULL ? 1 : 2;
        assert.equal(colsOf(sym) * rowsOf(sym) * copies, (SPAN - 4) * (SPAN - 4),
            `sym ${sym} does not tile the drawable arena exactly`);
    }
});

test('one block becomes four on a quarter, two on a half, one on a full map', () => {
    const area = BLOCK * BLOCK;
    assert.equal(solid(grid(shape(QUARTER, 3, 5), QUARTER)), 4 * area);
    assert.equal(solid(grid(shape(HALF_H, 3, 5), HALF_H)), 2 * area);
    assert.equal(solid(grid(shape(HALF_V, 3, 5), HALF_V)), 2 * area);
    assert.equal(solid(grid(shape(FULL, 3, 5), FULL)), 1 * area);
});

test('the two halves reflect on opposite axes', () => {
    const h = grid(shape(HALF_H, 3, 5), HALF_H);
    assert.equal(cellAt(h, 22 * BLOCK, 7 * BLOCK), WALL + 1, 'HALF_H reflects left to right');
    assert.equal(cellAt(h, 5 * BLOCK, 20 * BLOCK), 0, 'HALF_H must not reflect top to bottom');

    const v = grid(shape(HALF_V, 3, 5), HALF_V);
    assert.equal(cellAt(v, 5 * BLOCK, 20 * BLOCK), WALL + 1, 'HALF_V reflects top to bottom');
    assert.equal(cellAt(v, 22 * BLOCK, 7 * BLOCK), 0, 'HALF_V must not reflect left to right');
});

test('a full map is placed exactly where it was drawn', () => {
    const g = grid(shape(FULL, 0, 0), FULL);
    assert.equal(cellAt(g, 2 * BLOCK, 2 * BLOCK), WALL + 1);
    assert.equal(cellAt(g, 25 * BLOCK, 2 * BLOCK), 0, 'nothing is reflected');
    const far = grid(shape(FULL, colsOf(FULL) - 1, rowsOf(FULL) - 1), FULL);
    assert.equal(cellAt(far, 25 * BLOCK, 25 * BLOCK), WALL + 1);
});

test('every symmetry still honours the safe rings', () => {
    const edge = 2 * BLOCK;
    for (const sym of [QUARTER, HALF_H, FULL]) {
        const g = grid(shape(sym, 0, 0), sym);
        for (let x = 0; x < W; x++) {
            for (let y = 0; y < H; y++) {
                if (x >= edge && y >= edge && x < W - edge && y < H - edge) continue;
                assert.equal(cellAt(g, x, y), 0, `sym ${sym} touched ${x},${y}`);
            }
        }
    }
});

test('a map with no declared symmetry is a quarter', () => {
    assert.equal(symOf({ n: 'x', q: [] }), QUARTER);
    assert.equal(symOf(undefined), QUARTER);
    for (const m of MAPS) {
        assert.ok([QUARTER, HALF_H, FULL].includes(symOf(m)), `${m.n} has an unknown symmetry`);
    }
});

test('starts are reflected the same way the walls are', () => {
    const mark = (sym, rx, ry) => {
        const rows = shape(sym, -1, -1).slice();
        rows[ry] = rows[ry].slice(0, rx) + 'o' + rows[ry].slice(rx + 1);
        return rows;
    };
    assert.equal(startPoints({ q: mark(QUARTER, 3, 5), m: QUARTER }).length, 4);
    assert.equal(startPoints({ q: mark(HALF_H, 3, 5), m: HALF_H }).length, 2);
    assert.equal(startPoints({ q: mark(HALF_V, 3, 5), m: HALF_V }).length, 2);
    assert.equal(startPoints({ q: mark(FULL, 3, 5), m: FULL }).length, 1);
});

test('an o is a start, never a wall', () => {
    const rows = shape(QUARTER, -1, -1).slice();
    rows[5] = rows[5].slice(0, 3) + 'o' + rows[5].slice(4);
    assert.equal(solid(grid(rows, QUARTER)), 0, 'a start marker painted scenery');
    assert.equal(startPoints({ q: rows, m: QUARTER }).length, 4);
});

const text = (sym, fill) => {
    const letter = sym === QUARTER ? 'q' : sym === HALF_H ? 'h' : sym === HALF_V ? 'v' : 'f';
    return letter + fill.repeat(colsOf(sym) * rowsOf(sym));
};

test('a pasted map round-trips through its text form', () => {
    const m = parseMap(text(QUARTER, '.'));
    assert.equal(m.m, QUARTER);
    assert.equal(m.q.length, 12);
    assert.equal(m.q[0].length, 12);
    assert.equal(m.n, 'Custom');
    assert.equal(parseMap(text(HALF_H, '.')).m, HALF_H);
    assert.equal(parseMap(text(HALF_V, '.')).m, HALF_V);
    assert.equal(parseMap(text(FULL, '.')).m, FULL);
});

test('whitespace is ignored, so a map can be pasted as the rectangle it is', () => {
    const laidOut = 'q\n' + Array.from({ length: 12 }, () => '.'.repeat(12)).join('\n') + '\n';
    assert.deepEqual(parseMap(laidOut), parseMap(text(QUARTER, '.')));
});

test('a map that cannot be read is refused rather than guessed at', () => {
    for (const bad of [
        undefined, null, '', 'q', 'x' + '.'.repeat(144),
        'q' + '.'.repeat(143),                    // one short
        'q' + '.'.repeat(145),                    // one long
        'q' + '.'.repeat(143) + 'Z',              // not a cell
        'f' + '.'.repeat(144),                    // quarter-sized, claims full
    ]) {
        assert.equal(parseMap(bad), null, `accepted ${JSON.stringify(bad)}`);
    }
});

test('an imported map is selectable one past the built-ins', () => {
    const custom = text(QUARTER, '#');
    assert.equal(mapCount(''), MAPS.length);
    assert.equal(mapCount(custom), MAPS.length + 1);
    assert.equal(mapAt(MAPS.length, custom).n, 'Custom');

    assert.equal(mapAt(MAPS.length, '').n, 'Open');
    assert.equal(mapCount('nonsense'), MAPS.length);
});

test('an imported map actually paints, and paints what was pasted', () => {
    const rows = Array.from({ length: 24 }, (_, y) =>
        Array.from({ length: 24 }, (_, x) => (y === 0 && x === 3 ? '#' : '.')).join(''));
    const g = createArena();
    paintMap(g, parseMap('f' + rows.join('')));
    assert.equal(solidCount(g), BLOCK * BLOCK, 'exactly one block');
    assert.equal(cellAt(g, 5 * BLOCK, 2 * BLOCK), WALL + 1);
});

test('an imported map can name its own starts', () => {
    const rows = Array.from({ length: 12 }, (_, y) =>
        Array.from({ length: 12 }, (_, x) => (y === 1 && x === 1 ? 'o' : '.')).join(''));
    const m = parseMap('q' + rows.join(''));
    assert.equal(startPoints(m).length, 4, 'one mark on a quarter is four starts');
    const seated = startsFor([0, 1, 2, 3], m, 42);
    assert.equal(seated.length, 4);
});
