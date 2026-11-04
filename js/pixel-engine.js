/* ============================================================
   AVATAR ENGINE 2.5D — SOSO ARCADE
   Ilustração vetorial em camadas: mantém os mesmos slots/IDs do
   catálogo do servidor para preservar inventário e avatares salvos.
   ============================================================ */
(function(){
  'use strict';

  const W = 240;
  const H = 360;
  let instance = 0;

  const SLOTS = [
    'base', 'pele', 'rosto', 'cabelo', 'cabeloCor', 'roupa', 'roupaCor',
    'calcado', 'calcadoCor', 'acessorio', 'acessorioCor', 'efeito', 'animacao', 'moldura'
  ];

  const PADRAO = {
    base: 'masc', pele: 'media', rosto: 'feliz', cabelo: 'curto', cabeloCor: 'roxo',
    roupa: 'moletom', roupaCor: 'roxo', calcado: 'tenis', calcadoCor: 'branco',
    acessorio: 'oculos', acessorioCor: 'dourado', efeito: 'nenhum',
    animacao: 'respirar', moldura: 'simples'
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
    acessorio: ['nenhum', 'oculos', 'bone', 'headset', 'orelhas', 'laco', 'oculos_sol', 'microfone', 'gatinho', 'halo', 'coroa'],
    acessorioCor: ['dourado', 'lilas', 'azul', 'rosa', 'branco'],
    efeito: ['nenhum', 'brilho', 'faiscas', 'glitch', 'aura_roxa', 'aura_neon', 'chamas', 'estrelas', 'confete'],
    animacao: ['respirar', 'acenar', 'pular', 'dancar', 'flutuar', 'meditar', 'comemorar', 'hype'],
    moldura: ['nenhuma', 'simples', 'roxa', 'ciano', 'dourada', 'holo', 'evento1']
  };

  const PALETAS = {
    pele: {
      clara: '#f5d6bd', media: '#d99a6c', bronze: '#b9784f',
      morena: '#925b3b', escura: '#633b2c', alien: '#80d7bd'
    },
    cabeloCor: {
      preto: '#30283e', roxo: '#8b5cf6', loiro: '#e9bd55', ruivo: '#b95736',
      prata: '#b9c6d8', rosa: '#e66bb7', ciano: '#38b9cf'
    },
    roupaCor: {
      roxo: '#7950c9', grafite: '#4b4c62', preto: '#343044',
      vermelho: '#bd4656', ciano: '#218eaa', dourado: '#b98735'
    },
    calcadoCor: {
      branco: '#ece9f2', preto: '#282538', vermelho: '#bd4656',
      roxo: '#6945ad', ciano: '#208ca3'
    },
    acessorioCor: {
      dourado: '#e8b956', lilas: '#bb91ef', azul: '#74c9e5',
      rosa: '#eb83bf', branco: '#f0edf6'
    }
  };

  const OUTLINE = '#332744';
  const INK = '#2a1a3a';
  const WHITE = '#fffaf6';

  function esc(text){
    return String(text == null ? '' : text).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[ch]);
  }

  function normalizar(input){
    const out = {};
    SLOTS.forEach(slot => {
      const value = input && input[slot];
      out[slot] = IDS[slot].includes(value) ? value : PADRAO[slot];
    });
    return out;
  }

  function rgb(hex){
    let value = String(hex || '').replace('#', '');
    if (value.length === 3) value = value.split('').map(ch => ch + ch).join('');
    if (!/^[\da-f]{6}$/i.test(value)) return [121, 80, 201];
    return [parseInt(value.slice(0,2),16), parseInt(value.slice(2,4),16), parseInt(value.slice(4,6),16)];
  }

  function mix(a, b, amount){
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v,i) => Math.round(v + (B[i] - v) * amount).toString(16).padStart(2,'0')).join('');
  }

  function palette(slot, id){
    return (PALETAS[slot] && PALETAS[slot][id]) || '#7950c9';
  }
  /* ============================================================
     MOTOR DE CEL-SHADING
     Cada peça = sombra de borda dura (luz vindo de cima-esquerda)
     + faixa de luz + contorno COLORIDO (nunca preto chapado).
     Técnica: a forma é recortada (clipPath) e sobreposta a ela mesma
     deslocada, o que gera crescentes de sombra/luz nítidos para
     qualquer path, sem precisar desenhar sombras à mão.
     ============================================================ */


  function tone(color, kind){
    if (kind === 'skin') return {
      base: color, light: mix(color, '#fff4ea', .36),
      shade: mix(mix(color, '#c4476f', .24), '#3a1f4d', .12),
      deep: mix(color, '#4a2236', .45), line: mix(color, '#2a1426', .74)
    };
    if (kind === 'hair') return {
      base: color, light: mix(color, '#ffffff', .32),
      shade: mix(color, '#2a1252', .40),
      deep: mix(color, '#160a2a', .55), line: mix(color, '#10081f', .80)
    };
    return {
      base: color, light: mix(color, '#ffffff', .27),
      shade: mix(color, '#2c1858', .34),
      deep: mix(color, '#190c30', .52), line: mix(color, '#140a26', .76)
    };
  }

  /* espelha um path absoluto (M L Q C Z) no eixo central x=120 */
  function mir(d){
    const tk = d.match(/[MLQCZHV]|-?\d*\.?\d+/g) || [];
    let n = 0, cmd = '';
    return tk.map(t => {
      if (/[MLQCZHV]/.test(t)) { cmd = t; n = 0; return t; }
      const v = parseFloat(t);
      if (cmd === 'V') return t;
      if (cmd === 'H') return String(+(240 - v).toFixed(2));
      return (n++ % 2 === 0) ? String(+(240 - v).toFixed(2)) : t;
    }).join(' ');
  }

  function makeCtx(n){
    const defs = [];
    let k = 0;
    const id = key => `av${n}-${key}${++k}`;
    function cel(d, color, o = {}){
      const t = o.tone || tone(color, o.kind);
      const sx = o.sh == null ? 4.2 : o.sh;
      const sy = o.shy == null ? sx * 1.2 : o.shy;
      const lx = o.lt == null ? 2.4 : o.lt;
      const a = id('c'), b = id('c');
      defs.push(`<clipPath id="${a}"><path d="${d}"/></clipPath>`);
      let inner;
      if (o.light === false) {
        inner = `<path d="${d}" fill="${t.base}" transform="translate(${-sx} ${-sy})"/>`;
      } else {
        defs.push(`<clipPath id="${b}"><path d="${d}" transform="translate(${-sx} ${-sy})"/></clipPath>`);
        inner = `<g clip-path="url(#${b})"><rect x="-30" y="-30" width="300" height="420" fill="${t.light}"/><path d="${d}" fill="${t.base}" transform="translate(${lx} ${(lx * 1.2).toFixed(2)})"/></g>`;
      }
      const sw = o.sw == null ? 3 : o.sw;
      const stroke = sw ? `<path d="${d}" fill="none" stroke="${o.line || t.line}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>` : '';
      return `<g clip-path="url(#${a})"><rect x="-30" y="-30" width="300" height="420" fill="${t.shade}"/>${inner}</g>${stroke}`;
    }
    function clip(d, inner, extra){
      const a = id('k');
      defs.push(`<clipPath id="${a}"><path d="${d}"${extra || ''}/></clipPath>`);
      return `<g clip-path="url(#${a})">${inner}</g>`;
    }
    return { defs, id, cel, clip };
  }

  const EYE_COLOR = {
    preto: '#5f7fe6', roxo: '#a45cf2', loiro: '#e39a2b', ruivo: '#d4692f',
    prata: '#5fb2dc', rosa: '#e5509f', ciano: '#25b4c9'
  };

  const HEAD = 'M72 94C70 56 92 33 120 33C148 33 170 56 168 94C167 124 149 153 120 156C91 153 73 124 72 94Z';
  const NECK = 'M107 140L106 172Q120 183 134 172L133 140Z';
  const EAR_L = 'M76 92C66 88 61 102 69 114C72 117 76 115 77 111Z';

  /* ---------------- CABELO ---------------- */
  function hairParts(b, ctx){
    const color = palette('cabeloCor', b.cabeloCor);
    const t = tone(color, 'hair');
    const shineC = mix(color, '#ffffff', .72);
    const deepC = mix(color, '#2a1252', .22);
    const H = (d, col, o) => ctx.cel(d, col || color, Object.assign({ kind: 'hair', sw: 3 }, o || {}));
    const strand = (d, op) => `<path d="${d}" fill="none" stroke="${t.deep}" stroke-width="1.7" stroke-linecap="round" opacity="${op || .5}"/>`;
    const ring = d => `<path d="${d}" fill="none" stroke="${shineC}" stroke-width="6.5" stroke-linecap="round" opacity=".78"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".85" transform="translate(1.5 -.6)"/>`;

    const capBack = 'M69 104C62 62 90 31 122 31C154 31 182 62 175 104L171 124L71 124Z';
    const frontCurto =
      'M66 110C57 60 86 24 122 23C160 22 185 58 175 110L168 128C167 112 165 98 160 86C154 90 150 84 146 76C142 86 136 88 130 74C126 84 118 88 112 72C108 82 100 86 96 74C92 84 88 94 84 104C80 108 78 118 76 128Z';
    const strCurto = strand('M122 26C104 38 97 58 101 80') + strand('M124 26C142 38 149 58 145 80') +
      strand('M97 38C85 54 83 78 85 96', .4) + strand('M150 36C164 50 169 74 167 100', .4);
    const ringCurto = ring('M86 58C93 40 112 32 138 38');

    const out = { back: '', front: '', shadowD: '' };
    switch (b.cabelo) {
      case 'careca':
        out.front = `<path d="M92 52C100 40 118 36 134 40" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".28"/>`;
        return out;
      case 'moicano': {
        const sideL = 'M73 96C69 64 83 44 101 36L108 62C95 68 89 84 87 108Z';
        const sideShade = `<path d="${sideL}" fill="${t.shade}" opacity=".5"/><path d="${mir(sideL)}" fill="${t.shade}" opacity=".5"/>`;
        const mo = 'M97 74C90 58 96 42 102 30C106 38 108 34 111 18C116 30 119 24 123 4C127 22 131 26 135 12C140 28 141 34 148 28C147 46 148 62 143 76C130 68 110 68 97 74Z';
        out.front = sideShade + H(mo) + strand('M112 24C108 40 108 56 110 70') + strand('M128 20C131 38 130 56 128 70') + ring('M107 52C109 38 114 28 119 20');
        return out;
      }
      case 'espetado': {
        const f = 'M70 106C60 72 68 54 74 42L88 54L88 26L105 44L117 12L129 42L147 16L149 46L167 32L167 58C178 72 178 92 172 108L168 128C166 112 163 100 157 92L150 100L145 84L136 98L127 82L118 98L108 82L99 96L92 86L86 100C80 106 78 118 76 128Z';
        out.back = H(capBack, mix(color, '#2a1252', .22), { sw: 3 });
        out.front = H(f) + strand('M117 18C112 38 112 58 116 80') + strand('M147 22C146 40 150 60 147 82') + strand('M88 32C86 50 88 70 90 90', .4) + ring('M92 56C98 40 114 34 134 40');
        out.shadowD = f;
        return out;
      }
      default: break;
    }
    out.back = H(capBack, deepC, { sw: 3, light: false });
    out.front = H(frontCurto) + strCurto + ringCurto;
    out.shadowD = frontCurto;

    if (b.cabelo === 'longo') {
      out.back = H('M70 96C57 138 54 182 64 204Q80 214 93 192L101 142L139 142L147 192Q160 214 176 204C186 182 183 138 170 96Z', deepC, { sw: 3 }) +
        strand('M72 130C68 160 70 182 74 198', .4) + strand('M168 130C172 160 170 182 166 198', .4);
      const lock = 'M72 98C65 132 67 164 78 188C89 172 93 142 90 112L82 98Z';
      out.front = H(lock) + H(mir(lock)) + out.front +
        `<path d="M76 130C72 148 73 162 77 172" fill="none" stroke="${shineC}" stroke-width="3.6" stroke-linecap="round" opacity=".7"/>`;
    } else if (b.cabelo === 'rabo') {
      const pony = 'M158 62C192 54 208 86 200 120C197 142 206 162 192 188C180 180 175 162 178 142C168 130 160 104 156 92Z';
      out.back = H(pony) + strand('M176 80C190 96 192 124 186 150', .45) +
        H('M152 66C158 60 168 62 170 70C168 78 158 80 152 76Z', mix(palette('acessorioCor', b.acessorioCor), '#ffffff', 0), { kind: 'acc', sw: 2.4 });
      out.back = H(capBack, deepC, { sw: 3, light: false }) + out.back;
    } else if (b.cabelo === 'coques') {
      const bun = (cx) => H(`M${cx - 19} 52C${cx - 19} 34 ${cx - 6} 30 ${cx} 30C${cx + 6} 30 ${cx + 19} 34 ${cx + 19} 52C${cx + 19} 70 ${cx + 6} 74 ${cx} 74C${cx - 6} 74 ${cx - 19} 70 ${cx - 19} 52Z`) +
        `<path d="M${cx - 10} 44C${cx - 2} 38 ${cx + 8} 42 ${cx + 10} 52" fill="none" stroke="${t.deep}" stroke-width="1.7" stroke-linecap="round" opacity=".5"/>` +
        `<path d="M${cx - 12} 40C${cx - 6} 33 ${cx + 2} 32 ${cx + 8} 35" fill="none" stroke="${shineC}" stroke-width="4.5" stroke-linecap="round" opacity=".8"/>`;
      out.back = bun(66) + bun(174) + out.back;
    }
    return out;
  }

  /* ---------------- ROSTO ---------------- */
  function eyeOpen(ctx, cx, cy, o, iris, opt){
    opt = opt || {};
    const rx = 11.2, ry = 13.6;
    const ig = ctx.id('ig');
    const deep = mix(iris, '#140a2a', .62), light = mix(iris, '#ffffff', .5);
    ctx.defs.push(`<linearGradient id="${ig}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${deep}"/><stop offset=".5" stop-color="${iris}"/><stop offset="1" stop-color="${light}"/></linearGradient>`);
    const eyeD = `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    let inner = `<rect x="${cx - 14}" y="${cy - 16}" width="28" height="32" fill="#fffaf8"/>` +
      `<ellipse cx="${cx}" cy="${cy + 1}" rx="9.2" ry="12.6" fill="url(#${ig})"/>` +
      `<ellipse cx="${cx}" cy="${cy + 2}" rx="4.6" ry="6.6" fill="${deep}"/>`;
    if (opt.star) {
      const pts = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.4 : 8; pts.push((cx + Math.cos(a) * r).toFixed(1) + ' ' + (cy + 2 + Math.sin(a) * r).toFixed(1)); }
      inner += `<polygon points="${pts.join(' ')}" fill="#fff3b8" stroke="#c9791f" stroke-width="1"/>`;
    }
    if (opt.neon) {
      inner += `<ellipse cx="${cx}" cy="${cy + 1}" rx="7" ry="10" fill="none" stroke="#d9ffff" stroke-width="1.4" opacity=".9"/>` +
        `<path d="M${cx - 9} ${cy - 3}H${cx + 9}M${cx - 9} ${cy + 3}H${cx + 9}M${cx - 8} ${cy + 9}H${cx + 8}" stroke="#d9ffff" stroke-width=".8" opacity=".45"/>`;
    }
    inner += `<ellipse cx="${cx}" cy="${cy - 13}" rx="13" ry="6.6" fill="#1a0f2e" opacity=".34"/>` +
      `<ellipse cx="${cx - 3.2}" cy="${cy - 4.6}" rx="3.9" ry="4.6" fill="#fff"/>` +
      `<circle cx="${cx + 3.6}" cy="${cy + 6.2}" r="1.9" fill="#fff" opacity=".95"/>` +
      `<path d="M${cx - 6} ${cy + 10}Q${cx} ${cy + 13.4} ${cx + 6} ${cy + 10}" fill="none" stroke="#fff" stroke-width="1.2" opacity=".4"/>`;
    let lidLine = '';
    if (opt.lid != null) {
      const yR = cy + opt.lid + (o === -1 ? 2 : -2), yL = cy + opt.lid + (o === -1 ? -2 : 2);
      inner += `<path d="M${cx - 14} ${cy - 17}H${cx + 14}V${yR}L${cx - 14} ${yL}Z" fill="${opt.skin}"/>`;
      lidLine = `<path d="M${cx - 12} ${yL}L${cx + 12} ${yR}" stroke="${INK}" stroke-width="3.2" stroke-linecap="round"/>`;
    }
    const glow = opt.neon ? `<ellipse cx="${cx}" cy="${cy}" rx="14" ry="17" fill="#4bf0ff" opacity=".4" filter="url(#${opt.blur})"/>` : '';
    const lashW = opt.fem ? 4 : 3.4;
    const L = (x, y) => (cx + o * x).toFixed(1) + ' ' + (cy + y).toFixed(1);
    const lash = `<path d="M${L(12, -4)}Q${L(8, -15)} ${L(-2, -15)}Q${L(-10, -14.4)} ${L(-12.4, -5)}" fill="none" stroke="${INK}" stroke-width="${lashW}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M${L(12, -4)}L${L(16, -7.5)}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>` +
      (opt.fem ? `<path d="M${L(10, -9)}L${L(14.6, -12)}M${L(5.5, -12.6)}L${L(8.5, -16.6)}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` : '');
    return `<g transform="translate(${cx} ${cy}) scale(1.13) translate(${-cx} ${-cy})">${glow}${ctx.clip(eyeD, inner)}${lidLine}${opt.lid != null ? '' : lash}</g>`;
  }

  function eyeClosed(cx, cy, o, shape, fem){
    const L = (x, y) => (cx + o * x).toFixed(1) + ' ' + (cy + y).toFixed(1);
    const w = fem ? 4 : 3.6;
    const wrap = x => `<g transform="translate(${cx} ${cy}) scale(1.13) translate(${-cx} ${-cy})">${x}</g>`;
    if (shape === 'up') return wrap(`<path d="M${L(-10, 4)}Q${cx} ${cy - 9} ${L(10, 4)}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/><path d="M${L(10, 4)}L${L(13.5, 1)}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`);
    return wrap(`<path d="M${L(-10, -1)}Q${cx} ${cy + 8} ${L(10, -1)}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round"/><path d="M${L(10, -1)}L${L(13.5, 2)}" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`);
  }

  function faceParts(b, ctx, skinT, hairColor){
    const mood = b.rosto, fem = b.base === 'fem';
    const iris = mood === 'estrela' ? '#f2b53c' : mood === 'neon' ? '#33dcef' : (EYE_COLOR[b.cabeloCor] || '#7a5cf0');
    const blur = ctx.id('bl');
    if (mood === 'neon') ctx.defs.push(`<filter id="${blur}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3.4"/></filter>`);
    const brow = mix(hairColor, '#1d1030', .45);
    const browP = (d, w) => `<path d="${d}" fill="none" stroke="${brow}" stroke-width="${w || 2.8}" stroke-linecap="round"/>`;
    const lx = 98, rx = 142, cy = 108;
    const O = { fem, blur, skin: skinT.base };
    let eyes = '', brows = '', mouth = '', extra = '';

    if (mood === 'serio') {
      eyes = eyeOpen(ctx, lx, cy, -1, iris, Object.assign({ lid: -2 }, O)) + eyeOpen(ctx, rx, cy, 1, iris, Object.assign({ lid: -2 }, O));
      brows = browP(`M${lx - 10} ${cy - 20}L${lx + 9} ${cy - 14}`) + browP(`M${rx - 9} ${cy - 14}L${rx + 10} ${cy - 20}`);
      mouth = `<path d="M113 137Q120 135 127 137" fill="none" stroke="#8c3d57" stroke-width="3" stroke-linecap="round"/>`;
    } else if (mood === 'piscada') {
      eyes = eyeOpen(ctx, lx, cy, -1, iris, O) + eyeClosed(rx, cy + 2, 1, 'up', fem);
      brows = browP(`M${lx - 9} ${cy - 18}Q${lx} ${cy - 23} ${lx + 9} ${cy - 19}`) + browP(`M${rx - 9} ${cy - 17}Q${rx} ${cy - 20} ${rx + 9} ${cy - 17}`);
      extra = `<path d="M160 90L162 96L168 98L162 100L160 106L158 100L152 98L158 96Z" fill="#fff" opacity=".95"/>`;
      mouth = `<path d="M110 133Q120 143 130 133" fill="none" stroke="#8c3d57" stroke-width="3" stroke-linecap="round"/><path d="M119 139Q122 149 127 139Z" fill="#f58fa4" stroke="#9c3d58" stroke-width="1.6" stroke-linejoin="round"/>`;
    } else if (mood === 'sono') {
      eyes = eyeClosed(lx, cy + 1, -1, 'down', fem) + eyeClosed(rx, cy + 1, 1, 'down', fem);
      brows = browP(`M${lx - 9} ${cy - 15}Q${lx} ${cy - 18} ${lx + 9} ${cy - 15}`, 2.4) + browP(`M${rx - 9} ${cy - 15}Q${rx} ${cy - 18} ${rx + 9} ${cy - 15}`, 2.4);
      mouth = `<ellipse cx="120" cy="136" rx="3.6" ry="4.4" fill="#8a3350" stroke="#5e2038" stroke-width="1.6"/>`;
      extra = `<circle cx="133" cy="129" r="5" fill="#d8f2ff" fill-opacity=".55" stroke="#9ed6f2" stroke-width="1.4"/><path d="M170 62h9l-9 10h9M182 48h6l-6 7h6" fill="none" stroke="#e9dcff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else {
      const op = { star: mood === 'estrela', neon: mood === 'neon' };
      eyes = eyeOpen(ctx, lx, cy, -1, iris, Object.assign(op, O)) + eyeOpen(ctx, rx, cy, 1, iris, Object.assign({}, op, O));
      brows = browP(`M${lx - 9} ${cy - 18}Q${lx} ${cy - 23} ${lx + 9} ${cy - 19}`) + browP(`M${rx - 9} ${cy - 19}Q${rx} ${cy - 23} ${rx + 9} ${cy - 18}`);
      if (mood === 'neon') {
        mouth = `<path d="M111 134Q120 143 129 134" fill="none" stroke="#4bf0ff" stroke-width="3.2" stroke-linecap="round"/><path d="M111 134Q120 143 129 134" fill="none" stroke="#4bf0ff" stroke-width="7" stroke-linecap="round" opacity=".25"/>`;
      } else {
        const m = 'M109 131Q120 149 131 131Q120 136 109 131Z';
        mouth = ctx.clip(m, `<rect x="100" y="125" width="40" height="30" fill="#7a2a46"/><ellipse cx="120" cy="143" rx="6" ry="4.4" fill="#f58fa4"/><path d="M109 131Q120 136 131 131L131 128L109 128Z" fill="#fffaf6"/>`) +
          `<path d="${m}" fill="none" stroke="#5e2038" stroke-width="2.2" stroke-linejoin="round"/>`;
      }
    }

    const blushC = mood === 'neon' ? '#7be9f5' : '#ff7fa0';
    const blush = (cx) => `<ellipse cx="${cx}" cy="127" rx="9.4" ry="5" fill="${blushC}" opacity=".42"/>` +
      `<path d="M${cx - 5} 124.4l-2.4 5M${cx} 124l-2.4 5.4M${cx + 5} 124.4l-2.4 5" stroke="${blushC}" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>`;
    const nose = `<path d="M120 120Q118.4 124.4 122 125" fill="none" stroke="${skinT.deep}" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`;
    return { eyes, rest: blush(86) + blush(154) + nose + brows + mouth + extra };
  }

  /* ---------------- ROUPAS ---------------- */
  function clothing(b, ctx){
    const c = palette('roupaCor', b.roupaCor);
    const t = tone(c);
    const accent = mix(c, '#ffffff', .52);
    const dark = mix(c, '#1b1030', .42);
    const C = (d, col, o) => ctx.cel(d, col || c, o || {});
    const fold = (d, op) => `<path d="${d}" fill="none" stroke="${t.deep}" stroke-width="2.2" stroke-linecap="round" opacity="${op || .38}"/>`;
    const body = 'M88 164Q101 155 120 155Q139 155 152 164L169 184L161 257Q120 271 79 257L71 184Z';
    const slvL = 'M88 167Q74 171 68 185L56 235Q56 249 69 252Q81 254 86 240L100 195Z';
    const slvS = 'M88 167Q74 171 68 185L60 214Q76 223 94 209L100 195Z';
    const both = d => C(d) + C(mir(d));
    const hem = C('M77 246Q120 259 163 246L161 259Q120 272 79 259Z', dark, { sw: 2.4, sh: 2.5 });
    const cuffsW = C('M57 230Q55 248 69 252Q81 254 86 240L83 231Q71 238 57 230Z', '#ffffff', { sw: 2.4, sh: 2 }) + C(mir('M57 230Q55 248 69 252Q81 254 86 240L83 231Q71 238 57 230Z'), '#ffffff', { sw: 2.4, sh: 2 });
    const cuffs = C('M57 230Q55 248 69 252Q81 254 86 240L83 231Q71 238 57 230Z', dark, { sw: 2.4, sh: 2 }) + C(mir('M57 230Q55 248 69 252Q81 254 86 240L83 231Q71 238 57 230Z'), dark, { sw: 2.4, sh: 2 });

    if (b.roupa === 'camiseta') {
      return both(slvS) + C(body) +
        C('M104 160Q120 180 136 160L132 158Q120 170 108 158Z', dark, { sw: 2.4, sh: 2 }) +
        `<path d="M120 192L125 201L134 203L127 209L128 218L120 213L112 218L113 209L106 203L115 201Z" fill="${accent}" stroke="${t.line}" stroke-width="1.6" stroke-linejoin="round"/>` +
        fold('M96 214Q104 226 100 244') + fold('M144 214Q136 226 140 244') +
        C('M60 212Q76 221 94 209L92 203Q76 214 62 205Z', dark, { sw: 2, sh: 1.4, light: false }) + C(mir('M60 212Q76 221 94 209L92 203Q76 214 62 205Z'), dark, { sw: 2, sh: 1.4, light: false }) +
        hem;
    }
    if (b.roupa === 'social') {
      const white = mix(c, '#ffffff', .8);
      return C(slvL, white) + C(mir(slvL), white) + C(body, white) + cuffsW +
        C('M100 158L120 184L140 158L134 198L120 206L106 198Z', '#ffffff', { sw: 2.4, sh: 3 }) +
        C('M116 183L124 183L128 213L120 223L112 213Z', mix(c, '#1b1030', .12), { sw: 1.8, sh: 2.4 }) +
        `<path d="M112 190L128 194M112 199L128 203" stroke="${accent}" stroke-width="1.6" opacity=".7"/>` +
        `<circle cx="120" cy="238" r="2.6" fill="${accent}" stroke="${t.line}" stroke-width="1"/><circle cx="120" cy="226" r="2.6" fill="${accent}" stroke="${t.line}" stroke-width="1"/>` +
        fold('M92 216Q100 230 96 246', .25) + fold('M148 216Q140 230 144 246', .25);
    }
    if (b.roupa === 'vestido') {
      const dress = 'M91 164Q105 155 120 155Q135 155 149 164L159 208Q171 230 178 265Q120 287 62 265Q69 230 81 208Z';
      return C(dress) +
        C('M103 158Q120 182 137 158L132 156Q120 172 108 156Z', dark, { sw: 2.2, sh: 2 }) +
        C('M85 214Q120 230 155 214L158 226Q120 244 82 226Z', accent, { sw: 2.2, sh: 2.4 }) +
        `<path d="M70 262Q120 282 170 262" fill="none" stroke="${accent}" stroke-width="3.4" stroke-linecap="round" opacity=".7"/>` +
        C('M120 186L126 194L120 202L114 194Z', accent, { sw: 1.8, sh: 1.4 }) +
        fold('M100 232Q96 250 90 266') + fold('M140 232Q144 250 150 266') + fold('M120 236L120 270', .25);
    }
    if (b.roupa === 'jaqueta') {
      const inner = '#2a2840';
      return C('M91 164Q120 154 149 164L165 249Q120 265 75 249Z', inner, { sw: 3 }) +
        C(slvL) + C(mir(slvL)) +
        C('M91 166L105 171L116 254L91 250Z') + C(mir('M91 166L105 171L116 254L91 250Z')) +
        C('M95 160L108 176L100 174Z M145 160L132 176L140 174Z', accent, { sw: 2, sh: 1.2 }) +
        `<path d="M120 176L120 252" stroke="${accent}" stroke-width="2.6" stroke-linecap="round"/><path d="M118 176h4v6h-4z" fill="#fff" stroke="${t.line}" stroke-width="1"/>` +
        `<path d="M82 207L97 211M158 207L143 211" stroke="${accent}" stroke-width="3.4" stroke-linecap="round"/>` +
        C('M57 230Q55 248 69 252Q81 254 86 240L83 231Q71 238 57 230Z', inner, { sw: 2.4, sh: 2 }) + C(mir('M57 230Q55 248 69 252Q81 254 86 240L83 231Q71 238 57 230Z'), inner, { sw: 2.4, sh: 2 }) +
        fold('M99 216Q96 232 102 246') + fold('M141 216Q144 232 138 246');
    }
    if (b.roupa === 'armadura') {
      const metal = c;
      return C('M92 164Q120 151 148 164L167 250Q120 269 73 250Z', mix(c, '#2a2840', .45), { sw: 3.4 }) +
        C('M88 171L69 178L58 203L82 212L101 188Z', metal, { sw: 3 }) + C(mir('M88 171L69 178L58 203L82 212L101 188Z'), metal, { sw: 3 }) +
        C('M120 178L143 195L135 235L120 248L105 235L97 195Z', dark, { sw: 2.6 }) +
        `<path d="M120 190L132 202L120 219L108 202Z" fill="#6be0ef" stroke="#e6fbff" stroke-width="2"/><path d="M120 190L132 202L120 219L108 202Z" fill="#6be0ef" opacity=".5" filter="url(#${ctx.glow})"/>` +
        `<path d="M114 198L119 195" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".9"/>` +
        C('M85 226L105 236L101 244L82 236Z', accent, { sw: 2, sh: 1.6 }) + C(mir('M85 226L105 236L101 244L82 236Z'), accent, { sw: 2, sh: 1.6 }) +
        `<path d="M94 251L146 251" stroke="${accent}" stroke-width="3" opacity=".6"/>`;
    }
    /* moletom */
    return both(slvL) + C(body) +
      C('M99 163Q120 196 141 163L136 186Q120 200 104 186Z', dark, { sw: 2.4, sh: 2.4 }) +
      `<path d="M107 188L103 206M133 188L137 206" stroke="#f6e6ff" stroke-width="2.6" stroke-linecap="round"/><circle cx="103" cy="207" r="2" fill="#f6e6ff"/><circle cx="137" cy="207" r="2" fill="#f6e6ff"/>` +
      C('M91 222Q120 212 149 222L146 246Q120 254 94 246Z', mix(c, '#1b1030', .16), { sw: 2.4, sh: 2.6 }) +
      `<path d="M97 226Q120 219 143 226" fill="none" stroke="${accent}" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>` +
      cuffs + hem + fold('M96 190Q86 210 92 224') + fold('M144 190Q154 210 148 224') + fold('M70 205Q64 222 66 232', .3) + fold('M170 205Q176 222 174 232', .3);
  }

  /* ---------------- ACESSÓRIOS ---------------- */
  function accessory(b, ctx){
    const c = palette('acessorioCor', b.acessorioCor);
    const t = tone(c);
    const dark = t.line;
    const A = (d, col, o) => ctx.cel(d, col || c, Object.assign({ sw: 2.8 }, o || {}));
    switch (b.acessorio) {
      case 'oculos': {
        const l = 'M84 99Q84 91 94 91H106Q116 91 116 99V110Q116 121 106 121H94Q84 121 84 110Z';
        const lens = d => `<path d="${d}" fill="#dff4ff" fill-opacity=".10"/>`;
        return `<g class="px-glasses">${lens(l)}${lens(mir(l))}` +
          `<path d="M90 96L100 93M92 104L106 98" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6"/><path d="${mir('M90 96L100 93M92 104L106 98')}" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>` +
          `<path d="${l}" fill="none" stroke="${c}" stroke-width="2.6"/><path d="${mir(l)}" fill="none" stroke="${c}" stroke-width="2.6"/>` +
          `<path d="${l}" fill="none" stroke="${dark}" stroke-width="1.2" opacity=".7"/><path d="${mir(l)}" fill="none" stroke="${dark}" stroke-width="1.2" opacity=".7"/>` +
          `<path d="M117 99Q120 95 123 99" fill="none" stroke="${c}" stroke-width="3"/><path d="M83 100L74 96M157 100L166 96" stroke="${c}" stroke-width="3" stroke-linecap="round"/></g>`;
      }
      case 'oculos_sol': {
        const l = 'M82 95Q82 90 90 90H108Q117 90 117 97V108Q117 120 106 120H93Q82 120 82 108Z';
        const lens = d => `<path d="${d}" fill="#222a44" stroke="${dark}" stroke-width="3.4" stroke-linejoin="round"/>`;
        return `<g>${lens(l)}${lens(mir(l))}<path d="M117 98L123 98" stroke="${dark}" stroke-width="3.4"/>` +
          `<path d="M89 97L101 94M91 104L99 101" stroke="#8de9f5" stroke-width="2.6" stroke-linecap="round" opacity=".85"/><path d="${mir('M89 97L101 94M91 104L99 101')}" stroke="#8de9f5" stroke-width="2.6" stroke-linecap="round" opacity=".85"/>` +
          `<path d="M82 98L74 96M158 98L166 96" stroke="${dark}" stroke-width="3" stroke-linecap="round"/></g>`;
      }
      case 'bone':
        return A('M67 84C64 40 92 24 120 24C148 24 176 40 173 84Q120 70 67 84Z') +
          `<path d="M104 28Q110 50 108 74M136 28Q130 50 132 74" fill="none" stroke="${t.deep}" stroke-width="1.8" opacity=".4"/>` +
          `<circle cx="120" cy="25" r="4" fill="${t.light}" stroke="${dark}" stroke-width="2"/>` +
          A('M118 78Q150 68 182 84Q176 100 148 99L118 91Z', mix(c, '#1b1030', .22), { sw: 2.8 }) +
          `<path d="M92 50Q100 40 114 37" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>`;
      case 'headset': {
        const pad = 'M58 88Q58 82 66 82H72Q79 82 79 90V120Q79 128 72 128H66Q58 128 58 120Z';
        return `<path d="M68 104V82Q68 28 120 28Q172 28 172 82V104" fill="none" stroke="${dark}" stroke-width="12.5" stroke-linecap="round"/>` +
          `<path d="M68 104V82Q68 28 120 28Q172 28 172 82V104" fill="none" stroke="${mix(c, '#2a2840', .5)}" stroke-width="8.5" stroke-linecap="round"/>` +
          `<path d="M76 70Q82 40 112 33" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".45"/>` +
          A(pad) + A(mir(pad)) +
          `<path d="M63 92V116M177 92V116" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>` +
          `<path d="M172 124Q178 138 156 142" fill="none" stroke="${dark}" stroke-width="5.4" stroke-linecap="round"/><path d="M172 124Q178 138 156 142" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>` +
          `<ellipse cx="154" cy="142" rx="5.6" ry="4" fill="${c}" stroke="${dark}" stroke-width="2.2"/>`;
      }
      case 'orelhas': {
        const ear = 'M76 70C66 50 66 30 72 14C88 20 102 34 110 54Z';
        const inn = 'M80 58C75 46 75 34 78 26C87 31 95 39 100 50Z';
        return A(ear) + A(mir(ear)) +
          `<path d="${inn}" fill="#f7a9d0" stroke="${dark}" stroke-width="1.6" stroke-linejoin="round"/><path d="${mir(inn)}" fill="#f7a9d0" stroke="${dark}" stroke-width="1.6" stroke-linejoin="round"/>`;
      }
      case 'laco': {
        const loop = 'M146 70C132 46 114 52 114 68C114 80 132 84 146 74Z';
        const loopR = 'M146 70C160 46 178 52 178 68C178 80 160 84 146 74Z';
        return A(loop) + A(loopR) +
          `<circle cx="146" cy="72" r="7" fill="${t.light}" stroke="${dark}" stroke-width="2.4"/>`;
      }
      case 'microfone':
        return `<g class="px-mic" transform="rotate(24 180 220)">` +
          A('M175 214H185L187 246Q180 250 173 246Z', '#3a3550', { sw: 2.8, sh: 2.4 }) +
          `<circle cx="180" cy="204" r="12.5" fill="#222030" stroke="${dark}" stroke-width="3"/>` +
          A('M168 204A12 12 0 0 1 192 204A12 12 0 0 1 168 204Z', c, { sw: 3, sh: 3.6 }) +
          `<path d="M170 200Q180 195 190 200M169.5 205Q180 201 190.5 205M171 210Q180 207 189 210" fill="none" stroke="${dark}" stroke-width="1.2" opacity=".55"/>` +
          `<path d="M174 198Q177 194 182 193" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>` +
          `<rect x="174" y="213" width="12" height="4" rx="1.5" fill="${t.light}" stroke="${dark}" stroke-width="1.6"/></g>`;
      case 'gatinho':
        return `<g class="px-pet">` + A('M177 269Q174 247 189 241Q206 243 208 262L205 285L178 285Z', '#ece6f2', { sw: 2.8 }) +
          A('M179 251L178 237L190 246ZM197 246L208 237L206 253Z', '#ece6f2', { sw: 2.4, sh: 1.5 }) +
          `<circle cx="187" cy="261" r="2.8" fill="${INK}"/><circle cx="198" cy="261" r="2.8" fill="${INK}"/><circle cx="188" cy="260" r="1" fill="#fff"/><circle cx="199" cy="260" r="1" fill="#fff"/>` +
          `<path d="M191 267L193.5 269.4L196 267" fill="none" stroke="#c46d88" stroke-width="2.2" stroke-linecap="round"/></g>`;
      case 'halo':
        return `<ellipse cx="120" cy="18" rx="35" ry="9" fill="none" stroke="${c}" stroke-opacity=".3" stroke-width="12" filter="url(#${ctx.glow})"/>` +
          `<ellipse cx="120" cy="18" rx="35" ry="9" fill="none" stroke="${dark}" stroke-width="8"/><ellipse cx="120" cy="18" rx="35" ry="9" fill="none" stroke="${c}" stroke-width="5.4"/><ellipse cx="120" cy="18" rx="35" ry="9" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="1.8" transform="translate(0 -1)"/>`;
      case 'coroa':
        return A('M83 56L87 24L108 42L120 15L133 42L153 24L157 58Z') +
          A('M88 58H152L149 70H91Z', mix(c, '#1b1030', .25), { sw: 2.6, sh: 2.4 }) +
          `<circle cx="120" cy="45" r="5" fill="#f8f2ff" stroke="${dark}" stroke-width="2"/><circle cx="98" cy="64" r="2.6" fill="#7be9f5"/><circle cx="142" cy="64" r="2.6" fill="#ff8fc8"/><circle cx="120" cy="64" r="2.6" fill="#f8f2ff"/>`;
      default: return '';
    }
  }

  function effect(b, id){
    id = id || b.efeito;
    if (!id || id === 'nenhum') return '';
    if (id === 'brilho' || id === 'aura_roxa' || id === 'aura_neon') {
      const c = id === 'aura_neon' ? '#62dff2' : '#b78aff';
      return `<ellipse class="px-aura" cx="120" cy="190" rx="91" ry="148" fill="${c}" opacity=".08"/><ellipse cx="120" cy="190" rx="83" ry="140" fill="none" stroke="${c}" stroke-opacity=".34" stroke-width="2" stroke-dasharray="5 11"/>`;
    }
    const points = [[35,115],[202,124],[40,226],[195,235],[58,48],[183,54],[45,302],[195,300]];
    const colors = id === 'glitch' ? ['#67e8f9','#f472b6','#c4b5fd'] : ['#f9d78c','#d9b9ff','#8de4ee'];
    return `<g class="px-particles">${points.map((p,i) => `<path d="M${p[0]} ${p[1]-6}L${p[0]+2} ${p[1]-2}L${p[0]+7} ${p[1]}L${p[0]+2} ${p[1]+2}L${p[0]} ${p[1]+7}L${p[0]-2} ${p[1]+2}L${p[0]-7} ${p[1]}L${p[0]-2} ${p[1]-2}Z" fill="${colors[i%colors.length]}" opacity=".85"/>`).join('')}</g>`;
  }

  function frame(b){
    if (b.moldura === 'nenhuma' || b.moldura === 'simples') return '';
    const c = b.moldura === 'ciano' ? '#59d9eb' : b.moldura === 'dourada' ? '#e9bd62' : b.moldura === 'evento1' ? '#f28acb' : '#a879f2';
    return `<rect class="px-frame" x="8" y="8" width="224" height="344" rx="28" fill="none" stroke="${c}" stroke-opacity=".52" stroke-width="2" stroke-dasharray="8 12"/>`;
  }

  /* ---------------- MONTAGEM ---------------- */
  function renderSVG(input, options = {}){
    const b = normalizar(input);
    const mini = options.mini === true;
    const animate = options.animar !== false && !mini;
    const n = ++instance;
    const ctx = makeCtx(n);
    ctx.glow = ctx.id('gl');
    const id = key => `av${n}-${key}`;

    const skinColor = palette('pele', b.pele);
    const hairColor = palette('cabeloCor', b.cabeloCor);
    const shoeColor = palette('calcadoCor', b.calcadoCor);
    const skinT = tone(skinColor, 'skin');
    const S = (d, o) => ctx.cel(d, skinColor, Object.assign({ kind: 'skin', sw: 3 }, o || {}));

    const hair = hairParts(b, ctx);
    const face = faceParts(b, ctx, skinT, hairColor);
    const clothesSvg = clothing(b, ctx);
    const accessorySvg = accessory(b, ctx);
    const effectsSvg = mini ? '' : effect(b);
    const framesSvg = mini ? '' : frame(b);

    /* ---- corpo ---- */
    const armL = 'M84 171Q68 179 66 199L57 236Q54 251 68 255Q81 258 87 242L101 197Z';
    const handL = 'M62 243C57 252 60 262 70 262C80 262 87 254 87 244C82 238 70 236 62 243Z';
    const hands = S(handL, { sw: 2.6, sh: 2.6 }) + S(mir(handL), { sw: 2.6, sh: 2.6 }) +
      `<path d="M66 255L69 259M72 256L74 260" stroke="${skinT.deep}" stroke-width="1.2" stroke-linecap="round" opacity=".6"/><path d="${mir('M66 255L69 259M72 256L74 260')}" stroke="${skinT.deep}" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>`;
    const bodyTransform = b.base === 'fem' ? 'translate(120 0) scale(.93 1) translate(-120 0)' : '';
    const neckShadow = `<ellipse cx="120" cy="148" rx="19" ry="13" fill="${skinT.deep}" opacity=".55"/>`;
    const bodySvg = `
      <g class="px-body px-breath" transform="${bodyTransform}">
        ${S(NECK, { sw: 2.8 })}
        ${ctx.clip(NECK, neckShadow)}
        ${S(armL)}${S(mir(armL))}
        ${clothesSvg}
        ${hands}
      </g>`;

    /* ---- pernas e calçados ---- */
    const pantsC = '#3a3a55';
    const legL = 'M84 250Q101 258 117 256L115 316Q111 326 96 326Q83 325 83 315Z';
    const legsSvg = `<g class="px-legs">${ctx.cel(legL, pantsC, { sw: 3 })}${ctx.cel(mir(legL), pantsC, { sw: 3 })}
        <path d="M100 268L98 308" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".12"/><path d="M143 268L145 308" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".12"/></g>`;

    const sole = '#fff8f2';
    const SH = (d, col, o) => ctx.cel(d, col, Object.assign({ sw: 2.8, sh: 3 }, o || {}));
    let shoesSvg = '';
    if (b.calcado === 'chinelo') {
      const foot = 'M88 311Q98 316 111 312L114 332Q110 341 95 341Q81 340 80 330Z';
      shoesSvg = `<g class="px-shoes">${S(foot, { sw: 2.8 })}${S(mir(foot), { sw: 2.8 })}
        <path d="M78 332Q95 337 114 332M126 332Q145 337 164 332" fill="none" stroke="${mix(shoeColor,'#1b1030',.35)}" stroke-width="9" stroke-linecap="round"/>
        <path d="M78 332Q95 337 114 332M126 332Q145 337 164 332" fill="none" stroke="${shoeColor}" stroke-width="6" stroke-linecap="round"/>
        <path d="M91 315L98 331L105 316M137 316L144 331L151 315" fill="none" stroke="${mix(shoeColor,'#1b1030',.35)}" stroke-width="3.6" stroke-linecap="round"/>
        <path d="M91 315L98 331L105 316M137 316L144 331L151 315" fill="none" stroke="${shoeColor}" stroke-width="1.8" stroke-linecap="round"/></g>`;
    } else if (b.calcado === 'botas' || b.calcado === 'botas_cyber') {
      const bt = 'M84 292Q100 297 115 292L117 328Q113 342 95 342H76Q70 337 75 326Z';
      shoesSvg = `<g class="px-shoes">${SH(bt, shoeColor)}${SH(mir(bt), shoeColor)}
        <path d="M84 302H112M128 302H156" stroke="${mix(shoeColor,'#ffffff',.5)}" stroke-width="4" stroke-linecap="round"/>
        ${SH('M74 331Q96 336 116 330L117 336Q113 343 95 343H76Q70 339 74 331Z', sole, { sh: 1.6 })}${SH(mir('M74 331Q96 336 116 330L117 336Q113 343 95 343H76Q70 339 74 331Z'), sole, { sh: 1.6 })}</g>`;
    } else {
      const sn = 'M84 311Q96 316 114 311L116 331Q113 342 94 342H76Q70 338 75 329Z';
      shoesSvg = `<g class="px-shoes">${SH(sn, shoeColor)}${SH(mir(sn), shoeColor)}
        ${SH('M75 332Q96 337 116 331L116 335Q113 343 94 343H76Q70 339 75 332Z', sole, { sh: 1.6 })}${SH(mir('M75 332Q96 337 116 331L116 335Q113 343 94 343H76Q70 339 75 332Z'), sole, { sh: 1.6 })}
        <path d="M90 319L106 319M96 324L109 323M134 319L150 319M131 323L144 324" stroke="${mix(shoeColor,'#ffffff',.55)}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M80 325Q76 331 82 335" fill="none" stroke="${mix(shoeColor,'#1b1030',.3)}" stroke-width="2" opacity=".5"/></g>`;
    }
    const shoesExtra = (b.calcado === 'tenis_neon' || b.calcado === 'botas_cyber')
      ? `<path d="M76 335Q96 340 115 334M125 334Q145 340 165 335" fill="none" stroke="#55ddec" stroke-width="3" stroke-linecap="round" filter="url(#${ctx.glow})"/><path d="M76 335Q96 340 115 334M125 334Q145 340 165 335" fill="none" stroke="#c9fbff" stroke-width="1.6" stroke-linecap="round"/>` : '';

    /* ---- cabeça ---- */
    const foreheadShadow = hair.shadowD ? ctx.clip(HEAD, `<path d="${hair.shadowD}" transform="translate(1 7)" fill="${skinT.deep}" opacity=".5"/>`) : '';
    const headSvg = `
      <g class="px-head">
        ${S(EAR_L, { sw: 2.6, sh: 2 })}${S(mir(EAR_L), { sw: 2.6, sh: 2 })}
        ${S(HEAD, { sw: 3.2, sh: 5.4, lt: 2.8 })}
        ${foreheadShadow}
        ${face.rest}
        <g class="px-eyes">${face.eyes}</g>
      </g>`;

    const classNames = ['px-svg', 'px-avatar-25d'];
    if (mini) classNames.push('px-mini', 'px-static');
    if (!animate) classNames.push('px-static');
    if (animate) classNames.push('px-anim-' + b.animacao);

    const defsStatic = `
      <radialGradient id="${id('floor')}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#080611" stop-opacity=".65"/><stop offset="1" stop-color="#080611" stop-opacity="0"/></radialGradient>
      <filter id="${id('shadow')}" x="-30%" y="-20%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
      <filter id="${ctx.glow}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>`;

    const haloPet = b.acessorio === 'gatinho' ? accessorySvg : '';
    const headAccessory = b.acessorio === 'gatinho' ? '' : accessorySvg;
    const aria = options.label || 'Avatar 2.5D personalizável';

    return `<svg xmlns="http://www.w3.org/2000/svg" class="${classNames.join(' ')}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(aria)}" shape-rendering="geometricPrecision" data-animacao="${b.animacao}" data-efeito="${b.efeito}" data-moldura="${b.moldura}">
      <defs>${defsStatic}${ctx.defs.join('')}</defs>
      <g class="px-stage-art">
        ${effectsSvg}
        <ellipse cx="120" cy="342" rx="66" ry="10" fill="#080611" opacity=".38" filter="url(#${id('shadow')})"/>
        <g class="px-hair-back">${hair.back}</g>
        ${legsSvg}
        ${shoesSvg}
        ${shoesExtra}
        ${bodySvg}
        <g class="px-head-group">
          ${headSvg}
          ${hair.front}
          ${headAccessory}
        </g>
        ${haloPet}
        ${framesSvg}
      </g>
    </svg>`;
  }

  function render(input, options){
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSVG(input, options);
    return wrapper.firstElementChild;
  }

  window.PixelAvatar = { W, H, SLOTS, PADRAO, normalizar, render, renderSVG };
})();
