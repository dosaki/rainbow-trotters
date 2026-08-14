import { EV, TICK_MS, PHASE, GHOST, SPEED, DECAY_TICKS, FADE_TICKS } from '#shared';
import { connect, startPinging } from './net/socket.js';
import { createNet } from './net/state.js';
import { createClock } from './net/clock.js';
import { createPredictor } from './net/prediction.js';
import { setupCanvas, makeLayerCanvas } from './render/canvas.js';
import { createLayers, paintBodyRect, clearCells, clearLayer, beginFade, composite, repaintFromGrid } from './render/trails.js';
import { drawUnicorn } from './render/unicorns.js';
import { drawSparkle, drawPowerRing, drawBoost, drawBurst } from './render/effects.js';
import { bindInput, setDirSource } from './input/index.js';
import { drawHud } from './ui/hud.js';
import { drawOverlay } from './ui/overlay.js';
import { sfx } from './audio/sfx.js';

const { ctx } = setupCanvas(document.getElementById('c'));
const hudEl = document.getElementById('h');
const overlayEl = document.getElementById('o');

const layers = createLayers(makeLayerCanvas);
const net = createNet();
const clock = createClock();
let predictor = createPredictor(-1);
const bursts = [];

const hue = (id) => net.hueOf(id);
const repaint = () => repaintFromGrid(layers, net.state.grid, hue);

const sock = connect({
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
});

startPinging(sock);

const lead = () => Math.min(10, net.buffer.length + clock.lagTicks);

bindInput((input) => {
    if (!net.state || net.phase !== PHASE.RACE) return;
    const me = net.me();
    if (!me || !me.alive) return;
    const at = net.state.tick + lead();
    predictor.turn(input, at);
    sock.send(EV.TURN, [input, at]);
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
        sfx('crash');
    }

    for (const id of ev.clearedIds) {
        clearLayer(layers, id);
    }

    for (const [id] of ev.picked) {
        if (id === net.myId) {
            sfx('pickup');
        }
    }

    if (net.phase === PHASE.COUNTDOWN && s.tick % 20 === 0) {
        sfx('count');
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
    if (!net.state) {
        drawOverlay(overlayEl, net);
        return;
    }
    const s = net.state;

    ctx.fillStyle = '#07070d';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
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
        if (power) {
            drawPowerRing(ctx, p.x, p.y, power);
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

    drawHud(hudEl, net);
    drawOverlay(overlayEl, net);
};
requestAnimationFrame(frame);
