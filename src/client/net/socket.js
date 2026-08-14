import { EV } from '#shared';

export const connect = (handlers) => {
    const s = io();
    for (const ev of Object.keys(handlers)) {
        s.on(ev, handlers[ev]);
    }
    return { send: (ev, payload) => s.emit(ev, payload) };
};

export const startPinging = (net, every = 2000) => {
    const ping = () => net.send(EV.PING, [Date.now()]);
    ping();
    setInterval(ping, every);
};
