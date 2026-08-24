import { DIRS, BODY, HALF, LHALF, GHOST, BREAK, SPEED, TICK_MS } from '#shared';

const WARN = 1000 / TICK_MS;

export const POWER_COLOUR = { [GHOST]: '#9ff', [BREAK]: '#f9c', [SPEED]: '#ffd' };
export const POWER_NAME = { [GHOST]: 'GHOST', [BREAK]: 'BREAK', [SPEED]: 'SPEED' };

export const drawSparkle = (ctx, sp, tick) => {
    ctx.fillStyle = POWER_COLOUR[sp.type] || '#fff';
    ctx.globalAlpha = 0.55 + Math.sin(tick / 3) * 0.25;
    ctx.fillRect(sp.x - HALF, sp.y - HALF, BODY, BODY);
    ctx.globalAlpha = 1;
};

export const drawPowerRing = (ctx, x, y, dir, power, left) => {
    const [dx] = DIRS[dir];
    const ex = (dx ? LHALF : HALF) + 1.5;
    const ey = (dx ? HALF : LHALF) + 1.5;
    ctx.strokeStyle = POWER_COLOUR[power] || '#fff';
    ctx.lineWidth = 1;
    if (left <= WARN) {
        ctx.globalAlpha = (left / WARN) * 0.45 + 0.55 * (0.55 + 0.45 * Math.cos(left * 0.45));
    }
    ctx.strokeRect(x + 0.5 - ex, y + 0.5 - ey, ex * 2, ey * 2);
    ctx.globalAlpha = 1;
};

export const drawBoost = (ctx, x, y, dir) => {
    const [dx, dy] = DIRS[dir];
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    for (let k = LHALF + 1; k < LHALF + 6; k++) {
        ctx.fillRect(x - dx * k, y - dy * k, 1, 1);
    }
};

export const drawBurst = (ctx, x, y, hue, age) => {
    ctx.strokeStyle = `hsl(${hue} 95% 65% / ${Math.max(0, 1 - age / 20)})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, age * 1.6, 0, 7);
    ctx.stroke();
};
