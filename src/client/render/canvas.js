import { W, H } from '#shared';

export const DETAIL = 2;

export const setupCanvas = (el) => {
    const ctx = el.getContext('2d');
    const resize = () => {
        const side = Math.min(innerWidth, innerHeight);
        el.width = W * DETAIL;
        el.height = H * DETAIL;
        el.style.width = `${side}px`;
        el.style.height = `${side}px`;
        ctx.setTransform(DETAIL, 0, 0, DETAIL, 0, 0);
        ctx.imageSmoothingEnabled = false;
    };
    addEventListener('resize', resize);
    resize();
    return { ctx, resize };
};

export const makeLayerCanvas = () => document.createElement('canvas');
