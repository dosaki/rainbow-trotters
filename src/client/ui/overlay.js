import { PHASE, COUNTDOWN_TICKS, RESULTS_TICKS, TICK_MS, aliveCount } from '#shared';

const secondsLeft = (startedAt, ticks, now) =>
    Math.ceil((ticks * TICK_MS - (now - startedAt)) / 1000);

export const drawOverlay = (el, net, now = Date.now()) => {
    if (!net.state) {
        el.textContent = 'connecting…';
        return;
    }

    if (net.phase === PHASE.COUNTDOWN) {
        const left = secondsLeft(net.countdownAt, COUNTDOWN_TICKS, now);
        el.textContent = left > 0 ? String(left) : 'GO';
        return;
    }

    const result = net.result();
    if (result) {
        const wait = Math.max(0, secondsLeft(net.resultAt || now, RESULTS_TICKS, now));
        const who = !net.me() ? 'ROUND OVER'
            : result.winner === net.myId ? 'YOU WIN'
                : result.reason === 'out' ? 'YOU CRASHED'
                    : result.winner < 0 ? 'EVERYONE CRASHED'
                        : 'ROUND OVER';
        el.textContent = `${who} · next round in ${wait}`;
        return;
    }

    const me = net.me();
    if (!me) {
        el.textContent = 'spectating · next round soon';
        return;
    }
    el.textContent = me.alive ? '' : `crashed · ${aliveCount(net.state)} still racing`;
};
