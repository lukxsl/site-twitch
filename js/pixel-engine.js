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
  const INK = '#34283f';
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

  function gradient(id, color, dark = 0.32, light = 0.24){
    return `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${mix(color, '#ffffff', light)}"/>
      <stop offset=".48" stop-color="${color}"/>
      <stop offset="1" stop-color="${mix(color, '#171323', dark)}"/>
    </linearGradient>`;
  }

  function hairBack(b, hair){
    const fill = `url(#${hair})`;
    if (b.cabelo === 'longo') return `<path d="M76 77Q67 64 65 99L59 190Q73 205 86 181L87 119L153 119L154 181Q168 204 181 190L175 98Q171 62 160 77Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M68 112L66 174M172 112L174 174" fill="none" stroke="#ffffff" stroke-opacity=".16" stroke-width="5" stroke-linecap="round"/>`;
    if (b.cabelo === 'rabo') return `<path d="M156 72Q178 77 179 102L183 148Q192 163 185 180Q172 187 163 173L165 125Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M172 106Q180 137 177 166" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="4" stroke-linecap="round"/>`;
    if (b.cabelo === 'coques') return `<g fill="${fill}" stroke="${OUTLINE}" stroke-width="5"><circle cx="69" cy="54" r="20"/><circle cx="171" cy="54" r="20"/></g><path d="M59 54Q67 43 78 50M161 50Q173 42 182 54" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="4" stroke-linecap="round"/>`;
    return '';
  }

  function hairFront(b, hair){
    const fill = `url(#${hair})`;
    const shine = mix(palette('cabeloCor', b.cabeloCor), '#ffffff', .42);
    switch (b.cabelo) {
      case 'careca': return '';
      case 'moicano':
        return `<path d="M91 57Q96 24 107 31L113 18Q121 12 127 31Q141 19 147 36L151 61L142 72L98 72Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M112 34L119 22L124 42M133 38L141 31" fill="none" stroke="${shine}" stroke-width="5" stroke-linecap="round"/>`;
      case 'espetado':
        return `<path d="M72 82Q64 51 83 43L77 24L100 38Q108 10 122 31L137 16L140 42Q164 31 169 54L164 91L151 100L88 100Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M87 49L102 57M122 39L131 51M145 55L156 60" stroke="${shine}" stroke-width="5" stroke-linecap="round"/>`;
      case 'longo':
        return `<path d="M73 91Q67 42 103 32Q141 18 163 53Q175 73 164 111L155 100L151 75Q132 83 111 74Q94 67 84 85L83 110L74 124Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M91 51Q111 31 139 42" fill="none" stroke="${shine}" stroke-width="6" stroke-linecap="round"/><path d="M77 102Q73 133 81 151M161 103Q166 127 157 148" fill="none" stroke="${fill}" stroke-width="13" stroke-linecap="round"/>`;
      case 'rabo':
        return `<path d="M72 88Q68 42 104 32Q144 20 164 56Q172 76 163 109L151 96L149 71Q126 83 107 73Q92 67 83 86L82 111L73 121Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M92 52Q114 30 141 45" fill="none" stroke="${shine}" stroke-width="6" stroke-linecap="round"/>`;
      case 'coques':
        return `<path d="M75 86Q72 43 105 33Q143 21 164 58L163 103L151 94Q140 79 120 79Q99 79 85 96L80 111Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M95 52Q115 34 140 46" fill="none" stroke="${shine}" stroke-width="6" stroke-linecap="round"/>`;
      default:
        return `<path d="M72 91Q65 45 103 32Q143 19 164 55Q174 74 164 108L151 96L149 72Q132 82 111 73Q94 67 84 86L82 111L73 119Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M91 51Q111 30 140 43" fill="none" stroke="${shine}" stroke-width="6" stroke-linecap="round"/><path d="M85 78Q101 86 117 78" fill="none" stroke="${mix(palette('cabeloCor', b.cabeloCor),'#171323',.18)}" stroke-width="4" stroke-linecap="round"/>`;
    }
  }

  function clothing(b, cloth){
    const fill = `url(#${cloth})`;
    const accent = mix(palette('roupaCor', b.roupaCor), '#ffffff', .46);
    const dark = mix(palette('roupaCor', b.roupaCor), '#171323', .38);
    const base = `<path d="M88 164Q101 155 120 155Q139 155 152 164L169 184L161 257Q120 271 79 257L71 184Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>`;
    const sleeves = `<path d="M88 167Q74 171 68 185L56 235Q56 249 69 252Q81 254 86 240L100 195Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M152 167Q166 171 172 185L184 235Q184 249 171 252Q159 254 154 240L140 195Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>`;
    const hem = `<path d="M79 249Q120 260 161 249" fill="none" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>`;

    if (b.roupa === 'camiseta') {
      return `${base}${sleeves}<path d="M105 160Q120 177 135 160" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round"/><path d="M120 194L125 202L133 204L125 210L123 219L117 212L108 210L115 204Z" fill="${accent}" opacity=".95"/><path d="M98 232Q120 238 142 232" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width="4" stroke-linecap="round"/>${hem}`;
    }
    if (b.roupa === 'social') {
      return `${base}${sleeves}<path d="M103 159L120 181L137 159L130 194L120 202L110 194Z" fill="#f5eee8" stroke="${OUTLINE}" stroke-width="3"/><path d="M117 181L123 181L127 211L120 220L113 211Z" fill="#b94c61" stroke="#743346" stroke-width="2"/><path d="M120 188L124 212" stroke="#f9c3ce" stroke-width="2"/><circle cx="120" cy="231" r="3" fill="${accent}"/>${hem}`;
    }
    if (b.roupa === 'vestido') {
      return `<path d="M91 164Q105 155 120 155Q135 155 149 164L159 208Q171 230 178 265Q120 285 62 265Q69 230 81 208Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M103 159Q120 178 137 159" fill="none" stroke="${dark}" stroke-width="7" stroke-linecap="round"/><path d="M83 231Q120 246 157 231M76 253Q120 270 164 253" fill="none" stroke="${accent}" stroke-opacity=".6" stroke-width="4" stroke-linecap="round"/><path d="M120 188L126 196L120 204L114 196Z" fill="${accent}"/>`;
    }
    if (b.roupa === 'jaqueta') {
      return `<path d="M91 164Q120 154 149 164L165 249Q120 265 75 249Z" fill="#282638" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M88 166Q73 172 67 188L56 234Q56 250 70 252Q81 252 87 240L99 194Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5"/><path d="M152 166Q167 172 173 188L184 234Q184 250 170 252Q159 252 153 240L141 194Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="5"/><path d="M91 166L105 171L116 254L91 250Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="4"/><path d="M149 166L135 171L124 254L149 250Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="4"/><path d="M120 174L120 249" stroke="${accent}" stroke-width="3" stroke-linecap="round"/><path d="M82 208L96 211M158 208L144 211" stroke="${accent}" stroke-width="4" stroke-linecap="round"/><path d="M90 232L102 235M150 232L138 235" stroke="#ffffff" stroke-opacity=".32" stroke-width="3"/>`;
    }
    if (b.roupa === 'armadura') {
      return `<path d="M92 164Q120 151 148 164L167 250Q120 269 73 250Z" fill="${fill}" stroke="${OUTLINE}" stroke-width="6" stroke-linejoin="round"/><path d="M88 171L69 178L58 203L82 212L101 188ZM152 171L171 178L182 203L158 212L139 188Z" fill="${accent}" stroke="${OUTLINE}" stroke-width="5"/><path d="M120 178L143 195L135 235L120 248L105 235L97 195Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="4"/><path d="M120 190L132 202L120 219L108 202Z" fill="#6be0ef" stroke="#e6fbff" stroke-width="3"/><path d="M87 228L105 236M153 228L135 236" stroke="${accent}" stroke-width="5" stroke-linecap="round"/><path d="M94 251L146 251" stroke="#ffffff" stroke-opacity=".28" stroke-width="4"/>`;
    }
    // Moletom: capuz, bolso canguru e cordões dão leitura própria sem ficar chapado.
    return `${sleeves}${base}<path d="M99 163Q120 194 141 163L136 185Q120 199 104 185Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="3"/><path d="M104 184L101 198M136 184L139 198" stroke="#f4d9ff" stroke-width="3" stroke-linecap="round"/><path d="M91 220Q120 211 149 220L145 244Q120 252 95 244Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="3"/><path d="M99 224Q120 218 141 224" fill="none" stroke="${accent}" stroke-width="3" stroke-linecap="round"/><path d="M90 174Q79 184 76 202M150 174Q161 184 164 202" fill="none" stroke="#ffffff" stroke-opacity=".16" stroke-width="4" stroke-linecap="round"/>${hem}`;
  }

  function accessory(b, accessory){
    const c = palette('acessorioCor', b.acessorioCor);
    const dark = mix(c, '#171323', .35);
    switch (b.acessorio) {
      case 'oculos':
        return `<g class="px-glasses" fill="none" stroke="${dark}" stroke-width="5"><rect x="82" y="91" width="33" height="25" rx="10" fill="#f9e4ac" fill-opacity=".24"/><rect x="125" y="91" width="33" height="25" rx="10" fill="#f9e4ac" fill-opacity=".24"/><path d="M115 101Q120 97 125 101"/><path d="M88 96L103 96M130 96L145 96" stroke="#fff" stroke-opacity=".5" stroke-width="2"/></g>`;
      case 'oculos_sol':
        return `<g stroke="${dark}" stroke-width="5"><rect x="81" y="91" width="35" height="27" rx="9" fill="#293248"/><rect x="124" y="91" width="35" height="27" rx="9" fill="#293248"/><path d="M115 101L125 101" fill="none"/><path d="M88 96L101 96M131 96L145 96" stroke="#8de9f5" stroke-width="3" stroke-linecap="round"/></g>`;
      case 'bone':
        return `<path d="M69 78Q74 31 120 31Q166 31 171 78L164 86Q120 70 76 86Z" fill="${c}" stroke="${OUTLINE}" stroke-width="5"/><path d="M118 32Q123 50 121 70" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="5"/><path d="M119 77Q147 69 174 82Q169 96 146 95L119 91Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="4"/>`;
      case 'headset':
        return `<path d="M67 104V82Q67 28 120 28Q173 28 173 82V104" fill="none" stroke="${dark}" stroke-width="12" stroke-linecap="round"/><rect x="58" y="86" width="21" height="42" rx="9" fill="${c}" stroke="${OUTLINE}" stroke-width="4"/><rect x="161" y="86" width="21" height="42" rx="9" fill="${c}" stroke="${OUTLINE}" stroke-width="4"/><path d="M166 121Q178 130 162 140" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`;
      case 'orelhas':
        return `<path d="M78 64Q55 16 48 13Q39 49 69 82ZM162 64Q185 16 192 13Q201 49 171 82Z" fill="${c}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M62 52L53 28L73 60M178 52L187 28L167 60" fill="none" stroke="#f7b3d8" stroke-width="5" stroke-linecap="round"/>`;
      case 'laco':
        return `<path d="M147 66Q130 43 117 55Q106 70 129 82L147 73L165 82Q188 69 176 55Q162 42 147 66Z" fill="${c}" stroke="${OUTLINE}" stroke-width="4"/><circle cx="147" cy="70" r="7" fill="${dark}" stroke="${OUTLINE}" stroke-width="3"/>`;
      case 'microfone':
        return `<g class="px-mic"><path d="M160 225L179 204L190 215L171 239Z" fill="#343044" stroke="${OUTLINE}" stroke-width="4"/><rect x="174" y="184" width="19" height="32" rx="9" transform="rotate(42 183 200)" fill="${c}" stroke="${OUTLINE}" stroke-width="4"/><path d="M178 187L192 200" stroke="#fff" stroke-opacity=".55" stroke-width="3"/></g>`;
      case 'gatinho':
        return `<g class="px-pet"><path d="M177 269Q174 248 189 242Q205 244 207 262L204 284L179 284Z" fill="#e6e0ed" stroke="${OUTLINE}" stroke-width="4"/><path d="M179 251L179 239L189 247M197 246L207 238L205 253" fill="#e6e0ed" stroke="${OUTLINE}" stroke-width="4" stroke-linejoin="round"/><circle cx="187" cy="261" r="2.7" fill="#332744"/><circle cx="198" cy="261" r="2.7" fill="#332744"/><path d="M191 267L194 269L197 267" fill="none" stroke="#c46d88" stroke-width="2.5"/></g>`;
      case 'halo':
        return `<ellipse cx="120" cy="18" rx="35" ry="9" fill="none" stroke="${c}" stroke-width="6"/><ellipse cx="120" cy="18" rx="35" ry="9" fill="none" stroke="#fff" stroke-opacity=".58" stroke-width="2"/>`;
      case 'coroa':
        return `<path d="M83 55L88 25L108 42L120 17L133 42L153 25L158 57Z" fill="${c}" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/><path d="M89 58H153L149 69H93Z" fill="${dark}" stroke="${OUTLINE}" stroke-width="4"/><circle cx="120" cy="43" r="5" fill="#f8f2ff"/>`;
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

  function renderSVG(input, options = {}){
    const b = normalizar(input);
    const mini = options.mini === true;
    const animate = options.animar !== false && !mini;
    const n = ++instance;
    const id = key => `av${n}-${key}`;
    const skin = id('skin'), hair = id('hair'), cloth = id('cloth'), pants = id('pants'), shoes = id('shoes');
    const skinColor = palette('pele', b.pele);
    const hairColor = palette('cabeloCor', b.cabeloCor);
    const clothColor = palette('roupaCor', b.roupaCor);
    const shoeColor = palette('calcadoCor', b.calcadoCor);
    const pantsColor = '#333449';
    const faceMood = b.rosto;

    const hairBackSvg = hairBack(b, hair);
    const hairFrontSvg = hairFront(b, hair);
    const clothesSvg = clothing(b, cloth);
    const accessorySvg = accessory(b);
    const effectsSvg = mini ? '' : effect(b);
    const framesSvg = mini ? '' : frame(b);

    let eyes = '';
    if (faceMood === 'serio') {
      eyes = `<path d="M91 99L107 102M133 102L149 99" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M95 108L105 108M135 108L145 108" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
    } else if (faceMood === 'piscada') {
      eyes = `<path d="M91 108Q99 102 107 108M135 108Q143 101 151 106" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><ellipse cx="100" cy="101" rx="4" ry="5" fill="#fff"/><path d="M91 97L86 93" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
    } else if (faceMood === 'sono') {
      eyes = `<path d="M91 108Q99 112 107 108M135 108Q143 112 151 108" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
    } else if (faceMood === 'estrela') {
      eyes = `<path d="M99 94L103 102L112 103L105 109L107 118L99 113L91 118L93 109L86 103L95 102Z M141 94L145 102L154 103L147 109L149 118L141 113L133 118L135 109L128 103L137 102Z" fill="#f5c86a" stroke="#9f6b3b" stroke-width="2"/>`;
    } else if (faceMood === 'neon') {
      eyes = `<path d="M90 101Q99 94 108 101L106 112Q99 118 92 112ZM132 101Q141 94 150 101L148 112Q141 118 134 112Z" fill="#54ddec" stroke="#286f90" stroke-width="3"/><circle cx="99" cy="104" r="3" fill="#fff"/><circle cx="141" cy="104" r="3" fill="#fff"/>`;
    } else {
      eyes = `<ellipse cx="99" cy="106" rx="5.2" ry="7" fill="${INK}"/><ellipse cx="141" cy="106" rx="5.2" ry="7" fill="${INK}"/><circle cx="101" cy="103" r="2" fill="#fff"/><circle cx="143" cy="103" r="2" fill="#fff"/>`;
    }

    let mouth = '<path d="M111 132Q120 140 129 132" fill="none" stroke="#9a5260" stroke-width="4" stroke-linecap="round"/>';
    if (faceMood === 'serio') mouth = '<path d="M113 135H127" stroke="#9a5260" stroke-width="4" stroke-linecap="round"/>';
    if (faceMood === 'sono') mouth = '<ellipse cx="120" cy="135" rx="4" ry="5" fill="#9a5260"/>';
    if (faceMood === 'neon') mouth = '<path d="M112 133Q120 139 128 133" fill="none" stroke="#4bd9ed" stroke-width="3.5" stroke-linecap="round"/>';

    const bodyTransform = b.base === 'fem'
      ? 'translate(120 0) scale(.93 1) translate(-120 0)'
      : '';

    const bodySvg = `
      <g class="px-body px-breath" transform="${bodyTransform}">
        <path d="M105 144L104 169Q120 181 136 169L135 144Z" fill="url(#${skin})" stroke="${OUTLINE}" stroke-width="4"/>
        <path d="M84 171Q68 179 66 199L57 236Q54 251 68 255Q81 258 87 242L101 197Z" fill="url(#${skin})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M156 171Q172 179 174 199L183 236Q186 251 172 255Q159 258 153 242L139 197Z" fill="url(#${skin})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M62 241Q70 247 80 242M160 242Q170 247 178 241" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="3" stroke-linecap="round"/>
        <path d="M91 164Q120 153 149 164L169 250Q120 269 71 250Z" fill="#29263b" opacity=".14"/>
        ${clothesSvg}
        <path d="M69 247Q76 254 83 248M157 248Q164 254 171 247" fill="none" stroke="${OUTLINE}" stroke-width="3"/>
        <path d="M68 244Q71 252 80 251Q86 250 87 243M153 243Q154 250 160 251Q169 252 172 244" fill="url(#${skin})" stroke="${OUTLINE}" stroke-width="4"/>
      </g>`;

    const legsSvg = `
      <g class="px-legs">
        <path d="M84 250Q101 258 117 256L115 316Q111 326 96 326Q83 325 83 315Z" fill="url(#${pants})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M123 256Q140 258 156 250L157 315Q157 326 143 326Q128 326 125 316Z" fill="url(#${pants})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M101 264L98 310M143 264L145 310" stroke="#ffffff" stroke-opacity=".13" stroke-width="4" stroke-linecap="round"/>
        <path d="M119 264L120 317" stroke="#181625" stroke-opacity=".55" stroke-width="4"/>
      </g>`;

    let shoesSvg = '';
    let shoesExtra = '';
    if (b.calcado === 'chinelo') {
      shoesSvg = `<g class="px-shoes">
        <path d="M88 311Q98 316 111 312L114 332Q110 340 95 340Q81 339 80 330Z" fill="url(#${skin})" stroke="${OUTLINE}" stroke-width="4"/>
        <path d="M129 312Q142 316 152 311L160 330Q159 339 145 340Q130 340 126 332Z" fill="url(#${skin})" stroke="${OUTLINE}" stroke-width="4"/>
        <path d="M78 331Q95 336 114 331M126 331Q145 336 164 331" fill="none" stroke="${shoeColor}" stroke-width="7" stroke-linecap="round"/>
        <path d="M91 315L98 331L105 316M137 316L144 331L151 315" fill="none" stroke="${OUTLINE}" stroke-width="4" stroke-linecap="round"/>
      </g>`;
    } else if (b.calcado === 'botas' || b.calcado === 'botas_cyber') {
      shoesSvg = `<g class="px-shoes">
        <path d="M84 292Q100 297 115 292L117 328Q113 342 95 342H76Q70 337 75 326Z" fill="url(#${shoes})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M125 292Q140 297 156 292L165 326Q170 337 164 342H145Q127 342 123 328Z" fill="url(#${shoes})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M84 301H112M130 301H158" stroke="${mix(shoeColor,'#ffffff',.45)}" stroke-width="4" stroke-linecap="round"/>
        <path d="M78 332Q96 337 114 331M129 331Q147 337 165 332" fill="none" stroke="#fff" stroke-opacity=".82" stroke-width="4" stroke-linecap="round"/>
      </g>`;
    } else {
      shoesSvg = `<g class="px-shoes">
        <path d="M84 311Q96 316 114 311L116 331Q113 342 94 342H76Q70 338 75 329Z" fill="url(#${shoes})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M125 311Q144 316 156 311L165 329Q170 338 164 342H146Q127 342 124 331Z" fill="url(#${shoes})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M78 332Q96 337 114 331M129 331Q147 337 165 332" fill="none" stroke="#fff" stroke-opacity=".82" stroke-width="4" stroke-linecap="round"/>
        <path d="M91 319L105 319M137 319L151 319" stroke="${mix(shoeColor,'#ffffff',.5)}" stroke-width="3" stroke-linecap="round"/>
      </g>`;
    }
    if (b.calcado === 'tenis_neon' || b.calcado === 'botas_cyber') shoesExtra = `<path d="M78 333Q96 338 113 332M128 332Q146 338 164 333" fill="none" stroke="#55ddec" stroke-width="3" stroke-linecap="round"/>`;

    const face = `
      <g class="px-head">
        <path d="M76 78Q67 70 63 83Q59 101 76 111M164 78Q173 70 177 83Q181 101 164 111" fill="url(#${skin})" stroke="${OUTLINE}" stroke-width="4"/>
        <path d="M76 69Q76 35 120 31Q164 35 164 69L161 116Q158 150 120 158Q82 150 79 116Z" fill="url(#${skin})" stroke="${OUTLINE}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M83 118Q88 141 120 148Q151 141 157 118" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="4" stroke-linecap="round"/>
        <ellipse cx="91" cy="123" rx="10" ry="5" fill="#e98e93" opacity=".19"/><ellipse cx="149" cy="123" rx="10" ry="5" fill="#e98e93" opacity=".19"/>
        <path d="M119 112Q116 122 121 124" fill="none" stroke="${mix(skinColor,'#7c4d42',.36)}" stroke-width="3" stroke-linecap="round"/>
        <g class="px-eyes">${eyes}</g>
        ${mouth}
      </g>`;

    const classNames = ['px-svg', 'px-avatar-25d'];
    if (mini) classNames.push('px-mini', 'px-static');
    if (!animate) classNames.push('px-static');
    if (animate) classNames.push('px-anim-' + b.animacao);

    const defs = `<defs>
      ${gradient(skin, skinColor, .22, .20)}
      ${gradient(hair, hairColor, .38, .24)}
      ${gradient(cloth, clothColor, .34, .25)}
      ${gradient(pants, pantsColor, .28, .18)}
      ${gradient(shoes, shoeColor, .28, .24)}
      <radialGradient id="${id('floor')}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#080611" stop-opacity=".65"/><stop offset="1" stop-color="#080611" stop-opacity="0"/></radialGradient>
      <filter id="${id('shadow')}" x="-30%" y="-20%" width="160%" height="160%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>`;

    const haloPet = b.acessorio === 'gatinho' ? accessorySvg : '';
    const headAccessory = b.acessorio === 'gatinho' ? '' : accessorySvg;
    const aria = options.label || 'Avatar 2.5D personalizável';

    return `<svg xmlns="http://www.w3.org/2000/svg" class="${classNames.join(' ')}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax meet" role="img" aria-label="${esc(aria)}" shape-rendering="geometricPrecision" data-animacao="${b.animacao}" data-efeito="${b.efeito}" data-moldura="${b.moldura}">
      ${defs}
      <g class="px-stage-art">
        ${effectsSvg}
        <ellipse cx="120" cy="342" rx="66" ry="10" fill="#080611" opacity=".38" filter="url(#${id('shadow')})"/>
        ${hairBackSvg}
        ${legsSvg}
        ${shoesSvg}
        ${shoesExtra}
        ${bodySvg}
        <g class="px-head-group">
          ${face}
          ${hairFrontSvg}
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
