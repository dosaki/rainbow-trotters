import { createServer } from 'http';
import { WebSocketServer } from 'ws';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
const ID_LEN = 21;
const AT = 0x40;
const BAR = 0x7c;

const makeId = () => {
    let s = '';
    for (let i = 0; i < ID_LEN; i++) {
        s += ALPHABET[(Math.random() * ALPHABET.length) | 0];
    }
    return s;
};

const addressed = (buf) => {
    if (buf[0] !== AT) return null;
    const bar = buf.indexOf(BAR);
    if (bar < 2) return null;
    return { to: buf.subarray(1, bar).toString('utf8'), body: buf.subarray(bar + 1) };
};

export const attachRelay = (server) => {
    const wss = new WebSocketServer({ server });
    const rooms = new Map();

    wss.on('connection', (ws, req) => {
        const path = (req.url || '/').split('?')[0].split('#')[0];
        let room = rooms.get(path);
        if (!room) {
            room = new Map();
            rooms.set(path, room);
        }

        const id = makeId();
        for (const peer of room.values()) {
            peer.send(`+${id}`);
        }
        room.set(id, ws);
        ws.send(`@${id}`);

        ws.on('message', (data, isBinary) => {
            const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
            const direct = addressed(buf);
            if (direct) {
                const target = room.get(direct.to);
                if (target && target.readyState === 1) {
                    target.send(isBinary ? direct.body : direct.body.toString('utf8'), { binary: isBinary });
                }
                return;
            }
            for (const [peerId, peer] of room) {
                if (peerId !== id && peer.readyState === 1) {
                    peer.send(isBinary ? buf : buf.toString('utf8'), { binary: isBinary });
                }
            }
        });

        ws.on('close', () => {
            room.delete(id);
            if (!room.size) {
                rooms.delete(path);
                return;
            }
            for (const peer of room.values()) {
                peer.send(`-${id}`);
            }
        });
    });

    return wss;
};

export const startRelay = async (port = 0) => {
    const server = createServer();
    const wss = attachRelay(server);
    await new Promise((r) => server.listen(port, r));
    return {
        port: server.address().port,
        close: () => new Promise((r) => {
            for (const c of wss.clients) {
                c.terminate();
            }
            wss.close(() => server.close(r));
        }),
    };
};
