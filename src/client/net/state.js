import { createState, tickSim, replay, startsFor, roundOver, PHASE } from '#shared';

const spawnsFrom = (players, map, seed) =>
    startsFor(players.map(([id]) => id), map, seed);

export const createNet = () => ({
    state: null,
    buffer: [],
    myId: -1,
    phase: PHASE.RESULTS,
    players: new Map(),
    humans: new Set(),
    names: new Map(),
    readies: new Map(),
    wins: new Map(),
    code: '',
    hostId: -1,
    map: 0,

    countdownAt: 0,
    resultAt: 0,

    onHello([yourId, tick, seed, phase, startTick, players, turnLog, , , map]) {
        this.myId = yourId;
        this.phase = phase;
        this.map = map || 0;
        this.setPlayers(players);
        this.state = replay(seed, spawnsFrom(players, this.map, seed), turnLog, tick, this.map);
        this.buffer.length = 0;
    },

    onRound([seed, startTick, players, map], now = Date.now()) {
        this.setPlayers(players);
        this.map = map || 0;
        this.state = createState(seed, spawnsFrom(players, this.map, seed), this.map);
        this.phase = PHASE.COUNTDOWN;
        this.buffer.length = 0;
        this.countdownAt = now;
        this.resultAt = 0;
    },

    noteResult(now = Date.now()) {
        if (!this.resultAt) {
            this.resultAt = now;
        }
    },

    setPlayers(players) {
        this.players = new Map(players.map(([id, hue]) => [id, hue]));
        this.humans = new Set(players.filter(([, , bot]) => !bot).map(([id]) => id));
        this.names = new Map(players.map(([id, , , name]) => [id, name]));
        this.readies = new Map(players.map(([id, , , , ready]) => [id, !!ready]));
        this.wins = new Map(players.map(([id, , , , , w]) => [id, w || 0]));
    },

    onState([phase, code, hostId, players, map]) {
        this.phase = phase;
        this.code = code;
        this.hostId = hostId;
        this.map = map || 0;
        this.setPlayers(players);
    },

    isHost() { return this.myId >= 0 && this.myId === this.hostId; },
    nameOf(id) { return this.names.get(id) || `Unicorn ${id + 1}`; },
    winsOf(id) { return this.wins.get(id) || 0; },
    readyOf(id) { return !!this.readies.get(id); },

    onJoin([id, hue]) { this.players.set(id, hue); },
    onLeave([id]) { this.players.delete(id); this.humans.delete(id); },

    result() { return this.state && roundOver(this.state, this.humans); },

    pushTick(tick, turns) {
        this.buffer.push([tick, turns]);
        if (this.state) {
            this.phase = PHASE.RACE;
        }
    },

    drain() {
        if (!this.state || !this.buffer.length) return false;
        const [tick, turns] = this.buffer.shift();
        if (tick <= this.state.tick) return true;
        tickSim(this.state, turns);
        if (this.result()) {
            this.noteResult();
        }
        return true;
    },

    hueOf(id) {
        const h = this.players.get(id);
        return h === undefined ? 0 : h;
    },

    me() {
        return this.state && this.state.unicorns.find((u) => u.id === this.myId);
    },
});
