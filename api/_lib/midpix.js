const HANDLE = process.env.MIDPIX_HANDLE || 'asemtet0';
const BASE = 'https://midfielder.tv.br';
const UA = 'Mozilla/5.0 (compatible; SiteSoso/1.0)';

function decodificar(valor){
  return String(valor || '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function dinheiro(valor){
  const texto = String(valor || '').replace(/[^\d.,-]/g, '');
  if(!texto) return 0;
  const numero = texto.includes(',')
    ? Number(texto.replace(/\./g, '').replace(',', '.'))
    : Number(texto.replace(/,/g, ''));
  return Number.isFinite(numero) ? Math.round(numero * 100) / 100 : 0;
}

export function parseRanking(html){
  const ranking = [];
  const nomes = [...String(html || '').matchAll(/<div class="upv2-rank-name"[^>]*>([\s\S]*?)<\/div>/g)].map(m => decodificar(m[1]));
  const valores = [...String(html || '').matchAll(/<div class="upv2-rank-value"[^>]*>([\s\S]*?)<\/div>/g)].map(m => dinheiro(m[1]));
  const total = Math.min(nomes.length, valores.length);
  for(let i = 0; i < total; i++){
    if(nomes[i]) ranking.push({ nome: nomes[i], total: valores[i] });
  }
  const lista = [...String(html || '').matchAll(/<div class="upv2-rank-list-item">([\s\S]*?)<\/div>/g)];
  for(const item of lista){
    const nome = item[1].match(/<span class="upv2-rank-list-name"[^>]*>([\s\S]*?)<\/span>/);
    const valor = item[1].match(/<span class="upv2-rank-list-value"[^>]*>([\s\S]*?)<\/span>/);
    if(nome && valor){
      const apelido = decodificar(nome[1]);
      if(apelido) ranking.push({ nome: apelido, total: dinheiro(valor[1]) });
    }
  }
  return ranking
    .filter(apoiador => apoiador.nome)
    .sort((a, b) => b.total - a.total);
}

export function parseMetas(html){
  const texto = String(html || '');
  const article = texto.match(/<article[^>]*data-goal-slide[^>]*>([\s\S]*?)<\/article>/i);
  if(!article) return null;
  const bloco = article[0];
  const tituloAttr = bloco.match(/data-goal-title="([^"]*)"/i);
  const tituloTag = bloco.match(/<h4[^>]*>([\s\S]*?)<\/h4>/i);
  const valorAttr = bloco.match(/aria-valuenow="(\d+(?:\.\d+)?)"/i);
  const resumo = bloco.match(/<div class="upv2-goals-amount">([\s\S]*?)<\/div>/i);
  const valores = resumo
    ? [...resumo[1].matchAll(/R\$\s*[\d.,]+/g)].map(m => dinheiro(m[0]))
    : [];
  const arrecadado = valores[0] || 0;
  const objetivo = valores[1] || 0;
  const pct = objetivo > 0 ? Math.min(100, Math.round((arrecadado / objetivo) * 100)) : Number(valorAttr?.[1]) || 0;
  return {
    titulo: decodificar(tituloAttr?.[1] || tituloTag?.[1] || 'Meta da live'),
    arrecadado,
    objetivo,
    pct
  };
}

async function buscar(caminho){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try{
    const resposta = await fetch(`${BASE}/UserPanelV2/${caminho}/${encodeURIComponent(HANDLE)}`, {
      method: 'POST',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html, */*; q=0.01',
        'User-Agent': UA
      },
      signal: controller.signal
    });
    if(!resposta.ok) throw new Error(`MidPix ${caminho}: HTTP ${resposta.status}`);
    return await resposta.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function buscarMidpixPublico(){
  const [ranking, metas] = await Promise.allSettled([
    buscar('RefreshRanking'),
    buscar('RefreshMetasDoacao')
  ]);
  if(ranking.status === 'rejected' && metas.status === 'rejected'){
    throw new Error('Não foi possível consultar o MidPix agora.');
  }
  return {
    ranking: ranking.status === 'fulfilled' ? parseRanking(ranking.value) : [],
    meta: metas.status === 'fulfilled' ? parseMetas(metas.value) : null
  };
}
