import { ACTIVATE } from '#shared';
import { bindKeyboard, relativeTurn } from './keyboard.js';

let dirNow = () => 0;

export const setDirSource = (fn) => { dirNow = fn; };

export const bindInput = (onInput) => {
    bindKeyboard(onInput);

    addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (e.clientY > innerHeight * 0.85) {
            onInput(ACTIVATE);
            return;
        }
        onInput(relativeTurn(dirNow(), e.clientX < innerWidth / 2 ? -1 : 1));
    }, { passive: false });
};
