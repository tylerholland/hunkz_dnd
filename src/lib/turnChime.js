// Story 49 — the "your turn" chime: one soft bell (two quiet sine partials
// with a gentle decay), synthesized so there's no audio file to load. Only
// the player whose turn it is hears it.
let ctx = null;

export function playTurnChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = ctx || new AudioCtx();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [[880, 0.1], [1320, 0.04]].forEach(([freq, level]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.25);
    });
  } catch {
    // audio unavailable — the banner and the lit button still show it
  }
}
