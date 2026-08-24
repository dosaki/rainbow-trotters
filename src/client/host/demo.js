import { MAX_PLAYERS, mapCount } from '#shared';
import { createHost } from './index.js';
import { addBot } from './room.js';

export const createDemo = (handlers) => {
    const host = createHost({ demo: true });
    host.room.map = (Math.random() * mapCount('')) | 0;
    for (let i = 0; i < MAX_PLAYERS; i++) {
        addBot(host.room);
    }
    host.room.watch = (ev, payload) => {
        const h = handlers[ev];
        if (h) h(payload);
    };
    return { stop: host.stop };
};
