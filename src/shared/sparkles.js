import { W, H, SPARKLE_EVERY, SPARKLE_MAX, PICKUP_REACH, HALF, GHOST, BREAK, SPEED } from './constants.js';
import { cellAt, bodyInBounds } from './arena.js';
import { rngInt } from './rng.js';

const TYPES = [GHOST, BREAK, SPEED];

export const maybeSpawn = (s) => {
    if (s.tick === 0 || s.tick % SPARKLE_EVERY !== 0) return;
    const x = rngInt(s.rng, W);
    const y = rngInt(s.rng, H);
    const type = TYPES[rngInt(s.rng, TYPES.length)];
    if (s.sparkles.length >= SPARKLE_MAX) return;
    if (!bodyInBounds(x, y)) return;
    for (let oy = -HALF; oy <= HALF; oy++) {
        for (let ox = -HALF; ox <= HALF; ox++) {
            if (cellAt(s.grid, x + ox, y + oy) !== 0) return;
        }
    }
    if (s.sparkles.some((sp) => Math.abs(sp.x - x) < 3 && Math.abs(sp.y - y) < 3)) return;
    s.sparkles.push({ i: s.nextSparkle++, x, y, type });
};

export const collectAll = (s) => {
    const took = new Set();
    const gone = new Set();

    for (const sp of s.sparkles) {
        let best = null, bestKey = Infinity;
        for (const u of s.unicorns) {
            if (!u.alive || took.has(u.id)) continue;
            const dx = u.x - sp.x, dy = u.y - sp.y;
            if (Math.abs(dx) > PICKUP_REACH || Math.abs(dy) > PICKUP_REACH) continue;
            const key = (dx * dx + dy * dy) * 100 + u.id;
            if (key < bestKey) {
                bestKey = key;
                best = u;
            }
        }
        if (!best) continue;
        best.held = sp.type;
        took.add(best.id);
        gone.add(sp.i);
        s.events.picked.push([best.id, sp.i]);
    }

    if (gone.size) {
        s.sparkles = s.sparkles.filter((sp) => !gone.has(sp.i));
    }
};
