import { MODE, ERR } from '#shared';

const el = (id) => document.getElementById(id);
const KEY = 'rt.name';

export const savedName = () => {
    try {
        return localStorage.getItem(KEY) || '';
    } catch {
        return '';
    }
};

const remember = (name) => {
    try {
        localStorage.setItem(KEY, name);
    } catch {
        /* private browsing */
    }
};

const MESSAGE = {
    [ERR.NO_ROOM]: 'No lobby with that code',
    [ERR.FULL]: 'That lobby is full',
    [ERR.GONE]: 'That lobby has closed',
};

export const menuError = (reason) => {
    el('err').textContent = MESSAGE[reason] || 'Could not join';
};

export const hideMenu = () => { el('menu').hidden = true; };

export const showMenu = (onChoose) => {
    el('menu').hidden = false;
    el('name').value = savedName();

    const choose = (mode) => {
        const name = el('name').value.trim();
        remember(name);
        el('err').textContent = '';
        onChoose(mode, name, el('code').value.trim());
    };

    el('solo').onclick = () => choose(MODE.SOLO);
    el('auto').onclick = () => choose(MODE.AUTO);
    el('make').onclick = () => choose(MODE.CREATE);
    el('join').onclick = () => choose(MODE.JOIN);
    el('code').onkeydown = (e) => {
        if (e.key === 'Enter') {
            choose(MODE.JOIN);
        }
    };
};
