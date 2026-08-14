import { STEP_COST, STEP_GAIN, STEP_GAIN_BOOST, SPEED } from './constants.js';

export const createUnicorn = (id, x, y, dir) => ({
    id, x, y, dir,
    acc: 0,
    held: 0,
    power: 0,
    powerTicks: 0,
    alive: true,
    deathTick: -1,
    cells: 0,
});

export const isLegalTurn = (dir, next) => next !== (dir + 2) % 4;

export const applyTurn = (u, next) => {
    if (!isLegalTurn(u.dir, next)) return false;
    u.dir = next;
    return true;
};

export const stepsThisTick = (u) => {
    u.acc += u.power === SPEED ? STEP_GAIN_BOOST : STEP_GAIN;
    const steps = (u.acc / STEP_COST) | 0;
    u.acc -= steps * STEP_COST;
    return steps;
};
