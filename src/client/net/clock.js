import { TICK_MS } from '#shared';

export const createClock = () => {
    let minRtt = Infinity;
    return {
        get rtt() { return minRtt === Infinity ? 0 : minRtt; },
        get lagTicks() { return minRtt === Infinity ? 0 : Math.round(minRtt / TICK_MS); },
        onPong(clientTime, now) {
            minRtt = Math.min(minRtt, now - clientTime);
        },
    };
};
