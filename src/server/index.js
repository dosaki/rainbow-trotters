import { EV, TICK_MS, PHASE } from '#shared';
import { createRoom, addHuman, removePlayer, advance, startRound, backfill } from './room.js';
import { scheduleTurn, helloPayload } from './authority.js';
import { broadcast, sendTo } from './broadcast.js';

const room = createRoom();
startRound(room);

let lastAt = Date.now();
let owed = 0;
setInterval(() => {
    const now = Date.now();
    owed += now - lastAt;
    lastAt = now;
    for (let n = 0; owed >= TICK_MS && n < 5; n++) {
        owed -= TICK_MS;
        advance(room);
    }
    if (owed > TICK_MS * 20) {
        owed = 0;
    }
}, TICK_MS);

export default {
    io: (socket) => {
        const player = addHuman(room, socket);
        if (!player) {
            socket.disconnect();
            return;
        }

        if (room.phase === PHASE.COUNTDOWN) {
            startRound(room);
        }

        sendTo(player, EV.HELLO, helloPayload(room, player));
        broadcast(room, EV.JOIN, [player.id, player.hue, 0]);

        socket.on(EV.TURN, (msg) => {
            if (!Array.isArray(msg)) return;
            scheduleTurn(room, player, msg[0], msg[1]);
        });
        socket.on(EV.PING, (msg) => {
            if (!Array.isArray(msg)) return;
            sendTo(player, EV.PONG, [msg[0], room.state ? room.state.tick : 0]);
        });

        socket.on('disconnect', () => {
            removePlayer(room, player.id);
            backfill(room);
            broadcast(room, EV.LEAVE, [player.id]);
        });
    },
};
