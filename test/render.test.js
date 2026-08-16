import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    createLayers, paintBodyRect, clearCells, clearLayer, beginFade, fadeAlpha, repaintFromGrid,
} from '../src/client/render/trails.js';
import { keyToInput, relativeTurn } from '../src/client/input/keyboard.js';
import { isTypingTarget } from '../src/client/input/index.js';
import { createArena, paintBody, paint, idx } from '../src/shared/arena.js';
import { drawPowerRing } from '../src/client/render/effects.js';
import { GHOST, TICK_MS } from '../src/shared/constants.js';
import { MAX_PLAYERS, FADE_TICKS, BODY, HALF, W, ACTIVATE, WALL } from '../src/shared/constants.js';

const fakeFactory = () => {
    const ops = [];
    return {
        ops,
        make: () => ({
            width: 0, height: 0,
            getContext: () => ({
                fillStyle: '', globalAlpha: 1,
                fillRect: (x, y, w, h) => ops.push(['fill', x, y, w, h]),
                clearRect: (x, y, w, h) => ops.push(['clear', x, y, w, h]),
                drawImage: () => ops.push(['draw']),
            }),
        }),
    };
};

test('there is one layer per player slot, plus one for the map', () => {
    const f = fakeFactory();
    assert.equal(createLayers(f.make).length, MAX_PLAYERS + 1);
});

test('painting a body writes its whole BODY x BODY footprint on that layer', () => {
    const f = fakeFactory();
    const layers = createLayers(f.make);
    f.ops.length = 0;
    paintBodyRect(layers, 2, 10, 20, 160);
    assert.deepEqual(f.ops, [['fill', 10 - HALF, 20 - HALF, BODY, BODY]]);
});

test('consecutive footprints overlap, so the band cannot have gaps', () => {
    assert.ok(BODY > 2, 'a boosted step would otherwise skip a row of cells');
});

test('clearing a dead trail wipes the whole layer', () => {
    const f = fakeFactory();
    const layers = createLayers(f.make);
    f.ops.length = 0;
    clearLayer(layers, 3);
    assert.equal(f.ops[0][0], 'clear');
});

test('wall break clears the same pixel on every player layer, since any could own it', () => {
    const f = fakeFactory();
    const layers = createLayers(f.make);
    f.ops.length = 0;
    clearCells(layers, [20 * W + 10]);
    assert.equal(f.ops.length, MAX_PLAYERS, 'player layers only, never the map layer');
    assert.deepEqual(f.ops[0], ['clear', 10, 20, 1, 1]);
});

test('a fade runs from 1 down to 0 across FADE_TICKS and never below', () => {
    const f = fakeFactory();
    const layers = createLayers(f.make);
    beginFade(layers, 1, 100);
    assert.equal(fadeAlpha(layers[1], 100), 1);
    assert.ok(Math.abs(fadeAlpha(layers[1], 100 + FADE_TICKS / 2) - 0.5) < 0.06);
    assert.equal(fadeAlpha(layers[1], 100 + FADE_TICKS), 0);
    assert.equal(fadeAlpha(layers[1], 100 + FADE_TICKS * 3), 0);
});

test('a layer with no fade scheduled is fully opaque', () => {
    const f = fakeFactory();
    const layers = createLayers(f.make);
    assert.equal(fadeAlpha(layers[0], 5000), 1);
});

test('clearing a layer also cancels its fade', () => {
    const f = fakeFactory();
    const layers = createLayers(f.make);
    beginFade(layers, 1, 100);
    clearLayer(layers, 1);
    assert.equal(fadeAlpha(layers[1], 200), 1, 'a reused slot must not stay faded');
});

test('repaintFromGrid redraws every painted cell on its owner layer', () => {
    const f = fakeFactory();
    const layers = createLayers(f.make);
    const grid = createArena();
    paintBody(grid, 50, 50, 0);
    paintBody(grid, 90, 90, 3);
    f.ops.length = 0;
    repaintFromGrid(layers, grid, () => 200);
    const clears = f.ops.filter(([op]) => op === 'clear').length;
    const fills = f.ops.filter(([op]) => op === 'fill').length;
    assert.equal(clears, MAX_PLAYERS + 1, 'every layer, map included, is wiped first');
    assert.equal(fills, BODY * BODY * 2, 'and every painted cell is restored');
});

test('arrow keys, WASD and space map to inputs', () => {
    assert.equal(keyToInput('ArrowRight'), 0);
    assert.equal(keyToInput('ArrowDown'), 1);
    assert.equal(keyToInput('ArrowLeft'), 2);
    assert.equal(keyToInput('ArrowUp'), 3);
    assert.equal(keyToInput('d'), 0);
    assert.equal(keyToInput('S'), 1);
    assert.equal(keyToInput(' '), ACTIVATE);
    assert.equal(keyToInput('q'), -1);
});

test('a relative turn rotates around the compass', () => {
    assert.equal(relativeTurn(0, 1), 1);
    assert.equal(relativeTurn(0, -1), 3);
    assert.equal(relativeTurn(3, 1), 0);
    assert.equal(relativeTurn(2, -1), 1);
});

test('a form field is never treated as steering', () => {
    const field = (tag, extra = {}) => ({ tagName: tag, ...extra });
    assert.equal(isTypingTarget(field('INPUT')), true);
    assert.equal(isTypingTarget(field('TEXTAREA')), true);
    assert.equal(isTypingTarget(field('DIV', { isContentEditable: true })), true);
    assert.equal(isTypingTarget(field('CANVAS')), false);
    assert.equal(isTypingTarget(field('BUTTON')), false);
    assert.equal(isTypingTarget(null), false);
    assert.equal(isTypingTarget(undefined), false);
});

test('a wall cell is repainted onto the map layer in flat grey', () => {
    const f = fakeFactory();
    const layers = createLayers(f.make);
    const g = createArena();
    paint(g, 40, 40, WALL);
    const styles = [];
    for (const l of layers) {
        const ctx = l.ctx;
        const fillRect = ctx.fillRect;
        ctx.fillRect = (x, y, w, h) => { styles.push(ctx.fillStyle); fillRect(x, y, w, h); };
    }
    f.ops.length = 0;
    repaintFromGrid(layers, g, () => 200);
    assert.deepEqual(f.ops.filter((o) => o[0] === 'fill'), [['fill', 40, 40, 1, 1]]);
    assert.equal(styles.length, 1);
    assert.ok(!styles[0].startsWith('hsl'), 'scenery must not look like a trail');
});

const WARN = 1000 / TICK_MS;

const ringCtx = () => {
    const at = [];
    const ctx = {
        strokeStyle: '', lineWidth: 0, globalAlpha: 1, shadowColor: '', shadowBlur: 0,
        strokeRect: () => at.push({ alpha: ctx.globalAlpha }),
    };
    return { ctx, at };
};

const ringAt = (left) => {
    const { ctx, at } = ringCtx();
    drawPowerRing(ctx, 50, 50, GHOST, left);
    return at[0];
};

test('the power ring is steady while there is time left', () => {
    for (const left of [WARN + 1, WARN * 2, 120]) {
        assert.equal(ringAt(left).alpha, 1, `alpha at ${left}`);
    }
});

test('the power ring pulses and fades through the final second', () => {
    const seen = [];
    for (let left = WARN; left >= 1; left--) {
        seen.push(ringAt(left));
    }
    assert.ok(seen.every((r) => r.alpha < 1), 'it dims as soon as the warning starts');
    // Pulsing, not a straight ramp: alpha must go back up at least once.
    assert.ok(seen.some((r, i) => i > 0 && r.alpha > seen[i - 1].alpha), 'it pulses');
    // And trends downward overall.
    const first = seen.slice(0, 8).reduce((a, r) => a + r.alpha, 0) / 8;
    const last = seen.slice(-8).reduce((a, r) => a + r.alpha, 0) / 8;
    assert.ok(last < first, `fades overall: ${first.toFixed(2)} -> ${last.toFixed(2)}`);
});

test('the power ring leaves no alpha behind', () => {
    // Without this everything drawn after a dying ring would fade too.
    const { ctx } = ringCtx();
    drawPowerRing(ctx, 50, 50, GHOST, 3);
    assert.equal(ctx.globalAlpha, 1);
});
