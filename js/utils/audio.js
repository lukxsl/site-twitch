/* ============================================================
   AUDIO — WEB AUDIO API (sons suaves do mini-game do Setup)
   - Zero custo no carregamento: o AudioContext só nasce no 1º gesto
   - Cadeia: osciladores → filtro passa-baixa → compressor → saída
   - API: init, toggleMute, isMuted, playType, playPop, playStep,
          playMeow, playClick, playClose, playSuccess
   ============================================================ */
window.GameAudio = (() => {
  let ctx = null;
  let master = null;      // GainNode geral
  let tone = null;        // passa-baixa que "amacia" tudo
  let noiseBuf = null;    // ruído curto (passos), criado só quando precisa
  let muted = false;
  let lastType = 0;

  try { muted = localStorage.getItem('setup_mute') === '1'; } catch (e) { /* ignore */ }

  /* Cria (ou retoma) o contexto. Seguro para chamar várias vezes
     e para usar direto como listener de evento. */
  function init() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC({ latencyHint: 'interactive' });

        master = ctx.createGain();
        master.gain.value = 0.9;

        tone = ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = 3200;   // corta o agudo "furado"
        tone.Q.value = 0.4;

        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 4;

        tone.connect(master);
        master.connect(comp);
        comp.connect(ctx.destination);
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
    return ctx;
  }

  const ready = () => !muted && !!init();

  /* Nota simples com envelope suave (ataque curto, queda exponencial) */
  function tom({ freq, to, type = 'sine', dur = 0.1, vol = 0.05, delay = 0, attack = 0.004, out }) {
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(out || tone);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function ruido() {
    if (!noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.12);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }

  return {
    init,

    toggleMute() {
      muted = !muted;
      try { localStorage.setItem('setup_mute', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      if (!muted) init();
      return muted;
    },
    isMuted() { return muted; },

    /* "tick" curtinho e macio de digitação */
    playType() {
      const now = performance.now();
      if (now - lastType < 40 || !ready()) return;   // evita rajada
      lastType = now;
      const f = 330 + Math.random() * 190;            // 330–520 Hz
      tom({ freq: f, to: f * 0.8, type: 'triangle', dur: 0.03, vol: 0.016, attack: 0.002 });
    },

    /* "pop" agradável: blip ascendente + harmônico suave */
    playPop() {
      if (!ready()) return;
      tom({ freq: 440, to: 740, type: 'sine', dur: 0.12, vol: 0.07 });
      tom({ freq: 880, to: 1320, type: 'sine', dur: 0.1, vol: 0.02, delay: 0.025 });
    },

    /* passo grave e abafado: baque + ruído filtrado em frequências baixas */
    playStep() {
      if (!ready()) return;
      tom({ freq: 120, to: 55, type: 'sine', dur: 0.09, vol: 0.09, attack: 0.003 });
      const src = ctx.createBufferSource();
      src.buffer = ruido();
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const g = ctx.createGain();
      const t0 = ctx.currentTime;
      g.gain.setValueAtTime(0.05, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
      src.connect(lp); lp.connect(g); g.connect(tone);
      src.start(t0);
      src.stop(t0 + 0.08);
    },

    /* miau fofo: triângulo com vibrato leve, sobe e desce */
    playMeow() {
      if (!ready()) return;
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, t0);
      osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.14);
      osc.frequency.exponentialRampToValueAtTime(480, t0 + 0.45);
      lfo.frequency.value = 22; lfoG.gain.value = 14;
      lfo.connect(lfoG); lfoG.connect(osc.frequency);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.08, t0 + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.47);
      osc.connect(g); g.connect(tone);
      osc.start(t0); lfo.start(t0);
      osc.stop(t0 + 0.5); lfo.stop(t0 + 0.5);
    },

    /* clique de interface (catálogo, abas, filtros, botões) */
    playClick() {
      if (!ready()) return;
      tom({ freq: 620, to: 430, type: 'sine', dur: 0.05, vol: 0.05 });
    },

    playClose() {
      if (!ready()) return;
      tom({ freq: 520, to: 300, type: 'sine', dur: 0.09, vol: 0.05 });
    },

    /* arpejo suave de conclusão (recap do tour) */
    playSuccess() {
      if (!ready()) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tom({ freq: f, type: 'sine', dur: 0.28, vol: 0.05, delay: i * 0.09 }));
    }
  };
})();

/* Destrava o áudio no 1º gesto do usuário em QUALQUER lugar da página
   (clique, toque ou tecla). Cada listener roda uma única vez. */
(() => {
  const destravar = () => {
    window.GameAudio.init();
    ['click', 'touchend', 'keydown'].forEach((ev) => document.removeEventListener(ev, destravar, true));
  };
  document.addEventListener('click', window.GameAudio.init, { once: true });
  ['click', 'touchend', 'keydown'].forEach((ev) => document.addEventListener(ev, destravar, true));
})();