(function(){
  'use strict';

  const W = 24;
  const H = 36;

  const SLOTS = [
    'base', 'pele', 'rosto',
    'cabelo', 'cabeloCor',
    'roupa', 'roupaCor',
    'calcado', 'calcadoCor',
    'acessorio', 'acessorioCor',
    'efeito', 'animacao', 'moldura'
  ];

  const PADRAO = {
    base: 'masc',
    pele: 'media',
    rosto: 'feliz',
    cabelo: 'curto',
    cabeloCor: 'roxo',
    roupa: 'moletom',
    roupaCor: 'roxo',
    calcado: 'tenis',
    calcadoCor: 'branco',
    acessorio: 'oculos',
    acessorioCor: 'dourado',
    efeito: 'nenhum',
    animacao: 'respirar',
    moldura: 'simples'
  };

  const IDS = {
    base: ['masc', 'fem'],
    pele: ['clara', 'media', 'bronze', 'morena', 'escura', 'alien'],
    rosto: ['feliz', 'serio', 'piscada', 'sono', 'estrela', 'neon'],
    cabelo: ['curto', 'longo', 'careca', 'rabo', 'coques', 'moicano', 'espetado'],
    cabeloCor: ['preto', 'roxo', 'loiro', 'ruivo', 'prata', 'rosa', 'ciano'],
    roupa: ['moletom', 'camiseta', 'social', 'vestido', 'jaqueta', 'armadura'],
    roupaCor: ['roxo', 'grafite', 'preto', 'vermelho', 'ciano', 'dourado'],
    calcado: ['tenis', 'chinelo', 'botas', 'tenis_neon', 'botas_cyber'],
    calcadoCor: ['branco', 'preto', 'vermelho', 'roxo', 'ciano'],
    acessorio: ['nenhum', 'oculos', 'bone', 'headset', 'orelhas', 'halo', 'coroa'],
    acessorioCor: ['dourado', 'lilas', 'azul', 'rosa', 'branco'],
    efeito: ['nenhum', 'brilho', 'faiscas', 'glitch', 'aura_roxa', 'aura_neon', 'chamas', 'estrelas', 'confete'],
    animacao: ['respirar', 'acenar', 'pular', 'dancar', 'flutuar', 'meditar', 'comemorar'],
    moldura: ['nenhuma', 'simples', 'roxa', 'ciano', 'dourada', 'holo', 'evento1']
  };

  const PALETAS = {
    pele: {
      clara: '#f2c9a0',
      media: '#d99a6c',
      bronze: '#b87345',
      morena: '#8a5230',
      escura: '#5c3521',
      alien: '#7dd3a8'
    },
    cabeloCor: {
      preto: '#2b2540',
      roxo: '#8b5cf6',
      loiro: '#f2c94c',
      ruivo: '#c2531b',
      prata: '#cbd5e1',
      rosa: '#ff6ec7',
      ciano: '#22d3ee'
    },
    roupaCor: {
      roxo: '#7c3aed',
      grafite: '#454560',
      preto: '#28233c',
      vermelho: '#dc2626',
      ciano: '#06b6d4',
      dourado: '#f5b82e'
    },
    calcadoCor: {
      branco: '#f5f3ff',
      preto: '#1a1330',
      vermelho: '#dc2626',
      roxo: '#7c3aed',
      ciano: '#22d3ee'
    },
    acessorioCor: {
      dourado: '#ffd166',
      lilas: '#c084fc',
      azul: '#7dd3fc',
      rosa: '#ff6ec7',
      branco: '#f5f3ff'
    }
  };

  const CONTORNO = '#150a26';
  const BRANCO = '#f5f3ff';
  const OLHO = '#1d0f2e';
  const BOCA = '#8d4a52';

  function canvas(){
    const pixels = new Map();
    const chave = (x, y) => x + ',' + y;

    return {
      set(x, y, cor){
        const px = Math.round(x);
        const py = Math.round(y);
        if (!cor || px < 0 || py < 0 || px >= W || py >= H) return;
        pixels.set(chave(px, py), cor);
      },
      get(x, y){
        return pixels.get(chave(Math.round(x), Math.round(y))) || null;
      },
      mset(x, y, cor){
        this.set(x, y, cor);
        this.set(W - 1 - x, y, cor);
      },
      rect(x, y, largura, altura, cor){
        for (let py = y; py < y + altura; py++) {
          for (let px = x; px < x + largura; px++) this.set(px, py, cor);
        }
      },
      half(y, inicio, cor){
        for (let px = inicio; px < W / 2; px++) {
          this.set(px, y, cor);
          this.set(W - 1 - px, y, cor);
        }
      },
      mrect(x, y, largura, altura, cor){
        this.rect(x, y, largura, altura, cor);
        this.rect(W - x - largura, y, largura, altura, cor);
      },
      erase(x, y, largura, altura){
        for (let py = y; py < y + altura; py++) {
          for (let px = x; px < x + largura; px++) pixels.delete(chave(px, py));
        }
      },
      outline(cor = CONTORNO){
        const bordas = [];
        const vistos = new Set();
        pixels.forEach((_, par) => {
          const [x, y] = par.split(',').map(Number);
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) return;
            const k = chave(nx, ny);
            if (pixels.has(k) || vistos.has(k)) return;
            vistos.add(k);
            bordas.push([nx, ny]);
          });
        });
        bordas.forEach(([x, y]) => pixels.set(chave(x, y), cor));
        return this;
      },
      pixels(){
        return [...pixels.entries()].map(([par, cor]) => {
          const [x, y] = par.split(',').map(Number);
          return { x, y, cor };
        });
      }
    };
  }

  function hex2rgb(hex){
    let valor = String(hex || '').replace('#', '');
    if (valor.length === 3) valor = valor.split('').map(c => c + c).join('');
    if (!/^[0-9a-f]{6}$/i.test(valor)) return [245, 243, 255];
    return [
      parseInt(valor.slice(0, 2), 16),
      parseInt(valor.slice(2, 4), 16),
      parseInt(valor.slice(4, 6), 16)
    ];
  }

  function rgb2hex(r, g, b){
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  }

  function misturar(a, b, quantidade = 0.3){
    const ca = hex2rgb(a);
    const cb = hex2rgb(b);
    return rgb2hex(
      ca[0] + (cb[0] - ca[0]) * quantidade,
      ca[1] + (cb[1] - ca[1]) * quantidade,
      ca[2] + (cb[2] - ca[2]) * quantidade
    );
  }

  function escurecer(cor, quantidade = 0.28){
    return misturar(cor, '#0b0614', quantidade);
  }

  function clarear(cor, quantidade = 0.25){
    return misturar(cor, '#ffffff', quantidade);
  }

  function normalizar(entrada){
    const out = {};
    SLOTS.forEach(slot => {
      const valor = entrada && entrada[slot];
      out[slot] = IDS[slot].includes(valor) ? valor : PADRAO[slot];
    });
    return out;
  }

  function corDe(slot, id){
    const paleta = PALETAS[slot];
    if (!paleta) return BRANCO;
    return paleta[id] || paleta[PADRAO[slot]] || BRANCO;
  }

  function pernaDe(boneco){
    return boneco.base === 'fem'
      ? { x: 9, largura: 2 }
      : { x: 8, largura: 3 };
  }

  function topoCabeca(boneco){
    switch (boneco.cabelo) {
      case 'espetado': return 1;
      case 'coques': return 2;
      case 'careca': return 5;
      default: return 3;
    }
  }

  function miniEstrela(cv, x, y, cor, centro = BRANCO){
    cv.set(x, y, cor);
    cv.rect(x - 1, y + 1, 3, 1, cor);
    cv.set(x, y + 2, cor);
    cv.set(x, y + 1, centro);
  }

  function camadaCorpo(boneco){
    const cv = canvas();
    const fem = boneco.base === 'fem';
    const pele = corDe('pele', boneco.pele);
    const sombra = escurecer(pele, 0.22);
    const brilho = clarear(pele, 0.18);

    cv.half(5, 7, pele);
    cv.half(6, 6, pele);
    for (let y = 7; y <= 14; y++) cv.half(y, 5, pele);
    cv.half(15, 6, pele);
    cv.half(16, 7, pele);
    cv.half(16, 7, sombra);
    for (let y = 8; y <= 14; y++) cv.set(18, y, sombra);
    cv.set(17, 15, sombra);
    cv.mset(4, 11, pele);
    cv.mset(4, 12, sombra);

    if (boneco.cabelo === 'careca') {
      cv.rect(8, 6, 3, 1, brilho);
      cv.set(7, 7, brilho);
    }

    cv.rect(10, 17, 4, 2, sombra);
    cv.rect(10, 17, 2, 1, brilho);

    if (fem) {
      for (let y = 19; y <= 24; y++) cv.half(y, 8, pele);
      cv.half(25, 7, pele);
      cv.half(26, 7, pele);
    } else {
      for (let y = 19; y <= 26; y++) cv.half(y, 7, pele);
    }

    const bracoX = fem ? 6 : 5;
    cv.mrect(bracoX, 20, 2, 7, pele);
    cv.mrect(bracoX, 27, 2, 2, pele);
    cv.mrect(bracoX, 26, 2, 1, sombra);
    cv.mrect(bracoX, 27, 1, 2, sombra);

    const perna = pernaDe(boneco);
    cv.mrect(perna.x, 27, perna.largura, 5, pele);
    cv.mrect(perna.x + perna.largura - 1, 27, 1, 5, sombra);

    cv.outline();
    return cv;
  }

  function camadaOlhos(boneco){
    const cv = canvas();
    const sombra = escurecer(corDe('pele', boneco.pele), 0.32);

    switch (boneco.rosto) {
      case 'serio':
        cv.mrect(8, 11, 2, 2, OLHO);
        cv.rect(7, 9, 4, 1, sombra);
        cv.rect(13, 9, 4, 1, sombra);
        cv.mrect(9, 11, 1, 1, BRANCO);
        break;
      case 'piscada':
        cv.rect(7, 12, 3, 1, OLHO);
        cv.mrect(14, 11, 2, 3, OLHO);
        cv.mrect(15, 11, 1, 1, BRANCO);
        break;
      case 'sono':
        cv.mrect(7, 12, 3, 1, OLHO);
        cv.mrect(7, 13, 3, 1, clarear(corDe('pele', boneco.pele), 0.28));
        break;
      case 'estrela':
        miniEstrela(cv, 8, 10, '#ffd166');
        miniEstrela(cv, 15, 10, '#ffd166');
        break;
      case 'neon':
        cv.mrect(7, 10, 3, 3, 'rgba(34,211,238,.32)');
        cv.mrect(8, 11, 2, 3, '#22d3ee');
        cv.mrect(9, 11, 1, 1, BRANCO);
        break;
      default:
        cv.mrect(8, 11, 2, 3, OLHO);
        cv.mrect(9, 11, 1, 1, BRANCO);
    }

    return cv;
  }

  function camadaBoca(boneco){
    const cv = canvas();
    const escuro = '#7c3541';

    switch (boneco.rosto) {
      case 'serio':
        cv.rect(10, 14, 4, 1, escuro);
        break;
      case 'sono':
        cv.rect(11, 14, 2, 2, escuro);
        cv.set(11, 14, BOCA);
        break;
      case 'neon':
        cv.rect(10, 14, 3, 1, '#22d3ee');
        cv.set(13, 13, '#22d3ee');
        break;
      case 'estrela':
        cv.rect(10, 14, 4, 1, escuro);
        cv.rect(9, 13, 1, 1, escuro);
        cv.rect(14, 13, 1, 1, escuro);
        break;
      default:
        cv.rect(10, 14, 4, 1, escuro);
        cv.rect(9, 13, 1, 1, escuro);
        cv.rect(14, 13, 1, 1, escuro);
    }

    return cv;
  }

  function camadaCabeloTras(boneco){
    const cv = canvas();
    const cor = corDe('cabeloCor', boneco.cabeloCor);
    const sombra = escurecer(cor, 0.24);

    switch (boneco.cabelo) {
      case 'longo':
        for (let y = 7; y <= 18; y++) cv.half(y, 3, cor);
        for (let y = 19; y <= 24; y++) cv.half(y, 4, cor);
        for (let y = 9; y <= 24; y++) cv.set(3, y, sombra);
        break;
      case 'rabo':
        cv.rect(18, 7, 3, 9, cor);
        cv.rect(19, 16, 2, 5, cor);
        cv.rect(20, 21, 1, 3, cor);
        cv.rect(20, 8, 1, 8, sombra);
        cv.rect(18, 7, 1, 1, clarear(cor, 0.2));
        break;
      case 'coques':
        cv.rect(2, 3, 4, 4, cor);
        cv.rect(18, 3, 4, 4, cor);
        cv.rect(3, 2, 2, 1, cor);
        cv.rect(19, 2, 2, 1, cor);
        cv.rect(2, 6, 4, 1, sombra);
        cv.rect(18, 6, 4, 1, sombra);
        cv.set(3, 3, clarear(cor, 0.18));
        cv.set(19, 3, clarear(cor, 0.18));
        break;
      case 'espetado':
        for (let y = 3; y <= 8; y++) cv.half(y, y === 3 ? 7 : 5, cor);
        break;
      default:
        break;
    }

    cv.outline();
    return cv;
  }

  function camadaCabelo(boneco){
    const cv = canvas();
    const cor = corDe('cabeloCor', boneco.cabeloCor);
    const sombra = escurecer(cor, 0.28);
    const brilho = clarear(cor, 0.24);

    switch (boneco.cabelo) {
      case 'curto':
        for (let y = 3; y <= 8; y++) cv.half(y, y < 4 ? 7 : 5, cor);
        for (let y = 8; y <= 10; y++) cv.mrect(5, y, 2, 1, cor);
        for (let y = 9; y <= 10; y++) { cv.set(5, y, sombra); cv.set(18, y, sombra); }
        cv.half(9, 6, sombra);
        cv.rect(8, 3, 3, 1, brilho);
        break;
      case 'longo':
        for (let y = 3; y <= 9; y++) cv.half(y, y < 4 ? 7 : 5, cor);
        for (let y = 8; y <= 9; y++) cv.mrect(5, y, 2, 1, cor);
        for (let y = 9; y <= 17; y++) cv.mrect(4, y, 2, 1, cor);
        for (let y = 10; y <= 17; y++) cv.set(4, y, sombra);
        cv.half(9, 6, sombra);
        cv.rect(8, 3, 3, 1, brilho);
        break;
      case 'careca':
        break;
      case 'rabo':
        for (let y = 3; y <= 8; y++) cv.half(y, y < 4 ? 7 : 5, cor);
        for (let y = 8; y <= 10; y++) cv.mrect(5, y, 2, 1, cor);
        cv.rect(17, 7, 2, 5, cor);
        cv.rect(17, 11, 2, 1, sombra);
        cv.half(9, 6, sombra);
        cv.rect(8, 3, 3, 1, brilho);
        break;
      case 'coques':
        for (let y = 3; y <= 7; y++) cv.half(y, y < 4 ? 7 : 6, cor);
        cv.mrect(6, 7, 1, 2, sombra);
        cv.rect(4, 6, 2, 1, sombra);
        cv.rect(18, 6, 2, 1, sombra);
        cv.rect(9, 3, 2, 1, brilho);
        break;
      case 'moicano':
        for (let y = 3; y <= 5; y++) cv.rect(9, y, 6, 1, cor);
        for (let y = 4; y <= 8; y++) cv.mrect(6, y, 2, 1, cor);
        for (let y = 8; y <= 9; y++) cv.half(y, 5, cor);
        cv.rect(10, 3, 4, 1, brilho);
        cv.rect(9, 5, 6, 1, sombra);
        cv.rect(9, 3, 1, 3, sombra);
        break;
      case 'espetado': {
        const alturas = [1, 2, 0, 3, 1, 3, 0, 3, 1, 3, 0, 2, 1];
        let x = 5;
        alturas.forEach((altura, indice) => {
          cv.rect(x, 4 - altura, 1, altura + 1, cor);
          if (indice % 3 === 1) cv.set(x, 4 - altura, brilho);
          x++;
        });
        for (let y = 4; y <= 8; y++) cv.half(y, 5, cor);
        cv.half(8, 6, sombra);
        break;
      }
    }

    cv.outline();
    return cv;
  }

  function camadaRoupa(boneco){
    const cv = canvas();
    const cor = corDe('roupaCor', boneco.roupaCor);
    const sombra = escurecer(cor, 0.3);
    const brilho = clarear(cor, 0.24);
    const perna = pernaDe(boneco);
    const calca = '#30284a';
    const calcaSombra = '#1f1933';

    switch (boneco.roupa) {
      case 'moletom': {
        for (let y = 19; y <= 26; y++) cv.half(y, 7, cor);
        cv.mrect(5, 20, 2, 7, cor);
        cv.mrect(5, 20, 1, 7, sombra);
        cv.mrect(5, 26, 2, 1, sombra);
        cv.mrect(5, 18, 7, 2, sombra);
        cv.erase(10, 18, 4, 2);
        cv.rect(9, 23, 6, 3, sombra);
        cv.rect(10, 23, 4, 1, cor);
        cv.set(10, 20, brilho);
        cv.set(13, 20, brilho);
        cv.set(11, 22, brilho);
        cv.mrect(perna.x, 27, perna.largura, 5, calca);
        cv.mrect(perna.x + perna.largura - 1, 27, 1, 5, calcaSombra);
        break;
      }
      case 'camiseta':
        for (let y = 19; y <= 25; y++) cv.half(y, 7, cor);
        cv.mrect(5, 20, 2, 3, cor);
        cv.mrect(5, 22, 2, 1, sombra);
        cv.half(19, 9, sombra);
        cv.rect(10, 20, 4, 1, brilho);
        miniEstrela(cv, 12, 22, brilho, BRANCO);
        cv.set(11, 25, brilho);
        cv.set(12, 25, brilho);
        cv.mrect(perna.x, 27, perna.largura, 5, '#34558b');
        cv.mrect(perna.x + perna.largura - 1, 27, 1, 5, '#243b61');
        break;
      case 'social':
        for (let y = 19; y <= 26; y++) cv.half(y, 7, cor);
        cv.mrect(5, 20, 2, 7, cor);
        cv.mrect(5, 20, 1, 7, sombra);
        cv.rect(9, 19, 3, 2, BRANCO);
        cv.rect(13, 19, 3, 2, BRANCO);
        cv.rect(11, 20, 2, 2, '#b91c1c');
        cv.rect(12, 22, 1, 3, '#b91c1c');
        cv.rect(12, 22, 1, 1, '#ef4444');
        cv.set(11, 23, '#fbbf24');
        cv.set(11, 25, '#fbbf24');
        cv.rect(10, 24, 4, 1, sombra);
        cv.mrect(perna.x, 27, perna.largura, 5, '#252038');
        cv.mrect(perna.x + perna.largura - 1, 27, 1, 5, '#181326');
        break;
      case 'vestido':
        for (let y = 19; y <= 23; y++) cv.half(y, 8, cor);
        cv.half(24, 7, cor);
        cv.half(25, 6, cor);
        for (let y = 26; y <= 29; y++) cv.half(y, 5, cor);
        cv.half(29, 5, sombra);
        cv.half(24, 8, sombra);
        cv.rect(9, 19, 6, 1, clarear(cor, 0.35));
        cv.set(9, 20, brilho);
        cv.set(14, 20, brilho);
        cv.rect(10, 24, 4, 1, sombra);
        cv.set(11, 25, brilho);
        cv.set(12, 27, brilho);
        break;
      case 'jaqueta':
        for (let y = 19; y <= 26; y++) cv.half(y, 7, '#241b3b');
        for (let y = 19; y <= 26; y++) {
          cv.rect(7, y, 3, 1, cor);
          cv.rect(14, y, 3, 1, cor);
        }
        cv.mrect(5, 20, 2, 7, cor);
        cv.mrect(5, 20, 1, 7, sombra);
        cv.rect(10, 19, 1, 8, '#22d3ee');
        cv.rect(13, 19, 1, 8, '#22d3ee');
        cv.rect(9, 19, 1, 2, sombra);
        cv.rect(14, 19, 1, 2, sombra);
        cv.set(7, 21, brilho);
        cv.set(16, 21, brilho);
        cv.mrect(perna.x, 27, perna.largura, 5, '#1d1930');
        cv.mrect(perna.x + perna.largura - 1, 27, 1, 5, '#22d3ee');
        break;
      case 'armadura': {
        for (let y = 19; y <= 26; y++) cv.half(y, 7, cor);
        cv.mrect(4, 19, 3, 3, clarear(cor, 0.24));
        cv.mrect(5, 20, 2, 6, cor);
        cv.mrect(5, 20, 1, 6, sombra);
        cv.rect(9, 20, 6, 1, brilho);
        cv.rect(10, 21, 4, 1, sombra);
        cv.rect(11, 22, 2, 2, '#ffd166');
        cv.rect(10, 24, 4, 1, sombra);
        cv.mrect(perna.x, 27, perna.largura, 5, clarear(cor, 0.12));
        cv.mrect(perna.x + perna.largura - 1, 27, 1, 5, sombra);
        cv.mrect(perna.x, 29, perna.largura, 1, brilho);
        break;
      }
    }

    cv.outline();
    return cv;
  }

  function formaSapato(boneco){
    return boneco.base === 'fem'
      ? { x: 8, largura: 3 }
      : { x: 7, largura: 4 };
  }

  function camadaCalcado(boneco){
    const cv = canvas();
    const cor = corDe('calcadoCor', boneco.calcadoCor);
    const sombra = escurecer(cor, 0.34);
    const brilho = clarear(cor, 0.3);
    const sapato = formaSapato(boneco);

    switch (boneco.calcado) {
      case 'chinelo':
        cv.mrect(sapato.x, 32, sapato.largura, 1, corDe('pele', boneco.pele));
        cv.mrect(sapato.x, 33, sapato.largura, 1, cor);
        cv.mrect(sapato.x, 32, 1, 1, sombra);
        cv.rect(11, 32, 1, 1, sombra);
        cv.rect(12, 32, 1, 1, sombra);
        break;
      case 'botas':
        cv.mrect(sapato.x, 30, sapato.largura, 3, cor);
        cv.mrect(sapato.x, 30, sapato.largura, 1, brilho);
        cv.mrect(sapato.x, 33, sapato.largura, 1, sombra);
        cv.mrect(sapato.x, 31, 1, 2, sombra);
        cv.rect(10, 31, 1, 1, brilho);
        cv.rect(13, 31, 1, 1, brilho);
        break;
      case 'tenis_neon':
        cv.mrect(sapato.x, 32, sapato.largura, 2, cor);
        cv.mrect(sapato.x, 33, sapato.largura, 1, '#22d3ee');
        cv.mrect(sapato.x, 32, 1, 1, brilho);
        cv.rect(9, 32, 2, 1, brilho);
        cv.rect(13, 32, 2, 1, brilho);
        cv.set(6, 33, '#22d3ee');
        cv.set(17, 33, '#22d3ee');
        break;
      case 'botas_cyber':
        cv.mrect(sapato.x, 29, sapato.largura, 4, '#1d1930');
        cv.mrect(sapato.x, 33, sapato.largura, 1, cor);
        cv.mrect(sapato.x, 30, 1, 3, cor);
        cv.mrect(sapato.x, 29, sapato.largura, 1, brilho);
        cv.rect(9, 31, 2, 1, '#22d3ee');
        cv.rect(13, 31, 2, 1, '#ff6ec7');
        break;
      default:
        cv.mrect(sapato.x, 32, sapato.largura, 2, cor);
        cv.mrect(sapato.x, 33, sapato.largura, 1, sombra);
        cv.mrect(sapato.x, 32, 1, 1, brilho);
        cv.rect(10, 32, 1, 1, brilho);
        cv.rect(13, 32, 1, 1, brilho);
    }

    cv.outline();
    return cv;
  }

  function camadaAcessorio(boneco){
    const cv = canvas();
    if (boneco.acessorio === 'nenhum') return cv;

    const cor = corDe('acessorioCor', boneco.acessorioCor);
    const sombra = escurecer(cor, 0.34);
    const brilho = clarear(cor, 0.32);
    const topo = Math.max(0, topoCabeca(boneco) - 2);

    switch (boneco.acessorio) {
      case 'oculos':
        cv.mrect(7, 10, 4, 3, cor);
        cv.erase(8, 11, 2, 1);
        cv.set(8, 11, 'rgba(255,255,255,.28)');
        cv.rect(11, 11, 2, 1, cor);
        cv.mset(6, 11, cor);
        cv.rect(7, 13, 1, 1, sombra);
        cv.rect(16, 13, 1, 1, sombra);
        break;
      case 'bone': {
        const cap = Math.max(1, topo - 1);
        cv.rect(6, cap, 12, 3, cor);
        cv.rect(7, cap, 10, 1, brilho);
        cv.rect(6, cap + 2, 12, 1, sombra);
        cv.rect(17, cap + 2, 5, 1, cor);
        cv.rect(17, cap + 3, 5, 1, sombra);
        break;
      }
      case 'headset':
        cv.rect(4, 7, 2, 6, cor);
        cv.rect(18, 7, 2, 6, cor);
        cv.rect(4, 6, 16, 2, cor);
        cv.rect(5, 5, 14, 1, sombra);
        cv.rect(4, 10, 2, 2, cor);
        cv.rect(18, 10, 2, 2, cor);
        cv.rect(6, 15, 1, 1, cor);
        cv.rect(7, 16, 1, 1, cor);
        cv.rect(8, 16, 1, 1, cor);
        cv.rect(9, 15, 1, 1, cor);
        cv.rect(9, 14, 1, 1, cor);
        break;
      case 'orelhas':
        cv.rect(4, 4, 1, 2, cor);
        cv.rect(5, 3, 2, 3, cor);
        cv.rect(7, 4, 1, 2, cor);
        cv.rect(5, 4, 1, 1, '#ff9ecb');
        cv.rect(19, 4, 1, 2, cor);
        cv.rect(17, 3, 2, 3, cor);
        cv.rect(16, 4, 1, 2, cor);
        cv.rect(18, 4, 1, 1, '#ff9ecb');
        break;
      case 'halo': {
        const y = Math.max(0, topoCabeca(boneco) - 3);
        cv.rect(8, y, 8, 1, cor);
        cv.rect(6, y + 1, 3, 1, cor);
        cv.rect(15, y + 1, 3, 1, cor);
        cv.rect(8, y + 2, 8, 1, sombra);
        cv.rect(10, y, 4, 1, brilho);
        break;
      }
      case 'coroa':
        cv.rect(7, topo + 1, 10, 2, cor);
        cv.rect(7, topo, 1, 1, cor);
        cv.rect(10, topo, 1, 1, cor);
        cv.rect(13, topo, 1, 1, cor);
        cv.rect(16, topo, 1, 1, cor);
        cv.rect(9, topo + 3, 6, 1, sombra);
        cv.set(11, topo + 1, '#ff4f8b');
        cv.set(12, topo + 1, '#4dd7ff');
        break;
    }

    cv.outline();
    return cv;
  }

  function camadaEfeito(boneco){
    const fundo = canvas();
    const frente = canvas();
    const efeito = boneco.efeito;

    if (efeito === 'brilho') {
      fundo.rect(4, 8, 1, 18, 'rgba(192,132,252,.18)');
      fundo.rect(19, 8, 1, 18, 'rgba(192,132,252,.18)');
      fundo.rect(8, 3, 8, 1, 'rgba(255,255,255,.12)');
      fundo.rect(6, 30, 12, 1, 'rgba(192,132,252,.22)');
      frente.set(4, 7, 'rgba(255,255,255,.75)');
      frente.set(21, 13, 'rgba(255,255,255,.55)');
      frente.set(3, 25, 'rgba(192,132,252,.8)');
    }

    if (efeito === 'faiscas') {
      miniEstrela(frente, 3, 5, '#7dd3fc');
      miniEstrela(frente, 21, 8, '#ff6ec7');
      miniEstrela(frente, 3, 24, '#ffd166');
      miniEstrela(frente, 20, 27, '#c084fc');
      miniEstrela(frente, 13, 2, '#ffffff');
    }

    if (efeito === 'glitch') {
      fundo.rect(0, 10, 4, 1, 'rgba(34,211,238,.5)');
      fundo.rect(20, 14, 4, 1, 'rgba(255,110,199,.5)');
      fundo.rect(0, 22, 3, 1, 'rgba(255,110,199,.45)');
      fundo.rect(21, 28, 3, 1, 'rgba(34,211,238,.45)');
      frente.rect(1, 8, 3, 1, 'rgba(34,211,238,.8)');
      frente.rect(19, 17, 4, 1, 'rgba(255,110,199,.8)');
      frente.rect(2, 30, 3, 1, 'rgba(255,255,255,.6)');
    }

    if (efeito === 'aura_roxa' || efeito === 'aura_neon') {
      const a = efeito === 'aura_roxa' ? 'rgba(192,132,252,' : 'rgba(34,211,238,';
      const b = efeito === 'aura_roxa' ? 'rgba(124,58,237,' : 'rgba(255,110,199,';
      for (let y = 7; y <= 30; y++) {
        if (y % 3 !== 0) fundo.set(2, y, a + '.28)');
        if (y % 4 !== 0) fundo.set(21, y, b + '.24)');
      }
      fundo.rect(4, 32, 16, 1, a + '.2)');
      fundo.rect(6, 4, 12, 1, b + '.18)');
      frente.set(2, 9, a + '.8)');
      frente.set(21, 20, b + '.8)');
    }

    if (efeito === 'chamas') {
      const fogo = ['#dc2626', '#f97316', '#fbbf24'];
      for (let x = 4; x <= 19; x += 2) {
        const altura = 3 + (x % 4);
        fundo.rect(x, 32 - altura, 2, altura, fogo[x % 3]);
        fundo.set(x, 32 - altura, '#fef08a');
      }
      fundo.rect(3, 32, 18, 2, '#dc2626');
      fundo.rect(5, 31, 14, 1, '#f97316');
      frente.set(7, 30, '#fbbf24');
      frente.set(16, 29, '#fef08a');
    }

    if (efeito === 'estrelas') {
      miniEstrela(frente, 4, 6, '#ffd166');
      miniEstrela(frente, 20, 10, '#7dd3fc');
      miniEstrela(frente, 6, 19, '#ff6ec7');
      miniEstrela(frente, 18, 24, '#ffffff');
      miniEstrela(frente, 11, 1, '#c084fc');
      frente.set(2, 14, '#ffd166');
      frente.set(21, 30, '#7dd3fc');
      frente.set(16, 4, '#ffffff');
    }

    if (efeito === 'confete') {
      const cores = ['#ff6ec7', '#ffd166', '#7dd3fc', '#4ade80', '#c084fc'];
      const pontos = [
        [3, 4], [6, 8], [18, 5], [21, 9], [2, 16], [5, 21],
        [20, 17], [22, 23], [4, 28], [17, 30], [19, 26], [8, 3]
      ];
      pontos.forEach(([x, y], indice) => {
        frente.set(x, y, cores[indice % cores.length]);
        frente.set(x + (indice % 2 ? 1 : 0), y + 1, cores[(indice + 2) % cores.length]);
      });
    }

    return { fundo, frente };
  }

  function camadaMoldura(boneco){
    const cv = canvas();
    const desenho = boneco.moldura;
    if (desenho === 'nenhuma') return cv;

    if (desenho === 'simples') {
      cv.rect(1, 1, 22, 1, '#8b5cf6');
      cv.rect(1, 34, 22, 1, '#8b5cf6');
      cv.rect(1, 1, 1, 34, '#8b5cf6');
      cv.rect(22, 1, 1, 34, '#8b5cf6');
      cv.rect(1, 1, 1, 1, '#c084fc');
      cv.rect(22, 1, 1, 1, '#c084fc');
      cv.rect(1, 34, 1, 1, '#c084fc');
      cv.rect(22, 34, 1, 1, '#c084fc');
    }

    if (desenho === 'roxa') {
      cv.rect(0, 2, 2, 32, '#6d28d9');
      cv.rect(22, 2, 2, 32, '#6d28d9');
      cv.rect(2, 0, 20, 2, '#7c3aed');
      cv.rect(2, 34, 20, 2, '#7c3aed');
      cv.rect(0, 2, 1, 6, '#c084fc');
      cv.rect(23, 27, 1, 7, '#c084fc');
      cv.rect(2, 0, 6, 1, '#c084fc');
      cv.rect(16, 35, 6, 1, '#c084fc');
    }

    if (desenho === 'ciano') {
      cv.rect(0, 1, 24, 1, '#22d3ee');
      cv.rect(0, 34, 24, 1, '#22d3ee');
      cv.rect(0, 1, 1, 34, '#22d3ee');
      cv.rect(23, 1, 1, 34, '#22d3ee');
      cv.rect(1, 2, 2, 1, '#a5f3fc');
      cv.rect(21, 2, 2, 1, '#a5f3fc');
      cv.rect(1, 33, 2, 1, '#a5f3fc');
      cv.rect(21, 33, 2, 1, '#a5f3fc');
    }

    if (desenho === 'dourada') {
      cv.rect(1, 1, 22, 1, '#b45309');
      cv.rect(1, 34, 22, 1, '#b45309');
      cv.rect(1, 1, 1, 34, '#b45309');
      cv.rect(22, 1, 1, 34, '#b45309');
      cv.rect(2, 2, 3, 1, '#ffd166');
      cv.rect(19, 2, 3, 1, '#ffd166');
      cv.rect(2, 33, 3, 1, '#ffd166');
      cv.rect(19, 33, 3, 1, '#ffd166');
      cv.rect(11, 0, 2, 2, '#ffd166');
      cv.rect(11, 34, 2, 2, '#ffd166');
    }

    if (desenho === 'holo') {
      const cores = ['#22d3ee', '#ff6ec7', '#ffffff', '#c084fc'];
      for (let x = 0; x < W; x++) {
        cv.set(x, 0, cores[x % cores.length]);
        cv.set(x, 35, cores[(x + 2) % cores.length]);
      }
      for (let y = 0; y < H; y++) {
        cv.set(0, y, cores[(y + 1) % cores.length]);
        cv.set(23, y, cores[(y + 3) % cores.length]);
      }
      cv.rect(2, 2, 3, 1, 'rgba(255,255,255,.85)');
      cv.rect(19, 33, 3, 1, 'rgba(255,255,255,.65)');
    }

    if (desenho === 'evento1') {
      cv.rect(0, 1, 24, 1, '#ff4fd8');
      cv.rect(0, 34, 24, 1, '#ff4fd8');
      cv.rect(0, 1, 1, 34, '#ff4fd8');
      cv.rect(23, 1, 1, 34, '#ff4fd8');
      cv.rect(3, 3, 2, 2, '#ffd166');
      cv.rect(19, 3, 2, 2, '#ffd166');
      cv.rect(3, 31, 2, 2, '#ffd166');
      cv.rect(19, 31, 2, 2, '#ffd166');
      cv.rect(10, 0, 4, 1, '#ffd166');
      cv.rect(10, 35, 4, 1, '#ffd166');
    }

    return cv;
  }

  const CACHE = new Map();

  function svgDe(cv, classe){
    const porCor = new Map();
    cv.pixels().forEach(({ x, y, cor }) => {
      const caminho = porCor.get(cor) || '';
      porCor.set(cor, caminho + 'M' + x + ' ' + y + 'h1v1h-1z');
    });
    if (!porCor.size) return '';
    const partes = [...porCor.entries()].map(([cor, caminho]) =>
      '<path fill="' + cor + '" d="' + caminho + '"/>'
    );
    return '<g' + (classe ? ' class="' + classe + '"' : '') + '>' + partes.join('') + '</g>';
  }

  function grupo(nome, boneco, dependencias, desenhar, classe){
    const chave = nome + ':' + dependencias.map(slot => boneco[slot]).join('|');
    if (CACHE.has(chave)) return CACHE.get(chave);
    const grupoSvg = svgDe(desenhar(boneco), classe);
    CACHE.set(chave, grupoSvg);
    if (CACHE.size > 240) CACHE.delete(CACHE.keys().next().value);
    return grupoSvg;
  }

  function atributo(texto){
    return String(texto == null ? '' : texto).replace(/[&<>"']/g, caractere => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[caractere]);
  }

  function renderSVG(entrada, opcoes = {}){
    const boneco = normalizar(entrada);
    const mini = opcoes.mini === true;
    const animar = opcoes.animar !== false && !mini;
    const escala = Math.max(0.25, Math.min(12, Number(opcoes.escala) || 1));
    const label = opcoes.label || 'Boneco pixel art';

    const classes = ['px-svg'];
    if (mini) classes.push('px-mini');
    if (animar) classes.push('px-anim-' + boneco.animacao);

    return '<svg xmlns="http://www.w3.org/2000/svg" class="' + classes.join(' ') + '" ' +
      'viewBox="0 0 ' + W + ' ' + H + '" width="' + Math.round(W * escala) + '" height="' + Math.round(H * escala) + '" ' +
      'role="img" aria-label="' + atributo(label) + '" shape-rendering="crispEdges" ' +
      'data-animacao="' + boneco.animacao + '" data-efeito="' + boneco.efeito + '" data-moldura="' + boneco.moldura + '">' +
      (mini ? '' : grupo('fx-fundo', boneco, ['efeito'], b => camadaEfeito(b).fundo, 'px-fx px-fx-fundo')) +
      grupo('cabelo-tras', boneco, ['cabelo', 'cabeloCor'], camadaCabeloTras, 'px-cabelo-tras') +
      grupo('corpo', boneco, ['base', 'pele', 'cabelo'], camadaCorpo, 'px-corpo') +
      grupo('roupa', boneco, ['base', 'roupa', 'roupaCor'], camadaRoupa, 'px-roupa') +
      grupo('calcado', boneco, ['base', 'calcado', 'calcadoCor', 'pele'], camadaCalcado, 'px-calcado') +
      grupo('olhos', boneco, ['rosto', 'pele'], camadaOlhos, 'px-olhos') +
      grupo('boca', boneco, ['rosto'], camadaBoca, 'px-boca') +
      grupo('cabelo', boneco, ['cabelo', 'cabeloCor'], camadaCabelo, 'px-cabelo') +
      grupo('acessorio', boneco, ['acessorio', 'acessorioCor', 'cabelo'], camadaAcessorio, 'px-acessorio') +
      (mini ? '' : grupo('fx-frente', boneco, ['efeito'], b => camadaEfeito(b).frente, 'px-fx px-fx-frente')) +
      (mini ? '' : grupo('moldura', boneco, ['moldura'], camadaMoldura, 'px-moldura')) +
      '</svg>';
  }

  function render(entrada, opcoes){
    const caixa = document.createElement('div');
    caixa.innerHTML = renderSVG(entrada, opcoes);
    return caixa.firstElementChild;
  }

  window.PixelAvatar = {
    W,
    H,
    SLOTS,
    PADRAO,
    normalizar,
    render,
    renderSVG
  };
})();
