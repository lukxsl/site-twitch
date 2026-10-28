/* ============================================================
   SETUP — MINI GAME 2D ISOMÉTRICO (TOUR DO LUKZIN)
   ============================================================ */

const SETUP_DATA = {
  gabinete: {
    title: 'Gabinete Risemode Aquarium Branco',
    text: 'O cérebro do setup! Um Risemode Aquarium branco, com vidro na frente e na lateral pra mostrar todo o RGB. Dentro dele tem um Ryzen 9 5900X, 48GB de RAM, uma RX 9060 XT, SSD de 2TB e uma fonte Corsair RM800W. É uma nave! 🚀',
    x: '75%', y: '55%'
  },
  monitor: {
    title: 'Monitor AOC 240Hz',
    text: 'Aqui é onde a mágica acontece! Um AOC de 240Hz que deixa a gameplay super lisa. Perfeito pra não perder nenhum frame nos jogos mais rápidos. 🎮',
    x: '35%', y: '40%'
  },
  teclado: {
    title: 'Teclado AULA H68',
    text: 'O barulhinho delicioso das teclas! Um AULA H68, super compacto e estiloso, perfeito pra digitar e jogar. ⌨️',
    x: '30%', y: '60%'
  },
  mouse: {
    title: 'Mouse Logitech G502 X Superlight RGB',
    text: 'Leve como uma pena e preciso como um laser. O G502 X Superlight é o companheiro perfeito pra qualquer headshot. 🖱️',
    x: '45%', y: '65%'
  },
  microfone: {
    title: 'Microfone FIFINE AM8 Branco',
    text: 'A voz doce da Soso passa por aqui! Um FIFINE AM8 branco, super profissional, pra galera ouvir cada detalhe e cada risada. 🎙️',
    x: '20%', y: '50%'
  },
  cadeira: {
    title: 'Cadeira XT Racer',
    text: 'A base de tudo! Uma XT Racer super confortável pra aguentar aquelas lives longas de 8 horas sem doer as costas. 🪑',
    x: '50%', y: '65%'
  }
};

let tourAtivo = false;
let tourIndex = 0;
let tourTimer = null;
let typeTimer = null;
let lukPos = { x: '50%', y: '60%' };
const CHAVES_TOUR = ['gabinete', 'monitor', 'teclado', 'mouse', 'microfone', 'cadeira'];

function moverLuk(x, y) {
  const char = document.getElementById('lukChar');
  if (!char) return;
  
  char.classList.add('walking');
  
  // Inverte a direção do boneco dependendo de onde ele vai
  const currentX = parseFloat(char.style.left || '50');
  const targetX = parseFloat(x);
  if (targetX < currentX) {
    char.style.transform = 'scaleX(-1)';
  } else {
    char.style.transform = 'scaleX(1)';
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
  }, 25);
}

function irParaItem(itemId) {
  if (tourAtivo) pararTour(); // Para o tour automático se o usuário clicar manualmente
  
  const item = SETUP_DATA[itemId];
  if (!item) return;

  moverLuk(item.x, item.y);
  
  setTimeout(() => {
    digitarTexto(`<strong>${item.title}</strong><br><br>${item.text}`);
  }, 600); // Espera o boneco andar um pouco antes de falar
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
    // Fim do tour
    const progress = document.getElementById('setupProgress');
    if (progress) progress.textContent = 'Concluído! ✅';
    digitarTexto('E aí, curtiu o setup da Soso? Ela montou com muito carinho! Se quiser ver de novo, só clicar no botão de iniciar tour. 💜');
    setTimeout(pararTour, 4000); // Para o tour automaticamente após o fim
    return;
  }

  const itemId = CHAVES_TOUR[tourIndex];
  const progress = document.getElementById('setupProgress');
  if (progress) progress.textContent = `${tourIndex + 1} / ${CHAVES_TOUR.length}`;
  
  irParaItem(itemId);
  tourIndex++;
  
  tourTimer = setTimeout(executarPassoDoTour, 4500); // Tempo entre cada parada do tour
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
  
  moverLuk('50%', '60%');
}

// Inicialização básica quando o DOM carregar
document.addEventListener('DOMContentLoaded', () => {
  // Garante que o boneco comece na posição inicial
  const char = document.getElementById('lukChar');
  if (char) {
    char.style.left = lukPos.x;
    char.style.top = lukPos.y;
  }
});