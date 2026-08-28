import { DIRS, BODY, ACTIVATE, GHOST, BREAK, rngInt, isLegalTurn } from '#shared';
import { freeAhead, openness } from './vision.js';

const LOOKAHEAD = 14;
const SPARKLE_RANGE = 45;
const toward = (u, tx, ty) => (Math.abs(tx - u.x) > Math.abs(ty - u.y)
    ? (tx > u.x ? 0 : 2)
    : (ty > u.y ? 1 : 3));

const nearest = (state, u) => {
    let foe = null, near = 1e9;
    for (const o of state.unicorns) {
        if (o.id === u.id || !o.alive) continue;
        const d = Math.abs(o.x - u.x) + Math.abs(o.y - u.y);
        if (d < near) {
            near = d;
            foe = o;
        }
    }
    return foe;
};

export const botInputs = (state, u, rng, kind = 0) => {
    const g = state.grid;
    const out = [];
    const room = freeAhead(g, u.x, u.y, u.dir, LOOKAHEAD);

    if (u.held && !u.power && room < BODY) {
        const escapes = u.held === GHOST || u.held === BREAK;
        if (escapes) {
            out.push(ACTIVATE);
        }
    } else if (u.held && !u.power && u.held !== GHOST && u.held !== BREAK && room >= LOOKAHEAD) {
        if (rngInt(rng, 60) === 0) {
            out.push(ACTIVATE);
        }
    }

    if (kind && rngInt(rng, 6) === 0) {
        const foe = nearest(state, u);
        if (foe) {
            const [fx, fy] = DIRS[foe.dir];
            const aim = kind === 1 ? 10 : 0;
            const want = toward(u, foe.x + fx * aim, foe.y + fy * aim);
            if (want !== u.dir && isLegalTurn(u.dir, want)
                && (kind > 1 || openness(g, u.x, u.y, want) > 0)) {
                out.push(want);
                return out;
            }
        }
    }

    if (room >= LOOKAHEAD) {
        const sp = state.sparkles.find((s) =>
            Math.abs(s.x - u.x) + Math.abs(s.y - u.y) < SPARKLE_RANGE);
        if (sp && rngInt(rng, 5) === 0) {
            const want = toward(u, sp.x, sp.y);
            if (want !== u.dir && isLegalTurn(u.dir, want) && openness(g, u.x, u.y, want) > 0) {
                out.push(want);
                return out;
            }
        }
        if (rngInt(rng, 50) !== 0) return out;
    }

    let best = -1, bestScore = -1;
    for (let d = 0; d < DIRS.length; d++) {
        if (!isLegalTurn(u.dir, d)) continue;
        const score = openness(g, u.x, u.y, d) + rngInt(rng, 4);
        if (score > bestScore) {
            bestScore = score;
            best = d;
        }
    }
    if (best >= 0 && best !== u.dir) {
        out.push(best);
    }
    return out;
};
