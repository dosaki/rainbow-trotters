import { EV, MODE, ERR, PHASE, TICK_MS, SOLO_BOTS, MAPS, parseMap } from '#shared';
import { addPlayer, addBot, removeBot, advance, setReady, stateOf, cycleMap } from './room.js';
import { createRegistry, createLobby, joinByCode, autoJoin, dropPlayer } from './lobby.js';
import { scheduleTurn, helloPayload } from './authority.js';
import { broadcast, sendTo } from './broadcast.js';

const rooms = createRegistry();

let lastAt = Date.now();
let owed = 0;
setInterval(() => {
    const now = Date.now();
    owed += now - lastAt;
    lastAt = now;
    for (let n = 0; owed >= TICK_MS && n < 5; n++) {
        owed -= TICK_MS;
        for (const room of rooms.values()) {
            advance(room);
        }
    }
    if (owed > TICK_MS * 20) {
        owed = 0;
    }
}, TICK_MS);

const announce = (room) => broadcast(room, EV.STATE, stateOf(room));

export default {
    io: (socket) => {
        let room = null;
        let player = null;

        socket.on(EV.MENU, (msg) => {
            if (room || !Array.isArray(msg)) return;
            const [mode, name, code] = msg;

            let target;
            if (mode === MODE.JOIN) {
                target = joinByCode(rooms, code);
            }
            else if (mode === MODE.AUTO) {
                target = autoJoin(rooms);
            }
            else target = createLobby(rooms, false);

            if (typeof target === 'number') {
                sendTo({ socket }, EV.ERR, [target]);
                return;
            }

            player = addPlayer(target, socket, false, name);
            if (!player) {
                sendTo({ socket }, EV.ERR, [ERR.FULL]);
                return;
            }
            room = target;

            if (mode === MODE.SOLO) {
                room.solo = true;
                for (let i = 0; i < SOLO_BOTS; i++) {
                    addBot(room);
                }
            }

            sendTo(player, EV.HELLO, helloPayload(room, player));
            announce(room);
        });

        socket.on(EV.READY, () => {
            if (!room || room.phase !== PHASE.LOBBY) return;
            setReady(room, player.id, !player.ready);
            announce(room);
        });

        socket.on(EV.BOT, (msg) => {
            if (!room || room.phase !== PHASE.LOBBY) return;
            if (room.hostId !== player.id) return;
            if (!Array.isArray(msg)) return;
            if (msg[0] > 0) {
                addBot(room);
            } else {
                removeBot(room);
            }
            announce(room);
        });

        socket.on(EV.MAP, (msg) => {
            if (!room || room.phase !== PHASE.LOBBY) return;
            if (room.hostId !== player.id) return;
            if (!Array.isArray(msg)) return;
            cycleMap(room, msg[0]);
            announce(room);
        });

        socket.on(EV.MAPSET, (msg) => {
            if (!room || room.phase !== PHASE.LOBBY) return;
            if (room.hostId !== player.id) return;
            if (!Array.isArray(msg) || !parseMap(msg[0])) return;
            room.custom = msg[0];
            room.map = MAPS.length;
            announce(room);
        });

        socket.on(EV.QUIT, () => {
            if (!room) return;
            const gone = room;
            const id = player.id;
            room = null;
            player = null;
            dropPlayer(rooms, gone, id);
            if (rooms.has(gone.code)) {
                broadcast(gone, EV.STATE, stateOf(gone));
            }
        });

        socket.on(EV.TURN, (msg) => {
            if (!room || !Array.isArray(msg)) return;
            scheduleTurn(room, player, msg[0], msg[1]);
        });

        socket.on(EV.PING, (msg) => {
            if (!Array.isArray(msg)) return;
            sendTo({ socket }, EV.PONG, [msg[0], room && room.state ? room.state.tick : 0]);
        });

        socket.on('disconnect', () => {
            if (!room) return;
            const gone = room;
            dropPlayer(rooms, room, player.id);
            room = null;
            if (rooms.has(gone.code)) {
                announce(gone);
            }
        });
    },
};
