import { W, H, MAX_PLAYERS, FADE_TICKS, BODY, HALF, WALL } from '#shared';

export const createLayers = (make) =>
    Array.from({ length: MAX_PLAYERS + 1 }, () => {
        const canvas = make();
        canvas.width = W;
        canvas.height = H;
        return { canvas, ctx: canvas.getContext('2d'), fadeFrom: -1 };
    });

const fill = (layers, id, hue) => {
    const l = layers[id];
    if (!l) return null;
    l.ctx.fillStyle = id === WALL ? '#4d3d80' : `hsl(${hue} 90% 58%)`;
    return l;
};

export const paintBodyRect = (layers, id, x, y, hue) => {
    const l = fill(layers, id, hue);
    if (l) {
        l.ctx.fillRect(x - HALF, y - HALF, BODY, BODY);
    }
};

export const clearLayer = (layers, id) => {
    const l = layers[id];
    if (!l) return;
    l.ctx.clearRect(0, 0, W, H);
    l.fadeFrom = -1;
};

export const clearCells = (layers, indices) => {
    for (const i of indices) {
        const x = i % W, y = (i / W) | 0;
        for (let n = 0; n < MAX_PLAYERS; n++) {
            layers[n].ctx.clearRect(x, y, 1, 1);
        }
    }
};

export const beginFade = (layers, id, tick) => {
    if (layers[id]) {
        layers[id].fadeFrom = tick;
    }
};

export const fadeAlpha = (layer, tick) => {
    if (layer.fadeFrom < 0) return 1;
    const gone = tick - layer.fadeFrom;
    if (gone <= 0) return 1;
    if (gone >= FADE_TICKS) return 0;
    return 1 - gone / FADE_TICKS;
};

export const composite = (ctx, layers, tick) => {
    for (const l of layers) {
        const a = fadeAlpha(l, tick);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.drawImage(l.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
};

export const repaintFromGrid = (layers, grid, hueOf) => {
    for (let i = 0; i < layers.length; i++) {
        clearLayer(layers, i);
    }
    for (let i = 0; i < grid.length; i++) {
        const v = grid[i];
        if (!v) continue;
        const l = fill(layers, v - 1, hueOf(v - 1));
        if (l) {
            l.ctx.fillRect(i % W, (i / W) | 0, 1, 1);
        }
    }
};
