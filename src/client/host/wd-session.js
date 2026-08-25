import { EV, MODE, MAX_PLAYERS, TICK_MS } from '#shared';
import { createHost } from './index.js';

const CHANNEL = 0;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const CODES = false;

const sdk = () => globalThis.Wavedash;

export const launchLobby = () => {
    const w = sdk();
    if (!w || !w.getLaunchParams) return '';
    const params = w.getLaunchParams() || {};
    return params.lobby || '';
};

export const createSession = (lobby, handlers, opts = {}) => {
    const w = sdk();
    const remotes = new Map();
    const waiting = new Map();

    let host = null;
    let mine = null;
    let meId = '';
    let myName = '';
    let hostId = '';
    let lobbyId = '';
    let link = '';
    let poll = null;

    const deliver = (ev, payload) => {
        const h = handlers[ev];
        if (h) h(payload);
    };

    const frame = (ev, payload) => enc.encode(JSON.stringify([ev, payload]));

    const wire = {
        send: (ev, payload) => w.broadcastP2PMessage(CHANNEL, true, frame(ev, payload)),
        sendTo: (id, ev, payload) => w.sendP2PMessage(id, CHANNEL, true, frame(ev, payload)),
    };

    const route = (ev, payload, from) => {
        if (!host) {
            deliver(ev, payload);
            return;
        }
        const player = remotes.get(from);
        if (player) {
            host.input(player, ev, payload);
        }
    };

    const drain = () => {
        for (;;) {
            const msg = w.readP2PMessageFromChannel(CHANNEL);
            if (!msg) return;
            let body;
            try {
                body = JSON.parse(dec.decode(msg.payload));
            } catch {
                continue;
            }
            if (Array.isArray(body)) {
                route(body[0], body[1], msg.fromUserId);
            }
        }
    };

    const seat = (userId, name) => {
        if (!host || remotes.has(userId)) return;
        const player = host.seat({ cid: userId }, name || '');
        if (player) {
            remotes.set(userId, player);
            return;
        }
        wire.sendTo(userId, EV.ERR, [2]);
    };

    const becomeHost = (users) => {
        if (host) return;
        host = createHost({ relay: wire, code: lobbyId });
        mine = host.seat({ deliver }, myName);
        for (const u of users || []) {
            if (u.userId !== meId) {
                waiting.set(u.userId, u.username);
            }
        }
    };

    const onJoined = (payload) => {
        lobbyId = payload.lobbyId;
        hostId = payload.hostId;
        if (hostId === meId) {
            becomeHost(payload.users);
        }
    };

    const LEFT = (w.LobbyUserChangeType || {}).LEFT || 'LEFT';

    const onUsers = (payload) => {
        const gone = payload.changeType === LEFT;
        if (gone) {
            waiting.delete(payload.userId);
            const player = remotes.get(payload.userId);
            if (host && player) {
                remotes.delete(payload.userId);
                host.leave(player.id);
            }
        }
        else if (payload.userId !== meId) {
            waiting.set(payload.userId, payload.username);
        }

        const now = w.getLobbyHostId ? w.getLobbyHostId(lobbyId) : hostId;
        if (now) {
            hostId = now;
        }
        if (hostId === meId && !host) {
            becomeHost(w.getLobbyUsers ? w.getLobbyUsers(lobbyId) : []);
        }
    };

    const onPeerReady = (payload) => {
        const id = payload.userId;
        if (!host || !waiting.has(id)) return;
        const name = waiting.get(id) || payload.username;
        waiting.delete(id);
        seat(id, name);
    };

    const onPeerGone = (payload) => {
        const player = remotes.get(payload.userId);
        if (host && player) {
            remotes.delete(payload.userId);
            host.leave(player.id);
        }
    };

    const enter = async (mode) => {
        const V = w.LobbyVisibility || { PUBLIC: 0, PRIVATE: 2 };
        if (lobby) {
            await w.joinLobby(lobby);
            return;
        }
        if (mode === MODE.AUTO) {
            const list = await w.listAvailableLobbies();
            const spare = ((list && list.data) || list || [])
                .filter((l) => l.lobbyId && l.playerCount < l.maxPlayers)
                .sort((a, b) => b.playerCount - a.playerCount);
            if (spare.length) {
                await w.joinLobby(spare[0].lobbyId);
                return;
            }
            await w.createLobby(V.PUBLIC, MAX_PLAYERS);
            return;
        }
        await w.createLobby(V.PRIVATE, MAX_PLAYERS);
    };

    const E = w.Events;
    w.on(E.LOBBY_JOINED, onJoined);
    w.on(E.LOBBY_USERS_UPDATED, onUsers);
    w.on(E.P2P_CONNECTION_ESTABLISHED, onPeerReady);
    w.on(E.P2P_PEER_DISCONNECTED, onPeerGone);

    const stop = () => {
        if (poll) {
            poll = clearInterval(poll);
        }
        if (host) {
            host.stop();
            host = null;
        }
        if (lobbyId && w.leaveLobby) {
            w.leaveLobby(lobbyId);
        }
    };

    return {
        get id() {
            return meId;
        },
        get isHost() {
            return !!host;
        },
        get room() {
            return host ? host.room : null;
        },
        get invite() {
            return link;
        },
        async copyInvite() {
            const res = await w.getLobbyInviteLink(true);
            link = (res && res.data) || res || '';
            return link;
        },
        send: (ev, payload) => {
            if (ev === EV.MENU) {
                const user = w.getUser ? w.getUser() : null;
                meId = (user && user.id) || '';
                myName = (user && user.username) || (Array.isArray(payload) ? payload[1] : '');
                poll = setInterval(drain, TICK_MS);
                enter(Array.isArray(payload) ? payload[0] : MODE.CREATE);
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
            if (hostId) {
                wire.sendTo(hostId, ev, payload);
            }
        },
        close: stop,
    };
};
