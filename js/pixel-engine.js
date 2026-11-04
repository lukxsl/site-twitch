/* ============================================================
   AVATAR ENGINE 2.5D — SOSO ARCADE  (v3 · base de testes)
   Personagem vetorial em camadas, com volume por gradiente,
   luz de contorno neon, piscar, respiração e braço que acena.

   Catálogo ENXUTO de propósito: poucos itens por categoria só para
   testar o visual. Para adicionar uma peça nova:
     1) inclua o id em IDS (aqui) e desenhe em hairParts/clothing/etc.
     2) inclua o mesmo id no CATALOGO de api/_lib/game.js
   Os slots e as classes CSS (px-*) são os mesmos de antes.
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
    pele: ['clara', 'media', 'morena', 'escura'],
    rosto: ['feliz', 'serio', 'piscada'],
    cabelo: ['curto', 'longo', 'coques'],
    cabeloCor: ['preto', 'roxo', 'loiro', 'ruivo'],
    roupa: ['moletom', 'camiseta', 'jaqueta'],
    roupaCor: ['roxo', 'grafite', 'vermelho', 'ciano'],
    calcado: ['tenis', 'botas'],
    calcadoCor: ['branco', 'preto', 'vermelho'],
    acessorio: ['nenhum', 'oculos', 'headset', 'orelhas'],
    acessorioCor: ['dourado', 'lilas', 'rosa'],
    efeito: ['nenhum', 'brilho', 'aura_roxa'],
    animacao: ['respirar', 'acenar', 'pular'],
    moldura: ['nenhuma', 'simples', 'ciano']
  };

  const PALETAS = {
    pele: { clara: '#f6d9c4', media: '#e0a479', morena: '#a8693f', escura: '#6b4030' },
    cabeloCor: { preto: '#3a3050', roxo: '#8b5cf6', loiro: '#ecc25c', ruivo: '#c4572f' },
    roupaCor: { roxo: '#7c55d6', grafite: '#4d4e66', vermelho: '#c9475a', ciano: '#1f93b0' },
    calcadoCor: { branco: '#f1eef7', preto: '#2b2740', vermelho: '#c9475a' },
    acessorioCor: { dourado: '#eebd55', lilas: '#c096f2', rosa: '#f08ac4' }
  };

  const EYE_COLOR = { preto: '#6f86ea', roxo: '#a75ff5', loiro: '#e29a2d', ruivo: '#38b6a0' };
  const INK = '#2a1838';

  /* ---------------- utilidades ---------------- */
  function esc(t){
    return String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }
  function normalizar(input){
    const out = {};
    SLOTS.forEach(slot => {
      const v = input && input[slot];
      out[slot] = IDS[slot].includes(v) ? v : PADRAO[slot];
    });
    return out;
  }
  function rgb(hex){
    let v = String(hex || '').replace('#', '');
    if (v.length === 3) v = v.split('').map(c => c + c).join('');
    if (!/^[\da-f]{6}$/i.test(v)) return [124, 85, 214];
    return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
  }
  function mix(a, b, k){
    const A = rgb(a), B = rgb(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
  }
  const pal = (slot, id) => (PALETAS[slot] && PALETAS[slot][id]) || '#7c55d6';

  function tones(c, kind){
    if (kind === 'skin') return {
      light: mix(c, '#fff2e6', .38), base: c,
      shade: mix(mix(c, '#c2486e', .2), '#2f1740', .07),
      deep: mix(c, '#4a2038', .5), line: mix(c, '#2a1228', .72)
    };
    return {
      light: mix(c, '#ffffff', .30), base: c,
      shade: mix(c, '#1d0f3a', .42),
      deep: mix(c, '#12081f', .55), line: mix(c, '#12081f', .74)
    };
  }

  /* espelha um path absoluto (M L Q C Z H V) no eixo x=120 */
  function mir(d){
    const tk = d.match(/[MLQCZHVA]|-?\d*\.?\d+/g) || [];
    let n = 0, cmd = '';
    return tk.map(t => {
      if (/[MLQCZHVA]/.test(t)) { cmd = t; n = 0; return t; }
      const v = parseFloat(t);
      if (cmd === 'V') return t;
      if (cmd === 'H') return String(+(240 - v).toFixed(2));
      return (n++ % 2 === 0) ? String(+(240 - v).toFixed(2)) : t;
    }).join(' ');
  }

  function makeCtx(n){
    const defs = [];
    let k = 0;
    const id = p => `av${n}-${p}${++k}`;
    const stops = s => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a != null ? ` stop-opacity="${a}"` : ''}/>`).join('');
    function lin(s, x1 = 0, y1 = 0, x2 = 0, y2 = 1){
      const i = id('g');
      defs.push(`<linearGradient id="${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`);
      return `url(#${i})`;
    }
    function rad(s, cx = .5, cy = .5, r = .5){
      const i = id('r');
      defs.push(`<radialGradient id="${i}" cx="${cx}" cy="${cy}" r="${r}">${stops(s)}</radialGradient>`);
      return `url(#${i})`;
    }
    function clip(d, inner){
      const i = id('k');
      defs.push(`<clipPath id="${i}"><path d="${d}"/></clipPath>`);
      return `<g clip-path="url(#${i})">${inner}</g>`;
    }
    /* peça com volume: gradiente diagonal (luz em cima à esquerda) + contorno colorido */
    function vol(d, color, o = {}){
      const t = o.tone || tones(color, o.kind);
      const g = lin([[0, t.light], [.42, t.base], [1, t.shade]], .15, 0, .85, 1);
      const sw = o.sw == null ? 2.6 : o.sw;
      const stroke = sw ? ` stroke="${o.line || t.line}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"` : '';
      return `<path d="${d}" fill="${g}"${stroke}/>`;
    }
    return { defs, id, lin, rad, clip, vol };
  }

  /* ---------------- cabelo ---------------- */
  function hairParts(b, ctx){
    const color = pal('cabeloCor', b.cabeloCor);
    const t = tones(color);
    const sheen = mix(color, '#ffffff', .75);
    const V = (d, c, o) => ctx.vol(d, c || color, o);
    const strand = (d, op) => `<path d="${d}" fill="none" stroke="${t.deep}" stroke-width="1.6" stroke-linecap="round" opacity="${op || .42}"/>`;
    const shine = d => `<path d="${d}" fill="none" stroke="${sheen}" stroke-width="7" stroke-linecap="round" opacity=".38"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6" transform="translate(2 -1)"/>`;

    const capBack = 'M62 112C52 58 84 22 120 22C156 22 188 58 178 112L172 134L68 134Z';
    const fringe =
      'M62 116C52 62 84 24 120 24C156 24 188 62 178 116L172 132C171 112 168 98 162 88' +
      'C152 98 138 96 128 80C124 92 114 98 104 96C96 94 90 90 86 86C82 98 78 116 76 132Z';

    const out = { back: V(capBack, mix(color, '#12081f', .3), { sw: 2.6 }), front: '', shadowD: fringe };
    out.front = V(fringe) +
      strand('M122 28C106 40 100 60 104 82') + strand('M126 28C142 40 148 58 146 78') +
      strand('M92 36C82 54 80 76 84 96', .3) + strand('M156 36C168 52 172 74 168 98', .3) +
      shine('M84 62C92 44 110 34 134 38');

    if (b.cabelo === 'longo') {
      out.back = V('M60 104C46 152 50 208 68 236Q92 246 106 216L110 150L130 150L134 216Q148 246 172 236C190 208 194 152 180 104Z', mix(color, '#12081f', .22)) +
        strand('M66 150C62 180 64 210 70 226', .35) + strand('M174 150C178 180 176 210 170 226', .35);
      const lock = 'M63 112C55 154 59 196 75 222C85 202 84 154 79 118Z';
      out.front = V(lock) + V(mir(lock)) + out.front +
        `<path d="M72 150C68 168 70 184 74 196" fill="none" stroke="${sheen}" stroke-width="3.4" stroke-linecap="round" opacity=".6"/>`;
    } else if (b.cabelo === 'coques') {
      const bun = cx => V(`M${cx - 21} 52C${cx - 21} 32 ${cx - 8} 28 ${cx} 28C${cx + 8} 28 ${cx + 21} 32 ${cx + 21} 52C${cx + 21} 72 ${cx + 8} 78 ${cx} 78C${cx - 8} 78 ${cx - 21} 72 ${cx - 21} 52Z`) +
        `<path d="M${cx - 12} 42C${cx - 4} 36 ${cx + 8} 40 ${cx + 11} 52" fill="none" stroke="${t.deep}" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>` +
        `<path d="M${cx - 13} 38C${cx - 7} 31 ${cx + 2} 31 ${cx + 8} 34" fill="none" stroke="${sheen}" stroke-width="4.6" stroke-linecap="round" opacity=".8"/>`;
      out.back = bun(58) + bun(182) + out.back;
    }
    return out;
  }

  /* ---------------- rosto ---------------- */
  function eyeOpen(ctx, cx, cy, o, iris, opt){
    const rx = 12, ry = 14.5;
    const deep = mix(iris, '#140a2a', .6), light = mix(iris, '#ffffff', .55);
    const ig = ctx.lin([[0, deep], [.5, iris], [1, light]]);
    const eyeD = `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
    let inner = `<rect x="${cx - 15}" y="${cy - 17}" width="30" height="34" fill="#fffaf8"/>` +
      `<ellipse cx="${cx}" cy="${cy + 1}" rx="9.6" ry="13" fill="${ig}"/>` +
      `<ellipse cx="${cx}" cy="${cy + 2}" rx="4.8" ry="6.8" fill="${deep}"/>` +
      `<ellipse cx="${cx}" cy="${cy - 13}" rx="14" ry="7" fill="#1a0f2e" opacity=".32"/>` +
      `<ellipse cx="${cx - 3.4}" cy="${cy - 4.8}" rx="4" ry="4.8" fill="#fff"/>` +
      `<circle cx="${cx + 4}" cy="${cy + 6.4}" r="2" fill="#fff" opacity=".95"/>`;
    let lid = '';
    if (opt.lid != null) {
      const yR = cy + opt.lid + (o === -1 ? 2 : -2), yL = cy + opt.lid + (o === -1 ? -2 : 2);
      inner += `<path d="M${cx - 15} ${cy - 18}H${cx + 15}V${yR}L${cx - 15} ${yL}Z" fill="${opt.skin}"/>`;
      lid = `<path d="M${cx - 13} ${yL}L${cx + 13} ${yR}" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
    }
    const L = (x, y) => (cx + o * x).toFixed(1) + ' ' + (cy + y).toFixed(1);
    const lash = `<path d="M${L(13, -4)}Q${L(9, -16)} ${L(-2, -16)}Q${L(-11, -15)} ${L(-13, -5)}" fill="none" stroke="${INK}" stroke-width="${opt.fem ? 4.2 : 3.6}" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M${L(13, -4)}L${L(17.5, -8)}" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>` +
      (opt.fem ? `<path d="M${L(11, -10)}L${L(15.5, -13)}M${L(6, -13.5)}L${L(9, -17.5)}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>` : '');
    return ctx.clip(eyeD, inner) + lid + (opt.lid != null ? '' : lash);
  }
  function eyeWink(cx, cy, o, fem){
    const L = (x, y) => (cx + o * x).toFixed(1) + ' ' + (cy + y).toFixed(1);
    return `<path d="M${L(-11, 4)}Q${cx} ${cy - 9} ${L(11, 4)}" fill="none" stroke="${INK}" stroke-width="${fem ? 4.2 : 3.8}" stroke-linecap="round"/>` +
      `<path d="M${L(11, 4)}L${L(15, 1)}" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`;
  }

  function faceParts(b, ctx, skinT, hairColor){
    const mood = b.rosto, fem = b.base === 'fem';
    const iris = EYE_COLOR[b.cabeloCor] || '#7a5cf0';
    const brow = mix(hairColor, '#1d1030', .5);
    const browP = (d, w) => `<path d="${d}" fill="none" stroke="${brow}" stroke-width="${w || 3}" stroke-linecap="round"/>`;
    const lx = 95, rx = 145, cy = 114;
    const O = { fem, skin: skinT.base };
    let eyes = '', brows = '', mouth = '', extra = '';

    if (mood === 'serio') {
      eyes = eyeOpen(ctx, lx, cy, -1, iris, Object.assign({ lid: -3 }, O)) + eyeOpen(ctx, rx, cy, 1, iris, Object.assign({ lid: -3 }, O));
      brows = browP(`M${lx - 11} ${cy - 22}L${lx + 10} ${cy - 15}`) + browP(`M${rx - 10} ${cy - 15}L${rx + 11} ${cy - 22}`);
      mouth = `<path d="M112 148Q120 145 128 148" fill="none" stroke="#b24f70" stroke-width="3.2" stroke-linecap="round"/>`;
    } else if (mood === 'piscada') {
      eyes = eyeOpen(ctx, lx, cy, -1, iris, O) + eyeWink(rx, cy + 2, 1, fem);
      brows = browP(`M${lx - 10} ${cy - 20}Q${lx} ${cy - 26} ${lx + 10} ${cy - 21}`) + browP(`M${rx - 10} ${cy - 18}Q${rx} ${cy - 21} ${rx + 10} ${cy - 18}`);
      mouth = `<path d="M108 144Q120 156 132 144" fill="none" stroke="#b24f70" stroke-width="3.2" stroke-linecap="round"/><path d="M119 150Q123 160 128 150Z" fill="#f58fa4" stroke="#9c3d58" stroke-width="1.6" stroke-linejoin="round"/>`;
      extra = `<path d="M170 98L172 104L178 106L172 108L170 114L168 108L162 106L168 104Z" fill="#fff" opacity=".95"/>`;
    } else {
      eyes = eyeOpen(ctx, lx, cy, -1, iris, O) + eyeOpen(ctx, rx, cy, 1, iris, O);
      brows = browP(`M${lx - 10} ${cy - 20}Q${lx} ${cy - 26} ${lx + 10} ${cy - 21}`) + browP(`M${rx - 10} ${cy - 21}Q${rx} ${cy - 26} ${rx + 10} ${cy - 20}`);
      const m = 'M108 143Q120 162 132 143Q120 148 108 143Z';
      mouth = ctx.clip(m, `<rect x="100" y="136" width="40" height="32" fill="#7a2a46"/><ellipse cx="120" cy="157" rx="7" ry="5" fill="#f58fa4"/><path d="M108 143Q120 148 132 143L132 139L108 139Z" fill="#fffaf6"/>`) +
        `<path d="${m}" fill="none" stroke="#5e2038" stroke-width="2.4" stroke-linejoin="round"/>`;
    }
    const blush = cx => `<ellipse cx="${cx}" cy="138" rx="10" ry="5.4" fill="#ff7fa0" opacity=".4"/>`;
    const nose = `<path d="M120 130Q118 135 122.5 136" fill="none" stroke="${skinT.deep}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>`;
    return { eyes, rest: blush(80) + blush(160) + nose + brows + mouth + extra };
  }

  /* ---------------- braços e roupas ---------------- */
  const ARM = 'M90 188Q72 192 68 212L62 248Q61 260 73 262Q85 264 87 250L100 208Z';
  const HAND = 'M62 250C58 260 62 270 73 270C84 270 89 260 86 251C80 245 68 245 62 250Z';
  const SLV_LONG = 'M90 188Q72 192 68 212L63 240Q76 249 89 241L100 208Z';
  const SLV_SHORT = 'M90 188Q72 192 68 210L66 226Q80 234 97 222L100 208Z';
  const CUFF = 'M63 236Q76 246 89 237L87 250Q75 258 62 250Z';
  const TORSO = 'M90 184Q120 174 150 184L166 208L160 270Q120 284 80 270L74 208Z';

  function clothing(b, ctx){
    const c = pal('roupaCor', b.roupaCor);
    const t = tones(c);
    const accent = mix(c, '#ffffff', .55);
    const dark = mix(c, '#1b1030', .45);
    const V = (d, col, o) => ctx.vol(d, col || c, o);
    const fold = (d, op) => `<path d="${d}" fill="none" stroke="${t.deep}" stroke-width="2" stroke-linecap="round" opacity="${op || .35}"/>`;
    const skin = tones(pal('pele', b.pele), 'skin');
    const armSkin = ctx.vol(ARM, skin.base, { kind: 'skin' });
    let sleeve = '', body = '';

    if (b.roupa === 'camiseta') {
      sleeve = V(SLV_SHORT);
      body = V(TORSO) +
        V('M102 180Q120 200 138 180L134 176Q120 190 106 176Z', dark, { sw: 2 }) +
        `<path d="M122 206L113 224H121L117 242L133 218H124L129 206Z" fill="${accent}" stroke="${t.line}" stroke-width="1.6" stroke-linejoin="round"/>` +
        fold('M94 222Q102 238 98 256') + fold('M146 222Q138 238 142 256') +
        V('M78 262Q120 276 162 262L160 272Q120 286 80 272Z', dark, { sw: 2 });
    } else if (b.roupa === 'jaqueta') {
      const inner = '#2b2942';
      sleeve = V(SLV_LONG) + `<path d="M70 214L97 220" stroke="${accent}" stroke-width="3.4" stroke-linecap="round"/>` + V(CUFF, inner, { sw: 2 });
      const panel = 'M90 184L112 182L116 276Q96 274 80 270L74 208Z';
      body = V(TORSO, inner) + V(panel) + V(mir(panel)) +
        V('M96 178L110 196L116 180L104 172Z', accent, { sw: 2 }) + V(mir('M96 178L110 196L116 180L104 172Z'), accent, { sw: 2 }) +
        `<path d="M120 190V278" stroke="${accent}" stroke-width="2.4" stroke-linecap="round"/><rect x="117.6" y="190" width="4.8" height="8" rx="1.4" fill="#fff" stroke="${t.line}" stroke-width="1"/>` +
        fold('M96 228Q92 248 100 262') + fold('M144 228Q148 248 140 262');
    } else {
      sleeve = V(SLV_LONG) + V(CUFF, dark, { sw: 2 });
      body = V(TORSO) +
        V('M96 178Q120 210 144 178L140 174Q120 194 100 174Z', dark, { sw: 2.2 }) +
        `<path d="M110 196L107 216M130 196L133 216" stroke="#f6e6ff" stroke-width="2.6" stroke-linecap="round"/><circle cx="107" cy="217" r="2.1" fill="#f6e6ff"/><circle cx="133" cy="217" r="2.1" fill="#f6e6ff"/>` +
        V('M91 238Q120 227 149 238L146 262Q120 270 94 262Z', mix(c, '#1b1030', .14), { sw: 2.2 }) +
        `<path d="M97 243Q120 235 143 243" fill="none" stroke="${accent}" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>` +
        V('M78 262Q120 276 162 262L160 272Q120 286 80 272Z', dark, { sw: 2 }) +
        fold('M94 200Q86 220 92 236') + fold('M146 200Q154 220 148 236');
    }
    const handSkin = ctx.vol(HAND, skin.base, { kind: 'skin', sw: 2.4 });
    const arm = side => {
      const m = side === 'r';
      const f = d => m ? mir(d) : d;
      const a = `<path d="${f(ARM)}" fill="${ctx.lin([[0, skin.light], [.5, skin.base], [1, skin.shade]], .15, 0, .85, 1)}" stroke="${skin.line}" stroke-width="2.6" stroke-linejoin="round"/>`;
      const h = `<path d="${f(HAND)}" fill="${ctx.lin([[0, skin.light], [.55, skin.base], [1, skin.shade]], .15, 0, .85, 1)}" stroke="${skin.line}" stroke-width="2.4" stroke-linejoin="round"/>`;
      const s = m ? sleeve.replace(/ d="([^"]+)"/g, (_, d) => ` d="${mir(d)}"`) : sleeve;
      return a + h + s;
    };
    return { body, armL: arm('l'), armR: arm('r') };
  }

  /* ---------------- acessórios ---------------- */
  function accessory(b, ctx){
    const c = pal('acessorioCor', b.acessorioCor);
    const t = tones(c);
    const A = (d, col, o) => ctx.vol(d, col || c, Object.assign({ sw: 2.6 }, o || {}));
    switch (b.acessorio) {
      case 'oculos': {
        const l = 'M80 104Q80 96 90 96H102Q112 96 112 105V118Q112 130 101 130H90Q80 130 80 119Z';
        const g = ctx.lin([[0, '#ffffff', .38], [1, '#bfe6ff', .08]], 0, 0, 1, 1);
        return `<path d="${l}" fill="${g}"/><path d="${mir(l)}" fill="${g}"/>` +
          `<path d="M86 104L98 99M87 111L104 103" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>` +
          `<path d="${mir('M86 104L98 99M87 111L104 103')}" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".6"/>` +
          `<path d="${l}" fill="none" stroke="${t.line}" stroke-width="5.4"/><path d="${mir(l)}" fill="none" stroke="${t.line}" stroke-width="5.4"/>` +
          `<path d="${l}" fill="none" stroke="${c}" stroke-width="3"/><path d="${mir(l)}" fill="none" stroke="${c}" stroke-width="3"/>` +
          `<path d="M112 106Q120 101 128 106" fill="none" stroke="${t.line}" stroke-width="5"/><path d="M112 106Q120 101 128 106" fill="none" stroke="${c}" stroke-width="2.6"/>` +
          `<path d="M79 108L68 104M161 108L172 104" stroke="${c}" stroke-width="3" stroke-linecap="round"/>`;
      }
      case 'headset': {
        const pad = 'M52 98Q52 90 60 90H68Q76 90 76 99V128Q76 137 68 137H60Q52 137 52 128Z';
        const band = 'M62 112V92Q62 26 120 26Q178 26 178 92V112';
        return `<path d="${band}" fill="none" stroke="${t.line}" stroke-width="13" stroke-linecap="round"/>` +
          `<path d="${band}" fill="none" stroke="${mix(c, '#2a2840', .55)}" stroke-width="9" stroke-linecap="round"/>` +
          `<path d="M72 78Q78 42 112 32" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".4"/>` +
          A(pad) + A(mir(pad)) +
          `<path d="M57 102V126M183 102V126" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".5"/>` +
          `<path d="M178 134Q184 152 158 154" fill="none" stroke="${t.line}" stroke-width="5.6" stroke-linecap="round"/><path d="M178 134Q184 152 158 154" fill="none" stroke="${c}" stroke-width="2.6" stroke-linecap="round"/>` +
          `<ellipse cx="155" cy="154" rx="6" ry="4.2" fill="${c}" stroke="${t.line}" stroke-width="2.2"/>`;
      }
      case 'orelhas': {
        const ear = 'M70 70C58 50 58 28 66 10C84 16 102 32 110 56Z';
        const inn = 'M75 58C69 46 69 32 73 22C85 28 94 38 99 50Z';
        return A(ear) + A(mir(ear)) +
          `<path d="${inn}" fill="#f7a9d0" stroke="${t.line}" stroke-width="1.6" stroke-linejoin="round"/><path d="${mir(inn)}" fill="#f7a9d0" stroke="${t.line}" stroke-width="1.6" stroke-linejoin="round"/>`;
      }
      default: return '';
    }
  }

  /* ---------------- efeitos e moldura ---------------- */
  function effect(b, ctx){
    if (b.efeito === 'aura_roxa') {
      const g = ctx.rad([[0, '#b78aff', .0], [.65, '#b78aff', .16], [1, '#b78aff', .5]]);
      return `<ellipse class="px-aura" cx="120" cy="196" rx="104" ry="160" fill="${g}"/>`;
    }
    if (b.efeito === 'brilho') {
      const pts = [[38, 112, 1], [204, 126, .8], [44, 232, .7], [198, 240, 1], [64, 52, .8], [182, 58, .9]];
      const star = (x, y, s, i) => `<path class="px-twinkle" style="animation-delay:${i * .45}s" d="M${x} ${y - 8 * s}L${x + 2.4 * s} ${y - 2.4 * s}L${x + 8 * s} ${y}L${x + 2.4 * s} ${y + 2.4 * s}L${x} ${y + 8 * s}L${x - 2.4 * s} ${y + 2.4 * s}L${x - 8 * s} ${y}L${x - 2.4 * s} ${y - 2.4 * s}Z" fill="${i % 2 ? '#d9b9ff' : '#fbe3a0'}" opacity=".9"/>`;
      return `<g class="px-particles">${pts.map((p, i) => star(p[0], p[1], p[2], i)).join('')}</g>`;
    }
    return '';
  }
  function frame(b){
    if (b.moldura === 'nenhuma') return '';
    if (b.moldura === 'ciano') return `<rect class="px-frame" x="8" y="8" width="224" height="344" rx="26" fill="none" stroke="#59d9eb" stroke-opacity=".6" stroke-width="2.4"/>`;
    return `<rect class="px-frame" x="8" y="8" width="224" height="344" rx="26" fill="none" stroke="#a879f2" stroke-opacity=".45" stroke-width="2" stroke-dasharray="8 12"/>`;
  }

  /* ---------------- montagem ---------------- */
  function renderSVG(input, options = {}){
    const b = normalizar(input);
    const mini = options.mini === true;
    const animate = options.animar !== false && !mini;
    const n = ++instance;
    const ctx = makeCtx(n);
    const id = key => `av${n}-${key}`;
    const glow = id('glow');

    const skinColor = pal('pele', b.pele);
    const hairColor = pal('cabeloCor', b.cabeloCor);
    const shoeColor = pal('calcadoCor', b.calcadoCor);
    const skinT = tones(skinColor, 'skin');
    const skinFill = ctx.lin([[0, skinT.light], [.5, skinT.base], [1, skinT.shade]], .15, 0, .85, 1);
    const S = (d, o = {}) => `<path d="${d}" fill="${o.fill || skinFill}" stroke="${skinT.line}" stroke-width="${o.sw || 2.8}" stroke-linejoin="round" stroke-linecap="round"/>`;

    const hair = hairParts(b, ctx);
    const face = faceParts(b, ctx, skinT, hairColor);
    const clo = clothing(b, ctx);
    const acc = accessory(b, ctx);
    const fx = mini ? '' : effect(b, ctx);
    const fr = mini ? '' : frame(b);

    const HEAD = 'M64 104C62 60 88 34 120 34C152 34 178 60 176 104C175 142 154 170 120 172C86 170 65 142 64 104Z';
    const EAR = 'M68 100C56 96 52 112 60 124C64 128 70 126 72 120Z';
    const NECK = 'M105 156L104 188Q120 198 136 188L135 156Z';
    const headFill = ctx.rad([[0, skinT.light], [.55, skinT.base], [1, skinT.shade]], .38, .3, .85);

    /* pernas e calçados */
    const pants = '#3d3d5c';
    const leg = 'M92 268L118 270L116 324Q108 330 99 328Q90 326 90 318Z';
    const legs = `<g class="px-legs">${ctx.vol(leg, pants, { sw: 2.6 })}${ctx.vol(mir(leg), pants, { sw: 2.6 })}</g>`;
    const sole = '#fbf7ff';
    let shoes;
    if (b.calcado === 'botas') {
      const bt = 'M88 298L118 298L120 338Q120 346 106 346L82 346Q75 341 80 332Z';
      const so = 'M77 340L121 340L121 347Q121 351 108 351L82 351Q75 349 77 340Z';
      shoes = ctx.vol(bt, shoeColor) + ctx.vol(mir(bt), shoeColor) + ctx.vol(so, sole, { sw: 2.2 }) + ctx.vol(mir(so), sole, { sw: 2.2 }) +
        `<path d="M90 306H116M124 306H150" stroke="${mix(shoeColor, '#ffffff', .5)}" stroke-width="4" stroke-linecap="round"/>`;
    } else {
      const sn = 'M86 320Q102 317 119 322L121 340Q121 347 107 347L82 347Q75 343 79 332Z';
      const so = 'M77 341L121 341L121 348Q121 352 108 352L82 352Q75 350 77 341Z';
      shoes = ctx.vol(sn, shoeColor) + ctx.vol(mir(sn), shoeColor) + ctx.vol(so, sole, { sw: 2.2 }) + ctx.vol(mir(so), sole, { sw: 2.2 }) +
        `<path d="M96 326L109 328M94 332L109 333M144 328L131 330M146 333L131 335" stroke="${mix(shoeColor, '#ffffff', .6)}" stroke-width="2.6" stroke-linecap="round"/>`;
    }

    const bodyScale = b.base === 'fem' ? 'translate(120 0) scale(.93 1) translate(-120 0)' : 'translate(120 0) scale(1.03 1) translate(-120 0)';
    const neckShade = ctx.clip(NECK, `<ellipse cx="120" cy="160" rx="22" ry="15" fill="${skinT.deep}" opacity=".6"/>`);
    const bodySvg = `
      <g class="px-body px-breath" transform="${bodyScale}">
        ${S(NECK)}${neckShade}
        ${clo.armL}
        ${clo.body}
        <g class="px-arm-r">${clo.armR}</g>
      </g>`;

    const foreheadShade = ctx.clip(HEAD, `<path d="${hair.shadowD}" transform="translate(1 8)" fill="${skinT.deep}" opacity=".32"/>`);
    const cheekLight = `<ellipse cx="96" cy="86" rx="22" ry="10" fill="#fff" opacity=".1"/>`;
    const headSvg = `
      <g class="px-head">
        ${S(EAR, { sw: 2.6 })}${S(mir(EAR), { sw: 2.6 })}
        ${S(HEAD, { fill: headFill, sw: 3 })}
        ${foreheadShade}${cheekLight}
        ${face.rest}
        <g class="px-eyes">${face.eyes}</g>
      </g>`;

    const cls = ['px-svg', 'px-avatar-25d'];
    if (mini) cls.push('px-mini', 'px-static');
    if (!animate) cls.push('px-static');
    if (animate) cls.push('px-anim-' + b.animacao);

    const defsStatic = `
      <filter id="${id('shadow')}" x="-30%" y="-30%" width="160%" height="220%"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="${glow}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="3"/></filter>`;

    /* luz de contorno (rim light) neon no lado direito do corpo, só no modo grande */
    const rim = mini ? '' : `<path d="M166 210L160 270" stroke="#7be9f5" stroke-width="2.4" stroke-linecap="round" opacity=".35" filter="url(#${glow})"/><path d="M174 70C178 110 168 150 148 168" fill="none" stroke="#7be9f5" stroke-width="2" stroke-linecap="round" opacity=".28"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" class="${cls.join(' ')}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(options.label || 'Avatar 2.5D personalizável')}" shape-rendering="geometricPrecision" data-animacao="${b.animacao}" data-efeito="${b.efeito}" data-moldura="${b.moldura}">
      <defs>${defsStatic}${ctx.defs.join('')}</defs>
      <g class="px-stage-art">
        ${fx}
        <ellipse cx="120" cy="348" rx="70" ry="9" fill="#080611" opacity=".42" filter="url(#${id('shadow')})"/>
        <g class="px-hair-back">${hair.back}</g>
        ${legs}
        ${shoes}
        ${bodySvg}
        <g class="px-head-group">
          ${headSvg}
          ${hair.front}
          ${acc}
          ${rim}
        </g>
        ${fr}
      </g>
    </svg>`;
  }

  function render(input, options){
    const wrapper = document.createElement('div');
    wrapper.innerHTML = renderSVG(input, options);
    return wrapper.firstElementChild;
  }

  window.PixelAvatar = { W, H, SLOTS, PADRAO, IDS, normalizar, render, renderSVG };
})();
