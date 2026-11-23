// Isla Verde — audio.js
// All sound is synthesized with WebAudio. No audio files, no network.
import { mulberry32 } from './random.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicTimer = null;
  let musicOn = false;
  let sirenOsc = null;
  const rng = mulberry32(777);

  function ensure() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.35;
        master.connect(ctx.destination);
      } catch (e) { ctx = null; }
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function tone(freq, dur, type = 'sine', vol = 0.3, when = 0, slideTo = null) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, when = 0, low = 400) {
    if (!ensure()) return;
    const t = ctx.currentTime + when;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (rng() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = low;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }
  // island groove: seeded pentatonic bassline + hats, ~100 BPM
  const SCALE = [110, 130.8, 146.8, 164.8, 196, 220, 261.6];
  let step = 0;
  function musicStep() {
    if (!musicOn || !ctx) return;
    const beat = 0.3; // 100bpm eighth
    const bar = step % 16;
    if (bar % 4 === 0) tone(SCALE[Math.floor(rng() * 3)], beat * 1.8, 'triangle', 0.22);
    if (bar % 2 === 0) tone(SCALE[3 + Math.floor(rng() * 4)] * 2, beat * 0.5, 'square', 0.05);
    if (bar === 4 || bar === 12) noise(0.05, 0.08, 0, 6000);
    if (bar === 0) tone(55, beat * 3, 'sine', 0.3);
    step++;
    musicTimer = setTimeout(musicStep, beat * 1000);
  }
  return {
    unlock() { ensure(); },
    setMusic(on) {
      musicOn = on;
      if (on) { ensure(); if (!musicTimer) musicStep(); }
      else if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
    },
    shoot(weapon) {
      if (weapon === 'shotgun') { noise(0.22, 0.5, 0, 900); tone(120, 0.15, 'square', 0.25, 0, 50); }
      else if (weapon === 'smg') { noise(0.07, 0.3, 0, 1400); }
      else { noise(0.12, 0.4, 0, 1100); tone(180, 0.08, 'square', 0.2, 0, 70); }
    },
    melee() { noise(0.08, 0.25, 0, 500); },
    hit() { tone(220, 0.1, 'sawtooth', 0.2, 0, 90); },
    pickup() { tone(660, 0.08, 'sine', 0.25); tone(990, 0.12, 'sine', 0.25, 0.08); },
    cash() { tone(880, 0.1, 'sine', 0.25); tone(1174, 0.1, 'sine', 0.25, 0.09); tone(1568, 0.18, 'sine', 0.25, 0.18); },
    checkpoint() { tone(523, 0.1, 'sine', 0.25); tone(784, 0.15, 'sine', 0.25, 0.08); },
    missionStart() { tone(392, 0.12, 'square', 0.15); tone(523, 0.12, 'square', 0.15, 0.1); tone(659, 0.2, 'square', 0.15, 0.2); },
    missionComplete() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'triangle', 0.28, i * 0.11)); },
    missionFail() { [392, 330, 262].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.16, i * 0.14)); },
    siren(on) {
      if (on && !sirenOsc && ensure()) {
        sirenOsc = ctx.createOscillator();
        const g = ctx.createGain(); g.gain.value = 0.05;
        const lfo = ctx.createOscillator(); lfo.frequency.value = 0.7;
        const lg = ctx.createGain(); lg.gain.value = 250;
        lfo.connect(lg); lg.connect(sirenOsc.frequency);
        sirenOsc.frequency.value = 850; sirenOsc.type = 'triangle';
        sirenOsc.connect(g); g.connect(master);
        sirenOsc.start(); lfo.start();
        sirenOsc._lfo = lfo; sirenOsc._g = g;
      } else if (!on && sirenOsc) {
        try { sirenOsc.stop(); sirenOsc._lfo.stop(); } catch (e) {}
        sirenOsc = null;
      }
    },
    engine(speed01) {
      // called rarely; simple rev blip tied to speed
      if (speed01 > 0.6) tone(90 + speed01 * 90, 0.12, 'sawtooth', 0.04);
    },
    crash() { noise(0.3, 0.5, 0, 600); tone(70, 0.25, 'square', 0.25, 0, 40); },
    horn() { tone(370, 0.25, 'square', 0.18); tone(466, 0.25, 'square', 0.15); },
  };
}
