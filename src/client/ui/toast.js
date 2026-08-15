const DURATION = 1400;

let text = '';
let until = 0;

const el = () => (typeof t === 'undefined' ? null : t);

export const showToast = (msg, now = Date.now(), ms = DURATION) => {
    text = msg;
    until = now + ms;
    const e = el();
    if (!e) return;
    e.textContent = msg;
    e.classList.remove('go');
    void e.offsetWidth;
    e.classList.add('go');
};

export const clearToast = () => {
    until = 0;
    const e = el();
    if (!e) return;
    e.classList.remove('go');
    e.textContent = '';
};

export const toastText = (now = Date.now()) => (now < until ? text : '');
