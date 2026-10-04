// Vercel serverless: /api/backup.js
// GET     ?action=list           → lista os backups (data + tamanho)
// GET     ?action=download&id=X  → devolve o JSON do backup
// POST    { action:'create' }    → cria backup novo
// POST    { action:'restore', id } → restaura backup
// POST    { action:'delete', id }  → apaga backup
// GET     ?action=cron           → cria backup automático (protegido por CRON_SECRET)
import { createHmac } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const CRON_SECRET = process.env.CRON_SECRET;
const COOKIE_NAME = 'sessao_site';
const LIST_KEY = 'backups:lista';
const BACKUP_KEY = id => `backups:item:${id}`;
const MAX_BACKUPS = 5;
const MAX_BACKUP_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_BACKUP_ID = 60;

const KEYS_PARA_BACKUP = [
  'tierlist:jogos',
  'tierlist:filmes',
  'votos:config',
  'votos:ciclo_atual',
  'admins',
  'user_profiles',
  'banidos',
  'config:aviso',
  'config:donate',
  'config:manutencao',
  'config:recado',
  'config:horasMes',
  'config:updatedAt',
  'config:top3',
  'config:hall',
  'config:permissoes'
];

function b64urlDecode(str){ return Buffer.from(str, 'base64url').toString(); }
function assinar(p){ return createHmac('sha256', SESSION_SECRET).update(p).digest('base64url'); }
function lerSessao(req){
  if(!SESSION_SECRET) return null;
  const c = req.headers.cookie || '';
  const m = c.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]+)'));
  if(!m) return null;
  const [payload, sig] = m[1].split('.');
  if(!payload || !sig || assinar(payload) !== sig) return null;
  try {
    const d = JSON.parse(b64urlDecode(payload));
    if(d.exp && Date.now() > d.exp) return null;
    return d;
  } catch { return null; }
}

async function redis(cmds){
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

function safeStr(v, max = 200){
  return String(v == null ? '' : v).trim().slice(0, max);
}

function novoId(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function criarBackup(quem){
  const cmds = KEYS_PARA_BACKUP.map(k => ['GET', k]);
  const vals = await redis(cmds);
  const dados = {};
  KEYS_PARA_BACKUP.forEach((k, i) => { if(vals[i] != null) dados[k] = vals[i]; });

  const id = novoId();
  const payload = JSON.stringify({
    id,
    criadoEm: new Date().toISOString(),
    criadoPor: safeStr(quem, 60) || 'sistema',
    dados
  });

  // Limite de tamanho (evita estourar Redis / memória)
  if(payload.length > MAX_BACKUP_SIZE) {
    throw new Error(`Backup muito grande (${(payload.length/1024/1024).toFixed(2)}MB, máx 5MB)`);
  }

  const listaRaw = (await redis([['GET', LIST_KEY]]))[0];
  let lista = [];
  try { lista = listaRaw ? JSON.parse(listaRaw) : []; } catch(e){}
  lista.unshift({ id, criadoEm: new Date().toISOString(), criadoPor: safeStr(quem, 60) || 'sistema', tamanho: payload.length });

  const cmds2 = [
    ['SET', BACKUP_KEY(id), payload],
    ['SET', LIST_KEY, JSON.stringify(lista.slice(0, MAX_BACKUPS))]
  ];
  const idsMantidos = new Set(lista.slice(0, MAX_BACKUPS).map(x => x.id));
  for(const b of lista){
    if(!idsMantidos.has(b.id)) cmds2.push(['DEL', BACKUP_KEY(b.id)]);
  }
  await redis(cmds2);
  return { id, tamanho: payload.length };
}

async function restaurarBackup(id){
  const raw = (await redis([['GET', BACKUP_KEY(id)]]))[0];
  if(!raw) return { error: 'Backup não encontrado' };
  let bkp = null;
  try { bkp = JSON.parse(raw); } catch(e){ return { error: 'Backup corrompido' }; }
  if(!bkp || !bkp.dados) return { error: 'Backup vazio' };

  const cmds = [];
  for(const [k, v] of Object.entries(bkp.dados)){
    // Só restaura chaves conhecidas (evita injetar chaves maliciosas)
    if(!KEYS_PARA_BACKUP.includes(k)) continue;
    cmds.push(['SET', k, String(v)]);
  }
  if(!cmds.length) return { error: 'Nada pra restaurar' };
  await redis(cmds);
  return { ok: true, total: cmds.length };
}

export default async function handler(req, res){
  res.setHeader('Cache-Control', 'no-store');
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });
  if(!SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });

  const action = (req.query && req.query.action) || '';

  /* ---------- CRON — protegido por CRON_SECRET ---------- */
  if(req.method === 'GET' && action === 'cron'){
    if(!CRON_SECRET){
      return res.status(500).json({ error: 'CRON_SECRET não configurado' });
    }
    const auth = req.headers.authorization || '';
    if(auth !== `Bearer ${CRON_SECRET}`){
      return res.status(401).json({ error: 'Unauthorized' });
    }
    try{
      const r = await criarBackup('cron');
      return res.status(200).json({ ok: true, ...r });
    } catch(e){
      return res.status(500).json({ error: e.message });
    }
  }

  /* ---------- ROTAS PROTEGIDAS ---------- */
  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login' });
  if(!sessao.admin) return res.status(403).json({ error: 'Sem permissão' });

  const quem = safeStr(sessao.username, 60) || 'anônimo';

  try {
    if(req.method === 'GET' && action === 'list'){
      const raw = (await redis([['GET', LIST_KEY]]))[0];
      let lista = [];
      try { lista = raw ? JSON.parse(raw) : []; } catch(e){}
      return res.status(200).json({ backups: lista });
    }

    if(req.method === 'GET' && action === 'download'){
      const id = safeStr((req.query||{}).id, MAX_BACKUP_ID);
      if(!id) return res.status(400).json({ error: 'id obrigatório' });
      const raw = (await redis([['GET', BACKUP_KEY(id)]]))[0];
      if(!raw) return res.status(404).json({ error: 'Backup não encontrado' });
      res.setHeader('Content-Disposition', `attachment; filename="backup-${id}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).send(raw);
    }

    if(req.method === 'POST'){
      const body = req.body || {};
      const act = body.action || action;

      if(act === 'create'){
        const r = await criarBackup(quem);
        return res.status(200).json({ ok: true, ...r });
      }
      if(act === 'restore'){
        const id = safeStr(body.id, MAX_BACKUP_ID);
        if(!id) return res.status(400).json({ error: 'id obrigatório' });
        const r = await restaurarBackup(id);
        if(r.error) return res.status(400).json(r);
        return res.status(200).json(r);
      }
      if(act === 'delete'){
        const id = safeStr(body.id, MAX_BACKUP_ID);
        if(!id) return res.status(400).json({ error: 'id obrigatório' });
        await redis([['DEL', BACKUP_KEY(id)]]);
        const raw = (await redis([['GET', LIST_KEY]]))[0];
        let lista = [];
        try { lista = raw ? JSON.parse(raw) : []; } catch(e){}
        lista = lista.filter(x => x.id !== id);
        await redis([['SET', LIST_KEY, JSON.stringify(lista)]]);
        return res.status(200).json({ ok: true });
      }
      return res.status(400).json({ error: 'Ação inválida' });
    }

    return res.status(405).json({ error: 'Método não permitido' });
  } catch(e){
    return res.status(500).json({ error: 'Erro no backup: ' + e.message });
  }
}