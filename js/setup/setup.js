/* ============================================================
   SETUP — MINI GAME 2D (TOUR DO LUKZIN)
   ============================================================ */

const SETUP_DATA = {
  estante: {
    title: 'Estante de Zerados 🏆',
    text: 'O hall da fama! Temos o chapéu do Red Dead Redemption 2, a pulseira do Detroit, o Homem-Aranha e a Clove do Valorant. Só jogos que marcaram história!',
    x: '22%', y: '75%'
  },
  quadro: {
    title: 'Quadro do Gatinho 🐱',
    text: 'A Soso ama gatos! Esse quadro fofo aí dá toda a energia boa pro cantinho.',
    x: '50%', y: '70%'
  },
  webcam: {
    title: 'Webcam (iPhone 11)',
    text: 'A Soso usa um iPhone 11 como webcam! A qualidade é simplesmente insana, dá pra ver cada detalhe da live. 📱',
    x: '50%', y: '75%'
  },
  monitor: {
    title: 'Monitor AOC 240Hz',
    text: 'Aqui é onde a mágica acontece! Um AOC de 240Hz que deixa a gameplay super lisa. E não é que ela tá jogando Stardew Valley agora? 🎮',
    x: '50%', y: '75%'
  },
  microfone: {
    title: 'Microfone FIFINE AM8',
    text: 'A voz doce da Soso passa por aqui! Um FIFINE AM8 branco, super profissional, pra galera ouvir cada detalhe e risada. 🎙️',
    x: '38%', y: '75%'
  },
  garrafa: {
    title: 'Garrafa Stanley Branca',
    text: 'A famosa Stanley! Água gelada pra aguentar as lives longas. E branca, pra combinar com o setup. 🥤',
    x: '32%', y: '75%'
  },
  teclado: {
    title: 'Teclado AULA H68',
    text: 'O barulhinho delicioso das teclas! Um AULA H68, super compacto e estiloso, perfeito pra digitar e jogar. ⌨️',
    x: '45%', y: '85%'
  },
  mouse: {
    title: 'Mouse Logitech G502 X',
    text: 'Leve como uma pena e preciso como um laser. O G502 X Superlight é o companheiro perfeito pra qualquer headshot. 🖱️',
    x: '57%', y: '85%'
  },
  headset: {
    title: 'Headset Astro A50',
    text: 'O famoso Astro A50! Som imersivo pra ouvir até o passo do inimigo mais longe. 🎧',
    x: '65%', y: '75%'
  },
  gabinete: {
    title: 'Gabinete Risemode Aquarium',
    text: 'O coração da máquina! Um Risemode Aquarium branco. Dentro dele tem um Ryzen 9 5900X, 48GB de RAM, RX 9060 XT, SSD 2TB e fonte Corsair RM800W. 🚀',
    x: '72%', y: '75%'
  },
  pantufas: {
    title: 'Pantufas de Coelho Roxas',
    text: 'O item mais importante do setup! Conforto máximo pros pés enquanto joga. 🐰',
    x: '30%', y: '88%'
  },
  cadeira: {
    title: 'Cadeira XT Racer',
    text: 'A base de tudo! Uma XT Racer super confortável pra aguentar aquelas lives longas de 8 horas sem doer as costas. 🪑',
    x: '58%', y: '85%'
  }
};

let tourAtivo = false;
let tourIndex = 0;
let tourTimer = null;
let typeTimer = null;
const CHAVES_TOUR = ['gabinete', 'monitor', 'teclado', 'mouse', 'microfone', 'garrafa', 'headset', 'estante', 'pantufas', 'cadeira'];

function moverLuk(x, y) {
  const char = document.getElementById('lukChar');
  if (!char) return;
  
  char.classList.add('walking');
  
  const currentX = parseFloat(char.style.left || '50');
  const targetX = parseFloat(x);
  if (targetX < currentX) {
    char.querySelector('.luk-avatar').style.transform = 'scaleX(-1)';
  } else {
    char.querySelector('.luk-avatar').style.transform = 'scaleX(1)';
  }

  char.style.left = x;
  char.style.top = y;

  setTimeout(() => {
    char.classList.remove('walking');
  }, 800);
}

function digitarTexto(texto) {
  const el = document.getElementById('dlgText');
  if (!el) return;
  el.innerHTML = '';
  if (typeTimer) clearInterval(typeTimer);
  
  let i = 0;
  el.innerHTML = '<span class="typing-cursor">|</span>';
  
  typeTimer = setInterval(() => {
    if (i < texto.length) {
      el.innerHTML = texto.substring(0, i + 1) + '<span class="typing-cursor">|</span>';
      i++;
    } else {
      clearInterval(typeTimer);
      el.innerHTML = texto;
    }
  }, 20);
}

function irParaItem(itemId) {
  if (tourAtivo) pararTour();
  
  const item = SETUP_DATA[itemId];
  if (!item) return;

  moverLuk(item.x, item.y);
  
  setTimeout(() => {
    digitarTexto(`<strong style="color:var(--purple-2)">${item.title}</strong><br><br>${item.text}`);
  }, 700);
}

function iniciarTour() {
  if (tourAtivo) return;
  tourAtivo = true;
  tourIndex = 0;
  
  const btnTour = document.getElementById('btnTourSetup');
  const btnParar = document.getElementById('btnPararTour');
  const progress = document.getElementById('setupProgress');
  
  if (btnTour) btnTour.style.display = 'none';
  if (btnParar) btnParar.style.display = 'flex';
  if (progress) {
    progress.style.display = 'inline-block';
    progress.textContent = `1 / ${CHAVES_TOUR.length}`;
  }

  executarPassoDoTour();
}

function executarPassoDoTour() {
  if (!tourAtivo) return;
  if (tourIndex >= CHAVES_TOUR.length) {
    const progress = document.getElementById('setupProgress');
    if (progress) progress.textContent = 'Concluído! ✅';
    digitarTexto('E aí, curtiu o setup da Soso? Ela montou com muito carinho! Se quiser ver de novo, só clicar no botão de iniciar tour. 💜');
    setTimeout(pararTour, 5000);
    return;
  }

  const itemId = CHAVES_TOUR[tourIndex];
  const progress = document.getElementById('setupProgress');
  if (progress) progress.textContent = `${tourIndex + 1} / ${CHAVES_TOUR.length}`;
  
  irParaItem(itemId);
  tourIndex++;
  
  tourTimer = setTimeout(executarPassoDoTour, 5000);
}

function pararTour() {
  tourAtivo = false;
  if (tourTimer) clearTimeout(tourTimer);
  
  const btnTour = document.getElementById('btnTourSetup');
  const btnParar = document.getElementById('btnPararTour');
  const progress = document.getElementById('setupProgress');
  
  if (btnTour) btnTour.style.display = 'flex';
  if (btnParar) btnParar.style.display = 'none';
  if (progress) progress.style.display = 'none';
  
  moverLuk('50%', '88%');
}