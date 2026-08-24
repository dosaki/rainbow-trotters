import { EV, PHASE, MAPS, parseMap, TICK_MS, SOLO_BOTS } from '#shared';
import {
    createRoom, addPlayer, addBot, removeBot, removePlayer,
    advance, setReady, stateOf, cycleMap,
} from './room.js';
import { scheduleTurn, helloPayload } from './authority.js';
import { broadcast, sendTo } from './broadcast.js';

const CATCH_UP = 5;
const DRIFT_LIMIT = 20;

export const createHost = (opts = {}) => {
    const room = createRoom(opts.code || '', !!opts.open);
    room.relay = opts.relay || null;
    room.solo = !!opts.solo;
    room.demo = !!opts.demo;

    const announce = () => broadcast(room, EV.STATE, stateOf(room));

    let lastAt = Date.now();
    let owed = 0;
    const timer = setInterval(() => {
        const now = Date.now();
        owed += now - lastAt;
        lastAt = now;
        for (let n = 0; owed >= TICK_MS && n < CATCH_UP; n++) {
            owed -= TICK_MS;
            advance(room);
        }
        if (owed > TICK_MS * DRIFT_LIMIT) {
            owed = 0;
        }
    }, TICK_MS);

    const seat = (link, name) => {
        const player = addPlayer(room, link, false, name);
        if (!player) return null;
        if (room.solo && room.players.size === 1) {
            for (let i = 0; i < SOLO_BOTS; i++) {
                addBot(room);
            }
        }
        sendTo(room, player, EV.HELLO, helloPayload(room, player));
        announce();
        return player;
    };

    const leave = (id) => {
        if (!room.players.has(id)) return;
        removePlayer(room, id);
        announce();
    };

    const lobbyHost = (player) => room.phase === PHASE.LOBBY && room.hostId === player.id;

    const input = (player, ev, msg) => {
        if (!player || !room.players.has(player.id)) return;

        if (ev === EV.TURN) {
            if (Array.isArray(msg)) {
                scheduleTurn(room, player, msg[0], msg[1]);
            }
            return;
        }
        if (ev === EV.PING) {
            if (Array.isArray(msg)) {
                sendTo(room, player, EV.PONG, [msg[0], room.state ? room.state.tick : 0]);
            }
            return;
        }
        if (ev === EV.READY) {
            if (room.phase !== PHASE.LOBBY) return;
            setReady(room, player.id, !player.ready);
            announce();
            return;
        }
        if (ev === EV.BOT) {
            if (!lobbyHost(player) || !Array.isArray(msg)) return;
            if (msg[0] > 0) {
                addBot(room);
            }
            else removeBot(room);
            announce();
            return;
        }
        if (ev === EV.MAP) {
            if (!lobbyHost(player) || !Array.isArray(msg)) return;
            cycleMap(room, msg[0]);
            announce();
            return;
        }
        if (ev === EV.MAPSET) {
            if (!lobbyHost(player) || !Array.isArray(msg) || !parseMap(msg[0])) return;
            room.custom = msg[0];
            room.map = MAPS.length;
            announce();
            return;
        }
        if (ev === EV.QUIT) {
            leave(player.id);
        }
    };

    return {
        room,
        seat,
        leave,
        input,
        stop: () => clearInterval(timer),
    };
};
