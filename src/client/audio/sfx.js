let ac;

const TONE = {
    crash: [110, 0.35, 'sawtooth', 0.30],
    pickup: [880, 0.12, 'square', 0.18],
    count: [440, 0.08, 'triangle', 0.16],
};

export const sfx = (name) => {
    const t = TONE[name];
    if (!t) return;
    try {
        ac = ac || new AudioContext();
        if (ac.state === 'suspended') {
            ac.resume();
        }
        const [freq, dur, type, vol] = t;
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(freq, ac.currentTime);
        if (name === 'crash') {
            o.frequency.exponentialRampToValueAtTime(40, ac.currentTime + dur);
        }
        g.gain.setValueAtTime(vol, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
        o.connect(g).connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + dur);
    } catch {
    }
};
