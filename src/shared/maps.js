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

export const paintQuarter = (grid, rows) => {
    for (let ry = 0; ry < DESIGN; ry++) {
        for (let rx = 0; rx < DESIGN; rx++) {
            if (rows[ry][rx] !== '#') continue;
            const bx = rx + SAFE, by = ry + SAFE;
            const mx = SPAN - 1 - bx, my = SPAN - 1 - by;
            block(grid, bx, by);
            block(grid, mx, by);
            block(grid, bx, my);
            block(grid, mx, my);
        }
    }
};

export const MAPS = [
    { n: 'Open', q: null },
    {
        n: 'Pillars',
        q: [
            'o....o......',
            '............',
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
            'o.....o.....',
            '............',
            '............',
            '...###..####',
            '...#........',
            '...#........',
            'o...........',
            '............',
            '...#....##.#',
            '...#....#...',
            '...#........',
            '...#....#...',
        ],
    },
    {
        n: 'Cross',
        q: [
            'o....o......',
            '............',
            '............',
            '..........##',
            '..........##',
            'o.........##',
            '..........##',
            '..........##',
            '..........##',
            '..........##',
            '...#########',
            '...#########',
        ],
    },
];

export const paintMap = (grid, i) => {
    const m = MAPS[i];
    if (m && m.q) {
        paintQuarter(grid, m.q);
    }
};

export const mapName = (i) => (MAPS[i] || MAPS[0]).n;

const quadrants = (bx, by) =>
    [[bx, by], [SPAN - 1 - bx, by], [bx, SPAN - 1 - by], [SPAN - 1 - bx, SPAN - 1 - by]];

export const startPoints = (map) => {
    const m = MAPS[map];
    const out = [];
    if (!m || !m.q) return out;
    for (let ry = 0; ry < DESIGN; ry++) {
        for (let rx = 0; rx < DESIGN; rx++) {
            if (m.q[ry][rx] !== 'o') continue;
            for (const [px, py] of quadrants(rx + SAFE, ry + SAFE)) {
                const x = px * BLOCK + BLOCK / 2, y = py * BLOCK + BLOCK / 2;
                const dx = W / 2 - x, dy = W / 2 - y;
                const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3);
                out.push({ x, y, dir });
            }
        }
    }
    return out;
};

export const startsFor = (ids, map, seed) => {
    const pts = startPoints(map);
    if (pts.length < ids.length) return ids.map((id, i) => ({ id, ...spawnSlot(i, ids.length) }));
    const rng = rngFrom(seed);
    for (let i = pts.length - 1; i > 0; i--) {
        const j = rngInt(rng, i + 1);
        const t = pts[i]; pts[i] = pts[j]; pts[j] = t;
    }
    return ids.map((id, i) => ({ id, ...pts[i] }));
};
