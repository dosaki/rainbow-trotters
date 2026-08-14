import { DIRS, ACTIVATE, BODY, DECAY_TICKS, ROUND_CAP_TICKS } from './constants.js';
import { createArena, cellAt, paint, paintBody, bodyInBounds, frontier, clearOwner } from './arena.js';
import { rngFrom } from './rng.js';
import { createUnicorn, applyTurn, stepsThisTick } from './unicorn.js';
import { expirePower, isGhost, isBreaking, breakSwath, usePower } from './powers.js';
import { maybeSpawn, collectAll } from './sparkles.js';

export const createState = (seed, spawns) => {
    const grid = createArena();
    const unicorns = spawns.map((s) => createUnicorn(s.id, s.x, s.y, s.dir));
    for (const u of unicorns) {
        paintBody(grid, u.x, u.y, u.id);
    }
    return {
        tick: 0,
        seed,
        rng: rngFrom(seed),
        grid,
        unicorns,
        sparkles: [],
        nextSparkle: 0,
        dead: [],
        events: emptyEvents(),
    };
};

const emptyEvents = () => ({ deaths: [], cleared: [], clearedIds: [], broken: [], picked: [] });

export const aliveCount = (s) => s.unicorns.reduce((n, u) => n + (u.alive ? 1 : 0), 0);

export const unicornById = (s, id) => s.unicorns.find((u) => u.id === id);

const kill = (s, u) => {
    if (!u.alive) return;
    u.alive = false;
    u.deathTick = s.tick;
    s.dead.push({ id: u.id, clearTick: s.tick + DECAY_TICKS });
    s.events.deaths.push(u.id);
};

const subStep = (s, movers) => {
    const moves = movers.map((u) => {
        const [dx, dy] = DIRS[u.dir];
        return { u, nx: u.x + dx, ny: u.y + dy, front: frontier(u.x, u.y, u.dir) };
    });

    const doomed = new Set();

    for (const m of moves) {
        if (!bodyInBounds(m.nx, m.ny)) {
            doomed.add(m.u.id);
            continue;
        }
        if (isGhost(m.u) || isBreaking(m.u)) continue;
        if (m.front.some(([cx, cy]) => cellAt(s.grid, cx, cy) !== 0)) {
            doomed.add(m.u.id);
        }
    }

    for (let i = 0; i < moves.length; i++) {
        for (let j = i + 1; j < moves.length; j++) {
            const a = moves[i], b = moves[j];
            const overlap = Math.abs(a.nx - b.nx) < BODY && Math.abs(a.ny - b.ny) < BODY;
            if (!overlap) continue;
            if (!isGhost(a.u)) {
                doomed.add(a.u.id);
            }
            if (!isGhost(b.u)) {
                doomed.add(b.u.id);
            }
        }
    }

    for (const m of moves) {
        if (doomed.has(m.u.id)) {
            kill(s, m.u);
            continue;
        }
        const ox = m.u.x, oy = m.u.y;
        m.u.x = m.nx;
        m.u.y = m.ny;
        if (isBreaking(m.u)) {
            for (const i of breakSwath(s.grid, ox, oy, m.u.dir)) {
                s.events.broken.push(i);
            }
        }
        if (!isGhost(m.u)) {
            for (const [cx, cy] of m.front) {
                paint(s.grid, cx, cy, m.u.id);
            }
            m.u.cells += BODY;
        }
    }
};

export const tickSim = (s, turns) => {
    s.events = emptyEvents();

    for (let n = s.dead.length - 1; n >= 0; n--) {
        if (s.dead[n].clearTick !== s.tick) continue;
        for (const i of clearOwner(s.grid, s.dead[n].id)) {
            s.events.cleared.push(i);
        }
        s.events.clearedIds.push(s.dead[n].id);
        s.dead.splice(n, 1);
    }

    maybeSpawn(s);

    for (const [id, action] of turns) {
        const u = unicornById(s, id);
        if (!u || !u.alive) continue;
        if (action === ACTIVATE) {
            usePower(u);
        }
        else applyTurn(u, action);
    }

    const alive = s.unicorns.filter((u) => u.alive);
    const steps = new Map(alive.map((u) => [u.id, stepsThisTick(u)]));

    for (let phase = 0; phase < 2; phase++) {
        const movers = alive.filter((u) => u.alive && steps.get(u.id) > phase);
        if (movers.length) {
            subStep(s, movers);
        }
    }

    for (const u of s.unicorns) {
        if (u.alive) {
            expirePower(u);
        }
    }
    collectAll(s);

    s.tick++;
};

export const roundResult = (s) => {
    const alive = s.unicorns.filter((u) => u.alive);
    if (alive.length === 1) return { winner: alive[0].id, reason: 'last' };
    if (alive.length === 0) return { winner: -1, reason: 'draw' };
    if (s.tick >= ROUND_CAP_TICKS) {
        const best = alive.reduce((a, b) => (b.cells > a.cells ? b : a));
        return { winner: best.id, reason: 'cap' };
    }
    return null;
};

export const roundOver = (s, humans) => {
    const r = roundResult(s);
    if (r) return r;
    if (!humans || !humans.size) return null;
    if (s.unicorns.some((u) => u.alive && humans.has(u.id))) return null;
    return { winner: -1, reason: 'out' };
};

export const replay = (seed, spawns, turnLog, toTick) => {
    const s = createState(seed, spawns);
    const byTick = new Map();
    for (const [t, id, dir] of turnLog) {
        if (!byTick.has(t)) {
            byTick.set(t, []);
        }
        byTick.get(t).push([id, dir]);
    }
    while (s.tick < toTick) {
        tickSim(s, byTick.get(s.tick) || []);
    }
    return s;
};
