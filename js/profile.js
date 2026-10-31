/* ============================================================
   PERFIL — BANNER + CRIADOR DE AVATAR PIXEL ART (8/16-bit) + SEGURANÇA
   ------------------------------------------------------------
   • Boneco 100% desenhado em código (grade 24×36, SVG crispEdges)
   • Camadas: cabelo-tras · corpo · roupa · olhos · cabelo · acessorio
   • Cargos: USUARIO.cargo === 'dev'  → tudo liberado
             USUARIO.sub === true      → peças VIP liberadas
             demais                    → peças básicas
   ============================================================ */
(function(){
  'use strict';

  const BANNER_KEY = 'perfil:banner:v1';
  const AVATAR_KEY = 'perfil:boneco:v2';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ============================================================
     1) CATÁLOGO DE PEÇAS  (nivel 0 = básico · nivel 1 = 👑 Dev/Sub)
     ============================================================ */
  const OPCOES = {
    pele: [
      { id:'clara',  nome:'Clara',  cor:'#ffdcc2', nivel:0 },
      { id:'media',  nome:'Média',  cor:'#f0b98d', nivel:0 },
      { id:'bronze', nome:'Bronze', cor:'#cf9461', nivel:0 },
      { id:'morena', nome:'Morena', cor:'#a56c44', nivel:0 },
      { id:'escura', nome:'Escura', cor:'#6e4429', nivel:0 }
    ],
    cabeloEstilo: [
      { id:'curto',   nome:'Curto',   nivel:0 },
      { id:'longo',   nome:'Longo',   nivel:0 },
      { id:'careca',  nome:'Careca',  nivel:0 },
      { id:'moicano', nome:'Moicano', nivel:1 }
    ],
    cabeloCor: [
      { id:'preto', nome:'Preto', cor:'#2b2540', nivel:0 },
      { id:'roxo',  nome:'Roxo',  cor:'#8b5cf6', nivel:0 },
      { id:'loiro', nome:'Loiro', cor:'#f2c94c', nivel:0 },
      { id:'prata', nome:'Prata', cor:'#cbd5e1', nivel:1 },
      { id:'rosa',  nome:'Rosa',  cor:'#ff6ec7', nivel:1 }
    ],
    roupaEstilo: [
      { id:'moletom', nome:'Moletom',        nivel:0 },
      { id:'social',  nome:'Camisa Social',  nivel:0 },
      { id:'armadura',nome:'Armadura Gamer', nivel:1 }
    ],
    roupaCor: [
      { id:'roxo',    nome:'Roxo',    cor:'#7c3aed', nivel:0 },
      { id:'grafite', nome:'Grafite', cor:'#454560', nivel:0 },
      { id:'preto',   nome:'Preto',   cor:'#28233c', nivel:0 },
      { id:'ciano',   nome:'Ciano',   cor:'#06b6d4', nivel:1 },
      { id:'dourado', nome:'Dourado', cor:'#f5b82e', nivel:1 }
    ],
    acessorio: [
      { id:'nenhum',  nome:'Nenhum',          nivel:0 },
      { id:'oculos',  nome:'Óculos redondo',  nivel:0 },
      { id:'bone',    nome:'Boné',            nivel:0 },
      { id:'headset', nome:'Headset Gamer',   nivel:1 },
      { id:'coroa',   nome:'Coroa',           nivel:1 }
    ],
    acessorioCor: [
      { id:'dourado', nome:'Dourado', cor:'#ffd166', nivel:0 },
      { id:'lilas',   nome:'Lilás',   cor:'#c084fc', nivel:0 },
      { id:'azul',    nome:'Azul',    cor:'#7dd3fc', nivel:0 },
      { id:'rosa',    nome:'Rosa',    cor:'#ff6ec7', nivel:0 },
      { id:'branco',  nome:'Branco',  cor:'#f5f3ff', nivel:0 }
    ]
  };

  const DEFAULTS = {
    pele: 'media',
    cabeloEstilo: 'curto',
    cabeloCor: 'roxo',
    roupaEstilo: 'moletom',
    roupaCor: 'roxo',
    acessorio: 'oculos',
    acessorioCor: 'dourado'
  };

  const CAMPOS = Object.keys(DEFAULTS);
  const TXT_VIP = '👑 Exclusivo Dev/Sub';

  /* ============================================================
     2) CORES
     ============================================================ */
  function hex2rgb(h){
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  }
  function rgb2hex(a){
    return '#' + a.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }
  function mix(a, b, t){
    const A = hex2rgb(a), B = hex2rgb(b);
    return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
  }
  function shade(h, amt){ return amt < 0 ? mix(h, '#000000', -amt) : mix(h, '#ffffff', amt); }
  function lum(h){
    const c = hex2rgb(h);
    return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
  }

  const OUT = '#150a26';      // contorno padrão (roxo quase preto)
  const WHITE = '#f5f3ff';
  const EYE = '#1d0f2e';

  /* ============================================================
     3) MOTOR DE PIXELS  (grade 24×36, espelhamento horizontal)
     ============================================================ */
  const W = 24, H = 36;

  function canvas(){
    const px = new Map();
    const api = {
      set(x, y, c){ if (x >= 0 && x < W && y >= 0 && y < H) px.set(y * W + x, c); return api; },
      del(x, y){ px.delete(y * W + x); return api; },
      has(x, y){ return px.has(y * W + x); },
      rect(x, y, w, h, c){
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) api.set(x + i, y + j, c);
        return api;
      },
      /* desenha à esquerda e espelha à direita */
      mrect(x, y, w, h, c){ api.rect(x, y, w, h, c); api.rect(W - x - w, y, w, h, c); return api; },
      mset(x, y, c){ api.set(x, y, c); api.set(W - 1 - x, y, c); return api; },
      /* linha do x1 até o centro, espelhada */
      half(y, x1, c){ return api.mrect(x1, y, 12 - x1, 1, c); },
      outline(c, skip){
        const add = [];
        px.forEach((_, k) => {
          const x = k % W, y = (k / W) | 0;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach((d) => {
            const nx = x + d[0], ny = y + d[1];
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) return;
            if (px.has(ny * W + nx)) return;
            if (skip && skip(nx, ny)) return;
            add.push(ny * W + nx);
          });
        });
        add.forEach((k) => px.set(k, c));
        return api;
      },
      pixels(){ return px; }
    };
    return api;
  }

  function toSVG(cv){
    const px = cv.pixels();
    let out = '';
    for (let y = 0; y < H; y++) {
      let x = 0;
      while (x < W) {
        const c = px.get(y * W + x);
        if (!c) { x++; continue; }
        let e = x + 1;
        while (e < W && px.get(y * W + e) === c) e++;
        out += '<rect x="' + x + '" y="' + y + '" width="' + (e - x) + '" height="1" fill="' + c + '"/>';
        x = e;
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H +
      '" shape-rendering="crispEdges" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">' +
      out + '</svg>';
  }

  /* topo do crânio por estilo de cabelo (usado por coroa / headset) */
  function topoCabeca(R){
    return (R.cabeloEstilo === 'curto' || R.cabeloEstilo === 'longo') ? 3 : 5;
  }

  /* ============================================================
     4) CAMADAS
     ============================================================ */

  /* ---- CORPO: cabeça, pescoço, mãos, rosto ---- */
  function layerCorpo(R){
    const cv = canvas();
    const sk = R.pele, sh = shade(sk, -0.16), blush = mix(sk, '#ff5d8f', 0.5);

    cv.half(5, 7, sk);
    cv.half(6, 6, sk);
    for (let y = 7; y <= 14; y++) cv.half(y, 5, sk);
    cv.half(15, 6, sk);
    cv.half(16, 7, sk);

    // sombra: queixo e lado direito (luz vem da esquerda)
    cv.half(16, 7, sh);
    for (let y = 8; y <= 14; y++) cv.set(18, y, sh);
    cv.set(17, 15, sh);

    // pescoço
    cv.rect(10, 17, 4, 2, sh);

    // mãos
    cv.mrect(5, 27, 2, 2, sk);
    cv.mrect(5, 28, 2, 1, sh);

    // bochechas + sorriso
    cv.mrect(7, 13, 2, 1, blush);
    cv.mset(10, 13, '#8a3550');
    cv.rect(11, 14, 2, 1, '#8a3550');

    cv.outline(OUT);
    return cv;
  }

  /* ---- OLHOS (camada própria para piscar) ---- */
  function layerOlhos(){
    const cv = canvas();
    cv.mrect(8, 10, 2, 3, EYE);
    cv.mset(8, 10, '#ffffff');
    return cv;
  }

  /* ---- CABELO (traseira: só o longo) ---- */
  function layerCabeloTras(R){
    const cv = canvas();
    if (R.cabeloEstilo !== 'longo') return cv;
    const c = R.cabeloCor, hd = shade(c, -0.2);
    for (let y = 7; y <= 21; y++) cv.half(y, 2, hd);
    cv.half(22, 3, hd);
    cv.half(23, 4, hd);
    cv.half(24, 5, hd);
    cv.mrect(3, 11, 1, 9, shade(hd, -0.14));
    cv.outline(shade(c, -0.62));
    return cv;
  }

  /* ---- CABELO (frente) ---- */
  function layerCabelo(R){
    const cv = canvas();
    const c = R.cabeloCor;
    const hl = shade(c, 0.24), hd = shade(c, -0.2), ho = shade(c, -0.62);
    const estilo = R.cabeloEstilo;

    if (estilo === 'curto' || estilo === 'longo') {
      cv.half(3, 8, c);
      cv.half(4, 6, c);
      cv.half(5, 5, c);
      for (let y = 6; y <= 8; y++) cv.half(y, 4, c);
      // franja
      cv.mrect(4, 9, 4, 1, c);
      cv.mrect(9, 9, 2, 1, c);
      cv.mrect(4, 10, 2, 3, c);
      // brilho e sombra
      cv.mrect(8, 4, 3, 1, hl);
      cv.mrect(7, 5, 2, 1, hl);
      cv.mrect(5, 6, 1, 2, hl);
      cv.half(8, 4, hd);
      cv.mrect(9, 9, 2, 1, hd);
      cv.set(11, 6, hd); cv.set(12, 6, hd);
      cv.set(11, 7, hd); cv.set(12, 7, hd);

      if (estilo === 'longo') {
        // mechas longas na frente dos ombros
        cv.mrect(4, 13, 2, 4, c);
        cv.mrect(4, 17, 3, 4, c);
        cv.mrect(4, 14, 1, 6, hd);
        cv.mrect(5, 17, 1, 3, hl);
      }
    }

    if (estilo === 'moicano') {
      cv.half(0, 11, c);
      cv.half(1, 10, c);
      cv.half(2, 10, c);
      cv.half(3, 9, c);
      for (let y = 4; y <= 8; y++) cv.half(y, 9, c);
      cv.half(9, 10, c);
      cv.mrect(10, 1, 1, 6, hl);
      cv.mrect(9, 4, 1, 5, hd);
      // lateral raspada (pontilhado)
      const limite = { 5: 7, 6: 6, 7: 5, 8: 5, 9: 5 };
      const stub = mix(c, R.pele, 0.42);
      for (let y = 6; y <= 9; y++) {
        for (let x = limite[y]; x <= 7; x++) {
          if ((x + y) % 2 === 0) cv.mset(x, y, stub);
        }
      }
    }

    if (estilo === 'careca') {
      const glint = mix(R.pele, '#ffffff', 0.55);
      cv.mset(8, 6, glint);
      cv.set(9, 6, glint);
      cv.set(7, 7, glint);
      return cv;
    }

    // boné cobre o topo: corta o que sobra acima da cúpula
    if (R.acessorio === 'bone') {
      cv.pixels().forEach((_, k) => { if (((k / W) | 0) < 3) cv.pixels().delete(k); });
    }

    cv.outline(ho);
    return cv;
  }

  /* ---- ROUPA ---- */
  function parteInferior(cv, o){
    // pernas
    cv.mrect(8, 28, 3, 4, o.calca);
    cv.mrect(10, 28, 1, 4, o.calcaSombra);
    // sapatos
    cv.mrect(7, 32, 4, 2, o.sapato);
    cv.mrect(7, 33, 4, 1, o.sola);
    if (o.brilho) cv.mrect(8, 32, 2, 1, o.brilho);
  }

  function layerRoupa(R){
    const cv = canvas();
    const c = R.roupaCor;
    const lt = shade(c, 0.22), dk = shade(c, -0.26), dkk = shade(c, -0.55);
    const estilo = R.roupaEstilo;
    const sombraPele = shade(R.pele, -0.16);

    if (estilo === 'moletom') {
      // tronco + mangas
      cv.half(19, 8, c);
      for (let y = 20; y <= 27; y++) cv.half(y, 7, c);
      cv.mrect(5, 21, 2, 6, c);
      cv.mset(6, 20, c);
      cv.mrect(7, 21, 1, 6, dk);          // dobra sob o braço
      // capuz
      cv.mrect(8, 18, 2, 1, lt);
      cv.rect(11, 19, 2, 1, dkk);
      cv.mrect(9, 19, 2, 1, lt);
      // cordinhas
      cv.mset(10, 20, WHITE);
      cv.mset(10, 21, WHITE);
      cv.mset(10, 22, '#cdbdf0');
      cv.mset(10, 23, '#cdbdf0');
      // bolso canguru
      cv.mrect(9, 24, 3, 1, dk);
      cv.mrect(9, 25, 1, 2, dk);
      // barra e punhos
      cv.mrect(7, 27, 5, 1, dk);
      cv.mrect(5, 26, 2, 1, dk);
      // brilho do ombro
      cv.mrect(7, 20, 2, 1, lt);
      cv.mset(5, 21, lt);

      parteInferior(cv, { calca:'#34407d', calcaSombra:'#27316a', sapato:WHITE, sola:c, brilho:null });
    }

    if (estilo === 'social') {
      const tie = lum(c) > 0.45 ? '#5b21b6' : '#c4b5fd';
      const tieDk = shade(tie, -0.28);
      cv.half(19, 8, c);
      for (let y = 20; y <= 27; y++) cv.half(y, 7, c);
      cv.mrect(5, 21, 2, 6, c);
      cv.mset(6, 20, c);
      cv.mrect(7, 21, 1, 6, dk);
      // punhos brancos
      cv.mrect(5, 26, 2, 1, WHITE);
      // gola
      cv.mrect(8, 18, 3, 1, WHITE);
      cv.mrect(9, 19, 2, 1, WHITE);
      cv.mrect(8, 19, 1, 1, '#d9d0f2');
      // gravata
      cv.rect(11, 19, 2, 1, tieDk);
      cv.rect(11, 20, 2, 2, tie);
      cv.rect(10, 22, 4, 3, tie);
      cv.rect(11, 25, 2, 2, tieDk);
      cv.set(11, 23, shade(tie, 0.25));
      // botões
      cv.mset(9, 22, lt);
      // cinto
      cv.mrect(7, 27, 5, 1, '#241a38');
      cv.rect(11, 27, 2, 1, '#ffd166');
      // brilho
      cv.mrect(7, 20, 2, 1, lt);

      parteInferior(cv, { calca:'#2a2442', calcaSombra:'#1c1730', sapato:'#15101f', sola:'#0b0714', brilho:'#4a3d6b' });
    }

    if (estilo === 'armadura') {
      const pl = shade(c, 0.32), pd = shade(c, -0.3);
      const acc = c.toLowerCase() === '#f5b82e' ? '#22d3ee' : '#ffd166';
      const accD = shade(acc, -0.35);
      const under = '#2c2447', underD = '#211a38';

      // roupa de baixo
      cv.half(19, 8, under);
      for (let y = 20; y <= 27; y++) cv.half(y, 7, under);
      cv.mrect(5, 21, 2, 6, under);
      cv.mset(6, 20, under);
      cv.mrect(5, 24, 1, 2, underD);

      // peitoral
      for (let y = 19; y <= 24; y++) cv.half(y, 8, c);
      cv.half(25, 9, c);
      cv.half(19, 8, pl);
      cv.mrect(8, 20, 1, 4, pl);
      cv.half(24, 8, pd);
      cv.half(25, 9, pd);
      cv.rect(11, 20, 2, 5, pd);                 // divisão central
      cv.rect(11, 21, 2, 2, acc);                // emblema
      cv.mset(9, 24, accD);
      cv.mset(10, 24, acc);
      // gorjal
      cv.mrect(8, 18, 2, 1, pd);
      // ombreiras
      cv.mrect(4, 19, 4, 4, c);
      cv.del(4, 19).del(19, 19);   // quina arredondada
      cv.mrect(5, 19, 2, 1, pl);
      cv.mrect(4, 22, 4, 1, pd);
      cv.mset(6, 21, acc);
      // braçadeiras
      cv.mrect(5, 25, 2, 2, c);
      cv.mrect(5, 25, 2, 1, pl);
      cv.mrect(5, 26, 2, 1, pd);
      // cinto
      cv.mrect(7, 26, 5, 1, underD);
      cv.mrect(7, 27, 5, 1, '#171127');
      cv.rect(11, 27, 2, 1, acc);

      parteInferior(cv, { calca:under, calcaSombra:underD, sapato:'#1a1330', sola:acc, brilho:'#3a2f5f' });
      // joelheiras
      cv.mrect(8, 29, 3, 2, c);
      cv.mrect(8, 29, 3, 1, pl);
      cv.mrect(8, 30, 3, 1, pd);
    }

    cv.outline(OUT);
    return cv;
  }

  /* ---- ACESSÓRIOS ---- */
  function layerAcessorio(R){
    const cv = canvas();
    const c = R.acessorioCor;
    const lt = shade(c, 0.3), dk = shade(c, -0.28), ho = shade(c, -0.62);
    const t = topoCabeca(R);
    const tight = t === 5;

    if (R.acessorio === 'oculos') {
      cv.mrect(8, 9, 2, 1, c);
      cv.mrect(8, 13, 2, 1, dk);
      cv.mrect(7, 10, 1, 3, c);
      cv.mrect(10, 10, 1, 3, dk);
      cv.rect(11, 11, 2, 1, c);
      cv.mset(6, 10, dk);
      cv.mset(7, 9, lt);
      const interior = (x, y) => y >= 10 && y <= 12 && ((x >= 8 && x <= 9) || (x >= 14 && x <= 15));
      cv.outline(ho, interior);
    }

    if (R.acessorio === 'headset') {
      const cup = shade(c, -0.45), cupHi = shade(c, -0.2);
      // arco
      if (tight) {
        cv.half(4, 7, c);
        cv.mset(6, 5, c);
        cv.mset(5, 6, c);
        for (let y = 7; y <= 9; y++) cv.mset(4, y, c);
      } else {
        cv.half(2, 8, c);
        cv.mrect(6, 3, 2, 1, c);
        cv.mset(5, 4, c);
        cv.mset(4, 5, c);
        for (let y = 6; y <= 9; y++) cv.mset(3, y, c);
      }
      cv.mrect(8, tight ? 4 : 2, 3, 1, lt);
      // conchas
      cv.mrect(2, 10, 3, 6, cup);
      cv.mrect(2, 10, 3, 1, cupHi);
      cv.mrect(2, 11, 1, 4, cupHi);
      cv.mrect(3, 12, 1, 2, c);          // LED
      // microfone
      cv.set(3, 16, dk); cv.set(4, 17, dk);
      cv.rect(5, 17, 3, 1, dk);
      cv.rect(8, 16, 2, 2, cup);
      cv.set(8, 16, lt);
      cv.outline(ho);
    }

    if (R.acessorio === 'coroa') {
      const jewel = '#ff3d6e';
      cv.mrect(7, t, 5, 2, c);
      cv.mrect(7, t + 1, 5, 1, dk);
      cv.mrect(7, t - 2, 2, 2, c);
      cv.half(t - 1, 11, c);
      cv.half(t - 2, 11, c);
      cv.half(t - 3, 11, c);
      cv.set(11, t - 3, lt); cv.set(12, t - 3, lt);
      cv.mset(7, t - 2, lt);
      cv.rect(11, t, 2, 1, jewel);
      cv.mset(8, t, '#7dd3fc');
      cv.mset(14, t, '#7dd3fc');
      cv.outline(ho);
    }

    if (R.acessorio === 'bone') {
      const brim = shade(c, -0.18), bill = shade(c, -0.4);
      cv.half(3, 7, c);
      cv.half(4, 5, c);
      for (let y = 5; y <= 7; y++) cv.half(y, 4, c);
      cv.half(8, 3, brim);
      cv.half(9, 5, bill);
      cv.mset(8, 4, dk); cv.mset(7, 5, dk); cv.mset(6, 6, dk); cv.mset(6, 7, dk);
      cv.mrect(7, 4, 2, 1, lt);
      cv.mrect(5, 5, 1, 2, lt);
      cv.rect(11, 2, 2, 1, dk);
      cv.rect(11, 5, 2, 2, lum(c) > 0.55 ? '#5b21b6' : WHITE);
      cv.outline(ho);
    }

    return cv;
  }

  /* ============================================================
     5) MONTAGEM DAS CAMADAS
     ============================================================ */
  const CAMADAS = ['cabelo-tras', 'corpo', 'roupa', 'olhos', 'cabelo', 'acessorio'];

  const DEPENDE = {
    'cabelo-tras': ['cabeloEstilo', 'cabeloCor'],
    corpo:         ['pele'],
    roupa:         ['roupaEstilo', 'roupaCor', 'pele'],
    olhos:         [],
    cabelo:        ['cabeloEstilo', 'cabeloCor', 'pele', 'acessorio'],
    acessorio:     ['acessorio', 'acessorioCor', 'cabeloEstilo']
  };

  const BUILDERS = {
    'cabelo-tras': layerCabeloTras,
    corpo: layerCorpo,
    roupa: layerRoupa,
    olhos: layerOlhos,
    cabelo: layerCabelo,
    acessorio: layerAcessorio
  };

  function achar(campo, id){
    const lista = OPCOES[campo];
    return lista.find((o) => o.id === id) || lista.find((o) => o.id === DEFAULTS[campo]);
  }

  function resolver(estado){
    const g = (campo) => achar(campo, estado[campo]);
    return {
      pele: g('pele').cor,
      cabeloEstilo: g('cabeloEstilo').id,
      cabeloCor: g('cabeloCor').cor,
      roupaEstilo: g('roupaEstilo').id,
      roupaCor: g('roupaCor').cor,
      acessorio: g('acessorio').id,
      acessorioCor: g('acessorioCor').cor
    };
  }

  function desenharCamada(nome, R){
    return toSVG(BUILDERS[nome](R));
  }

  /* API pública (útil para depurar no console) */
  window.PixelAvatar = { OPCOES, DEFAULTS, CAMADAS, resolver, desenharCamada, builders: BUILDERS, W, H };

  /* ============================================================
     6) CARGOS / ACESSO
     ============================================================ */
  function getUsuario(){
    try {
      /* USUARIO é um `let` global do main.js */
      // eslint-disable-next-line no-undef
      if (typeof USUARIO !== 'undefined') return USUARIO;
    } catch (_) { /* ignora */ }
    return window.USUARIO || null;
  }

  /* 0 = básico · 1 = Sub (VIP) · 2 = Dev (tudo)
     Prévia: ?sim=sub ou ?sim=dev simula o cargo (apenas visual/local). */
  function nivelAcesso(){
    try {
      const sim = new URLSearchParams(location.search).get('sim');
      if (sim === 'dev') return 2;
      if (sim === 'sub') return 1;
    } catch (_) { /* ignora */ }
    const u = getUsuario();
    if (!u) return 0;
    if (u.cargo === 'dev') return 2;
    if (u.sub === true) return 1;
    return 0;
  }

  const permitido = (opt, nivel) => (opt.nivel || 0) <= (nivel >= 2 ? 1 : nivel);

  function sanear(bruto, nivel){
    const out = {};
    CAMPOS.forEach((campo) => {
      const opt = OPCOES[campo].find((o) => o.id === (bruto && bruto[campo]));
      out[campo] = (opt && permitido(opt, nivel)) ? opt.id : DEFAULTS[campo];
    });
    return out;
  }

  /* ============================================================
     7) STORAGE
     ============================================================ */
  function lerLocal(chave){
    try {
      const raw = localStorage.getItem(chave);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function salvarLocal(chave, valor){
    try {
      localStorage.setItem(chave, JSON.stringify(valor));
      return true;
    } catch (_) { return false; }
  }
  function estadoBrutoValido(dados){
    const bruto = { ...DEFAULTS };
    if (!dados || typeof dados !== 'object') return bruto;
    CAMPOS.forEach((campo) => {
      if (OPCOES[campo].some((o) => o.id === dados[campo])) bruto[campo] = dados[campo];
    });
    return bruto;
  }

  /* ============================================================
     8) INTERFACE
     ============================================================ */
  function init(){
    const avatar = $('#pfAvatar');
    const banner = $('#pfBanner');
    const bannerInput = $('#pfBannerInput');
    const bannerStatus = $('#pfBannerStatus');
    if (!avatar && !banner) return;

    /* ---------- Avatar ---------- */
    let bruto = estadoBrutoValido(lerLocal(AVATAR_KEY));
    let nivel = nivelAcesso();
    let efetivo = sanear(bruto, nivel);
    const assin = {};
    let avisoTimer = null;

    const camadaEl = {};
    CAMADAS.forEach((n) => { camadaEl[n] = avatar ? $('[data-layer="' + n + '"]', avatar) : null; });

    function desenhar(animar){
      if (!avatar) return;
      const R = resolver(efetivo);
      let mudou = false;
      CAMADAS.forEach((nome) => {
        const el = camadaEl[nome];
        if (!el) return;
        const sig = DEPENDE[nome].map((k) => R[k]).join('|');
        if (assin[nome] === sig) return;
        assin[nome] = sig;
        el.innerHTML = desenharCamada(nome, R);
        mudou = true;
        if (animar && nome !== 'olhos') {
          el.classList.remove('troca');
          void el.offsetWidth;
          el.classList.add('troca');
        }
      });
      if (mudou && animar) {
        avatar.classList.remove('hop');
        void avatar.offsetWidth;
        avatar.classList.add('hop');
      }
      marcar();
    }

    /* monta os botões a partir do catálogo */
    function montarControles(){
      $$('[data-pf-field]').forEach((box) => {
        const campo = box.dataset.pfField;
        const lista = OPCOES[campo];
        if (!lista) return;
        const ehEstilo = box.classList.contains('pf-styles');
        box.innerHTML = lista.map((opt) => {
          if (ehEstilo) {
            return '<button type="button" class="pf-style" data-campo="' + campo + '" data-id="' + opt.id + '" aria-pressed="false">' +
              '<span class="pf-style-top"><span class="pf-style-name">' + opt.nome + '</span><i class="pf-lock" aria-hidden="true">🔒</i></span>' +
              (opt.nivel ? '<small class="pf-vip"></small>' : '') +
              '</button>';
          }
          return '<button type="button" class="pf-swatch" data-campo="' + campo + '" data-id="' + opt.id +
            '" style="--sw:' + opt.cor + '" aria-pressed="false" aria-label="' + opt.nome + '" title="' + opt.nome + '">' +
            '<i class="pf-lock" aria-hidden="true">🔒</i></button>';
        }).join('');
      });
    }

    /* aplica estado de bloqueio nos botões */
    function atualizarBloqueios(){
      $$('[data-campo][data-id]').forEach((btn) => {
        const opt = OPCOES[btn.dataset.campo].find((o) => o.id === btn.dataset.id);
        if (!opt) return;
        const liberado = permitido(opt, nivel);
        btn.classList.toggle('is-locked', !liberado);
        btn.classList.toggle('is-vip', !!opt.nivel);
        btn.setAttribute('aria-disabled', liberado ? 'false' : 'true');
        const vip = $('.pf-vip', btn);
        if (vip) vip.textContent = liberado ? '👑 VIP' : TXT_VIP;
        if (btn.classList.contains('pf-swatch')) {
          btn.title = liberado ? opt.nome : opt.nome + ' — ' + TXT_VIP;
          btn.setAttribute('aria-label', liberado ? opt.nome : opt.nome + ' (bloqueada: ' + TXT_VIP + ')');
        }
      });
      $$('.pf-option-group').forEach((g) => {
        const temBloqueio = !!$('.is-locked', g);
        const dica = $('.pf-vip-hint', g);
        if (dica) dica.hidden = !temBloqueio;
      });
      const badge = $('#pfAccess');
      if (badge) {
        badge.dataset.nivel = String(nivel);
        badge.textContent = nivel >= 2 ? '🛠️ Dev · tudo liberado'
          : nivel === 1 ? '👑 Sub · peças VIP liberadas'
          : '🔒 Acesso básico';
      }
      const nome = $('#pfBannerNome');
      const u = getUsuario();
      const apelido = u && (u.nome || u.name || u.username || u.global_name);
      if (nome) nome.textContent = apelido ? '@' + String(apelido).replace(/^@/, '') : '@convidado';
    }

    /* marca opção selecionada e escreve o nome escolhido */
    function marcar(){
      $$('[data-campo][data-id]').forEach((btn) => {
        const on = efetivo[btn.dataset.campo] === btn.dataset.id;
        btn.classList.toggle('on', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      CAMPOS.forEach((campo) => {
        const alvo = $('[data-pf-name="' + campo + '"]');
        if (alvo) alvo.textContent = achar(campo, efetivo[campo]).nome;
      });
    }

    function avisar(msg){
      const nota = $('#pfLockNote');
      if (!nota) return;
      nota.textContent = msg;
      nota.classList.add('on');
      clearTimeout(avisoTimer);
      avisoTimer = setTimeout(() => { nota.classList.remove('on'); nota.textContent = ''; }, 4200);
    }

    function escolher(btn){
      const campo = btn.dataset.campo;
      const opt = OPCOES[campo].find((o) => o.id === btn.dataset.id);
      if (!opt) return;
      if (!permitido(opt, nivel)) {
        btn.classList.remove('nope');
        void btn.offsetWidth;
        btn.classList.add('nope');
        avisar('🔒 “' + opt.nome + '” é ' + TXT_VIP + '. Vire Sub na Twitch pra liberar!');
        return;
      }
      bruto[campo] = opt.id;
      efetivo = sanear(bruto, nivel);
      salvarLocal(AVATAR_KEY, bruto);
      desenhar(true);
    }

    const opcoes = $('#pfOptions');
    if (opcoes) {
      opcoes.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-campo][data-id]');
        if (btn) escolher(btn);
      });
      opcoes.addEventListener('animationend', (e) => {
        if (e.animationName === 'pfShake') e.target.classList.remove('nope');
      });
    }
    if (avatar) {
      avatar.addEventListener('animationend', (e) => {
        if (e.target.classList.contains('avatar-layer')) e.target.classList.remove('troca');
        if (e.target === avatar) avatar.classList.remove('hop');
      });
    }

    const resetBtn = $('#pfReset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        bruto = { ...DEFAULTS };
        efetivo = sanear(bruto, nivel);
        salvarLocal(AVATAR_KEY, bruto);
        desenhar(true);
        avisar('↺ Boneco base restaurado!');
      });
    }

    const randBtn = $('#pfRandom');
    if (randBtn) {
      randBtn.addEventListener('click', () => {
        CAMPOS.forEach((campo) => {
          const livres = OPCOES[campo].filter((o) => permitido(o, nivel));
          bruto[campo] = livres[Math.floor(Math.random() * livres.length)].id;
        });
        efetivo = sanear(bruto, nivel);
        salvarLocal(AVATAR_KEY, bruto);
        desenhar(true);
      });
    }

    montarControles();
    atualizarBloqueios();
    desenhar(false);

    /* cargo chega assíncrono (checarLogin do main.js): reavalia quando mudar */
    function reavaliarAcesso(){
      const n = nivelAcesso();
      const u = getUsuario();
      const chave = n + '|' + (u ? (u.nome || u.name || u.username || u.global_name || '') : '');
      if (reavaliarAcesso.ult === chave) return;
      reavaliarAcesso.ult = chave;
      nivel = n;
      efetivo = sanear(bruto, nivel);
      const nota = $('#pfLockNote');
      if (nota) { nota.classList.remove('on'); nota.textContent = ''; }
      atualizarBloqueios();
      desenhar(false);
    }
    reavaliarAcesso.ult = null;
    reavaliarAcesso();
    setInterval(() => { if (!document.hidden) reavaliarAcesso(); }, 800);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reavaliarAcesso(); });

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
          const cv = document.createElement('canvas');
          cv.width = largura;
          cv.height = altura;
          const ctx = cv.getContext('2d');
          if (!ctx) { resolve(dataUrl); return; }
          ctx.drawImage(img, 0, 0, largura, altura);
          resolve(cv.toDataURL('image/jpeg', 0.86));
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
    const tabs = $$('[data-pf-tab]');
    const paineis = $$('[data-pf-panel]');
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