import { ACTIVATE } from '#shared';

const KEYS = {
    ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3,
    d: 0, s: 1, a: 2, w: 3,
    ' ': ACTIVATE,
};

export const keyToInput = (key) => {
    const k = key.length === 1 ? key.toLowerCase() : key;
    return k in KEYS ? KEYS[k] : -1;
};

export const relativeTurn = (dir, side) => (dir + side + 4) % 4;

export const bindKeyboard = (onInput) => {
    addEventListener('keydown', (e) => {
        const i = keyToInput(e.key);
        if (i < 0) return;
        e.preventDefault();
        onInput(i);
    });
};
