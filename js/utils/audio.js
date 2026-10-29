/* ============================================================
   AUDIO — WEB AUDIO API (Chiptune Synthesizer)
   ============================================================ */
window.GameAudio = (() => {
  let ctx = null;
  let muted = false;
  try { muted = localStorage.getItem('setup_mute') === '1'; } catch(e) {}

  function init() {
    if (ctx) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) ctx = new AudioCtx();
    } catch(e) {}
  }

  function playTone(freq, type, duration, vol, slideFreq) {
    if (muted || !ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideFreq, ctx.currentTime + duration);
    }

    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  return {
    init,
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('setup_mute', muted ? '1' : '0'); } catch(e) {}
      return muted;
    },
    isMuted() { return muted; },
    playType() { playTone(600 + Math.random() * 200, 'square', 0.05, 0.02); },
    playPop() { playTone(400, 'sine', 0.1, 0.1, 800); },
    playStep() { playTone(150, 'triangle', 0.08, 0.05); },
    playMeow() {
      playTone(800, 'sawtooth', 0.2, 0.05, 600);
      setTimeout(() => playTone(600, 'sawtooth', 0.2, 0.05, 400), 100);
    }
  };
})();