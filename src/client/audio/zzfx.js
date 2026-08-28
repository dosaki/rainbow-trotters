// ZzFX (C) Frank Force | ZzFXM (C) Keith Clark | MIT | github.com/keithclark/ZzFXM
export const zzfxR = 44100;
const zzfxV = 0.3;

export const zzfxG = (q = 1, k = .05, c = 220, e = 0, t = 0, u = .1, r = 0, F = 1, v = 0, z = 0, w = 0, A = 0, l = 0, B = 0, x = 0, G = 0, d = 0) => { let b = 2 * Math.PI, H = v *= 500 * b / zzfxR ** 2, I = (0 < x ? 1 : -1) * b / 4, D = c *= (1 + 2 * k * Math.random() - k) * b / zzfxR, Z = [], g = 0, E = 0, a = 0, n = 1, J = 0, K = 0, f = 0, p, h; e = 99 + zzfxR * e; t *= zzfxR; u *= zzfxR; d *= zzfxR; x *= b / zzfxR; w *= b / zzfxR; A *= zzfxR; l = zzfxR * l | 0; for (h = e + t + u + d | 0; a < h; Z[a++] = f)++K % (100 * G | 0) || (f = r ? 1 < r ? 2 < r ? 3 < r ? Math.sin((g % b) ** 3) : Math.max(Math.min(Math.tan(g), 1), -1) : 1 - (2 * g / b % 2 + 2) % 2 : 1 - 4 * Math.abs(Math.round(g / b) - g / b) : Math.sin(g), f = (0 < f ? 1 : -1) * Math.abs(f) ** F * q * zzfxV * (a < e ? a / e : a < e + t ? 1 : a < h - d ? (h - a - d) / u : 0), f = d ? f / 2 + (d > a ? 0 : (a < h - d ? 1 : (h - a) / d) * Z[a - d | 0] / 2) : f), p = (c += v) * Math.sin(E * x - I), g += p - p * B * (1 - 1E9 * (Math.sin(a) + 1) % 2), E += p - p * B * (1 - 1E9 * (Math.sin(a) ** 2 + 1) % 2), n && ++n > A && (c += w, D += w, n = 0), !l || ++J % l || (c = D, v = H, n = n || 1); return Z };

export const zzfxM = (n, f, t, e = 125) => { let l, o, z, r, g, h, x, a, u, c, d, i, m, p, G, M = 0, R = [], b = [], j = [], k = 0, q = 0, s = 1, v = {}, w = zzfxR / e * 60 >> 2; for (; s; k++) R = [s = a = d = m = 0], t.map((e, d) => { for (x = f[e][k] || [0, 0, 0], s |= !!f[e][k], G = m + (f[e][0].length - 2 - !a) * w, p = d == t.length - 1, o = 2, r = m; o < x.length + p; a = ++o) { for (g = x[o], u = o == x.length + p - 1 && p || c != (x[0] || 0) | g | 0, z = 0; z < w && a; z++ > w - 99 && u ? i += (i < 1) / 99 : 0)h = (1 - i) * R[M++] / 2 || 0, b[r] = (b[r] || 0) - h * q + h, j[r] = (j[r++] || 0) + h * q + h; g && (i = g % 1, q = x[1] || 0, (g |= 0) && (R = v[[c = x[M = 0] || 0, g]] = v[[c, g]] || (l = [...n[c]], l[2] *= 2 ** ((g - 12) / 12), g > 0 ? zzfxG(...l) : []))) } m = G }); return [b, j] };

export const SOUNDS = {
    crash: [1.4, , 260, .01, .09, .34, 4, 1.9, -4, , , , , 1.3, , .4, .12],
    pickup: [.7, , 880, .01, .06, .14, 1, 1.7, , , 320, .05],
    hover: [.25, , 1400, , .01, .02, 1, 2.2, , , , , , , , , .02],
    click: [.4, , 520, , .02, .05, 2, 1.6],
};

const BASS = [.7, 0, 22, , .07, .07, 2, 0, , , .5, .01];
const SYNTH = [, 0, 25, .002, .02, .08, 3, , , , , , , , , .1, .01];
const KICK = [1, 0, 84, , , .1, , .7, , , , .5, , 6.7, 1, .05];
const HAT = [2, 0, 4e3, , , .03, 2, 1.25, , , , , .02, 6.8, -.3, , .5];

const STEPS = 16;
const MAJ = [0, 4, 7, 12];
const MIN = [0, 3, 7, 12];
const CHORDS = [[0, MAJ], [7, MAJ], [9, MIN], [5, MAJ]];

const steps = (fn) => Array.from({ length: STEPS }, (_, i) => fn(i));
const arp = (root, shape) => [1, .35, ...steps((i) => 60 + root + shape[i % shape.length])];
const pulse = (inst, note, every, off, pan) =>
    [inst, pan, ...steps((i) => ((i + off) % every ? 0 : note))];

export const SONG = [
    [BASS, SYNTH, KICK, HAT],
    CHORDS.map(([root, shape]) => [
        pulse(0, 33 + root, 2, 0, 0),
        arp(root, shape),
        pulse(2, 12, 4, 0, 0),
        pulse(3, 12, 2, 1, .5),
    ]),
    [0, 1, 2, 3, 0, 1, 2, 3],
    140,
];
