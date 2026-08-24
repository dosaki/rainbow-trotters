import { DIRS, BODY, ACTIVATE, GHOST, BREAK, rngInt, isLegalTurn } from '#shared';
import { freeAhead, openness } from './vision.js';

const LOOKAHEAD = 14;
const SPARKLE_RANGE = 45;

export const botInputs = (state, u, rng) => {
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

    if (room >= LOOKAHEAD) {
        const sp = state.sparkles.find((s) =>
            Math.abs(s.x - u.x) + Math.abs(s.y - u.y) < SPARKLE_RANGE);
        if (sp && rngInt(rng, 5) === 0) {
            const want = Math.abs(sp.x - u.x) > Math.abs(sp.y - u.y)
                ? (sp.x > u.x ? 0 : 2)
                : (sp.y > u.y ? 1 : 3);
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
