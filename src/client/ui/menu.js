import { MODE, ERR } from '#shared';

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
    err.textContent = MESSAGE[reason] || 'Could not join';
};

export const hideMenu = () => { menu.hidden = true; };

export const showMenu = (onChoose) => {
    menu.hidden = false;
    nm.value = savedName();

    const choose = (mode) => {
        const name = nm.value.trim();
        remember(name);
        err.textContent = '';
        onChoose(mode, name, code.value.trim());
    };

    solo.onclick = () => choose(MODE.SOLO);
    auto.onclick = () => choose(MODE.AUTO);
    make.onclick = () => choose(MODE.CREATE);
    join.onclick = () => choose(MODE.JOIN);
    code.onkeydown = (e) => {
        if (e.key === 'Enter') {
            choose(MODE.JOIN);
        }
    };
};
