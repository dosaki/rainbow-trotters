const EVENTS = {
    LOBBY_JOINED: 'LobbyJoined',
    LOBBY_USERS_UPDATED: 'LobbyUsersUpdated',
    P2P_CONNECTION_ESTABLISHED: 'P2PConnectionEstablished',
    P2P_PEER_DISCONNECTED: 'P2PPeerDisconnected',
};

export const createPlatform = () => {
    const lobbies = new Map();
    const clients = new Map();
    let nextId = 1;

    const emit = (userId, event, payload) => {
        const c = clients.get(userId);
        if (!c) return;
        for (const fn of c.listeners.get(event) || []) {
            fn(payload);
        }
    };

    const members = (lobbyId) => [...clients.values()].filter((c) => c.lobbyId === lobbyId);

    const roster = (lobbyId) => members(lobbyId).map((c) => ({
        userId: c.id,
        username: c.name,
        isHost: lobbies.get(lobbyId).hostId === c.id,
        lobbyId,
    }));

    const join = (client, lobbyId) => {
        const lobby = lobbies.get(lobbyId);
        if (!lobby) return false;
        const existing = members(lobbyId);
        client.lobbyId = lobbyId;
        if (!lobby.hostId) {
            lobby.hostId = client.id;
        }
        emit(client.id, EVENTS.LOBBY_JOINED, {
            lobbyId,
            hostId: lobby.hostId,
            users: roster(lobbyId),
            metadata: {},
        });
        for (const peer of existing) {
            emit(peer.id, EVENTS.LOBBY_USERS_UPDATED, {
                userId: client.id, username: client.name, lobbyId, changeType: 'JOINED',
            });
        }
        for (const peer of existing) {
            emit(peer.id, EVENTS.P2P_CONNECTION_ESTABLISHED, { userId: client.id, username: client.name });
            emit(client.id, EVENTS.P2P_CONNECTION_ESTABLISHED, { userId: peer.id, username: peer.name });
        }
        return true;
    };

    const leave = (client) => {
        const lobbyId = client.lobbyId;
        if (!lobbyId) return;
        client.lobbyId = '';
        const lobby = lobbies.get(lobbyId);
        const left = members(lobbyId);
        if (lobby && lobby.hostId === client.id) {
            lobby.hostId = left.length ? left[0].id : '';
        }
        for (const peer of left) {
            emit(peer.id, EVENTS.LOBBY_USERS_UPDATED, {
                userId: client.id, username: client.name, lobbyId, changeType: 'LEFT',
            });
            emit(peer.id, EVENTS.P2P_PEER_DISCONNECTED, { userId: client.id });
        }
    };

    const sdkFor = (client) => ({
        Events: EVENTS,
        LobbyVisibility: { PUBLIC: 0, FRIENDS_ONLY: 1, PRIVATE: 2 },
        LobbyUserChangeType: { JOINED: 'JOINED', LEFT: 'LEFT' },
        init: () => { client.inited = true; },
        getUser: () => ({ id: client.id, username: client.name, avatarUrl: undefined }),
        getLaunchParams: () => ({ lobby: client.launch || undefined }),
        on: (event, fn) => {
            const list = client.listeners.get(event) || [];
            list.push(fn);
            client.listeners.set(event, list);
        },
        createLobby: async (visibility, maxPlayers) => {
            const id = `lobby-${nextId++}`;
            lobbies.set(id, { id, visibility, maxPlayers, hostId: '' });
            join(client, id);
            return { success: true, data: id };
        },
        joinLobby: async (lobbyId) => ({ success: true, data: join(client, lobbyId) }),
        leaveLobby: async () => { leave(client); return { success: true, data: client.lobbyId }; },
        listAvailableLobbies: async () => ({
            success: true,
            data: [...lobbies.values()]
                .filter((l) => l.visibility === 0 && members(l.id).length < l.maxPlayers)
                .map((l) => ({ lobbyId: l.id, playerCount: members(l.id).length, maxPlayers: l.maxPlayers, visibility: l.visibility, metadata: {} })),
        }),
        getLobbyUsers: (lobbyId) => roster(lobbyId),
        getLobbyHostId: (lobbyId) => (lobbies.get(lobbyId) || {}).hostId || null,
        getLobbyInviteLink: async () => ({ success: true, data: `https://wavedash.test/${client.lobbyId}` }),
        broadcastP2PMessage: (channel, reliable, payload) => {
            for (const peer of members(client.lobbyId)) {
                if (peer.id !== client.id) {
                    peer.inbox.push({ fromUserId: client.id, channel, payload });
                }
            }
            return true;
        },
        sendP2PMessage: (toUserId, channel, reliable, payload) => {
            const peer = clients.get(toUserId);
            if (!peer || peer.lobbyId !== client.lobbyId) return false;
            peer.inbox.push({ fromUserId: client.id, channel, payload });
            return true;
        },
        readP2PMessageFromChannel: (channel) => {
            const i = client.inbox.findIndex((m) => m.channel === channel);
            return i < 0 ? null : client.inbox.splice(i, 1)[0];
        },
    });

    return {
        client: (name, launch = '') => {
            const client = {
                id: `user-${nextId++}`, name, launch, lobbyId: '',
                listeners: new Map(), inbox: [],
            };
            clients.set(client.id, client);
            return { id: client.id, sdk: sdkFor(client), drop: () => leave(client) };
        },
        lobbyIds: () => [...lobbies.keys()],
        hostOf: (lobbyId) => (lobbies.get(lobbyId) || {}).hostId,
    };
};
