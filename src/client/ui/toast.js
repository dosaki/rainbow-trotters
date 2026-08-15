const DURATION = 1400;

let text = '';
let until = 0;

const el = () => (typeof document === 'undefined' ? null : document.getElementById('t'));

export const showToast = (t, now = Date.now(), ms = DURATION) => {
    text = t;
    until = now + ms;
    const e = el();
    if (!e) return;
    e.textContent = t;
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
