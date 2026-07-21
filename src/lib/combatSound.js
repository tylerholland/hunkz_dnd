// Web Audio synthesis for combat mode transitions.
// Each function creates its own AudioContext (fire-and-forget), so callers
// never need to manage context lifetime. Silently no-ops if the browser has
// no AudioContext (e.g. headless test environments).

function makeCtx() {
  try { return new (window.AudioContext || window.webkitAudioContext)(); }
  catch { return null; }
}

export function playCombatEnterSound() {
  const ac = makeCtx();
  if (!ac) return;
  const t = ac.currentTime;

  // War drum hit — sub sine boom + mid-range bandpass thwack
  function drumHit(startT, vol) {
    // Sub boom: sine pitched down for speakers that can handle it
    const boom = ac.createOscillator();
    const boomG = ac.createGain();
    boom.type = "sine";
    boom.frequency.setValueAtTime(120, startT);
    boom.frequency.exponentialRampToValueAtTime(40, startT + 0.35);
    boomG.gain.setValueAtTime(0, startT);
    boomG.gain.linearRampToValueAtTime(vol, startT + 0.006);
    boomG.gain.exponentialRampToValueAtTime(0.001, startT + 0.40);
    boom.connect(boomG); boomG.connect(ac.destination);
    boom.start(startT); boom.stop(startT + 0.40);

    // Body thud: second sine in audible range (covers laptop speakers)
    const body = ac.createOscillator();
    const bodyG = ac.createGain();
    body.type = "sine";
    body.frequency.setValueAtTime(200, startT);
    body.frequency.exponentialRampToValueAtTime(80, startT + 0.25);
    bodyG.gain.setValueAtTime(0, startT);
    bodyG.gain.linearRampToValueAtTime(vol * 0.6, startT + 0.006);
    bodyG.gain.exponentialRampToValueAtTime(0.001, startT + 0.28);
    body.connect(bodyG); bodyG.connect(ac.destination);
    body.start(startT); body.stop(startT + 0.28);

    // Mid crack: white noise through a wide bandpass — the "thwack" of hide on drum
    const bufSize = Math.floor(ac.sampleRate * 0.12);
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ac.createBufferSource();
    noise.buffer = buf;
    const bp = ac.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 500;
    bp.Q.value = 0.5;
    const ng = ac.createGain();
    ng.gain.setValueAtTime(vol * 0.85, startT);
    ng.gain.exponentialRampToValueAtTime(0.001, startT + 0.10);
    noise.connect(bp); bp.connect(ng); ng.connect(ac.destination);
    noise.start(startT);
  }

  drumHit(t, 0.85);
  drumHit(t + 0.32, 0.65);

  // Sword ripped from scabbard starting at t+560ms
  const sw = t + 0.56;

  // Scrape: broadband noise high-passed — the blade sliding along the scabbard
  const scrapeLen = Math.floor(ac.sampleRate * 0.13);
  const scrapeBuf = ac.createBuffer(1, scrapeLen, ac.sampleRate);
  const sd = scrapeBuf.getChannelData(0);
  for (let i = 0; i < scrapeLen; i++) sd[i] = Math.random() * 2 - 1;
  const scrape = ac.createBufferSource();
  scrape.buffer = scrapeBuf;
  const hp2 = ac.createBiquadFilter();
  hp2.type = "highpass";
  hp2.frequency.value = 3500;
  const scrapeG = ac.createGain();
  scrapeG.gain.setValueAtTime(0, sw);
  scrapeG.gain.linearRampToValueAtTime(0.28, sw + 0.01);
  scrapeG.gain.exponentialRampToValueAtTime(0.001, sw + 0.13);
  scrape.connect(hp2); hp2.connect(scrapeG); scrapeG.connect(ac.destination);
  scrape.start(sw);

  // Shing — bright initial strike then body resonance.
  // Keys: HIGH frequencies (6-9 kHz) for the metallic "ting", SHORT decays.
  // Mid frequencies (1-2 kHz) are vocal-range — avoid long sustain there.
  const impactT = sw + 0.10;

  // Bright ting: two detuned sines up high, fast decay (300ms)
  [[7200, 0.20, 0.28], [8100, 0.16, 0.32]].forEach(([freq, vol, decay]) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, impactT);
    g.gain.linearRampToValueAtTime(vol, impactT + 0.007);
    g.gain.exponentialRampToValueAtTime(0.001, impactT + decay);
    o.connect(g); g.connect(ac.destination);
    o.start(impactT); o.stop(impactT + decay);
  });

  // Body ring: lower but still high enough to stay metallic, medium decay (500ms)
  [[3400, 0.12, 0.45], [3750, 0.09, 0.55]].forEach(([freq, vol, decay]) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "sine";
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, impactT);
    g.gain.linearRampToValueAtTime(vol, impactT + 0.010);
    g.gain.exponentialRampToValueAtTime(0.001, impactT + decay);
    o.connect(g); g.connect(ac.destination);
    o.start(impactT); o.stop(impactT + decay);
  });
}

export function playCombatExitSound() {
  const ac = makeCtx();
  if (!ac) return;
  const t = ac.currentTime;

  // Ascending C major arpeggio: C4 → G4 → C5 (resolving, calming)
  [
    [261.63, 0,    0.18],
    [392.00, 0.12, 0.14],
    [523.25, 0.22, 0.10],
  ].forEach(([freq, delay, vol]) => {
    const osc = ac.createOscillator();
    const g   = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t + delay);
    g.gain.linearRampToValueAtTime(vol, t + delay + 0.1);
    g.gain.setValueAtTime(vol, t + delay + 0.45);
    g.gain.linearRampToValueAtTime(0, t + delay + 1.4);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t + delay); osc.stop(t + delay + 1.4);
  });

  // Soft high shimmer — C6, adds air
  const shimmer = ac.createOscillator();
  const shimG   = ac.createGain();
  shimmer.type = "sine";
  shimmer.frequency.value = 1046.5;
  shimG.gain.setValueAtTime(0, t + 0.3);
  shimG.gain.linearRampToValueAtTime(0.06, t + 0.42);
  shimG.gain.linearRampToValueAtTime(0, t + 1.2);
  shimmer.connect(shimG); shimG.connect(ac.destination);
  shimmer.start(t + 0.3); shimmer.stop(t + 1.2);
}
