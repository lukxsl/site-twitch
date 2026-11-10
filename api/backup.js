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
  'tierlist:jogos', 'tierlist:filmes', 'tierlist:animes', 'tierlist:seedFeito',
  'votos:config', 'votos:ciclo_atual', 'config:aviso', 'config:donate',
  'config:manutencao', 'config:recado', 'config:horasMes', 'config:updatedAt',
  'config:top3', 'config:hall', 'config:metas', 'config:permissoes',
  'config:votosFechamento', 'setup:data', 'setup:sonhos', 'lives:count', 'live:atual'
];
const HASHES_SENSIVEIS = new Set([
  'accounts', 'usernames', 'email_idx', 'google_idx', 'google_email_idx', 'twitch_idx',
  'admins', 'user_profiles', 'banidos'
]);
const HASHES_FIXOS = [...HASHES_SENSIVEIS];
const LISTAS_FIXAS = ['sugestoes:lista'];
const ZSETS_FIXOS = ['rank:xp'];

function chaveCriptografia(){
  if(!ENCRYPTION_SECRET) throw new Error('Configure SESSION_SECRET ou BACKUP_ENCRYPTION_KEY antes de criar backups.');
  return createHash('sha256').update(`soso-backup-v1:${ENCRYPTION_SECRET}`).digest();
}
function criptografar(flat, tipo = 'encrypted-hash'){
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', chaveCriptografia(), iv);
  const conteudo = Buffer.from(JSON.stringify(flat || []), 'utf8');
  const cifrado = Buffer.concat([cipher.update(conteudo), cipher.final()]);
  return {
    __t: tipo, alg: 'aes-256-gcm',
    iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'),
    data: cifrado.toString('base64')
  };
}
function descriptografar(item){
  if(!item || !['encrypted-hash','encrypted-list'].includes(item.__t) || item.alg !== 'aes-256-gcm') throw new Error('Conteúdo criptografado em formato inválido.');
  const decipher = createDecipheriv('aes-256-gcm', chaveCriptografia(), Buffer.from(item.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(item.tag, 'base64'));
  const texto = Buffer.concat([decipher.update(Buffer.from(item.data, 'base64')), decipher.final()]).toString('utf8');
  const flat = JSON.parse(texto);
  if(!Array.isArray(flat)) throw new Error('Conteúdo inválido após descriptografar.');
  if(item.__t === 'encrypted-hash' && flat.length % 2 !== 0) throw new Error('Hash inválido após descriptografar.');
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

async function criarBackup(criadoPor, preservarId = null){
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '_' + randomUUID().slice(0, 8);
  // Snapshot inclui perfil, economia, atividade, votação e marcadores de idempotência.
  const hashes = [...new Set([
    ...HASHES_FIXOS,
    ...await scan('votos:[0-9]*'),
    ...await scan('votos_usuarios:[0-9]*'),
    ...await scan('activity:*'),
    ...await scan('g:*'),
    ...await scan('att:*'),
    ...((await scan('pres:*')).filter(k => /^pres:[0-9]+$/.test(k)))
  ])];
  const strings = [...new Set([
    ...KEYS_PARA_BACKUP,
    ...await scan('xpev:*'),
    ...await scan('xpdia:*'),
    ...await scan('pres:tick:*')
  ])];

  const dados = {};
  const lerEmLotes = async (keys, comando, tamanho = 40) => {
    const resultados = [];
    for(let i = 0; i < keys.length; i += tamanho){
      const lote = keys.slice(i, i + tamanho);
      const retorno = await redis(lote.map(k => [comando, k]));
      resultados.push(...retorno);
    }
    return resultados;
  };

  const [textos, hashRows, listaRows, zsetRows] = await Promise.all([
    lerEmLotes(strings, 'GET'),
    lerEmLotes(hashes, 'HGETALL'),
    Promise.all(LISTAS_FIXAS.map(k => redis([['LRANGE', k, '0', '-1']]))),
    Promise.all(ZSETS_FIXOS.map(k => redis([['ZRANGE', k, '0', '-1', 'WITHSCORES']])))
  ]);

  strings.forEach((k, i) => { dados[k] = textos[i] ?? null; });
  hashes.forEach((k, i) => {
    const flat = hashRows[i];
    if(!Array.isArray(flat) || !flat.length){ dados[k] = null; return; }
    const sensivel = HASHES_SENSIVEIS.has(k) || /^(g|activity|att|pres|votos_usuarios):/.test(k);
    dados[k] = sensivel ? criptografar(flat) : { __t: 'hash', v: flat };
  });
  LISTAS_FIXAS.forEach((k, i) => {
    const flat = listaRows[i]?.[0];
    dados[k] = Array.isArray(flat) ? criptografar(flat, 'encrypted-list') : null;
  });
  ZSETS_FIXOS.forEach((k, i) => {
    const flat = zsetRows[i]?.[0];
    dados[k] = Array.isArray(flat) && flat.length ? { __t: 'zset', v: flat } : null;
  });

  const criadoEm = Date.now();
  const pacote = { versao: 3, id, criadoEm, criadoPor: criadoPor || 'sistema', chaves: dados };
  const json = JSON.stringify(pacote);
  const tamanho = Buffer.byteLength(json, 'utf8');
  await redis([['SET', BACKUP_PREFIX + id, json]]);
  const meta = JSON.stringify({ id, criadoEm, criadoPor: criadoPor || 'sistema', tamanho, versao: 3 });
  await redis([['LPUSH', INDEX_KEY, meta]]);

  const [total] = await redis([['LLEN', INDEX_KEY]]);
  if(Number(total) > MAX_BACKUPS){
    const [sobrando] = await redis([['LRANGE', INDEX_KEY, String(MAX_BACKUPS), '-1']]);
    const apagar = [];
    const preservarMeta = [];
    for(const item of (sobrando || [])){
      try {
        const metaAntiga = JSON.parse(item);
        if(preservarId && metaAntiga.id === preservarId) preservarMeta.push(item);
        else apagar.push(BACKUP_PREFIX + metaAntiga.id);
      } catch(_) {}
    }
    if(apagar.length) await executarLotes(apagar.map(k => ['DEL', k]), 100);
    await redis([['LTRIM', INDEX_KEY, '0', String(MAX_BACKUPS - 1)]]);
    // Uma restauração pode apontar justamente para o backup mais antigo.
    // Mantemos esse arquivo e sua referência até a restauração terminar.
    if(preservarMeta.length) await redis(preservarMeta.map(item => ['RPUSH', INDEX_KEY, item]));
  }
  return { id, tamanho, versao: 3 };
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
  const listasProntas = new Map();
  const zsetsProntos = new Map();
  for(const [k, valor] of Object.entries(chaves)){
    if(!valor || typeof valor !== 'object') continue;
    if(valor.__t === 'encrypted-hash') hashesProntos.set(k, descriptografar(valor));
    else if(valor.__t === 'encrypted-list') listasProntas.set(k, descriptografar(valor));
    else if(valor.__t === 'hash' && Array.isArray(valor.v)) hashesProntos.set(k, valor.v);
    else if(valor.__t === 'zset' && Array.isArray(valor.v) && valor.v.length % 2 === 0) zsetsProntos.set(k, valor.v);
  }

  const comandos = [];
  let total = 0;
  for(const k of KEYS_PARA_BACKUP){
    if(!(k in chaves)) continue; // backups antigos não apagam itens que não conheciam
    const valor = chaves[k];
    comandos.push(valor === null || valor === undefined ? ['DEL', k] : ['SET', k, String(valor)]);
    total++;
  }
  const permitidos = new Set([...HASHES_FIXOS, ...LISTAS_FIXAS, ...ZSETS_FIXOS]);
  // Hashes fixos que aparecem como null no backup representam hashes vazios
  // naquela data. Backups antigos sem a chave não apagam dados atuais.
  for(const k of HASHES_FIXOS){
    if(Object.prototype.hasOwnProperty.call(chaves, k) && chaves[k] == null){
      comandos.push(['DEL', k]);
      total++;
    }
  }
  for(const k of Object.keys(chaves)){
    if(/^activity:[a-zA-Z0-9_-]+$/.test(k) || /^g:[a-zA-Z0-9_-]+$/.test(k) || /^att:\d+$/.test(k) || /^pres:[0-9]+$/.test(k) || /^votos(?:_usuarios)?:\d+$/.test(k)){
      if(chaves[k] == null){ comandos.push(['DEL', k]); total++; }
    }
  }
  for(const [k, flat] of hashesProntos){
    if(!permitidos.has(k) && !/^(activity|g):[a-zA-Z0-9_-]+$/.test(k) && !/^att:\d+$/.test(k) && !/^pres:[0-9]+$/.test(k) && !/^votos(?:_usuarios)?:\d+$/.test(k)) continue;
    if(!HASHES_FIXOS.includes(k) && !/^(activity|g):/.test(k) && !/^att:/.test(k) && !/^pres:[0-9]+$/.test(k) && !/^votos/.test(k)) continue;
    comandos.push(['DEL', k]);
    for(const parte of paresEmLotes(flat)) comandos.push(['HSET', k, ...parte]);
    if(/^pres:[0-9]+$/.test(k)) comandos.push(['EXPIRE', k, '259200']);
    if(/^att:[0-9]+$/.test(k)) comandos.push(['EXPIRE', k, '34560000']);
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
  if(Number(pacote.versao) >= 3){
    const gruposBackup = new Set(Object.keys(chaves).filter(k => /^g:[a-zA-Z0-9_-]+$/.test(k)));
    const gruposAtuais = await scan('g:*');
    const gruposExtras = gruposAtuais.filter(k => !gruposBackup.has(k));
    for(let i = 0; i < gruposExtras.length; i += 100) comandos.push(['DEL', ...gruposExtras.slice(i, i + 100)]);
    const presencasBackup = new Set(Object.keys(chaves).filter(k => /^att:\d+$/.test(k)));
    const sessoesPresencaBackup = new Set(Object.keys(chaves).filter(k => /^pres:[0-9]+$/.test(k)));
    const presencasAtuais = await scan('att:*');
    const presencasExtras = presencasAtuais.filter(k => !presencasBackup.has(k));
    for(let i = 0; i < presencasExtras.length; i += 100) comandos.push(['DEL', ...presencasExtras.slice(i, i + 100)]);
    const sessoesPresencaAtuais = (await scan('pres:*')).filter(k => /^pres:[0-9]+$/.test(k));
    const sessoesPresencaExtras = sessoesPresencaAtuais.filter(k => !sessoesPresencaBackup.has(k));
    for(let i = 0; i < sessoesPresencaExtras.length; i += 100) comandos.push(['DEL', ...sessoesPresencaExtras.slice(i, i + 100)]);
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
    const itens = listasProntas.get(k) || (valor && valor.__t === 'list' && Array.isArray(valor.v) ? valor.v : null);
    if(Array.isArray(itens)){
      for(let i = 0; i < itens.length; i += 200) comandos.push(['RPUSH', k, ...itens.slice(i, i + 200)]);
    }
    total++;
  }
  for(const k of ZSETS_FIXOS){
    if(!Object.prototype.hasOwnProperty.call(chaves, k)) continue;
    const valor = chaves[k];
    comandos.push(['DEL', k]);
    const flat = zsetsProntos.get(k);
    if(flat?.length){
      for(let i = 0; i < flat.length; i += 200){
        const loteRaw = flat.slice(i, i + 200);
        if(loteRaw.length % 2 === 0){
          const pares = [];
          for(let j = 0; j < loteRaw.length; j += 2) pares.push(loteRaw[j + 1], loteRaw[j]);
          comandos.push(['ZADD', k, ...pares]);
        }
      }
    }
    total++;
  }
  // Preserva marcadores de recompensa para impedir crédito duplicado após restore.
  // Os que existem hoje e não estavam no snapshot não são apagados.
  for(const [k, valor] of Object.entries(chaves)){
    if(!/^xpev:[a-zA-Z0-9:_-]+$/.test(k) && !/^xpdia:[a-zA-Z0-9:_-]+$/.test(k) && !/^pres:tick:[a-zA-Z0-9:_-]+$/.test(k)) continue;
    if(typeof valor !== 'string' || valor === '') continue;
    const ttl = k.startsWith('xpdia:') ? '172800' : (k.startsWith('pres:tick:') ? '3600' : '7776000');
    comandos.push(['SET', k, valor, 'EX', ttl, 'NX']);
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
    catch(error){ console.error('[Backup cron]', error?.message || error); return res.status(500).json({ error: 'Não foi possível criar o backup. Consulte os logs da função.' }); }
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
        if(cargo !== 'dev') return res.status(403).json({ error: 'Somente Dev pode restaurar um backup.' });
        const id = String(req.body?.id || '').trim();
        if(!id) return res.status(400).json({ error: 'Informe o backup.' });
        // Snapshot automático do estado atual antes de qualquer operação destrutiva.
        const seguranca = await criarBackup(`pre-restore:${sessao.username || 'dev'}`, id);
        const restaurado = await restaurarBackup(id, sessao.username || 'dev');
        return res.status(200).json({ ok: true, seguranca, ...restaurado });
      }
      if(req.body?.action === 'delete'){
        if(cargo !== 'dev') return res.status(403).json({ error: 'Somente Dev pode excluir um backup.' });
        const id = String(req.body?.id || '').trim();
        if(!id) return res.status(400).json({ error: 'Informe o backup.' });
        return res.status(200).json(await apagarBackup(id));
      }
    }
    return res.status(400).json({ error: 'Ação inválida.' });
  } catch(error){
    console.error('[Backup]', error?.message || error);
    return res.status(500).json({ error: 'Não foi possível processar o backup. Consulte os logs da função.' });
  }
}
