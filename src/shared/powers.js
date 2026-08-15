import { GHOST, BREAK, POWER_TICKS, DIRS, BODY, HALF, WALL } from './constants.js';
import { idx, inBounds, cellAt, clearCell } from './arena.js';

export const grantPower = (u, type) => {
    u.power = type;
    u.powerTicks = POWER_TICKS;
};

export const usePower = (u) => {
    if (!u.held || u.power) return false;
    grantPower(u, u.held);
    u.held = 0;
    return true;
};

export const expirePower = (u) => {
    if (u.powerTicks > 0 && --u.powerTicks === 0) {
        u.power = 0;
    }
};

export const isGhost = (u) => u.power === GHOST;
export const isBreaking = (u) => u.power === BREAK;

export const breakSwath = (grid, x, y, dir) => {
    const [dx, dy] = DIRS[dir];
    const cx = x + dx * (HALF + 1), cy = y + dy * (HALF + 1);
    const px = dy, py = dx;
    const reach = HALF + BODY;
    const cleared = [];
    for (let k = -reach; k <= reach; k++) {
        const ax = cx + px * k, ay = cy + py * k;
        if (!inBounds(ax, ay)) continue;
        const v = cellAt(grid, ax, ay);
        if (v === WALL + 1) continue;
        if (v !== 0) {
            clearCell(grid, ax, ay);
        }
        cleared.push(idx(ax, ay));
    }
    return cleared;
};
