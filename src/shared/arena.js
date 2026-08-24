import { W, H, HALF, BODY, LHALF, DIRS } from './constants.js';

export const createArena = () => new Uint8Array(W * H);

export const idx = (x, y) => y * W + x;

export const inBounds = (x, y) => x >= 0 && x < W && y >= 0 && y < H;

export const cellAt = (grid, x, y) => grid[y * W + x];

export const paint = (grid, x, y, id) => { grid[y * W + x] = id + 1; };

export const clearCell = (grid, x, y) => { grid[y * W + x] = 0; };

export const clearOwner = (grid, id) => {
    const v = id + 1, cleared = [];
    for (let i = 0; i < grid.length; i++) {
        if (grid[i] === v) {
            grid[i] = 0;
            cleared.push(i);
        }
    }
    return cleared;
};

export const halfSpan = (dir) => {
    if (dir === undefined) return [LHALF, LHALF];
    return DIRS[dir][0] ? [LHALF, HALF] : [HALF, LHALF];
};

export const bodyInBounds = (x, y, dir) => {
    const [ex, ey] = halfSpan(dir);
    return x - ex >= 0 && x + ex < W && y - ey >= 0 && y + ey < H;
};

export const paintBody = (grid, x, y, id, dir) => {
    const [ex, ey] = halfSpan(dir);
    for (let oy = -ey; oy <= ey; oy++) {
        for (let ox = -ex; ox <= ex; ox++) {
            grid[(y + oy) * W + (x + ox)] = id + 1;
        }
    }
};

const perp = (x, y, dir, half) => {
    const [dx, dy] = DIRS[dir];
    const cx = x + dx * (LHALF + 1);
    const cy = y + dy * (LHALF + 1);
    const px = dy, py = dx;
    const cells = [];
    for (let k = -half; k <= half; k++) {
        cells.push([cx + px * k, cy + py * k]);
    }
    return cells;
};

export const frontier = (x, y, dir) => perp(x, y, dir, HALF);

export const canStep = (grid, x, y, dir) => {
    const [dx, dy] = DIRS[dir];
    return bodyInBounds(x + dx, y + dy, dir)
        && !frontier(x, y, dir).some(([cx, cy]) => cellAt(grid, cx, cy) !== 0);
};

export const swath = (x, y, dir) => perp(x, y, dir, HALF + BODY * 2);

export const spawnSlot = (i, n) => {
    const M = 8;
    const slot = (i / Math.max(n, 1)) * 4;
    const side = Math.floor(slot) % 4;
    const t = slot - Math.floor(slot);
    const span = (d) => d - 1 - M * 2;
    if (side === 0) return { x: Math.round(M + t * span(W)), y: M, dir: 1 };
    if (side === 1) return { x: W - 1 - M, y: Math.round(M + t * span(H)), dir: 2 };
    if (side === 2) return { x: Math.round(W - 1 - M - t * span(W)), y: H - 1 - M, dir: 3 };
    return { x: M, y: Math.round(H - 1 - M - t * span(H)), dir: 0 };
};

export const hashGrid = (grid) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < grid.length; i++) {
        h ^= grid[i];
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h >>> 0;
};
