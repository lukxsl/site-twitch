/* ============================================================
   UTILS — FORMAT
   ============================================================ */
function fmtBRL(v){
  if(!v && v !== 0) return 'R$ 0';
  return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtDuracao(min){
  if(!min) return null;
  const h = Math.floor(min/60), m = min % 60;
  return h ? `${h}h ${String(m).padStart(2,'0')}min` : `${m}min`;
}

const tempoAtras = iso => {
  const m = (Date.now() - new Date(iso)) / 60000;
  if (m < 60) return 'há ' + Math.max(1, Math.round(m)) + ' min';
  if (m < 1440) return 'há ' + Math.round(m / 60) + 'h';
  const d = Math.round(m / 1440); return d === 1 ? 'ontem' : 'há ' + d + ' dias';
};

const durTw = d => {
  const h = /(\d+)h/.exec(d || ''), mi = /(\d+)m/.exec(d || '');
  return h ? h[1] + 'h' + (mi ? mi[1].padStart(2, '0') : '00') : (mi ? mi[1] + ' min' : '');
};

function fmtDataHora(iso){
  if(!iso) return null;
  const d = new Date(iso);
  if(isNaN(d.getTime())) return String(iso);
  const data = d.toLocaleDateString('pt-BR');
  const hora = d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  return `${data} às ${hora}`;
}

function tempoRestante(iso){
  if(!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if(ms <= 0) return { encerrado: true, texto: 'Encerrada' };
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  let texto = '';
  if(d > 0) texto = `Fecha em ${d}d ${h}h`;
  else if(h > 0) texto = `Fecha em ${h}h ${m}m`;
  else texto = `Fecha em ${m}min`;
  return { encerrado: false, texto, dias: d, horas: h, min: m };
}

function ehNovo(item){
  if(!item) return false;
  if(item.tier && item.tier !== 'NR') return false;
  if(!item.adicionadoEm) return false;
  const dias = (Date.now() - new Date(item.adicionadoEm)) / 86400000;
  return dias <= 7;
}

function gerarIniciaisFaixa(nome){
  if(!nome) return '♪';
  const palavras = String(nome).trim().split(/\s+/).filter(Boolean);
  if(!palavras.length) return '♪';
  if(palavras.length === 1) return palavras[0].slice(0, 2).toUpperCase();
  return (palavras[0][0] + palavras[1][0]).toUpperCase();
}