import {
    DIRS, cellAt, bodyInBounds, frontier, isLegalTurn,
    GHOST, SPEED, ACTIVATE, POWER_TICKS, STEP_COST, STEP_GAIN, STEP_GAIN_BOOST,
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
        if (!u || !u.alive) {
            return { x: u ? u.x : 0, y: u ? u.y : 0, dir: u ? u.dir : 0, alive: false, cells: [], power: 0, held: 0 };
        }

        let { x, y, dir } = u;
        let alive = true;
        const cells = [];

        let held = u.held, power = u.power, powerTicks = u.powerTicks;

        let acc = u.acc;

        const end = Math.min(toTick, state.tick + MAX_LEAD);
        let k = 0;
        for (let t = state.tick; t < end && alive; t++) {
            while (k < this.pending.length && this.pending[k][0] <= t) {
                const pd = this.pending[k++][1];
                if (pd === ACTIVATE) {
                    if (held && !power) {
                        power = held;
                        powerTicks = POWER_TICKS;
                        held = 0;
                    }
                } else if (isLegalTurn(dir, pd)) {
                    dir = pd;
                }
            }

            const ghost = power === GHOST;

            acc += power === SPEED ? STEP_GAIN_BOOST : STEP_GAIN;
            let steps = (acc / STEP_COST) | 0;
            acc -= steps * STEP_COST;

            while (steps-- > 0) {
                const [dx, dy] = DIRS[dir];
                const nx = x + dx, ny = y + dy;
                const front = frontier(x, y, dir);
                if (!bodyInBounds(nx, ny)) {
                    alive = false;
                    break;
                }
                if (!ghost && front.some(([cx, cy]) => cellAt(state.grid, cx, cy) !== 0)) {
                    alive = false;
                    break;
                }
                x = nx; y = ny;
                if (!ghost) {
                    for (const c of front) {
                        cells.push(c);
                    }
                }
            }
            if (powerTicks > 0 && --powerTicks === 0) {
                power = 0;
            }
        }

        return { x, y, dir, alive, cells, power, held, powerTicks };
    },
});
