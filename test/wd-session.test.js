import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EV, MODE, PHASE, TICK_MS, COUNTDOWN_TICKS } from '#shared';
import { createPlatform } from '../scripts/wd-mock.mjs';
import { createSession, CODES, launchLobby } from '../src/client/host/wd-session.js';

const settle = (ms = 120) => new Promise((r) => setTimeout(r, ms));

const stage = (t) => {
    const platform = createPlatform();
    const open = [];
    const real = globalThis.Wavedash;
    t.after(() => {
        for (const s of open) {
            s.close();
        }
        globalThis.Wavedash = real;
    });

    const join = (name, mode = MODE.CREATE, launch = '') => {
        const c = platform.client(name, launch);
        globalThis.Wavedash = c.sdk;
        const seen = [];
        const s = createSession(launch, {
            [EV.HELLO]: (p) => seen.push([EV.HELLO, p]),
            [EV.STATE]: (p) => seen.push([EV.STATE, p]),
            [EV.ROUND]: (p) => seen.push([EV.ROUND, p]),
            [EV.TICK]: (p) => seen.push([EV.TICK, p]),
            [EV.ERR]: (p) => seen.push([EV.ERR, p]),
        }, {});
        s.of = (ev) => seen.filter(([e]) => e === ev);
        s.uid = c.id;
        s.drop = c.drop;
        s.sdk = c.sdk;
        open.push(s);
        s.send(EV.MENU, [mode, name, '']);
        return s;
    };

    return { platform, join, use: (s) => { globalThis.Wavedash = s.sdk; } };
};

test('the wavedash build reports that it does not use typed codes', () => {
    assert.equal(CODES, false, 'the menu hides the code box off this flag');
});

test('creating a lobby makes you its host without any claim protocol', async (t) => {
    const { join } = stage(t);
    const a = join('Alice');
    await settle();
    assert.equal(a.isHost, true, 'the platform named us host in LOBBY_JOINED');
    assert.equal(a.of(EV.HELLO).length, 1, 'and we seated ourselves');
});

test('a second player is seated by the host once their channel opens', async (t) => {
    const { platform, join } = stage(t);
    const a = join('Alice');
    await settle();
    const lobby = platform.lobbyIds()[0];
    const b = join('Bob', MODE.CREATE, lobby);
    await settle(300);

    assert.equal(a.isHost, true);
    assert.equal(b.isHost, false, 'exactly one host, decided by the platform');
    assert.equal(b.of(EV.HELLO).length, 1, 'the host answered them directly');

    const names = [...a.room.players.values()].map((p) => p.name).sort();
    assert.deepEqual(names, ['Alice', 'Bob'], 'and used their wavedash usernames');
});

test('a guest input reaches the host over p2p', async (t) => {
    const { platform, join, use } = stage(t);
    const a = join('Alice');
    await settle();
    const b = join('Bob', MODE.CREATE, platform.lobbyIds()[0]);
    await settle(300);

    use(b);
    b.send(EV.READY, []);
    await settle(300);

    const guest = [...a.room.players.values()].find((p) => p.name === 'Bob');
    assert.ok(guest, 'the guest is seated');
    assert.equal(guest.ready, true, 'the host applied their input');
});

test('a game runs across the platform', async (t) => {
    const { platform, join, use } = stage(t);
    const a = join('Alice');
    await settle();
    const b = join('Bob', MODE.CREATE, platform.lobbyIds()[0]);
    await settle(300);

    use(a);
    a.send(EV.BOT, [1]);
    a.send(EV.READY, []);
    use(b);
    b.send(EV.READY, []);
    await settle(TICK_MS * (COUNTDOWN_TICKS + 14));

    assert.ok(b.of(EV.ROUND).length >= 1, 'the guest was told a round started');
    assert.ok(b.of(EV.TICK).length >= 1, 'and is receiving the simulation');
});

test('a leaving guest is dropped from the room', async (t) => {
    const { platform, join } = stage(t);
    const a = join('Alice');
    await settle();
    const b = join('Bob', MODE.CREATE, platform.lobbyIds()[0]);
    await settle(300);
    assert.equal(a.room.players.size, 2);

    b.drop();
    await settle(200);
    assert.equal(a.room.players.size, 1, 'the host saw the disconnect');
});

test('when the host leaves the platform promotes a guest', async (t) => {
    const { platform, join } = stage(t);
    const a = join('Alice');
    await settle();
    const lobby = platform.lobbyIds()[0];
    const b = join('Bob', MODE.CREATE, lobby);
    await settle(300);
    assert.equal(b.isHost, false);

    a.drop();
    await settle(300);
    assert.equal(platform.hostOf(lobby), b.uid, 'the platform moved hosting');
    assert.equal(b.isHost, true, 'and the session took it up');
    assert.equal(b.room.phase, PHASE.LOBBY);
});

test('auto-join lands in an existing public lobby rather than a new one', async (t) => {
    const { platform, join } = stage(t);
    const a = join('Alice', MODE.AUTO);
    await settle(200);
    assert.equal(platform.lobbyIds().length, 1, 'the first player opened one');

    const b = join('Bob', MODE.AUTO);
    await settle(300);
    assert.equal(platform.lobbyIds().length, 1, 'the second joined it instead of opening another');
    assert.equal(a.room.players.size, 2);
});

test('an invite link is obtainable for the current lobby', async (t) => {
    const { join } = stage(t);
    const a = join('Alice');
    await settle();
    const link = await a.copyInvite();
    assert.match(link, /^https:\/\//, 'the invite is a shareable url');
});

test('a launch param is what the invite flow hands back to the game', async (t) => {
    const { platform, join } = stage(t);
    const a = join('Alice');
    await settle();
    const lobby = platform.lobbyIds()[0];

    const c = platform.client('Cara', lobby);
    globalThis.Wavedash = c.sdk;
    assert.equal(launchLobby(), lobby, 'the game reads the lobby id off the launch params');
    void a;
});

test('the fake platform speaks the sdk vocabulary, not my paraphrase of it', () => {
    const platform = createPlatform();
    const c = platform.client('Probe');

    assert.deepEqual(c.sdk.LobbyUserChangeType, { JOINED: 'JOINED', LEFT: 'LEFT' },
        'these literals are what the sdk ships; lowercasing them silently breaks departures');
    assert.deepEqual(c.sdk.LobbyVisibility, { PUBLIC: 0, FRIENDS_ONLY: 1, PRIVATE: 2 });
});

test('an available lobby is identified by lobbyId, with a player count', async () => {
    const platform = createPlatform();
    const c = platform.client('Probe');
    await c.sdk.createLobby(c.sdk.LobbyVisibility.PUBLIC, 8);
    const res = await c.sdk.listAvailableLobbies();

    const row = res.data[0];
    assert.ok(row.lobbyId, 'the list keys lobbies on lobbyId, not id or _id');
    assert.equal(typeof row.playerCount, 'number');
    assert.equal(typeof row.maxPlayers, 'number');
    c.drop();
});
