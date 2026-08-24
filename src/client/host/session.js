import { EV, ERR } from '#shared';
import { connect } from '../net/relay.js';
import { createHost } from './index.js';

const CLAIM_MS = 700;
const RETRIES = 1;

export const createSession = (code, handlers, opts = {}) => {
    const claimMs = opts.claimMs || CLAIM_MS;
    const seen = new Set();
    const remotes = new Map();

    let host = null;
    let mine = null;
    let hostCid = '';
    let joinName = '';
    let waiting = false;
    let tries = 0;
    let timer = null;

    const deliver = (ev, payload) => {
        const h = handlers[ev];
        if (h) h(payload);
    };

    const stopTimer = () => {
        if (timer) {
            clearTimeout(timer);
            timer = null;
        }
    };

    const seatClaim = (cid, who) => {
        const player = host.seat({ cid }, who || '');
        if (player) {
            remotes.set(cid, player);
        }
    };

    const becomeHost = () => {
        if (host) return;
        stopTimer();
        waiting = false;
        host = createHost({ relay, code, open: !!opts.open });
        mine = host.seat({ deliver }, joinName);
        for (const cid of seen) {
            seatClaim(cid, '');
        }
        seen.clear();
    };

    const demote = (cid) => {
        host.stop();
        host = null;
        mine = null;
        remotes.clear();
        seen.clear();
        hostCid = cid;
    };

    const decide = () => {
        if (host || hostCid) return;
        const beatenBy = [...seen].some((id) => id < relay.id);
        if (beatenBy && tries < RETRIES) {
            tries++;
            timer = setTimeout(decide, claimMs);
            return;
        }
        if (opts.joinOnly) {
            waiting = false;
            deliver(EV.ERR, [ERR.NO_ROOM]);
            return;
        }
        becomeHost();
    };

    const claim = () => {
        if (host || hostCid) return;
        waiting = true;
        relay.send(EV.CLAIM, [joinName]);
        stopTimer();
        timer = setTimeout(decide, claimMs);
    };

    const onAny = (ev, payload, from) => {
        if (ev === EV.CLAIM) {
            if (host) {
                seatClaim(from, Array.isArray(payload) ? payload[0] : '');
                return;
            }
            seen.add(from);
            return;
        }

        if (host && ev === EV.HELLO && from && from < relay.id) {
            demote(from);
            deliver(ev, payload);
            return;
        }

        if (host) {
            const player = remotes.get(from);
            if (player) {
                host.input(player, ev, payload);
            }
            return;
        }

        if (ev === EV.HELLO) {
            hostCid = from;
            seen.clear();
            stopTimer();
            waiting = false;
        }
        deliver(ev, payload);
    };

    const onPart = (cid) => {
        if (host) {
            const player = remotes.get(cid);
            if (player) {
                remotes.delete(cid);
                host.leave(player.id);
            }
            return;
        }
        if (cid && cid === hostCid) {
            hostCid = '';
            seen.clear();
            tries = 0;
            claim();
        }
    };

    const relay = connect(code, {}, {
        onId: () => {
            if (waiting) claim();
        },
        onAny,
        onPart,
    }, opts.base);

    const stop = () => {
        stopTimer();
        if (host) {
            host.stop();
            host = null;
        }
        relay.close();
    };

    return {
        get id() {
            return relay.id;
        },
        get isHost() {
            return !!host;
        },
        get room() {
            return host ? host.room : null;
        },
        send: (ev, payload) => {
            if (ev === EV.MENU) {
                joinName = Array.isArray(payload) ? payload[1] : '';
                if (relay.id) {
                    claim();
                }
                else waiting = true;
                return;
            }
            if (ev === EV.QUIT) {
                stop();
                return;
            }
            if (host) {
                host.input(mine, ev, payload);
                return;
            }
            if (hostCid) {
                relay.sendTo(hostCid, ev, payload);
            }
        },
        close: stop,
    };
};
