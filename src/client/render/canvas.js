import { W, H } from '#shared';

export const setupCanvas = (el) => {
    const ctx = el.getContext('2d');
    const resize = () => {
        const side = Math.min(innerWidth, innerHeight);
        el.width = W;
        el.height = H;
        el.style.width = `${side}px`;
        el.style.height = `${side}px`;
        ctx.imageSmoothingEnabled = false;
    };
    addEventListener('resize', resize);
    resize();
    return { ctx, resize };
};

export const makeLayerCanvas = () => document.createElement('canvas');
