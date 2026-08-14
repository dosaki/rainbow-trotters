import { DIRS, cellAt, bodyInBounds, frontier } from '#shared';

export const freeAhead = (grid, x, y, dir, max) => {
    const [dx, dy] = DIRS[dir];
    let n = 0;
    for (let k = 0; k < max; k++) {
        const cx = x + dx * k, cy = y + dy * k;
        if (!bodyInBounds(cx + dx, cy + dy)) break;
        if (frontier(cx, cy, dir).some(([fx, fy]) => cellAt(grid, fx, fy) !== 0)) break;
        n++;
    }
    return n;
};

export const openness = (grid, x, y, dir) => {
    const [dx, dy] = DIRS[dir];
    const nx = x + dx, ny = y + dy;
    if (!bodyInBounds(nx, ny)) return -1;
    if (frontier(x, y, dir).some(([fx, fy]) => cellAt(grid, fx, fy) !== 0)) return -1;
    const ahead = freeAhead(grid, nx, ny, dir, 30);
    const left = freeAhead(grid, nx, ny, (dir + 3) % 4, 15);
    const right = freeAhead(grid, nx, ny, (dir + 1) % 4, 15);
    return ahead * 2 + left + right;
};
