import { PHASE, COUNTDOWN_TICKS, RESULTS_TICKS } from '#shared';

export const enterPhase = (room, phase) => {
    room.phase = phase;
    room.phaseTick = 0;
};

export const phaseLength = (phase) =>
    phase === PHASE.COUNTDOWN ? COUNTDOWN_TICKS
        : phase === PHASE.RESULTS ? RESULTS_TICKS
            : Infinity;
