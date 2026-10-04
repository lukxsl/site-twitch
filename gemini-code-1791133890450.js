/* ============================================================
   CONFIGURAÇÕES[cite: 3]
   ============================================================ */
const CONFIG = {
  subs: null,
  donate: 'https://midfielder.tv.br/asemtet0',
  siteUpdated: '12/10/2026',
  topDoadores: [],
  atividadeManual: [],
  spotifyPlaylist: 'https://open.spotify.com/playlist/0OV32Qe5e7BJY33rL4tpXk'
};

const AVISO = { ativo: false, tipo: 'info', icone: '📢', titulo: 'Aviso', texto: '' };

const EMOTES = [
  { emoji: '💜', nome: 'amor' }, { emoji: '😭', nome: 'chora' },
  { emoji: '😂', nome: 'risada' }, { emoji: '😡', nome: 'raiva' },
  { emoji: '😱', nome: 'pog' }, { emoji: '🎮', nome: 'gg' }
];

const MARCOS = [50,100,250,500,1000,2500,5000,10000,25000,50000];
const HOST = window.location.hostname || 'localhost';

const COMANDOS_LISTA = [
  { c:'!discord', d:'Link do Discord' },
  { c:'!insta',   d:'Instagram da Soso' },
  { c:'!social',  d:'Instagram, Discord e TikTok' },
  { c:'!lurk',    d:'Avisar que vai ficar de lurk' },
  { c:'!uptime',  d:'Tempo de live' },
  { c:'!commands',d:'Lista de comandos' }
];

const NIVEIS = { dev: 4, dono: 3, administrador: 2, moderador: 1 };
const LABEL_CARGO = {
  dev: '🛠️ Dev', dono: '👑 Dono',
  administrador: '🛡️ Administrador', moderador: '🔰 Moderador'
};

/* --- Variáveis Globais de Estado --- */
let USUARIO = { admin: true, cargo: 'dev' }; // Mock para visualização do painel. Mude para a sua lógica real de verificação de login.
let ADMIN_PAGE = 'home';
let ADMIN_TAB = 'votos';
let ADMIN_TIER_TAB = 'jogos';

/* --- Funções de Navegação da Nova UI --- */
function mudarEcra(idEcra) {
  // Atualizar botões de navegação
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // Atualizar secções visíveis
  document.querySelectorAll('.section').forEach(sec => sec.classList.remove('active'));
  const target = document.getElementById(idEcra + 'Section');
  if(target) target.classList.add('active');

  // Se o utilizador clicar em Admin, arranca o carregamento dos dados
  if (idEcra === 'admin' && typeof carregarAdmin === 'function') {
    carregarAdmin();
  }
}

// Inicializar configuração visual
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById('btnDonate').href = CONFIG.donate;
  const aviso = document.getElementById('avisoGlobal');
  if (AVISO.ativo) {
    aviso.innerHTML = `<strong>${AVISO.icone} ${AVISO.titulo}:</strong> ${AVISO.texto}`;
    aviso.classList.remove('hidden');
    if (AVISO.tipo === 'warn') aviso.style.borderLeft = "4px solid var(--danger)";
  }
});

// Funções Utilitárias mockadas para o script admin não quebrar
const $ = id => document.getElementById(id);
const esc = str => String(str).replace(/[&<>'"]/g, match => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[match]));
const toast = (msg, tipo) => alert(`${tipo.toUpperCase()}: ${msg}`);
const confirmar = async (titulo, desc) => confirm(`${titulo}\n${desc}`);
const tempoAtras = data => new Date(data).toLocaleDateString('pt-PT');
const fmtDataHora = data => new Date(data).toLocaleString('pt-PT');
const checarLogin = async () => {}; // A substituir pela sua função real de verificação
const temPerm = perm => true; // A substituir pela sua função real de permissões