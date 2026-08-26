import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zzfxR, zzfxG, zzfxM, SOUNDS, SONG } from '../src/client/audio/zzfx.js';

const loudest = (samples) => samples.reduce((n, v) => Math.max(n, Math.abs(v)), 0);

test('every sound effect renders audible samples', () => {
    const names = Object.keys(SOUNDS);
    assert.ok(names.length >= 4, 'crash, pickup, hover and click at least');

    for (const name of names) {
        const samples = zzfxG(...SOUNDS[name]);
        assert.ok(samples.length > 0, `${name} rendered nothing`);
        assert.ok(loudest(samples) > 0.01, `${name} is silent`);
        assert.ok(samples.every(Number.isFinite), `${name} produced NaN or Infinity`);
    }
});

test('no sound effect outstays its welcome', () => {
    for (const [name, params] of Object.entries(SOUNDS)) {
        const seconds = zzfxG(...params).length / zzfxR;
        assert.ok(seconds < 1.5, `${name} runs for ${seconds.toFixed(2)}s`);
    }
});

test('a crash is louder and longer than a hover tick', () => {
    const crash = zzfxG(...SOUNDS.crash);
    const hover = zzfxG(...SOUNDS.hover);
    assert.ok(crash.length > hover.length, 'dying should not be quieter than pointing at a button');
    assert.ok(loudest(crash) > loudest(hover));
});

test('the song renders two channels of audible music', () => {
    const [left, right] = zzfxM(...SONG);
    assert.ok(left.length > 0 && right.length > 0, 'the song rendered nothing');
    assert.equal(left.length, right.length, 'stereo channels must be the same length');
    assert.ok(loudest(left) > 0.01 && loudest(right) > 0.01, 'the song is silent');
    assert.ok(left.every(Number.isFinite) && right.every(Number.isFinite), 'the song has NaN in it');
});

test('the song is long enough to be a loop rather than a stab', () => {
    const [left] = zzfxM(...SONG);
    const seconds = left.length / zzfxR;
    assert.ok(seconds > 8, `only ${seconds.toFixed(1)}s of music`);
    assert.ok(seconds < 60, `${seconds.toFixed(1)}s is more song than the budget can want`);
});

test('the song is stereo, not the same signal twice', () => {
    const [left, right] = zzfxM(...SONG);
    const differs = left.some((v, i) => Math.abs(v - right[i]) > 1e-6);
    assert.ok(differs, 'panning is set per channel, so the two sides should differ');
});

test('every pattern names an instrument that exists', () => {
    const [instruments, patterns, sequence] = SONG;
    for (const pattern of patterns) {
        for (const channel of pattern) {
            assert.ok(instruments[channel[0]], `pattern uses missing instrument ${channel[0]}`);
        }
    }
    for (const index of sequence) {
        assert.ok(patterns[index], `sequence names missing pattern ${index}`);
    }
});

test('every channel in a pattern is the same length as the first', () => {
    const [, patterns] = SONG;
    for (const pattern of patterns) {
        const steps = pattern[0].length;
        for (const channel of pattern) {
            assert.equal(channel.length, steps,
                'zzfxM takes pattern length from channel zero, so a short channel silently truncates');
        }
    }
});
