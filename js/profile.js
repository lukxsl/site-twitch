/* ============================================================
   PERFIL — BANNER + BONECO 2D + SEGURANÇA (DEMO)
   ============================================================ */
(function(){
  'use strict';

  const BANNER_KEY = 'perfil:banner:v1';
  const AVATAR_KEY = 'perfil:boneco:v1';
  const DEFAULTS = {
    cabelo: '#c084fc',
    roupa: '#7c3aed',
    acessorio: '#ffd166',
    estilo: 'oculos'
  };

  const $ = (sel, root = document) => root.querySelector(sel);

  function lerLocal(chave){
    try {
      const raw = localStorage.getItem(chave);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  }

  function salvarLocal(chave, valor){
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (_) {
      return false;
    }
  }

  function stateValido(dados){
    const estado = { ...DEFAULTS };
    if (!dados || typeof dados !== 'object') return estado;
    ['cabelo', 'roupa', 'acessorio'].forEach((k) => {
      if (typeof dados[k] === 'string' && /^#[0-9a-f]{3,8}$/i.test(dados[k])) estado[k] = dados[k];
    });
    if (['oculos', 'fone', 'none'].includes(dados.estilo)) estado.estilo = dados.estilo;
    return estado;
  }

  function hexToHsl(hex){
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let hue = 0;
    if (d) {
      if (max === r) hue = ((g - b) / d) % 6;
      else if (max === g) hue = (b - r) / d + 2;
      else hue = (r - g) / d + 4;
      hue *= 60;
      if (hue < 0) hue += 360;
    }
    const l = (max + min) / 2;
    const s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return { h: hue, s: s * 100, l: l * 100 };
  }

  function init(){
    const stage = $('#pfAvatarStage');
    const banner = $('#pfBanner');
    const bannerInput = $('#pfBannerInput');
    const bannerStatus = $('#pfBannerStatus');
    const resetBtn = $('#pfReset');
    if (!stage && !banner) return;

    let estado = stateValido(lerLocal(AVATAR_KEY));

    /* ---------- Boneco 2D ---------- */
    function marcarOpcoes(){
      document.querySelectorAll('[data-pf-group]').forEach((grupo) => {
        const campo = grupo.dataset.pfGroup;
        grupo.querySelectorAll('.pf-swatch').forEach((btn) => {
          btn.classList.toggle('on', btn.dataset.value === estado[campo]);
        });
      });
      document.querySelectorAll('[data-pf-style] .pf-style').forEach((btn) => {
        btn.classList.toggle('on', btn.dataset.style === estado.estilo);
      });
    }

    function aplicarBoneco(){
      if (stage) {
        const cabelo = hexToHsl(estado.cabelo);
        const roupa = hexToHsl(estado.roupa);
        const deltaCabelo = cabelo.h - 270;
        const deltaRoupa = roupa.h - 262;
        const hue = Math.round(deltaCabelo * 0.35 + deltaRoupa * 0.65);
        const sat = Math.max(.6, Math.min(1.5, 1 + (roupa.s - 83) / 180));
        const bright = Math.max(.75, Math.min(1.25, 1 + (roupa.l - 58) / 200 + (cabelo.l - 75) / 400));
        stage.style.setProperty('--pf-hue', hue + 'deg');
        stage.style.setProperty('--pf-sat', sat.toFixed(2));
        stage.style.setProperty('--pf-bright', bright.toFixed(2));
        stage.style.setProperty('--pf-acc', estado.acessorio);
        stage.dataset.acc = estado.estilo;
      }
      marcarOpcoes();
    }

    function salvarBoneco(){
      salvarLocal(AVATAR_KEY, estado);
    }

    document.querySelectorAll('[data-pf-group]').forEach((grupo) => {
      grupo.addEventListener('click', (e) => {
        const btn = e.target.closest('.pf-swatch');
        if (!btn) return;
        const campo = grupo.dataset.pfGroup;
        if (!(campo in DEFAULTS)) return;
        estado[campo] = btn.dataset.value;
        aplicarBoneco();
        salvarBoneco();
      });
    });

    document.querySelectorAll('[data-pf-style]').forEach((grupo) => {
      grupo.addEventListener('click', (e) => {
        const btn = e.target.closest('.pf-style');
        if (!btn) return;
        estado.estilo = btn.dataset.style;
        aplicarBoneco();
        salvarBoneco();
      });
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        estado = { ...DEFAULTS };
        aplicarBoneco();
        salvarBoneco();
      });
    }

    aplicarBoneco();

    /* ---------- Banner (base64 no localStorage) ---------- */
    function status(texto, erro = false){
      if (!bannerStatus) return;
      bannerStatus.textContent = texto;
      bannerStatus.style.color = erro ? 'var(--red)' : '';
    }

    function aplicarBanner(dataUrl){
      if (!banner) return;
      banner.style.backgroundImage =
        'linear-gradient(180deg, rgba(8,4,16,.08), rgba(8,4,16,.5)), url("' + dataUrl + '")';
      banner.classList.add('has-image');
    }

    function redimensionar(dataUrl){
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 1600;
          let largura = img.width;
          let altura = img.height;
          if (largura > MAX) {
            altura = Math.round((altura * MAX) / largura);
            largura = MAX;
          }
          const canvas = document.createElement('canvas');
          canvas.width = largura;
          canvas.height = altura;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, largura, altura);
          resolve(canvas.toDataURL('image/jpeg', 0.86));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      });
    }

    function lerArquivo(file){
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }

    const bannerSalvo = lerLocal(BANNER_KEY);
    if (typeof bannerSalvo === 'string' && bannerSalvo.startsWith('data:image/')) {
      aplicarBanner(bannerSalvo);
    }

    if (bannerInput) {
      bannerInput.addEventListener('change', async () => {
        const file = bannerInput.files && bannerInput.files[0];
        if (!file) return;
        if (!file.type.startsWith('image/')) {
          status('Escolha um arquivo de imagem.', true);
          return;
        }
        status('Processando imagem...');
        try {
          const original = await lerArquivo(file);
          const otimizada = await redimensionar(original);
          aplicarBanner(otimizada);
          if (!salvarLocal(BANNER_KEY, otimizada)) {
            status('Banner aplicado, mas não coube no armazenamento local.', true);
          } else {
            status('Banner atualizado e salvo!');
          }
        } catch (_) {
          status('Não foi possível carregar essa imagem.', true);
        } finally {
          bannerInput.value = '';
        }
      });
    }

    /* ---------- Abas ---------- */
    const tabs = document.querySelectorAll('[data-pf-tab]');
    const paineis = document.querySelectorAll('[data-pf-panel]');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const alvo = tab.dataset.pfTab;
        tabs.forEach((t) => {
          const ativo = t === tab;
          t.classList.toggle('on', ativo);
          t.setAttribute('aria-selected', ativo ? 'true' : 'false');
        });
        paineis.forEach((p) => p.classList.toggle('on', p.dataset.pfPanel === alvo));
      });
    });

    /* ---------- Segurança (demonstrativo) ---------- */
    const form = $('#pfSecurityForm');
    const nota = $('#pfFormNote');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const usuario = ($('#pfUser') && $('#pfUser').value || '').trim();
        const senha = $('#pfPass') ? $('#pfPass').value : '';
        const confirmar = $('#pfPass2') ? $('#pfPass2').value : '';

        if (!usuario || !senha || !confirmar) {
          if (nota) { nota.textContent = 'Preencha todos os campos.'; nota.classList.add('erro'); }
          return;
        }
        if (senha.length < 6) {
          if (nota) { nota.textContent = 'Use uma senha com pelo menos 6 caracteres.'; nota.classList.add('erro'); }
          return;
        }
        if (senha !== confirmar) {
          if (nota) { nota.textContent = 'As senhas não conferem.'; nota.classList.add('erro'); }
          return;
        }
        if (nota) {
          nota.textContent = 'Demonstração validada! Nenhuma credencial foi enviada.';
          nota.classList.remove('erro');
        }
        form.reset();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
