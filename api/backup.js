// Backup da comunidade. Dados de conta e índices de login ficam criptografados
// no próprio arquivo de backup (AES-256-GCM). A restauração desfaz a criptografia.
import {
  createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual
} from 'crypto';
import { redis, validarSessao, cargoDe, origemOk, ENV } from './_lib/core.js';

const CRON_SECRET = String(process.env.CRON_SECRET || '').trim();
const ENCRYPTION_SECRET = String(process.env.BACKUP_ENCRYPTION_KEY || process.env.SESSION_SECRET || '').trim();
const BACKUP_PREFIX = 'backup:';
const INDEX_KEY = 'backups:index';
const MAX_BACKUPS = 5;

const KEYS_PARA_BACKUP = [
  'tierlist:jogos', 'tierlist:filmes', 'tierlist:seedFeito',
  'votos:config', 'votos:ciclo_atual', 'config:aviso', 'config:donate',
  'config:manutencao', 'config:recado', 'config:horasMes', 'config:updatedAt',
  'config:top3', 'config:hall', 'config:metas', 'config:permissoes',
  'config:votosFechamento', 'setup:data', 'setup:sonhos'
];
const HASHES_SENSIVEIS = new Set([
  'accounts', 'usernames', 'email_idx', 'google_idx', 'google_email_idx', 'twitch_idx'
]);
const HASHES_FIXOS = [
  ...HASHES_SENSIVEIS, 'admins', 'user_profiles', 'banidos'
];
const LISTAS_FIXAS = ['sugestoes:lista'];

function chaveCriptografia(){
  if(!ENCRYPTION_SECRET) throw new Error('Configure SESSION_SECRET ou BACKUP_ENCRYPTION_KEY antes de criar backups.');
  return createHash('sha256').update(`soso-backup-v1:${ENCRYPTION_SECRET}`).digest();
}
function criptografar(flat){
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chaveCriptografia(), iv);
  const conteudo = Buffer.from(JSON.stringify(flat || []), 'utf8');
  const cifrado = Buffer.concat([cipher.update(conteudo), cipher.final()]);
  return {
    __t: 'encrypted-hash', alg: 'aes-256-gcm',
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
    data: cifrado.toString('base64')
  };
}
function descriptografar(item){
  if(!item || item.__t !== 'encrypted-hash' || item.alg !== 'aes-256-gcm') throw new Error('Hash de conta criptografado em formato inválido.');
  const decipher = createDecipheriv('aes-256-gcm', chaveCriptografia(), Buffer.from(item.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(item.tag, 'base64'));
  const texto = Buffer.concat([decipher.update(Buffer.from(item.data, 'base64')), decipher.final()]).toString('utf8');
  const flat = JSON.parse(texto);
  if(!Array.isArray(flat) || flat.length % 2 !== 0) throw new Error('Hash de conta inválido após descriptografar.');
  return flat;
}

async function scan(pattern){
  let cursor = '0';
  const encontrados = new Set();
  for(let i = 0; i < 1000; i++){
    const [resposta] = await redis([['SCAN', cursor, 'MATCH', pattern, 'COUNT', '200']]);
    if(!Array.isArray(resposta) || resposta.length < 2) break;
    cursor = String(resposta[0]);
    if(Array.isArray(resposta[1])) resposta[1].forEach(k => encontrados.add(String(k)));
    if(cursor === '0') break;
  }
  return [...encontrados];
}
function paresEmLotes(flat, tamanho = 250){
  const comandos = [];
  for(let i = 0; i < flat.length; i += tamanho * 2){
    const parte = flat.slice(i, i + tamanho * 2);
    if(parte.length) comandos.push(parte);
  }
  return comandos;
}
async function executarLotes(comandos, tamanho = 80){
  for(let i = 0; i < comandos.length; i += tamanho) await redis(comandos.slice(i, i + tamanho));
}

async function listarBackups(){
  const [flat] = await redis([['LRANGE', INDEX_KEY, '0', '-1']]);
  const backups = [];
  for(const item of (flat || [])){
    try {
      const meta = JSON.parse(item);
      const [existe] = await redis([['EXISTS', BACKUP_PREFIX + meta.id]]);
      if(Number(existe) === 1) backups.push(meta);
    } catch(_) {}
  }
  return backups.sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
}

async function criarBackup(criadoPor){
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '_' + randomUUID().slice(0, 8);
  // Inclui todos os ciclos de votação, não apenas o ciclo atual.
  // Assim, uma restauração recupera também o histórico que ainda está no Redis.
  const hashes = [...new Set([
    ...HASHES_FIXOS,
    ...await scan('votos:[0-9]*'),
    ...await scan('votos_usuarios:[0-9]*'),
    ...await scan('activity:*')
  ])];
  const [textos, ...resto] = await Promise.all([
    redis(KEYS_PARA_BACKUP.map(k => ['GET', k])),
    ...hashes.map(k => redis([['HGETALL', k]])),
    ...LISTAS_FIXAS.map(k => redis([['LRANGE', k, '0', '-1']]))
  ]);
  const dados = {};
  KEYS_PARA_BACKUP.forEach((k, i) => { dados[k] = textos[i] ?? null; });
  hashes.forEach((k, i) => {
    const flat = resto[i]?.[0];
    if(!Array.isArray(flat) || !flat.length){ dados[k] = null; return; }
    dados[k] = HASHES_SENSIVEIS.has(k) ? criptografar(flat) : { __t: 'hash', v: flat };
  });
  LISTAS_FIXAS.forEach((k, i) => {
    const flat = resto[hashes.length + i]?.[0];
    dados[k] = Array.isArray(flat) ? { __t: 'list', v: flat } : null;
  });

  const criadoEm = Date.now();
  const pacote = { versao: 2, id, criadoEm, criadoPor: criadoPor || 'sistema', chaves: dados };
  const json = JSON.stringify(pacote);
  const tamanho = Buffer.byteLength(json, 'utf8');
  await redis([['SET', BACKUP_PREFIX + id, json]]);
  const meta = JSON.stringify({ id, criadoEm, criadoPor: criadoPor || 'sistema', tamanho, versao: 2 });
  await redis([['LPUSH', INDEX_KEY, meta]]);

  const [total] = await redis([['LLEN', INDEX_KEY]]);
  if(Number(total) > MAX_BACKUPS){
    const [sobrando] = await redis([['LRANGE', INDEX_KEY, String(MAX_BACKUPS), '-1']]);
    const apagar = [];
    for(const item of (sobrando || [])){
      try { const metaAntiga = JSON.parse(item); apagar.push(BACKUP_PREFIX + metaAntiga.id); } catch(_) {}
    }
    if(apagar.length) await executarLotes(apagar.map(k => ['DEL', k]), 100);
    await redis([['LTRIM', INDEX_KEY, '0', String(MAX_BACKUPS - 1)]]);
  }
  return { id, tamanho };
}

async function restaurarBackup(id, quem){
  if(!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) throw new Error('Identificador de backup inválido.');
  const [raw] = await redis([['GET', BACKUP_PREFIX + id]]);
  if(!raw) throw new Error('Backup não encontrado.');
  let pacote;
  try { pacote = JSON.parse(raw); } catch(_) { throw new Error('Backup corrompido.'); }
  const chaves = pacote?.chaves;
  if(!chaves || typeof chaves !== 'object') throw new Error('Este backup não contém uma lista válida de dados.');

  // Primeiro valida/descriptografa tudo. Assim, uma senha errada não deixa o Redis pela metade.
  const hashesProntos = new Map();
  for(const [k, valor] of Object.entries(chaves)){
    if(!valor || typeof valor !== 'object') continue;
    if(valor.__t === 'encrypted-hash') hashesProntos.set(k, descriptografar(valor));
    else if(valor.__t === 'hash' && Array.isArray(valor.v)) hashesProntos.set(k, valor.v);
  }

  const comandos = [];
  let total = 0;
  for(const k of KEYS_PARA_BACKUP){
    if(!(k in chaves)) continue; // backups antigos não apagam itens que não conheciam
    const valor = chaves[k];
    comandos.push(valor === null || valor === undefined ? ['DEL', k] : ['SET', k, String(valor)]);
    total++;
  }
  const permitidos = new Set([...HASHES_FIXOS, ...LISTAS_FIXAS]);
  // Hashes fixos que aparecem como null no backup representam hashes vazios
  // naquela data. Backups antigos sem a chave não apagam dados atuais.
  for(const k of HASHES_FIXOS){
    if(Object.prototype.hasOwnProperty.call(chaves, k) && chaves[k] == null){
      comandos.push(['DEL', k]);
      total++;
    }
  }
  for(const k of Object.keys(chaves)){
    if(/^activity:[a-zA-Z0-9_-]+$/.test(k) || /^votos(?:_usuarios)?:\d+$/.test(k)){
      if(chaves[k] == null){ comandos.push(['DEL', k]); total++; }
    }
  }
  for(const [k, flat] of hashesProntos){
    if(!permitidos.has(k) && !/^activity:[a-zA-Z0-9_-]+$/.test(k) && !/^votos(?:_usuarios)?:\d+$/.test(k)) continue;
    if(!HASHES_FIXOS.includes(k) && !/^activity:/.test(k) && !/^votos/.test(k)) continue;
    comandos.push(['DEL', k]);
    for(const parte of paresEmLotes(flat)) comandos.push(['HSET', k, ...parte]);
    total++;
  }
  // Ao restaurar um retrato antigo, também removemos atividades criadas depois
  // dele, para o resultado não misturar dados de duas datas diferentes.
  const atividadesBackup = new Set(Object.keys(chaves).filter(k => /^activity:[a-zA-Z0-9_-]+$/.test(k)));
  const atividadesAtuais = await scan('activity:*');
  const atividadesExtras = atividadesAtuais.filter(k => !atividadesBackup.has(k));
  for(let i = 0; i < atividadesExtras.length; i += 100){
    comandos.push(['DEL', ...atividadesExtras.slice(i, i + 100)]);
  }
  // Não deixe ciclos de votação posteriores ao backup misturados na restauração.
  const votosBackup = new Set(Object.keys(chaves).filter(k => /^votos(?:_usuarios)?:[0-9]+$/.test(k)));
  const votosAtuais = [...await scan('votos:[0-9]*'), ...await scan('votos_usuarios:[0-9]*')];
  const votosExtras = votosAtuais.filter(k => !votosBackup.has(k));
  for(let i = 0; i < votosExtras.length; i += 100){
    comandos.push(['DEL', ...votosExtras.slice(i, i + 100)]);
  }
  for(const k of LISTAS_FIXAS){
    if(!Object.prototype.hasOwnProperty.call(chaves, k)) continue;
    const valor = chaves[k];
    comandos.push(['DEL', k]);
    if(valor && valor.__t === 'list' && Array.isArray(valor.v)){
      for(let i = 0; i < valor.v.length; i += 200) comandos.push(['RPUSH', k, ...valor.v.slice(i, i + 200)]);
    }
    total++;
  }
  await executarLotes(comandos, 50);
  try {
    const log = JSON.stringify({ quem: quem || 'admin', cargo: null, acao: `Restaurou backup ${id} (${total} chaves)`, ts: Date.now() });
    await redis([['LPUSH', 'admin:logs', log], ['LTRIM', 'admin:logs', '0', '199']]);
  } catch(_) {}
  return { total };
}

async function apagarBackup(id){
  if(!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) throw new Error('Identificador de backup inválido.');
  await redis([['DEL', BACKUP_PREFIX + id]]);
  const [flat] = await redis([['LRANGE', INDEX_KEY, '0', '-1']]);
  const restantes = [];
  for(const item of (flat || [])){
    try { const meta = JSON.parse(item); if(meta.id !== id) restantes.push(item); } catch(_) {}
  }
  const comandos = [['DEL', INDEX_KEY]];
  for(let i = restantes.length - 1; i >= 0; i--) comandos.push(['RPUSH', INDEX_KEY, restantes[i]]);
  await executarLotes(comandos, 100);
  return { ok: true };
}

export default async function handler(req, res){
  if(!ENV.URL || !ENV.TOKEN) return res.status(500).json({ error: 'Banco não configurado.' });
  const action = req.query?.action || '';
  if(req.method === 'POST' && !origemOk(req)) return res.status(403).json({ error: 'Origem inválida.' });

  if(action === 'cron'){
    if(!CRON_SECRET) return res.status(500).json({ error: 'CRON_SECRET não configurado.' });
    const auth = req.headers.authorization || '';
    const a = Buffer.from(auth), b = Buffer.from(`Bearer ${CRON_SECRET}`);
    if(a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Não autorizado.' });
    try { return res.status(200).json({ ok: true, ...(await criarBackup('cron')) }); }
    catch(error){ console.error('[Backup cron]', error?.message || error); return res.status(500).json({ error: error?.message || 'Erro ao criar backup.' }); }
  }

  const sessao = await validarSessao(req);
  if(!sessao?.id) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  const cargo = await cargoDe(sessao.id, sessao.email || '');
  if(!['dev', 'dono', 'administrador'].includes(cargo)) return res.status(403).json({ error: 'Somente a administração pode acessar os backups.' });
  res.setHeader('Cache-Control', 'no-store');

  try {
    if(req.method === 'GET' && action === 'list') return res.status(200).json({ backups: await listarBackups() });
    if(req.method === 'GET' && action === 'download'){
      const id = String(req.query?.id || '').trim();
      if(!/^[a-zA-Z0-9_-]{10,100}$/.test(id)) return res.status(400).json({ error: 'Identificador inválido.' });
      const [raw] = await redis([['GET', BACKUP_PREFIX + id]]);
      if(!raw) return res.status(404).json({ error: 'Backup não encontrado.' });
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="backup-${id}.json"`);
      return res.status(200).send(raw);
    }
    if(req.method === 'POST'){
      if(req.body?.action === 'create') return res.status(200).json({ ok: true, ...(await criarBackup(sessao.username || 'admin')) });
      if(req.body?.action === 'restore'){
        const id = String(req.body?.id || '').trim();
        if(!id) return res.status(400).json({ error: 'Informe o backup.' });
        return res.status(200).json({ ok: true, ...(await restaurarBackup(id, sessao.username || 'admin')) });
      }
      if(req.body?.action === 'delete'){
        const id = String(req.body?.id || '').trim();
        if(!id) return res.status(400).json({ error: 'Informe o backup.' });
        return res.status(200).json(await apagarBackup(id));
      }
    }
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch(error){
    console.error('[Backup]', error?.message || error);
    return res.status(500).json({ error: error?.message || 'Erro ao processar backup.' });
  }
}
