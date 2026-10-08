// Vercel serverless: /api/backup.js
import { createHmac, timingSafeEqual, randomUUID } from 'crypto';

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SESSION_SECRET = process.env.SESSION_SECRET;
const COOKIE_NAME = 'sessao_site';
const CRON_SECRET = process.env.CRON_SECRET;

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
  'config:permissoes',
  'config:votosFechamento',
  'sugestoes:lista'
];

const MAX_BACKUPS = 5;
const INDEX_KEY = 'backups:index';
const BACKUP_PREFIX = 'backup:';

async function redis(cmds){
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

/* ---------- Sessão ---------- */
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

/* ---------- Verificar se é admin de verdade (revalida no banco) ---------- */
async function ehAdmin(sessao){
  if(!sessao) return false;
  const ENV_ADMINS = (process.env.DISCORD_ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
  if(ENV_ADMINS.includes(String(sessao.id))) return true;
  try {
    const [raw] = await redis([['HGET', 'admins', String(sessao.id)]]);
    if(!raw) return false;
    const d = JSON.parse(raw);
    return !!(d && d.cargo);
  } catch(e){ return false; }
}

/* ---------- Listar backups (filtra órfãos) ---------- */
async function listarBackups(){
  const [flat] = await redis([['LRANGE', INDEX_KEY, '0', '-1']]);
  const backups = [];
  for(const item of (flat || [])){
    try {
      const d = JSON.parse(item);
      const [existe] = await redis([['EXISTS', BACKUP_PREFIX + d.id]]);
      if(Number(existe) === 1) backups.push(d);
    } catch(e){}
  }
  return backups.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
}

/* ---------- Criar backup ---------- */
async function criarBackup(criadoPor){
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '_' + randomUUID().slice(0, 8);

  const cmds = KEYS_PARA_BACKUP.map(k => ['GET', k]);
  const results = await redis(cmds);

  const dados = {};
  KEYS_PARA_BACKUP.forEach((k, i) => {
    dados[k] = results[i] ?? null;
  });

  const json = JSON.stringify({
    id,
    criadoEm: Date.now(),
    criadoPor: criadoPor || 'sistema',
    chaves: dados
  });

  const tamanho = Buffer.byteLength(json, 'utf8');

  await redis([['SET', BACKUP_PREFIX + id, json]]);

  const meta = JSON.stringify({
    id,
    criadoEm: Date.now(),
    criadoPor: criadoPor || 'sistema',
    tamanho
  });
  await redis([['LPUSH', INDEX_KEY, meta]]);

  // Mantém só os MAX_BACKUPS mais recentes
  const [total] = await redis([['LLEN', INDEX_KEY]]);
  if(Number(total) > MAX_BACKUPS){
    const [sobrando] = await redis([['LRANGE', INDEX_KEY, String(MAX_BACKUPS), '-1']]);
    for(const item of (sobrando || [])){
      try {
        const d = JSON.parse(item);
        await redis([['DEL', BACKUP_PREFIX + d.id]]);
      } catch(e){}
    }
    await redis([['LTRIM', INDEX_KEY, '0', String(MAX_BACKUPS - 1)]]);
  }

  return { id, tamanho };
}

/* ---------- Restaurar ---------- */
async function restaurarBackup(id, quem){
  const [raw] = await redis([['GET', BACKUP_PREFIX + id]]);
  if(!raw) throw new Error('Backup não encontrado');

  let dados;
  try {
    dados = JSON.parse(raw);
  } catch(e){
    throw new Error('Backup corrompido');
  }

  const chaves = dados.chaves || {};
  const cmds = [];
  let total = 0;
  for(const k of KEYS_PARA_BACKUP){
    const v = chaves[k];
    if(v === null || v === undefined){
      cmds.push(['DEL', k]);
    } else {
      cmds.push(['SET', k, v]);
      total++;
    }
  }

  if(cmds.length) await redis(cmds);

  // Log da ação
  try {
    const logItem = JSON.stringify({
      quem: quem || 'alguém',
      cargo: null,
      acao: `Restaurou backup ${id} (${total} chaves)`,
      ts: Date.now()
    });
    await redis([['LPUSH', 'admin:logs', logItem], ['LTRIM', 'admin:logs', '0', '199']]);
  } catch(e){}

  return { total };
}

/* ---------- Apagar ---------- */
async function apagarBackup(id){
  await redis([['DEL', BACKUP_PREFIX + id]]);

  const [flat] = await redis([['LRANGE', INDEX_KEY, '0', '-1']]);
  const cmds = [['DEL', INDEX_KEY]];
  const restantes = [];
  for(const item of (flat || [])){
    try {
      const d = JSON.parse(item);
      if(d.id !== id) restantes.push(item);
    } catch(e){}
  }
  for(let i = restantes.length - 1; i >= 0; i--){
    cmds.push(['RPUSH', INDEX_KEY, restantes[i]]);
  }
  await redis(cmds);
  return { ok: true };
}

/* ============ HANDLER ============ */
export default async function handler(req, res){
  if(!URL_ || !TOKEN) return res.status(500).json({ error: 'Banco não configurado' });

  const action = req.query?.action || '';

  // ============ CRON (precisa do CRON_SECRET) ============
  if(action === 'cron'){
    if(!CRON_SECRET){
      return res.status(500).json({ error: 'CRON_SECRET não configurado' });
    }
    const auth = req.headers.authorization || '';
    const expected = `Bearer ${CRON_SECRET}`;
    try {
      const a = Buffer.from(auth);
      const b = Buffer.from(expected);
      if(a.length !== b.length || !timingSafeEqual(a, b)){
        return res.status(401).json({ error: 'Não autorizado' });
      }
    } catch(e){
      return res.status(401).json({ error: 'Não autorizado' });
    }

    try {
      const r = await criarBackup('cron');
      return res.status(200).json({ ok: true, ...r });
    } catch(e){
      return res.status(500).json({ error: 'Erro no cron' });
    }
  }

  // ============ Daqui pra baixo só admin ============
  const sessao = lerSessao(req);
  if(!sessao) return res.status(401).json({ error: 'Faça login' });
  if(!(await ehAdmin(sessao))) return res.status(403).json({ error: 'Sem permissão' });

  res.setHeader('Cache-Control', 'no-store');

  try {
    // ---- GET ?action=list ----
    if(req.method === 'GET' && action === 'list'){
      const backups = await listarBackups();
      return res.status(200).json({ backups });
    }

    // ---- GET ?action=download&id=X ----
    if(req.method === 'GET' && action === 'download'){
      const id = String(req.query?.id || '').trim();
      if(!id) return res.status(400).json({ error: 'id obrigatório' });
      const [raw] = await redis([['GET', BACKUP_PREFIX + id]]);
      if(!raw) return res.status(404).json({ error: 'Backup não encontrado' });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="backup-${id}.json"`);
      return res.status(200).send(raw);
    }

    // ---- POST ----
    if(req.method === 'POST'){
      const body = req.body || {};
      const sub = body.action || '';

      if(sub === 'create'){
        const r = await criarBackup(sessao.username || 'admin');
        return res.status(200).json({ ok: true, ...r });
      }

      if(sub === 'restore'){
        const id = String(body.id || '').trim();
        if(!id) return res.status(400).json({ error: 'id obrigatório' });
        const r = await restaurarBackup(id, sessao.username || 'admin');
        return res.status(200).json({ ok: true, ...r });
      }

      if(sub === 'delete'){
        const id = String(body.id || '').trim();
        if(!id) return res.status(400).json({ error: 'id obrigatório' });
        await apagarBackup(id);
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(400).json({ error: 'Ação inválida: ' + action });
  } catch(e){
    return res.status(500).json({ error: 'Erro no backup: ' + e.message });
  }
}