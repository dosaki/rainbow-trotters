import { ACTIVATE } from '#shared';
import { bindKeyboard, relativeTurn } from './keyboard.js';

let dirNow = () => 0;
let racing = () => false;

export const setDirSource = (fn) => { dirNow = fn; };

export const setInputActive = (fn) => { racing = fn; };

export const isTypingTarget = (t) =>
    !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable === true);

const allow = (e) => racing() && !isTypingTarget(e.target);

export const bindInput = (onInput) => {
    bindKeyboard(onInput, allow);

    addEventListener('pointerdown', (e) => {
        if (!allow(e)) return;
        e.preventDefault();
        if (e.clientY > innerHeight * 0.85) {
            onInput(ACTIVATE);
            return;
        }
        onInput(relativeTurn(dirNow(), e.clientX < innerWidth / 2 ? -1 : 1));
    }, { passive: false });
};
