import { DIRS, canStep } from '#shared';

export const freeAhead = (grid, x, y, dir, max) => {
    const [dx, dy] = DIRS[dir];
    let n = 0;
    for (let k = 0; k < max; k++) {
        if (!canStep(grid, x + dx * k, y + dy * k, dir)) break;
        n++;
    }
    return n;
};

export const openness = (grid, x, y, dir) => {
    if (!canStep(grid, x, y, dir)) return -1;
    const [dx, dy] = DIRS[dir];
    const nx = x + dx, ny = y + dy;
    const ahead = freeAhead(grid, nx, ny, dir, 30);
    const left = freeAhead(grid, nx, ny, (dir + 3) % 4, 15);
    const right = freeAhead(grid, nx, ny, (dir + 1) % 4, 15);
    return ahead * 2 + left + right;
};
