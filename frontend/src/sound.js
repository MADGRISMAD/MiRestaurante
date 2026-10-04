/** Sonido de aviso sin archivos: dos tonos cortos con Web Audio. */
let audio = null;

export function beep() {
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    const t = audio.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t + i * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.25, t + i * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.14);
      osc.connect(gain).connect(audio.destination);
      osc.start(t + i * 0.16);
      osc.stop(t + i * 0.16 + 0.15);
    });
  } catch {
    // Sin audio (navegador sin permiso aún): queda la vibración y el aviso visual
  }
}

/** El navegador solo deja sonar tras un toque del usuario: llámalo en ese primer toque. */
export function resumeAudio() {
  audio?.resume?.();
}
