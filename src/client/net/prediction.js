import {
    DIRS, bodyInBounds, frontier, canStep, GHOST, ACTIVATE,
    applyTurn, usePower, expirePower, stepsThisTick,
} from '#shared';

const MAX_LEAD = 30;

export const createPredictor = (myId) => ({
    myId,
    pending: [],

    turn(input, tick) {
        this.pending.push([tick, input]);
    },

    reconcile(tick) {
        this.pending = this.pending.filter(([t]) => t > tick);
    },

    advance(state, toTick) {
        const u = state.unicorns.find((x) => x.id === this.myId);
        const p = { x: 0, y: 0, dir: 0, power: 0, held: 0, powerTicks: 0, ...u, cells: [] };
        if (!u || !u.alive) {
            p.alive = false;
            return p;
        }
        const end = Math.min(toTick, state.tick + MAX_LEAD);
        let k = 0;
        for (let t = state.tick; t < end && p.alive; t++) {
            while (k < this.pending.length && this.pending[k][0] <= t) {
                const pd = this.pending[k++][1];
                if (pd === ACTIVATE) {
                    usePower(p);
                } else {
                    applyTurn(p, pd);
                }
            }

            const ghost = p.power === GHOST;
            let steps = stepsThisTick(p);

            while (steps-- > 0) {
                const [dx, dy] = DIRS[p.dir];
                const nx = p.x + dx, ny = p.y + dy;
                const front = frontier(p.x, p.y, p.dir);
                if (!(ghost ? bodyInBounds(nx, ny) : canStep(state.grid, p.x, p.y, p.dir))) {
                    p.alive = false;
                    break;
                }
                p.x = nx;
                p.y = ny;
                if (!ghost) {
                    for (const c of front) {
                        p.cells.push(c);
                    }
                }
            }
            expirePower(p);
        }
        return p;
    },
});
