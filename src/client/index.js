import { EV, MODE, TICK_MS, PHASE, GHOST, SPEED, DECAY_TICKS, FADE_TICKS, HALF, W, H, parseMap } from '#shared';
import { startPinging } from './net/relay.js';
import { createLocalHost } from './host/local.js';
import { createSession, CODES, launchLobby } from './host/session.js';
import { createDemo } from './host/demo.js';
import { makeCode, cleanCode } from './host/code.js';
import { createNet } from './net/state.js';
import { createClock } from './net/clock.js';
import { createPredictor } from './net/prediction.js';
import { setupCanvas, makeLayerCanvas } from './render/canvas.js';
import { createLayers, paintBodyRect, clearCells, clearLayer, beginFade, composite, repaintFromGrid } from './render/trails.js';
import { drawUnicorn } from './render/unicorns.js';
import { drawSparkle, drawPowerRing, drawBoost, drawBurst, POWER_NAME } from './render/effects.js';
import { bindInput, setDirSource, setInputActive } from './input/index.js';
import { drawHud } from './ui/hud.js';
import { drawOverlay } from './ui/overlay.js';
import { sfx, music, muted } from './audio/sfx.js';
import { showMenu, hideMenu, menuError, load, save } from './ui/menu.js';
import { showLobby, hideLobby, renderLobby } from './ui/lobby.js';
import { syncNames, clearNames } from './ui/names.js';
import { showToast, clearToast } from './ui/toast.js';
import { platformReady } from './platform.js';

const { ctx } = setupCanvas(c);

let shownPhase = -1;
const layers = createLayers(makeLayerCanvas);
const net = createNet();
const clock = createClock();
let predictor = createPredictor(-1);
const bursts = [];

const hue = (id) => net.hueOf(id);
const repaint = () => repaintFromGrid(layers, net.state.grid, hue);

const handlers = {
    [EV.HELLO]: (p) => {
        net.onHello(p);
        predictor = createPredictor(net.myId);
        setDirSource(() => { const me = net.me(); return me ? me.dir : 0; });
        repaint();
    },
    [EV.ROUND]: (p) => { net.onRound(p); predictor = createPredictor(net.myId); repaint(); },
    [EV.TICK]: (p) => net.pushTick(p[0], p[1]),
    [EV.JOIN]: (p) => net.onJoin(p),
    [EV.LEAVE]: (p) => net.onLeave(p),
    [EV.PONG]: (p) => clock.onPong(p[0], Date.now()),
    [EV.STATE]: (p) => { net.onState(p); shell(); },
    [EV.ERR]: (p) => menuError(p[0]),
};

let sock = null;
const send = (ev, payload) => {
    if (sock) sock.send(ev, payload);
};


const shell = () => {
    hideMenu();
    quit.hidden = false;
    if (net.phase === PHASE.LOBBY) {
        lobby.appendChild(quit);
        quit.className = '';
        quit.textContent = 'Back to Menu';
        showLobby(
            () => send(EV.READY, []),
            (delta) => send(EV.BOT, [delta]),
            (delta) => send(EV.MAP, [delta]),
            (text) => (parseMap(text)
                ? send(EV.MAPSET, [text])
                : showToast('Bad map')),
            CODES || !sock ? null : () => sock.copyInvite(),
        );
        renderLobby(net);
        clearNames();
        h.textContent = '';
        o.textContent = '';
    } else {
        document.body.appendChild(quit);
        quit.className = 'float';
        quit.textContent = 'Menu';
        hideLobby();
    }
};

let demo = null;

const stopDemo = () => {
    if (!demo) return;
    demo.stop();
    demo = null;
    net.state = null;
    net.phase = PHASE.RESULTS;
    for (let i = 0; i < layers.length; i++) {
        clearLayer(layers, i);
    }
};

const startDemo = () => {
    if (demo) return;
    demo = createDemo({
        [EV.ROUND]: (p) => { net.onRound(p); repaint(); },
        [EV.TICK]: (p) => net.pushTick(p[0], p[1]),
    });
};

const TOUCH = matchMedia('(pointer:coarse)').matches;

const AUTO_ROOM = 'PLAY';
const RELAY = location.hostname === 'localhost' ? `ws://${location.host}` : undefined;

const choose = (mode, name, code) => {
    stopDemo();
    if (sock) sock.close();
    if (mode === MODE.SOLO) {
        sock = createLocalHost(handlers);
    }
    else if (!CODES) {
        sock = createSession(launchLobby(), handlers, {});
    }
    else {
        const typed = cleanCode(code);
        if (mode === MODE.JOIN && !typed) {
            menuError(0);
            return;
        }
        const room = mode === MODE.JOIN ? typed : mode === MODE.AUTO ? AUTO_ROOM : makeCode();
        sock = createSession(room, handlers, { joinOnly: mode === MODE.JOIN, open: mode === MODE.AUTO, base: RELAY });
    }
    send(EV.MENU, [mode, name, code]);
};
if (!CODES) {
    nm.hidden = true;
    code.parentElement.hidden = true;
}
showMenu(choose);
startDemo();
if (!CODES && launchLobby()) {
    choose(MODE.JOIN, '', '');
}

const leave = () => {
    if (net.myId < 0) return;
    send(EV.QUIT, []);
    net.myId = -1;
    net.state = null;
    net.phase = PHASE.RESULTS;
    shownPhase = -1;
    audio();
    clearNames();
    clearToast();
    hideLobby();
    quit.hidden = true;
    h.textContent = '';
    o.textContent = '';
    showMenu(choose);
    startDemo();
};

let off = load('rt.mute') === '1';
const audio = () => {
    muted(off);
    music(!off && net.phase === PHASE.RACE);
    mute.textContent = off ? '🔇' : '🔊';
};
for (const [ev, name] of [['pointerover', 'hover'], ['pointerdown', 'click']]) {
    addEventListener(ev, (e) => {
        if (e.target.tagName === 'BUTTON') sfx(name);
    });
}

mute.onclick = () => {
    off = !off;
    save('rt.mute', off ? '1' : '');
    audio();
};
audio();

quit.onclick = leave;
addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        leave();
    }
});

startPinging({ send });

const lead = () => Math.min(10, net.buffer.length + clock.lagTicks);

setInputActive(() => net.myId >= 0 && net.phase === PHASE.RACE);

bindInput((input) => {
    if (!net.state || net.phase !== PHASE.RACE) return;
    const me = net.me();
    if (!me || !me.alive) return;
    const at = net.state.tick + lead();
    predictor.turn(input, at);
    send(EV.TURN, [input, at]);
});

let lastAt = Date.now();
let owed = 0;

const applyTick = () => {
    const s = net.state;
    const ev = s.events;

    if (ev.broken.length) {
        clearCells(layers, ev.broken);
    }

    for (const u of s.unicorns) {
        if (u.alive && u.power !== GHOST) {
            paintBodyRect(layers, u.id, u.x, u.y, hue(u.id));
        }
    }

    for (const id of ev.deaths) {
        const u = s.unicorns.find((x) => x.id === id);
        bursts.push({ x: u.x, y: u.y, hue: hue(id), born: s.tick });
        beginFade(layers, id, u.deathTick + DECAY_TICKS - FADE_TICKS);
        if (net.myId >= 0) {
            sfx('crash');
        }
    }

    for (const id of ev.clearedIds) {
        clearLayer(layers, id);
    }

    for (const [id] of ev.picked) {
        if (id !== net.myId) continue;
        sfx('pickup');
        const mine = net.me();
        if (mine && mine.held) {
            showToast(`${POWER_NAME[mine.held]} · ${TOUCH ? 'tap below' : 'press SPACE'}`);
        }
    }
};

setInterval(() => {
    const now = Date.now();
    const elapsed = now - lastAt;
    lastAt = now;
    if (!net.state) return;

    if (net.buffer.length > 120) {
        location.reload();
        return;
    }

    owed += elapsed;
    for (let n = 0; owed >= TICK_MS && n < 2; n++) {
        owed -= TICK_MS;
        if (!net.drain()) {
            owed = 0;
            break;
        }
        applyTick();
        predictor.reconcile(net.state.tick);
    }
    if (owed > TICK_MS * 4) {
        owed = TICK_MS * 4;
    }
}, TICK_MS);

const frame = () => {
    requestAnimationFrame(frame);
    if (net.myId >= 0 && net.phase !== shownPhase) {
        shownPhase = net.phase;
        audio();
        shell();
    }
    const held = net.myId >= 0 && net.state ? net.me() : null;
    hint.hidden = !(TOUCH && net.phase === PHASE.RACE && held && held.held);

    if (net.phase === PHASE.LOBBY) return;
    if (!net.state) {
        if (net.myId < 0) {
            o.textContent = '';
        }
        else drawOverlay(o, net);
        return;
    }
    const s = net.state;

    ctx.fillStyle = '#0d0620';
    ctx.fillRect(0, 0, W, H);
    composite(ctx, layers, s.tick);

    for (const sp of s.sparkles) {
        drawSparkle(ctx, sp, s.tick);
    }

    const predicting = net.phase === PHASE.RACE;
    const toTick = s.tick + lead() + 1;
    for (const u of s.unicorns) {
        if (!u.alive) continue;
        const me = u.id === net.myId;
        const p = me && predicting ? predictor.advance(s, toTick) : u;
        if (me && predicting && !p.alive) continue;

        if (me && predicting) {
            ctx.fillStyle = `hsl(${hue(u.id)} 90% 58%)`;
            for (const [cx, cy] of p.cells) {
                ctx.fillRect(cx, cy, 1, 1);
            }
        }
        const power = me && predicting ? p.power : u.power;
        const left = me && predicting ? p.powerTicks : u.powerTicks;
        if (power) {
            drawPowerRing(ctx, p.x, p.y, p.dir, power, left);
        }
        if (power === SPEED) {
            drawBoost(ctx, p.x, p.y, p.dir);
        }
        drawUnicorn(ctx, p.x, p.y, p.dir, hue(u.id), me);
    }

    for (let i = bursts.length - 1; i >= 0; i--) {
        const age = s.tick - bursts[i].born;
        if (age > 20 || age < 0) {
            bursts.splice(i, 1);
            continue;
        }
        drawBurst(ctx, bursts[i].x, bursts[i].y, bursts[i].hue, age);
    }

    if (net.myId < 0) return;

    syncNames(s.unicorns
        .filter((u) => u.alive)
        .map((u) => [u.id, u.x, u.y - HALF, hue(u.id), net.nameOf(u.id)]));

    drawHud(h, net);
    drawOverlay(o, net);
};
requestAnimationFrame(frame);
platformReady();
