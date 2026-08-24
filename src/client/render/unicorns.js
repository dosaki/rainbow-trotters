import { DIRS } from '#shared';

export const drawUnicorn = (ctx, x, y, dir, hue, isYou) => {
    const [dx, dy] = DIRS[dir];
    const px = -dy, py = dx;
    const cx = x + 0.5, cy = y + 0.5;
    const rect = (f0, s0, f1, s1, c) => {
        const ax = cx + dx * f0 + px * s0, ay = cy + dy * f0 + py * s0;
        const bx = cx + dx * f1 + px * s1, by = cy + dy * f1 + py * s1;
        ctx.fillStyle = c;
        ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
    };

    const dark = `hsl(${hue} 50% 10%)`;
    const coat = `hsl(${hue} 92% 70%)`;
    const lit = `hsl(${hue} 100% 88%)`;
    const maneA = `hsl(${(hue + 45) % 360} 95% 68%)`;
    const maneB = `hsl(${(hue + 100) % 360} 95% 68%)`;

    rect(-3, -2, 3.5, 2, dark);
    rect(-2.5, -1.5, 2.5, 1.5, coat);

    rect(-2, -2, -1, -1.5, dark);
    rect(-2, 1.5, -1, 2, dark);
    rect(0.5, -2, 1.5, -1.5, dark);
    rect(0.5, 1.5, 1.5, 2, dark);

    rect(-3.5, -1, -2.5, 0, maneB);
    rect(-3.5, 0, -2.5, 1, maneA);

    rect(0, -1.5, 0.5, 1.5, maneA);
    rect(0.5, -1.5, 1, 1.5, maneB);

    rect(1.5, -1, 3, 1, lit);
    rect(3, -0.5, 3.5, 0.5, lit);
    rect(2, -1, 2.5, -0.5, dark);
    rect(2, 0.5, 2.5, 1, dark);

    rect(3, -0.5, 4.5, 0.5, '#ffd24a');
    rect(4, -0.5, 4.5, 0.5, '#fffbe8');

    if (isYou) {
        rect(-4.5, -3.5, -4, 3.5, '#fff');
        rect(5, -3.5, 5.5, 3.5, '#fff');
        rect(-4.5, -3.5, 5.5, -3, '#fff');
        rect(-4.5, 3, 5.5, 3.5, '#fff');
    }
};
