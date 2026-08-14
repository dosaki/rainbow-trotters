import { DIRS, BODY, HALF } from '#shared';

export const drawUnicorn = (ctx, x, y, dir, hue, isYou) => {
    const [dx, dy] = DIRS[dir];
    const bx = x - HALF, by = y - HALF;

    ctx.fillStyle = `hsl(${hue} 95% 78%)`;
    ctx.fillRect(bx, by, BODY, BODY);

    ctx.fillStyle = '#fff';
    ctx.fillRect(x + dx * (HALF + 1), y + dy * (HALF + 1), 1, 1);

    ctx.fillRect(x + dx, y + dy, 1, 1);

    ctx.fillStyle = `hsl(${hue} 90% 42%)`;
    ctx.fillRect(x - dx * (HALF + 1), y - dy * (HALF + 1), 1, 1);

    if (isYou) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 1.5, by - 1.5, BODY + 3, BODY + 3);
    }
};
