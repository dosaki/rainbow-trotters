import { EV } from '#shared';
import { createHost } from './index.js';

export const createLocalHost = (handlers = {}) => {
    let host = null;
    let player = null;

    const deliver = (ev, payload) => {
        const h = handlers[ev];
        if (h) h(payload);
    };

    const stop = () => {
        if (!host) return;
        host.stop();
        host = null;
        player = null;
    };

    return {
        id: '',
        me: '',
        send: (ev, payload) => {
            if (ev === EV.MENU) {
                if (host) return;
                host = createHost({ solo: true });
                player = host.seat({ deliver }, Array.isArray(payload) ? payload[1] : '');
                return;
            }
            if (ev === EV.QUIT) {
                stop();
                return;
            }
            if (host) {
                host.input(player, ev, payload);
            }
        },
        sendTo: () => {},
        close: stop,
    };
};
