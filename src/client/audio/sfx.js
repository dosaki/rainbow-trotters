let ac;
let step = 0;
let next = 0;
let timer;
let off;

const TONE = {
    crash: [110, 0.35, 'sawtooth', 0.30, 40],
    pickup: [880, 0.12, 'square', 0.18],
    hover: [1320, 0.03, 'triangle', 0.05],
    click: [660, 0.06, 'square', 0.11],
};

const SCALE = [0, 3, 5, 7, 10];
const ROOTS = [0, 5, 3, 7];

const start = () => {
    ac = ac || new AudioContext();
    if (ac.state === 'suspended') {
        ac.resume();
    }
    return ac;
};

const note = (freq, dur, type, vol, at, glide) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (glide) {
        o.frequency.exponentialRampToValueAtTime(glide, at + dur);
    }
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(ac.destination);
    o.start(at);
    o.stop(at + dur);
};

export const sfx = (name) => {
    const t = TONE[name];
    if (!t || off) return;
    try {
        note(t[0], t[1], t[2], t[3], start().currentTime, t[4]);
    } catch {
    }
};

const hz = (semi) => 220 * 2 ** (semi / 12);

const bars = () => {
    while (next < ac.currentTime + 0.5) {
        const root = ROOTS[(step >> 3) % ROOTS.length];
        if (step % 8 === 0) {
            note(hz(root - 12), 0.45, 'triangle', 0.10, next);
        }
        const r = step * 2654435761 >>> 13 & 7;
        if (r !== 7) {
            note(hz(root + SCALE[r % SCALE.length] + (r & 1 ? 24 : 12)), 0.16, 'square', 0.035, next);
        }
        next += 0.15;
        step++;
    }
};

export const music = (on) => {
    try {
        if (!on) {
            timer = clearInterval(timer);
        } else if (!timer) {
            next = start().currentTime + 0.1;
            timer = setInterval(bars, 200);
            bars();
        }
    } catch {
    }
};

export const muted = (on) => {
    off = on;
};
