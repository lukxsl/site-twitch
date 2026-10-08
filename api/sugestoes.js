// Vercel serverless: /api/sugestoes.js
import { createHash, randomUUID, createHmac, timingSafeEqual } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'sessao_site';
const LIST_KEY = 'sugestoes:lista';
const MAX_ITENS = 200;
const MAX_TEXTO = 300;
const AUTO_TRANSICAO_MS = 90 * 1000; // 90 segundos

async function redis(cmds){
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

async function rateLimitOk(chave, limite, janelaSeg){
  try {
    const [n] = await redis([['INCR', chave]]);
    if(Number(n) === 1) await redis([['EXPIRE', chave, String(janelaSeg)]]);
    return Number(n) <= limite;
  } catch(e){ return true; }
}

function safeStr(v, max = 1000){
  return String(v == null ? '' : v).trim().slice(0, max);
}

function b64urlDecode(str){ return Buffer.from(str, 'base64url').toString(); }
function assinar(p){ return createHmac('sha256', SESSION_SECRET).update(p).digest('base64url'); }
function assinarValido(p, sig){
  const esperado = assinar(p);
  try {
    const a = Buffer.from(esperado);
    const b = Buffer.from(String(sig));
    if(a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch { return false; }
}
function lerSessao(req){
  if(!SESSION_SECRET) return null;
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  if(!m) return null;
  const [payload, sig] = m[1].split('.');
  if(!payload || !sig || !assinarValido(payload, sig)) return null;
  try {
    const d = JSON.parse(b64urlDecode(payload));
    if(d.exp && Date.now() > d.exp) return null;
    return d;
  } catch { return null; }
}

function tipoConfig(categoria){
  const t = String(categoria || '').toLowerCase();
  if(t.includes('bug'))      return { key:'bug',      cor: 0xef4444, icone: '🐛', titulo: 'Novo bug reportado',    label: 'Bug' };
  if(t.includes('jogo'))     return { key:'jogo',     cor: 0x3b82f6, icone: '🎮', titulo: 'Nova sugestão de jogo', label: 'Jogo' };
  if(t.includes('feedback')) return { key:'feedback', cor: 0x10b981, icone: '💬', titulo: 'Novo feedback',         label: 'Feedback' };
  return { key:'sugestao', cor: 0xa855f7, icone: '💡', titulo: 'Nova ideia', label: 'Sugestão' };
}

/* Aplica auto-transição: nova -> analise após 90s */
async function aplicarAutoTransicao(itens){
  const agora = Date.now();
  let mudou = false;
  for(const i of itens){
    if((i.status || 'nova') === 'nova' && i.data){
      const idade = agora - new Date(i.data).getTime();
      if(idade >= AUTO_TRANSICAO_MS){
        i.status = 'analise';
        i.atualizadoEm = new Date().toISOString();
        i.atualizadoPor = 'auto';
        mudou = true;
      }
    }
  }
  if(mudou && URL_ && TOKEN){
    const cmds = [['DEL', LIST_KEY]];
    for(let k = itens.length - 1; k >= 0; k--){
      cmds.push(['RPUSH', LIST_KEY, JSON.stringify(itens[k])]);
    }
    try { await redis(cmds); } catch(e){}
  }
  return mudou;
}

export default async function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    if (!URL_ || !TOKEN) return res.status(200).json({ itens: [] });
    try {
      const [flat] = await redis([['LRANGE', LIST_KEY, '0', String(MAX_ITENS - 1)]]);
      const itens = (flat || [])
        .map(x => { try { return JSON.parse(x); } catch { return null; } })
        .filter(Boolean);

      await aplicarAutoTransicao(itens);

      res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
      return res.status(200).json({ itens });
    } catch (e) {
      return res.status(200).json({ itens: [] });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return res.status(500).json({ error: 'Webhook não configurado' });

  const { nome, texto, site, tipo } = req.body || {};
  if (site) return res.status(200).json({ ok: true });

  const categoria = safeStr(tipo, 40) || 'Sugestão / ideia';
  const msg = safeStr(texto, MAX_TEXTO);
  const autor = safeStr(nome, 40) || 'Anônimo';

  if (!msg) return res.status(400).json({ error: 'Escreva uma sugestão' });
  if (msg.length > MAX_TEXTO) return res.status(400).json({ error: `Mensagem muito longa (máx ${MAX_TEXTO})` });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';

  // Rate-limit por IP via Redis: 1 sugestão a cada 30s
  if(!(await rateLimitOk(`ratelimit:sug:${ip}`, 1, 30))) {
    return res.status(429).json({ error: 'Aguarde um pouco antes de enviar de novo' });
  }

  // Anti-duplicata via Redis: mesmo IP + mesma mensagem em 2min
  const hash = createHash('sha256').update(ip + '|' + msg.toLowerCase()).digest('hex').slice(0, 24);
  if(!(await rateLimitOk(`ratelimit:sugdup:${hash}`, 1, 120))) {
    return res.status(429).json({ error: 'Você já enviou essa mensagem. Aguarde.' });
  }

  const sessao = lerSessao(req);
  const userId = sessao?.id || null;
  const usernameLogado = sessao?.username || null;
  const avatarLogado = sessao?.avatar || null;

  const item = {
    id: randomUUID(),
    nome: autor,
    userId,
    username: usernameLogado,
    avatar: avatarLogado,
    tipo: categoria,
    texto: msg,
    data: new Date().toISOString(),
    status: 'nova',
    motivo: null,
    atualizadoEm: null
  };

  try {
    if (URL_ && TOKEN) {
      await redis([
        ['LPUSH', LIST_KEY, JSON.stringify(item)],
        ['LTRIM', LIST_KEY, '0', String(MAX_ITENS - 1)]
      ]);
    }
  } catch (e) {}

  try {
    if (URL_ && TOKEN) {
      const logItem = JSON.stringify({
        quem: autor,
        cargo: null,
        acao: `Nova sugestão (${categoria}): "${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}"`,
        ts: Date.now()
      });
      await redis([['LPUSH', 'admin:logs', logItem], ['LTRIM', 'admin:logs', '0', '199']]);
    }
  } catch (e) {}

  const conf = tipoConfig(categoria);

  const embed = {
    author: {
      name: `@${autor}${userId ? '' : ' (anônimo)'}`,
      ...(avatarLogado ? { icon_url: avatarLogado } : {})
    },
    title: `${conf.icone} ${conf.titulo}`,
    description: msg,
    color: conf.cor,
    fields: [
      { name: '🏷️ Tipo',    value: `${conf.icone} ${conf.label}`,       inline: true },
      { name: '📊 Status',  value: '🟡 Nova',                           inline: true },
      { name: '👤 Canal',   value: userId ? '🔒 Logado' : '👤 Anônimo', inline: true }
    ],
    footer: { text: `ID: ${item.id.slice(0, 8)}` },
    timestamp: new Date().toISOString()
  };

  const r = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [embed] })
  });

  return r.ok
    ? res.status(200).json({ ok: true, id: item.id })
    : res.status(502).json({ error: 'Falha ao enviar' });
}