import { W, WALL } from './constants.js';
import { paint, spawnSlot } from './arena.js';
import { rngFrom, rngInt } from './rng.js';

export const BLOCK = 8;
export const SPAN = W / BLOCK;          // 28 blocks across the arena

const SAFE = 2;
export const DESIGN = SPAN / 2 - SAFE;  // a 12 x 12 designable block area

const block = (grid, bx, by) => {
    const x0 = bx * BLOCK, y0 = by * BLOCK;
    for (let y = y0; y < y0 + BLOCK; y++) {
        for (let x = x0; x < x0 + BLOCK; x++) {
            paint(grid, x, y, WALL);
        }
    }
};

export const FULL = 0, HALF_H = 1, HALF_V = 2, QUARTER = 3;

export const symOf = (m) => (m && m.m) ?? QUARTER;
export const colsOf = (sym) => (sym & HALF_H ? DESIGN : DESIGN * 2);
export const rowsOf = (sym) => (sym & HALF_V ? DESIGN : DESIGN * 2);

const mirrors = (bx, by, sym) => {
    const mx = SPAN - 1 - bx, my = SPAN - 1 - by;
    const out = [[bx, by]];
    if (sym & HALF_H) {
        out.push([mx, by]);
    }
    if (sym & HALF_V) {
        out.push([bx, my]);
    }
    if (sym === QUARTER) {
        out.push([mx, my]);
    }
    return out;
};

export const paintShape = (grid, rows, sym = QUARTER) => {
    for (let ry = 0; ry < rows.length; ry++) {
        for (let rx = 0; rx < rows[ry].length; rx++) {
            if (rows[ry][rx] !== '#') continue;
            for (const [bx, by] of mirrors(rx + SAFE, ry + SAFE, sym)) {
                block(grid, bx, by);
            }
        }
    }
};

export const MAPS = [
    { n: 'Open', q: null },
    {
        n: 'Pillars',
        q: [
            'o...........',
            '.....o......',
            '............',
            '...#..#..#..',
            '............',
            'o...........',
            '...#..#..#..',
            '............',
            '............',
            '...#..#..#..',
            '............',
            '............',
        ],
    },
    {
        n: 'Rings',
        q: [
            '......o.....',
            'o...........',
            '............',
            '...###..####',
            '...#........',
            '...#........',
            '.o..........',
            '............',
            '...#....##.#',
            '...#....#...',
            '...#........',
            '...#....#...',
        ],
    }
];

export const paintMap = (grid, m) => {
    if (m && m.q) {
        paintShape(grid, m.q, symOf(m));
    }
};

const SYMS = { q: QUARTER, h: HALF_H, v: HALF_V, f: FULL };

export const parseMap = (text) => {
    const t = ('' + text).replace(/\s/g, '');
    const sym = SYMS[t[0]];
    if (sym === undefined) return null;
    const body = t.slice(1);
    const cols = colsOf(sym), rows = rowsOf(sym);
    if (body.length !== cols * rows || /[^.#o]/.test(body)) return null;
    const q = [];
    for (let y = 0; y < rows; y++) {
        q.push(body.substr(y * cols, cols));
    }
    return { n: 'Custom', q, m: sym };
};

export const mapAt = (i, custom) =>
    (i < MAPS.length ? MAPS[i] : parseMap(custom)) || MAPS[0];

export const mapCount = (custom) => MAPS.length + (parseMap(custom) ? 1 : 0);

export const startPoints = (m) => {
    const out = [];
    if (!m || !m.q) return out;
    for (let ry = 0; ry < m.q.length; ry++) {
        for (let rx = 0; rx < m.q[ry].length; rx++) {
            if (m.q[ry][rx] !== 'o') continue;
            for (const [px, py] of mirrors(rx + SAFE, ry + SAFE, symOf(m))) {
                const x = px * BLOCK + BLOCK / 2, y = py * BLOCK + BLOCK / 2;
                const dx = W / 2 - x, dy = W / 2 - y;
                const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
                out.push({ x, y, dir });
            }
        }
    }
    return out;
};

export const startsFor = (ids, m, seed) => {
    const pts = startPoints(m);
    if (pts.length < ids.length) return ids.map((id, i) => ({ id, ...spawnSlot(i, ids.length) }));
    const rng = rngFrom(seed);
    for (let i = pts.length - 1; i > 0; i--) {
        const j = rngInt(rng, i + 1);
        const t = pts[i]; pts[i] = pts[j]; pts[j] = t;
    }
    return ids.map((id, i) => ({ id, ...pts[i] }));
};
