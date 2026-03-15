/**
 * SoundManager.js
 * Synthetic audio using Web Audio API — no audio files needed.
 * All sounds are procedurally generated tones/chords.
 *
 * Usage:
 *   import { SoundManager } from "./SoundManager.js";
 *   SoundManager.playCollect();
 *   SoundManager.playCorrect();
 *   SoundManager.playWrong();
 *   SoundManager.playVictory();
 *   SoundManager.playEnterCastle();
 *   SoundManager.startAmbient();
 *   SoundManager.stopAmbient();
 *   SoundManager.setEnabled(true/false);
 */

let _ctx   = null;
let _enabled = true;
let _ambientNodes = [];

function _getCtx() {
  if (!_ctx) {
    try { _ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (_ctx && _ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

/** Play a single sine/square tone */
function _tone(freq, type, startTime, duration, gainValue, ctx, dest) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type      = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(gainValue, startTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

export const SoundManager = {
  setEnabled(val) { _enabled = !!val; },
  isEnabled()     { return _enabled; },

  /** Short upward chime — collect item */
  playCollect() {
    if (!_enabled) return;
    const ctx = _getCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
    _tone(660, "sine", now,        0.12, 0.6, ctx, master);
    _tone(880, "sine", now + 0.09, 0.14, 0.6, ctx, master);
    _tone(1100,"sine", now + 0.18, 0.18, 0.5, ctx, master);
  },

  /** Happy chord — correct answer */
  playCorrect() {
    if (!_enabled) return;
    const ctx = _getCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    // C major chord arpeggio
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => _tone(f, "sine", now + i * 0.10, 0.35, 0.55, ctx, master));
  },

  /** Descending buzz — wrong answer */
  playWrong() {
    if (!_enabled) return;
    const ctx = _getCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.20;
    master.connect(ctx.destination);
    _tone(330, "sawtooth", now,        0.10, 0.5, ctx, master);
    _tone(260, "sawtooth", now + 0.08, 0.10, 0.5, ctx, master);
    _tone(196, "sawtooth", now + 0.16, 0.20, 0.5, ctx, master);
  },

  /** Rising fanfare — victory / crown earned */
  playVictory() {
    if (!_enabled) return;
    const ctx = _getCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    const seq = [523, 659, 784, 659, 1047];
    seq.forEach((f, i) => _tone(f, "sine", now + i * 0.13, 0.28, 0.6, ctx, master));
    // Harmony
    const harm = [394, 494, 587, 494, 784];
    harm.forEach((f, i) => _tone(f, "sine", now + i * 0.13, 0.28, 0.3, ctx, master));
  },

  /** Descending "whoosh" — enter castle */
  playEnterCastle() {
    if (!_enabled) return;
    const ctx = _getCtx(); if (!ctx) return;
    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.55);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + 0.65);
  },

  /** Gentle ambient hum — ocean world */
  startAmbient() {
    if (!_enabled) return;
    if (_ambientNodes.length) return; // already running
    const ctx = _getCtx(); if (!ctx) return;

    const master = ctx.createGain();
    master.gain.value = 0.04;
    master.connect(ctx.destination);
    _ambientNodes.push(master);

    // Two slow sine drones
    const drones = [110, 165];
    drones.forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;

      const lfo  = ctx.createOscillator();
      lfo.type   = "sine";
      lfo.frequency.value = 0.10;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 2;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      osc.connect(master);
      osc.start();
      lfo.start();
      _ambientNodes.push(osc, lfo);
    });
  },

  stopAmbient() {
    _ambientNodes.forEach(n => { try { n.stop ? n.stop() : n.disconnect(); } catch(e) {} });
    _ambientNodes = [];
  },
};
