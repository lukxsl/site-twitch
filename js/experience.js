/* ============================================================
   EXPERIENCE — som ambiente generativo + efeitos visuais
   Não depende do main.js. Tudo opcional e à prova de falhas.
   ============================================================ */
(function(){
  'use strict';
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const store = {
    get(k, d){ try { const v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  };
  const $ = (s, r = document) => r.querySelector(s);

  /* ---------------- SOM AMBIENTE (WebAudio, sem arquivos) ---------------- */
  const Som = {
    ctx: null, master: null, on: false, vol: Number(store.get('fx_vol', 0.35)),
    chuva: store.get('fx_chuva', '1') === '1', timer: null, passo: 0, chuvaGain: null,
    // Am9 → Fmaj7 → Cmaj7 → G6 (lo-fi calmo)
    acordes: [[110,164.8,196,246.9,329.6],[87.3,130.8,164.8,220,329.6],[130.8,196,246.9,329.6,392],[98,146.8,196,246.9,329.6]],
    penta: [440,493.9,523.3,587.3,659.3,784,880,987.8],

    iniciar(){
      if(this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400;
      // reverb simples: delay com feedback filtrado
      const dl = c.createDelay(1); dl.delayTime.value = .42;
      const fb = c.createGain(); fb.gain.value = .45;
      const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 1800;
      dl.connect(dlp); dlp.connect(fb); fb.connect(dl);
      this.bus = c.createGain();
      this.bus.connect(lp); this.bus.connect(dl); dlp.connect(lp);
      lp.connect(this.master); this.master.connect(c.destination);
      // chuva (ruído filtrado)
      const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for(let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = .4;
      this.chuvaGain = c.createGain(); this.chuvaGain.gain.value = this.chuva ? .05 : 0;
      src.connect(bp); bp.connect(this.chuvaGain); this.chuvaGain.connect(this.master); src.start();
    },
    nota(f, t, dur, tipo, vol){
      const c = this.ctx, o = c.createOscillator(), g = c.createGain();
      o.type = tipo; o.frequency.value = f; o.detune.value = (Math.random() - .5) * 10;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + dur * .35);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + dur + .1);
    },
    compasso(){
      if(!this.ctx || !this.on) return;
      const t = this.ctx.currentTime + .05, ac = this.acordes[this.passo++ % this.acordes.length];
      ac.forEach(f => this.nota(f, t, 9, 'triangle', .035));
      // sino aleatório (2–4 por compasso)
      const n = 2 + Math.floor(Math.random() * 3);
      for(let i = 0; i < n; i++){
        const f = this.penta[Math.floor(Math.random() * this.penta.length)];
        this.nota(f, t + 1 + Math.random() * 6.5, 3.5, 'sine', .028);
      }
    },
    async ligar(){
      this.iniciar(); if(!this.ctx) return;
      try { await this.ctx.resume(); } catch(e){}
      this.on = true; store.set('fx_som', '1');
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(this.vol, this.ctx.currentTime, 1.2);
      this.compasso(); clearInterval(this.timer); this.timer = setInterval(() => this.compasso(), 8000);
      UI.refletir();
    },
    desligar(){
      this.on = false; store.set('fx_som', '0'); clearInterval(this.timer);
      if(this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, .4);
      UI.refletir();
    },
    alternar(){ this.on ? this.desligar() : this.ligar(); },
    setVol(v){ this.vol = v; store.set('fx_vol', v); if(this.on) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, .1); },
    setChuva(b){ this.chuva = b; store.set('fx_chuva', b ? '1' : '0'); if(this.chuvaGain) this.chuvaGain.gain.setTargetAtTime(b ? .05 : 0, this.ctx.currentTime, .3); },
    // pequeno "pop" de interface
    pop(freq = 880){
      if(!this.ctx || !this.on) return;
      const t = this.ctx.currentTime;
      this.nota(freq, t, .25, 'sine', .05);
    }
  };
  window.SomSite = Som;

  /* ---------------- UI do som ---------------- */
  const UI = {
    btn: null, wrap: null,
    montar(){
      const box = $('.nav-actions'); if(!box || this.wrap) return;
      const w = this.wrap = document.createElement('div'); w.className = 'sound-wrap';
      w.innerHTML = `<button class="sound-btn" type="button" aria-label="Som ambiente" title="Som ambiente (M)">🔇</button>
        <div class="sound-pop">
          <label>Volume <input type="range" min="0" max="1" step="0.05" value="${Som.vol}" id="fxVol"></label>
          <label>Som de chuva <input type="checkbox" id="fxChuva" ${Som.chuva ? 'checked' : ''}></label>
        </div>`;
      box.insertBefore(w, box.firstChild);
      this.btn = $('.sound-btn', w);
      let pressTimer;
      this.btn.addEventListener('click', () => Som.alternar());
      this.btn.addEventListener('contextmenu', e => { e.preventDefault(); w.classList.toggle('open'); });
      this.btn.addEventListener('pointerdown', () => { pressTimer = setTimeout(() => w.classList.toggle('open'), 600); });
      ['pointerup','pointerleave'].forEach(ev => this.btn.addEventListener(ev, () => clearTimeout(pressTimer)));
      $('#fxVol', w).addEventListener('input', e => Som.setVol(Number(e.target.value)));
      $('#fxChuva', w).addEventListener('change', e => Som.setChuva(e.target.checked));
      document.addEventListener('click', e => { if(!w.contains(e.target)) w.classList.remove('open'); });
      this.refletir();
    },
    refletir(){
      if(!this.btn) return;
      this.btn.classList.toggle('on', Som.on);
      this.btn.textContent = Som.on ? '🔊' : '🔇';
      this.btn.title = Som.on ? 'Desligar som (M) · clique direito/segure: opções' : 'Ligar som ambiente (M)';
    }
  };

  /* ---------------- INTRO ---------------- */
  function intro(){
    const jaViu = (() => { try { return sessionStorage.getItem('fx_intro') === '1'; } catch(e){ return false; } })();
    const querSom = store.get('fx_som', '1') === '1';
    if(jaViu){
      // sem gesto não dá pra tocar: liga no primeiro clique/tecla
      if(querSom){
        const go = () => { Som.ligar(); removeEventListener('pointerdown', go); removeEventListener('keydown', go); };
        addEventListener('pointerdown', go, { once: false }); addEventListener('keydown', go);
      }
      return;
    }
    const el = document.createElement('div'); el.id = 'intro';
    el.innerHTML = `<div class="intro-box">
      <div class="intro-logo">asemtet<span>0</span></div>
      <p class="intro-sub">Bem-vindo ao cantinho 💜 Fone de ouvido recomendado.</p>
      <div class="intro-btns">
        <button class="intro-btn main" data-som="1" type="button">Entrar com som 🎧</button>
        <button class="intro-btn" data-som="0" type="button">Entrar sem som</button>
      </div>
      <span class="intro-hint">Dá pra mudar a qualquer momento no botão 🔊 do menu</span></div>`;
    document.body.appendChild(el);
    document.documentElement.style.overflow = 'hidden';
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-som]'); if(!b) return;
      if(b.dataset.som === '1') Som.ligar(); else Som.desligar();
      try { sessionStorage.setItem('fx_intro', '1'); } catch(_){}
      el.classList.add('sai'); document.documentElement.style.overflow = '';
      setTimeout(() => el.remove(), 1000);
    });
  }

  /* ---------------- PARTÍCULAS (poeira mágica) ---------------- */
  function particulas(){
    if(reduz) return;
    const cv = document.createElement('canvas'); cv.id = 'fxCanvas'; document.body.prepend(cv);
    const g = cv.getContext('2d'); let W, H, ps = [];
    const cores = ['192,132,252','255,110,199','125,211,252','255,209,102'];
    const resize = () => {
      W = cv.width = innerWidth; H = cv.height = innerHeight;
      const n = Math.min(70, Math.floor(W * H / 22000));
      ps = Array.from({ length: n }, () => novo(true));
    };
    function novo(random){
      return { x: Math.random() * W, y: random ? Math.random() * H : H + 10, r: Math.random() * 1.8 + .4,
        vy: Math.random() * .25 + .08, vx: (Math.random() - .5) * .15, a: Math.random() * .5 + .2,
        c: cores[Math.floor(Math.random() * cores.length)], ph: Math.random() * 6.28 };
    }
    let vivo = true;
    document.addEventListener('visibilitychange', () => { vivo = !document.hidden; if(vivo) loop(); });
    function loop(){
      if(!vivo) return;
      g.clearRect(0, 0, W, H);
      for(const p of ps){
        p.y -= p.vy; p.x += p.vx + Math.sin(p.ph += .01) * .15;
        if(p.y < -10) Object.assign(p, novo(false));
        g.beginPath(); g.fillStyle = `rgba(${p.c},${p.a})`; g.shadowColor = `rgba(${p.c},.9)`; g.shadowBlur = 8;
        g.arc(p.x, p.y, p.r, 0, 6.28); g.fill();
      }
      requestAnimationFrame(loop);
    }
    addEventListener('resize', resize); resize(); loop();
  }

  /* ---------------- GLOW DO CURSOR + CORAÇÕES + PROGRESSO ---------------- */
  function interacoes(){
    if(!$('#progress')){ const p = document.createElement('div'); p.id = 'progress'; document.body.prepend(p); }
    const barra = $('#progress');
    addEventListener('scroll', () => {
      const h = document.documentElement;
      barra.style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100) + '%';
    }, { passive: true });

    if(!reduz){
      const glow = document.createElement('div'); glow.id = 'cursorGlow'; document.body.prepend(glow);
      let x = 0, y = 0, tx = 0, ty = 0;
      addEventListener('pointermove', e => { tx = e.clientX; ty = e.clientY; document.body.classList.add('fx-on'); }, { passive: true });
      (function f(){ x += (tx - x) * .12; y += (ty - y) * .12; glow.style.transform = `translate(${x}px,${y}px)`; requestAnimationFrame(f); })();
    }

    document.addEventListener('click', e => {
      if(!e.target.closest('.btn,.nav-links button,.intro-btn')) return;
      Som.pop(e.target.closest('.nav-links') ? 660 : 880);
      if(reduz) return;
      for(let i = 0; i < 4; i++){
        const s = document.createElement('span'); s.className = 'heart'; s.textContent = '💜';
        s.style.left = (e.clientX - 9) + 'px'; s.style.top = (e.clientY - 9) + 'px';
        s.style.setProperty('--dx', (Math.random() * 70 - 35) + 'px');
        document.body.appendChild(s); setTimeout(() => s.remove(), 900);
      }
    });

    addEventListener('keydown', e => {
      if(e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) Som.alternar();
      if(e.key === '/' ){
        const q = $('#q');
        if(q && q.offsetParent && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)){ e.preventDefault(); q.focus(); }
      }
    });
  }

  /* ---------------- REVEAL + TILT (cards, inclusive dinâmicos) ---------------- */
  function cards(){
    if(reduz) return;
    const io = new IntersectionObserver(es => es.forEach(en => { if(en.isIntersecting){ en.target.classList.add('vis'); io.unobserve(en.target); } }), { threshold: .08 });
    const sel = '.card,.sonho-card,.apoiador-row';
    const marcar = root => root.querySelectorAll(sel).forEach(el => {
      if(el.dataset.fx) return; el.dataset.fx = '1';
      el.classList.add('fx-reveal'); io.observe(el);
      if(matchMedia('(hover:hover)').matches && el.matches('.card,.sonho-card')){
        el.addEventListener('pointermove', e => {
          const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
          el.classList.add('fx-tilt');
          el.style.transform = `perspective(900px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg) translateY(-2px)`;
        });
        el.addEventListener('pointerleave', () => { el.style.transform = ''; });
      }
    });
    marcar(document);
    new MutationObserver(() => marcar(document)).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------------- rota por hash + topo ao trocar aba ---------------- */
  function rotas(){
    const abas = ['inicio','tierlist','comunidade','setup','sugestoes'];
    const orig = window.mudarAba;
    if(typeof orig === 'function'){
      window.mudarAba = function(nome, ...r){
        const res = orig.call(this, nome, ...r);
        if(abas.includes(nome)) history.replaceState(null, '', '#' + nome);
        scrollTo({ top: 0, behavior: reduz ? 'auto' : 'smooth' });
        Som.pop(740);
        return res;
      };
    }
    const h = location.hash.slice(1);
    if(abas.includes(h) && h !== 'inicio' && typeof window.mudarAba === 'function') window.mudarAba(h);
  }

  /* Pausa o áudio quando a aba fica oculta */
  document.addEventListener('visibilitychange', () => {
    if(!Som.ctx) return;
    if(document.hidden) Som.ctx.suspend(); else if(Som.on) Som.ctx.resume();
  });

  function init(){ UI.montar(); particulas(); interacoes(); cards(); intro(); addEventListener('load', rotas); }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();