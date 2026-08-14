import { aliveCount } from '#shared';
import { POWER_NAME } from '../render/effects.js';

export const drawHud = (el, net) => {
    if (!net.state) return;
    const me = net.me();
    let bits = '';
    if (me && me.alive) {
        if (me.held) {
            bits += ` · ${POWER_NAME[me.held]} ready`;
        }
        if (me.power) {
            bits += ` · ${POWER_NAME[me.power]}`;
        }
    }
    el.textContent = `${aliveCount(net.state)} alive${bits}`;
};
