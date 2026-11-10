/* ============================================================
   CORE — helpers de DOM, formatação e cliente HTTP
   (utils/dom.js + utils/format.js + api/client.js unificados)
   ============================================================ */

/* ---------- DOM ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const n1 = n => Number(n).toLocaleString('pt-BR', {minimumFractionDigits:1, maximumFractionDigits:1});

/* ---------- Ícones (sprite SVG em index.html) ---------- */
function ico(nome, classe = ''){
  const id = 'i-' + String(nome || '').replace(/^i-/, '');
  return `<svg class="ico${classe ? ' ' + classe : ''}" aria-hidden="true" focusable="false"><use href="#${id}"></use></svg>`;
}
window.ico = ico;

/* ---------- Formatação ---------- */
function fmtBRL(v){
  if(!v && v !== 0) return 'R$ 0';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDuracao(min){
  if(!min) return null;
  const h = Math.floor(min/60), m = Math.round(min % 60);
  return h ? `${h}h ${String(m).padStart(2,'0')}min` : `${m}min`;
}

function tempoAtras(iso){
  const m = (Date.now() - new Date(iso)) / 60000;
  if(!Number.isFinite(m)) return '';
  if(m < 1) return 'agora';
  if(m < 60) return 'há ' + Math.round(m) + ' min';
  if(m < 1440) return 'há ' + Math.round(m / 60) + 'h';
  const d = Math.round(m / 1440);
  return d === 1 ? 'ontem' : 'há ' + d + ' dias';
}

function fmtDataHora(iso){
  if(!iso) return null;
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return String(iso);
  const data = d.toLocaleDateString('pt-BR');
  const hora = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  return `${data} às ${hora}`;
}

function tempoRestante(iso){
  if(!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if(!Number.isFinite(ms)) return null;
  if(ms <= 0) return { encerrado: true, texto: 'Encerrada' };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  let texto;
  if(d > 0) texto = `Fecha em ${d}d ${h}h`;
  else if(h > 0) texto = `Fecha em ${h}h ${m}m`;
  else texto = `Fecha em ${m}min`;
  return { encerrado: false, texto, dias: d, horas: h, min: m };
}

function ehNovo(item){
  if(!item || !item.adicionadoEm) return false;
  if(item.tier && item.tier !== 'NR') return false;
  const dias = (Date.now() - new Date(item.adicionadoEm)) / 86400000;
  return dias >= 0 && dias <= 7;
}

/* ---------- Cliente HTTP ---------- */
const API_AUTH = '/api/auth';

async function api(base, action, { method = 'GET', body = null, query = null } = {}) {
  const url = new URL(base, window.location.origin);
  if (action) url.searchParams.set('action', action);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
  }
  const options = {
    method: String(method || 'GET').toUpperCase(),
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  };
  if (options.method !== 'GET' && options.method !== 'HEAD') {
    options.headers['Content-Type'] = 'application/json';
    if (body !== null && body !== undefined) options.body = JSON.stringify(body);
  }
  try {
    const resposta = await fetch(url.toString(), options);
    let data = null;
    try { data = await resposta.json(); } catch (_) { data = null; }
    if (resposta.status === 401 && !['login', 'register', 'me'].includes(action)) {
      window.dispatchEvent(new CustomEvent('soso:unauthorized'));
    }
    return { ok: resposta.ok, status: resposta.status, data };
  } catch (erro) {
    console.error('[API]', `${base || ''}${action ? `?action=${action}` : ''}`, erro);
    return { ok: false, status: 0, data: { error: 'Sem conexão com o servidor. Tente novamente.' } };
  }
}

window.API_AUTH = API_AUTH;
window.api = api;
