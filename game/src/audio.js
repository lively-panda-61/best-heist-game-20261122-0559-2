// Tiny synthesized sound effects for The Velvet Vault (WebAudio, no assets).
// Silent until the player interacts, and safe to import in Node (no-ops).
let audioCtx = null;

export function ensureAudio() {
  if (typeof window === 'undefined' || audioCtx) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  } catch {
    audioCtx = null;
  }
}

function tone(freq, dur, type = 'sine', gain = 0.08, when = 0) {
  if (!audioCtx) return;
  try {
    const t0 = audioCtx.currentTime + when;
    const osc = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    amp.gain.setValueAtTime(gain, t0);
    amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(amp).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch {
    // Audio is decoration; never break the game.
  }
}

export const sfx = {
  loot() { tone(880, 0.12, 'sine', 0.07); tone(1320, 0.1, 'sine', 0.05, 0.05); },
  diamond() { tone(1046, 0.15, 'sine', 0.08); tone(1568, 0.15, 'sine', 0.07, 0.08); tone(2093, 0.25, 'sine', 0.06, 0.16); },
  smoke() { tone(220, 0.25, 'triangle', 0.06); },
  emp() { tone(1800, 0.08, 'square', 0.04); tone(900, 0.15, 'square', 0.04, 0.06); },
  spotted() { tone(196, 0.3, 'sawtooth', 0.07); tone(147, 0.3, 'sawtooth', 0.07, 0.12); },
  caught() { tone(110, 0.4, 'sawtooth', 0.09); },
  exit() { tone(523, 0.12, 'sine', 0.07); tone(659, 0.12, 'sine', 0.07, 0.1); tone(784, 0.25, 'sine', 0.07, 0.2); },
  win() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, 'sine', 0.08, i * 0.13)); },
};
