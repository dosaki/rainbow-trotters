import { NAME_MAX } from './constants.js';

export const cleanName = (raw, id) => {
    const s = String(raw == null ? '' : raw)
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .trim()
        .slice(0, NAME_MAX);
    return s || `Unicorn ${id}`;
};
