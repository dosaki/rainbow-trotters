import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClock } from '../src/client/net/clock.js';
import { createNet } from '../src/client/net/state.js';
import { createRoom, addPlayer, startRound, advance } from '../src/server/room.js';
import { helloPayload } from '../src/server/authority.js';
import { hashGrid } from '../src/shared/arena.js';
import { TICK_MS, COUNTDOWN_TICKS } from '../src/shared/constants.js';
import { PHASE } from '../src/shared/protocol.js';

test('a fresh clock reports no latency rather than guessing', () => {
    const c = createClock();
    assert.equal(c.rtt, 0);
    assert.equal(c.lagTicks, 0);
});

test('latency is measured from the round trip', () => {
    const c = createClock();
    c.onPong(1000, 1000 + TICK_MS * 4);
    assert.equal(c.rtt, TICK_MS * 4);
    assert.equal(c.lagTicks, 4);
});

test('a sub-millisecond link is not charged a whole tick of lead', () => {
    const c = createClock();
    c.onPong(1000, 1001);
    assert.equal(c.lagTicks, 0,
        'ceiling here put every turn 50ms late on a link with no latency at all');
});

test('lead appears as soon as latency is worth a tick', () => {
    const c = createClock();
    c.onPong(1000, 1000 + TICK_MS);
    assert.equal(c.lagTicks, 1);
});

test('a latency spike is ignored in favour of the best sample', () => {
    const c = createClock();
    c.onPong(1000, 1020);
    c.onPong(2000, 2800);
    c.onPong(3000, 3020);
    assert.ok(c.rtt <= 20, `rtt should track the minimum, got ${c.rtt}`);
    assert.equal(c.lagTicks, Math.round(20 / TICK_MS));
});

test('the clock never extrapolates the server tick', () => {
    const c = createClock();
    assert.equal(typeof c.estimate, 'undefined',
        'extrapolating wall time is guesswork; the confirmed tick is the truth');
});

const linked = (raceTicks) => {
    const room = createRoom();
    const p0 = addPlayer(room, null, false);
    const p1 = addPlayer(room, null, false);
    startRound(room);
    for (let i = 0; i < COUNTDOWN_TICKS; i++) {
        advance(room);
    }

    const net = createNet();
    net.onHello(helloPayload(room, p0));

    for (let i = 0; i < raceTicks; i++) {
        const before = room.turnLog.length;
        advance(room);
        const turns = room.turnLog.slice(before).map(([, id, input]) => [id, input]);
        net.pushTick(room.state.tick, turns);
    }
    while (net.drain()) {
        ;
    }
    return { room, net, p0, p1 };
};

test('the client reproduces the server grid exactly from tick messages', () => {
    const { room, net } = linked(120);
    assert.equal(net.state.tick, room.state.tick);
    assert.equal(hashGrid(net.state.grid), hashGrid(room.state.grid),
        'client and server disagree about the arena');
});

test('client and server agree on who is alive and where', () => {
    const { room, net } = linked(200);
    assert.deepEqual(
        net.state.unicorns.map((u) => [u.id, u.x, u.y, u.dir, u.alive]),
        room.state.unicorns.map((u) => [u.id, u.x, u.y, u.dir, u.alive]),
    );
});

test('hello alone rebuilds a race already in progress', () => {
    const { room } = linked(150);
    const latecomer = createNet();
    latecomer.onHello(helloPayload(room, [...room.players.values()][1]));
    assert.equal(latecomer.state.tick, room.state.tick);
    assert.equal(hashGrid(latecomer.state.grid), hashGrid(room.state.grid),
        'a mid-round joiner rebuilt a different arena');
});

test('the buffer holds ticks until the local clock drains them', () => {
    const net = createNet();
    net.onRound([1, 0, [[0, 340], [1, 25]]]);
    net.pushTick(1, []);
    net.pushTick(2, []);
    assert.equal(net.state.tick, 0, 'nothing advances just from arriving');
    assert.equal(net.drain(), true);
    assert.equal(net.state.tick, 1);
    assert.equal(net.drain(), true);
    assert.equal(net.state.tick, 2);
    assert.equal(net.drain(), false, 'an empty buffer holds the last state');
    assert.equal(net.state.tick, 2);
});

test('ticks already simulated are discarded rather than replayed', () => {
    const net = createNet();
    net.onRound([1, 0, [[0, 340], [1, 25]]]);
    net.pushTick(1, []);
    net.drain();
    net.pushTick(1, []);
    net.drain();
    assert.equal(net.state.tick, 1, 'a duplicate tick must not double-advance');
});

test('a new round resets the arena and the buffer', () => {
    const net = createNet();
    net.onRound([1, 0, [[0, 340], [1, 25]]]);
    net.pushTick(1, []);
    net.drain();
    assert.ok(net.state.tick > 0);
    net.onRound([2, 0, [[0, 340], [1, 25]]]);
    assert.equal(net.state.tick, 0);
    assert.equal(net.buffer.length, 0);
    assert.equal(net.phase, PHASE.COUNTDOWN);
});

test('join and leave keep the hue table in step', () => {
    const net = createNet();
    net.onRound([1, 0, [[0, 340]]]);
    net.onJoin([5, 195]);
    assert.equal(net.hueOf(5), 195);
    net.onLeave([5]);
    assert.equal(net.hueOf(5), 0, 'an unknown id falls back rather than throwing');
});

test('a client joining mid-race rebuilds the same arena, not a different one', () => {
    const { room, net } = linked(150);
    const latecomer = addPlayer(room, null, false);
    const late = createNet();
    late.onHello(helloPayload(room, latecomer));
    assert.equal(hashGrid(late.state.grid), hashGrid(room.state.grid),
        'the joiner simulated an arena the server does not have');
    assert.equal(late.state.unicorns.length, room.state.unicorns.length,
        'the joiner spawned a unicorn that does not exist server-side');
    assert.equal(late.me(), undefined, 'and knows it is only spectating');
});

test('both clients still agree after someone joins mid-race', () => {
    const { room, net } = linked(120);
    const latecomer = addPlayer(room, null, false);
    const late = createNet();
    late.onHello(helloPayload(room, latecomer));
    for (let i = 0; i < 40; i++) {
        const before = room.turnLog.length;
        advance(room);
        const turns = room.turnLog.slice(before).map(([, id, input]) => [id, input]);
        net.pushTick(room.state.tick, turns);
        late.pushTick(room.state.tick, turns);
    }
    while (net.drain()) {
        ;
    }
    while (late.drain()) {
        ;
    }
    assert.equal(hashGrid(net.state.grid), hashGrid(late.state.grid));
    assert.deepEqual(net.result(), late.result(), 'they must agree the round is over');
});

test('a state message fills in the lobby view', () => {
    const net = createNet();
    net.myId = 0;
    net.onState([PHASE.LOBBY, 'PONY', 0, [
        [0, 340, 0, 'Tiago', 1, 2],
        [1, 25, 1, 'Bot 2', 1, 0],
    ]]);
    assert.equal(net.phase, PHASE.LOBBY);
    assert.equal(net.code, 'PONY');
    assert.equal(net.isHost(), true);
    assert.equal(net.nameOf(0), 'Tiago');
    assert.equal(net.winsOf(0), 2);
    assert.equal(net.readyOf(0), true);
    assert.equal(net.humans.has(1), false, 'a bot is not a racing human');
});

test('a non-host knows it is not the host', () => {
    const net = createNet();
    net.myId = 1;
    net.onState([PHASE.LOBBY, 'PONY', 0, [[0, 340, 0, 'A', 0, 0], [1, 25, 0, 'B', 0, 0]]]);
    assert.equal(net.isHost(), false);
});

test('an unknown id gets a usable name rather than undefined', () => {
    const net = createNet();
    assert.equal(typeof net.nameOf(7), 'string');
    assert.ok(net.nameOf(7).length > 0);
    assert.equal(net.winsOf(7), 0);
    assert.equal(net.readyOf(7), false);
});

test('names survive a round starting', () => {
    const net = createNet();
    net.myId = 0;
    net.onRound([1, 0, [[0, 340, 0, 'Tiago', 1, 1], [1, 25, 1, 'Bot 2', 1, 0]]]);
    assert.equal(net.nameOf(0), 'Tiago', 'the round roster carries names too');
    assert.equal(net.winsOf(0), 1);
});
