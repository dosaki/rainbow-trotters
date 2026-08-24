import { EV } from '#shared';

const RELAY = 'wss://relay.js13kgames.com/rainbow-trotters';

export const connect = (code, handlers, sys = {}, base) => {
    const root = base || RELAY;
    const ws = new WebSocket(code ? `${root}/${code}` : root);
    const queue = [];
    const raw = (line) => {
        if (ws.readyState === 1) {
            ws.send(line);
        }
        else queue.push(line);
    };

    const api = {
        id: '',
        me: '',
        send: (ev, payload) => raw(JSON.stringify([ev, payload, api.me])),
        sendTo: (cid, ev, payload) => raw(`@${cid}|${JSON.stringify([ev, payload, api.me])}`),
        close: () => ws.close(),
    };

    ws.onopen = () => {
        for (const line of queue) {
            ws.send(line);
        }
        queue.length = 0;
        if (sys.onOpen) sys.onOpen();
    };

    ws.onmessage = (e) => {
        const m = e.data;
        const c = m[0];
        if (c === '@') {
            api.id = m.slice(1);
            if (!api.me) {
                api.me = api.id;
            }
            if (sys.onId) sys.onId(api.id);
            return;
        }
        if (c === '+') {
            if (sys.onJoin) sys.onJoin(m.slice(1));
            return;
        }
        if (c === '-') {
            if (sys.onPart) sys.onPart(m.slice(1));
            return;
        }
        let msg;
        try {
            msg = JSON.parse(m);
        } catch {
            return;
        }
        if (!Array.isArray(msg)) return;
        const h = handlers[msg[0]];
        if (h) h(msg[1], msg[2]);
        else if (sys.onAny) sys.onAny(msg[0], msg[1], msg[2]);
    };

    return api;
};

export const startPinging = (net, every = 2000) => {
    const ping = () => net.send(EV.PING, [Date.now()]);
    ping();
    setInterval(ping, every);
};
