import { zzfxR, zzfxG, zzfxM, SOUNDS, SONG } from './zzfx.js';

let ac;
let song;
let node;
let off;

const start = () => {
    ac = ac || new AudioContext();
    if (ac.state === 'suspended') {
        ac.resume();
    }
    return ac;
};

const play = (channels, loop) => {
    const a = start();
    const source = a.createBufferSource();
    const buffer = a.createBuffer(channels.length, channels[0].length, zzfxR);
    channels.map((data, i) => buffer.getChannelData(i).set(data));
    source.buffer = buffer;
    source.loop = !!loop;
    source.connect(a.destination);
    source.start();
    return source;
};

export const sfx = (name) => {
    const params = SOUNDS[name];
    if (!params || off) return;
    try {
        play([zzfxG(...params)]);
    } catch {
    }
};

export const music = (on) => {
    try {
        if (!on) {
            if (node) {
                node.stop();
                node = null;
            }
            return;
        }
        if (node) return;
        song = song || zzfxM(...SONG);
        node = play(song, true);
    } catch {
    }
};

export const muted = (on) => {
    off = on;
};
