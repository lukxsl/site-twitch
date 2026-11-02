// api/_lib/game-api.js — rotas do jogo expostas por /api/game (rewrite) e /api/auth (delegação).
// Leitura do estado do jogo + ações que o usuário pode pedir (todas validadas aqui).
//
//   GET  /api/game?action=catalogo          (público)  catálogo, raridades, conquistas, títulos, regras
//   GET  /api/game?action=ranking           (público)  Top 50 com boneco
//   GET  /api/game?action=perfil            (logado)   tudo do jogador + posição no ranking
//   POST /api/game?action=resgatar          {codigo}   código secreto
//   POST /api/game?action=comprar           {slot,id}  item de loja (SosoCoins)
//   POST /api/game?action=titulo            {id}       equipa título
//   POST /api/game?action=notif-lidas
//   GET  /api/game?action=cron-presenca     (Bearer CRON_SECRET)  tempo de tela / streak
//
// ⚠️ NÃO EXISTE rota "ganhar XP" aqui. XP/moedas só mudam via _lib/game.js (servidor).
import { timingSafeEqual } from 'crypto';
import {
  ENV, redis, paraObj, jparse, rateLimit, ipDe, origemOk, lerSessao, cargoDe, safeStr, hojeBR
} from './core.js';
import {
  MOEDA, RARIDADES, CONQUISTAS, PLATINA, TITULOS, SLOTS, LIVE, BONECO_PADRAO, NIVEL_MAX,
  catalogoPublico, acharItem, precoDe, infoNivel, lerStats, contarItens, itemLiberado, titulosDe,
  validarBoneco, creditar, notificar, lerNotificacoes, avaliarConquistas, xpDoNivel, CATALOGO, VERSAO_CONQUISTAS
} from './game.js';
import { cronPresenca } from './twitch.js';

/* sessão válida (para contas próprias confere a versão → senha trocada derruba o resto) */
async function sessaoValida(req){
  const s = lerSessao(req);
  if(!s) return null;
  if(s.tipo === 'own'){
    const [raw] = await redis([['HGET', 'accounts', String(s.id)]]);
    const c = jparse(raw);
    if(!c || c.sv !== s.sv) return null;
  }
  return s;
}

const REGRAS_PUBLICAS = {
  moeda: MOEDA, nivelMax: NIVEL_MAX,
  xp: [
    'Voto na votação: +10 XP · +5 moedas (até 3 por dia)',
    'Sugestão enviada: +5 XP · +2 moedas (até 3 por dia)',
    'Sugestão aprovada pela Soso: +60 XP · +30 moedas',
    `Cada minuto assistido na live: +1 XP · +1 moeda a cada 10 min (máx. ${LIVE.TETO_MIN_SESSAO / 60}h por live)`,
    `Live contada (≥ ${LIVE.MIN_PRESENCA} min): +${LIVE.XP_PRESENCA} XP + ${LIVE.XP_STREAK_POR_LIVE} XP × sua sequência`,
    'Códigos secretos falados na live: XP, moedas ou itens',
    'Cada nível novo: +20 moedas'
  ],
  streak: {
    texto: `Sequência = lives CONSECUTIVAS em que você ficou pelo menos ${LIVE.MIN_PRESENCA} min no chat. ` +
           'O servidor confere a Twitch a cada 5 minutos (live no ar + lista de quem está no chat) e só conta contas com Twitch vinculada. ' +
           'Perdeu uma live válida → a sequência volta a 1. Lives com menos de 30 min no ar não contam para ninguém.',
    marcos: LIVE.MARCOS_STREAK
  },
  tempoDeTela: 'O tempo de tela é medido pelo servidor, nunca pelo navegador. Vincule sua Twitch (OAuth) para ele ser creditado.'
};

function conquistasPublicas(){
  return [...CONQUISTAS, PLATINA].map(c => ({
    id: c.id, icone: c.icone, nome: c.nome, desc: c.desc, r: c.r,
    premio: c.premio, progresso: c.progresso || null
  }));
}

function valorProgresso(S, config){
  if(!config) return null;
  const camposEspeciais = {
    sempre: 1,
    bonecoSalvo: S.bonecoSalvo ? 1 : 0,
    twitch: S.twitch ? 1 : 0
  };
  const bruto = Object.prototype.hasOwnProperty.call(camposEspeciais, config.campo)
    ? camposEspeciais[config.campo]
    : Number(S[config.campo] || 0);
  return Math.max(0, Number(bruto) || 0);
}

const SE_BASE = 'https://api.streamelements.com/kappa/v2';
const SE_JWT = String(process.env.STREAMELEMENTS_JWT || '').trim();
const SE_PAGE_SIZE = 100;
// A API não documenta o tipo/unidade do campo numérico de watchtime em todas as versões.
// Configure STREAMELEMENTS_WATCHTIME_UNIT=minutes|seconds|milliseconds apenas se confirmar a unidade.
const SE_WATCHTIME_NUMERIC_UNIT = String(process.env.STREAMELEMENTS_WATCHTIME_UNIT || '').trim().toLowerCase();
let seChannelCache = { id: null, expiresAt: 0 };
let seDevCache = { data: null, expiresAt: 0 };
let twitchTokenCache = { token: null, expiresAt: 0 };

function rowsFrom(payload){
  if(Array.isArray(payload)) return payload;
  if(!payload || typeof payload !== 'object') return [];
  const nested = payload.data && typeof payload.data === 'object' ? payload.data : null;
  const options = [payload.docs,payload.results,payload.items,payload.users,payload.subscribers,payload.tips,payload.data,nested?.docs,nested?.results,nested?.items,nested?.users,nested?.subscribers,nested?.tips];
  return options.find(Array.isArray) || [];
}
function totalFrom(payload){
  for(const v of [payload?.total,payload?.totalDocs,payload?.total_count,payload?.count,payload?.meta?.total,payload?.pagination?.total]){
    const n=Number(v); if(Number.isFinite(n)&&n>=0) return n;
  }
  return null;
}
async function seFetch(path){
  if(!SE_JWT) throw new Error('STREAMELEMENTS_JWT não configurado na Vercel.');
  const response = await fetch(`${SE_BASE}${path.startsWith('/')?'':'/'}${path}`, {
    headers: { Authorization: `Bearer ${SE_JWT}`, Accept: 'application/json' }
  });
  const raw = await response.text();
  let data=null; try{data=raw?JSON.parse(raw):null;}catch{}
  if(!response.ok) throw new Error(`StreamElements HTTP ${response.status} em ${path}`);
  if(raw && data===null) throw new Error(`Resposta inválida do StreamElements em ${path}`);
  return data;
}
async function seChannelId(){
  if(seChannelCache.id && Date.now()<seChannelCache.expiresAt) return seChannelCache.id;
  const me=await seFetch('/channels/me');
  const id=me?._id || me?.id || me?.channel?._id;
  if(!id) throw new Error('O StreamElements não retornou o ID do canal em /channels/me.');
  seChannelCache={id:String(id),expiresAt:Date.now()+15*60*1000};
  return seChannelCache.id;
}
async function sePages(path, maxPages=20){
  const rows=[]; let complete=false, reportedTotal=null;
  for(let page=0;page<maxPages;page++){
    const offset=page*SE_PAGE_SIZE;
    const payload=await seFetch(`${path}${path.includes('?')?'&':'?'}limit=${SE_PAGE_SIZE}&offset=${offset}`);
    const batch=rowsFrom(payload); if(reportedTotal===null) reportedTotal=totalFrom(payload);
    rows.push(...batch);
    if(batch.length<SE_PAGE_SIZE || (reportedTotal!==null && rows.length>=reportedTotal)){complete=true;break;}
  }
  return {rows,complete,total:reportedTotal};
}
function durationMinutes(value){
  if(typeof value!=='string') return null;
  const text=value.toLowerCase().trim();
  // Formato de relógio HH:MM:SS ou MM:SS.
  const clock=text.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if(clock){
    const hours=Number(clock[1]||0),minutes=Number(clock[2]),seconds=Number(clock[3]);
    return hours*60+minutes+seconds/60;
  }
  // ISO-8601 simplificado: P[nD][T[nH][nM][nS]].
  const iso=text.match(/^p(?:(\d+(?:[.,]\d+)?)d)?(?:t(?:(\d+(?:[.,]\d+)?)h)?(?:(\d+(?:[.,]\d+)?)m)?(?:(\d+(?:[.,]\d+)?)s)?)?$/i);
  if(iso){const n=i=>Number(String(iso[i]||0).replace(',','.'));return n(1)*1440+n(2)*60+n(3)+n(4)/60;}
  const parts=[...text.matchAll(/(\d+(?:[.,]\d+)?)\s*(years?|yrs?|months?|days?|dias?|d|hours?|hrs?|horas?|h|minutes?|mins?|minutos?|m|seconds?|secs?|segundos?|s)/g)];
  if(!parts.length) return null;
  let minutes=0;
  for(const match of parts){
    const n=Number(match[1].replace(',','.')); const unit=match[2];
    if(/year|yr/.test(unit)) minutes+=n*365*24*60;
    else if(/month/.test(unit)) minutes+=n*30*24*60;
    else if(/day|dia|^d$/.test(unit)) minutes+=n*24*60;
    else if(/hour|hr|hora|^h$/.test(unit)) minutes+=n*60;
    else if(/min|^m$/.test(unit)) minutes+=n;
    else minutes+=n/60;
  }
  return minutes;
}
function numericWatchtimeMinutes(value){
  const n=Number(value); if(!Number.isFinite(n)||n<0||!SE_WATCHTIME_NUMERIC_UNIT) return null;
  if(SE_WATCHTIME_NUMERIC_UNIT==='minutes') return n;
  if(SE_WATCHTIME_NUMERIC_UNIT==='seconds') return n/60;
  if(SE_WATCHTIME_NUMERIC_UNIT==='milliseconds') return n/60000;
  return null;
}
function watchtimeMinutes(row){
  if(!row || typeof row!=='object') return null;
  for(const key of ['minutes','watchtimeMinutes','watchTimeMinutes','timeOnlineMinutes','time_online_minutes']){
    const n=Number(row[key]); if(Number.isFinite(n)&&n>=0) return n;
  }
  for(const key of ['watchtime','watchTime','time_online','timeOnline','time']){
    const value=row[key];
    const parsed=durationMinutes(value); if(parsed!==null) return parsed;
    if(typeof value==='number'){const numeric=numericWatchtimeMinutes(value);if(numeric!==null)return numeric;}
    if(value && typeof value==='object'){
      const days=Number(value.days||0),hours=Number(value.hours||0),mins=Number(value.minutes||0),secs=Number(value.seconds||0);
      if([days,hours,mins,secs].every(Number.isFinite)) return days*1440+hours*60+mins+secs/60;
    }
  }
  return null;
}
function usernameFrom(row){return String(row?.username||row?.userName||row?.displayName||row?.name||row?.user?.username||row?.user?.name||'').trim();}
function subscriberIsActive(row){
  if(!row||typeof row!=='object') return false;
  if(row.active===false||row.isActive===false||row.subscribed===false||row.isSubscriber===false) return false;
  const status=String(row.status||row.subscription?.status||row.subscriptionStatus||'').toLowerCase();
  return !['inactive','expired','ended','cancelled','canceled','revoked','unsubscribed'].includes(status);
}
function timestampMs(value){
  if(typeof value==='number'&&Number.isFinite(value))return value<1e12?value*1000:value;
  const parsed=Date.parse(value||'');return Number.isFinite(parsed)?parsed:NaN;
}
function inicioDoMesSaoPaulo(){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const year=Number(parts.find(p=>p.type==='year')?.value),month=Number(parts.find(p=>p.type==='month')?.value);
  return Date.UTC(year,month-1,1,3,0,0,0);
}
function quantile(values,q){
  if(!values.length) return null;
  const sorted=[...values].sort((a,b)=>a-b); const index=(sorted.length-1)*q; const lo=Math.floor(index),hi=Math.ceil(index);
  return sorted[lo]+(sorted[hi]-sorted[lo])*(index-lo);
}
function summary(values){
  const data=values.filter(v=>Number.isFinite(v)&&v>=0);
  if(!data.length) return {count:0,mean:null,p25:null,median:null,p75:null,p90:null,min:null,max:null};
  return {count:data.length,mean:data.reduce((a,b)=>a+b,0)/data.length,p25:quantile(data,.25),median:quantile(data,.5),p75:quantile(data,.75),p90:quantile(data,.9),min:Math.min(...data),max:Math.max(...data)};
}
function roundSummary(input,divisor=1){
  const out={...input};
  for(const k of ['mean','p25','median','p75','p90','min','max']){
    const value=input?.[k];
    out[k]=value==null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value)/divisor*10)/10;
  }
  return out;
}
async function arcadeCommunitySample(){
  const [totalRaw]=await redis([['ZCARD','rank:xp']]); const total=Number(totalRaw||0);
  if(!total) return {players:0,sampleSize:0,complete:true,stats:{hours:summary([]),lives:summary([]),votes:summary([]),suggestions:summary([])}};
  const sampleSize=Math.min(total,200), offsets=[];
  if(total<=sampleSize){for(let i=0;i<total;i++) offsets.push(i);}else{
    for(let i=0;i<sampleSize;i++) offsets.push(Math.floor(i*(total-1)/(sampleSize-1)));
  }
  const idPages=await redis(offsets.map(n=>['ZRANGE','rank:xp',String(n),String(n)]));
  const ids=[...new Set((idPages||[]).flat().filter(Boolean))];
  if(!ids.length) return {players:total,sampleSize:0,complete:total===0,stats:{hours:summary([]),lives:summary([]),votes:summary([]),suggestions:summary([])}};
  const values=await redis(ids.map(id=>['HMGET',`g:${id}`,'minutos','lives','votos','sugestoes_env','sugestoes']));
  const stats={hours:[],lives:[],votes:[],suggestions:[],approvedSuggestions:[]};
  values.forEach(row=>{
    const minutes=Number(row?.[0]||0); stats.hours.push(Math.max(0,minutes/60));
    stats.lives.push(Number(row?.[1]||0)); stats.votes.push(Number(row?.[2]||0));
    stats.suggestions.push(Number(row?.[3]||0)); stats.approvedSuggestions.push(Number(row?.[4]||0));
  });
  return {players:total,sampleSize:ids.length,complete:ids.length===total,sampling:'amostra estratificada por posição no ranking de XP',stats:Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,summary(v)]))};
}
async function twitchLiveStatus(){
  const clientId=String(process.env.TWITCH_CLIENT_ID||'').trim();
  const clientSecret=String(process.env.TWITCH_CLIENT_SECRET||'').trim();
  if(!clientId||!clientSecret) return {configured:false,online:null,error:'TWITCH_CLIENT_ID/TWITCH_CLIENT_SECRET não configurados.'};
  try{
    if(!twitchTokenCache.token || Date.now()>=twitchTokenCache.expiresAt){
      const response=await fetch('https://id.twitch.tv/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,grant_type:'client_credentials'})});
      const tokenData=await response.json(); if(!response.ok||!tokenData.access_token) throw new Error('Não foi possível obter token de aplicação da Twitch.');
      twitchTokenCache={token:tokenData.access_token,expiresAt:Date.now()+Math.max(60,Number(tokenData.expires_in||3600)-60)*1000};
    }
    const headers={'Client-ID':clientId,Authorization:`Bearer ${twitchTokenCache.token}`};
    const userRes=await fetch('https://api.twitch.tv/helix/users?login=asemtet0',{headers}); const userData=await userRes.json();
    const userId=userData?.data?.[0]?.id; if(!userRes.ok||!userId) throw new Error('Canal asemtet0 não encontrado na Twitch.');
    const streamRes=await fetch(`https://api.twitch.tv/helix/streams?user_id=${encodeURIComponent(userId)}`,{headers});
    const streamData=await streamRes.json(); if(!streamRes.ok) throw new Error('Não foi possível consultar o status da live.');
    const stream=streamData?.data?.[0]||null;
    return {configured:true,online:!!stream,viewers:stream?Number(stream.viewer_count||0):0,title:stream?.title||null,game:stream?.game_name||null,startedAt:stream?.started_at||null};
  }catch(e){return {configured:true,online:null,error:e.message||'Falha ao consultar a Twitch.'};}
}
async function streamElementsInsights(){
  if(!SE_JWT) return {configured:false,error:'STREAMELEMENTS_JWT não configurado no ambiente da Vercel.'};
  const channelId=await seChannelId();
  const [watchResult,pointsResult,subsResult,tipsResult]=await Promise.allSettled([
    sePages(`/points/${encodeURIComponent(channelId)}/watchtime`,20),
    seFetch(`/points/${encodeURIComponent(channelId)}/top?limit=10&offset=0`),
    sePages(`/subscribers/${encodeURIComponent(channelId)}`,20),
    sePages(`/tips/${encodeURIComponent(channelId)}?sort=-createdAt`,20)
  ]);
  const watch=watchResult.status==='fulfilled'?watchResult.value:{rows:[],complete:false,total:null};
  const watchRows=watch.rows.map(row=>({nome:usernameFrom(row),minutos:watchtimeMinutes(row)}));
  const parsedWatch=watchRows.filter(row=>row.minutos!==null);
  const points=pointsResult.status==='fulfilled'?rowsFrom(pointsResult.value):[];
  const subsPage=subsResult.status==='fulfilled'?subsResult.value:{rows:[],complete:false,total:null};
  const tipsPage=tipsResult.status==='fulfilled'?tipsResult.value:{rows:[],complete:false,total:null};
  const tips=tipsPage.rows;
  const inicioMes=inicioDoMesSaoPaulo();
  const totalsByCurrency={}; let tipsMesCount=0;
  for(const tip of tips){
    const when=timestampMs(tip.createdAt||tip.created_at||tip.date||tip.timestamp);
    const amount=Number(tip?.donation?.amount??tip.amount??tip.value);
    const status=String(tip.status||tip?.donation?.status||'').toLowerCase();
    if(!Number.isFinite(when)||when<inicioMes||!Number.isFinite(amount)||amount<=0||['failed','rejected','refunded','chargeback','cancelled','canceled'].includes(status)) continue;
    const currency=String(tip?.donation?.currency||tip.currency||'?').toUpperCase();
    totalsByCurrency[currency]=(totalsByCurrency[currency]||0)+amount;tipsMesCount++;
  }
  const totalSubsApi=totalFrom(subsPage);
  const activeSubscribers=subsPage.rows.filter(subscriberIsActive).length;
  const watchValues=parsedWatch.map(row=>row.minutos);
  // A amostra revela nomes de campos e tipos, nunca e-mails/tokens/IDs do viewer.
  const watchShape=watch.rows.slice(0,3).map(row=>Object.fromEntries(Object.entries(row||{}).map(([key,value])=>[key,{
    type:Array.isArray(value)?'array':(value===null?'null':typeof value),
    // Só inclui amostras de campos temporais; nomes e identificadores são omitidos.
    sample:/(watch|time|minute|hour|duration|online)/i.test(key) && (typeof value==='string'||typeof value==='number') ? String(value).slice(0,32) : undefined
  }])));
  const pointsSorted=points.map(row=>({nome:usernameFrom(row)||'Viewer',points:Number(row.points??row.current??row.amount??row.pointsCurrent??0)}))
    .filter(row=>Number.isFinite(row.points)).sort((a,b)=>b.points-a.points);
  const watchSorted=parsedWatch.sort((a,b)=>b.minutos-a.minutos);
  return {
    configured:true,channelId,
    watchtime:{summary:roundSummary(summary(watchValues),60),sampled:parsedWatch.length,rowsReceived:watch.rows.length,complete:watch.complete,totalReported:watch.total,unparsed:watch.rows.length-parsedWatch.length,numericUnit:SE_WATCHTIME_NUMERIC_UNIT||null,fieldShapeSample:watchShape,leaderboard:watchSorted.slice(0,10).map((row,i)=>({pos:i+1,nome:row.nome||'Viewer',horas:Math.round(row.minutos/60*10)/10}))},
    points:{leaderboard:pointsSorted.slice(0,10).map((row,i)=>({pos:i+1,...row})),rowsReceived:points.length},
    subscribers:{activeTotal:subsPage.complete?activeSubscribers:null,activeInFetchedPages:activeSubscribers,sampleCount:subsPage.rows.length,complete:subsPage.complete,totalReported:totalSubsApi??subsPage.total},
    donations:{month:Object.entries(totalsByCurrency).map(([currency,total])=>({currency,total:Math.round(total*100)/100})),tipsInMonth:tipsMesCount,recordsFetched:tips.length,complete:tipsPage.complete,totalReported:tipsPage.total},
    errors:{watchtime:watchResult.status==='rejected'?String(watchResult.reason?.message||watchResult.reason):null,points:pointsResult.status==='rejected'?String(pointsResult.reason?.message||pointsResult.reason):null,subscribers:subsResult.status==='rejected'?String(subsResult.reason?.message||subsResult.reason):null,tips:tipsResult.status==='rejected'?String(tipsResult.reason?.message||tipsResult.reason):null}
  };
}
async function carregarDevInsights(){
  if(seDevCache.data && Date.now()<seDevCache.expiresAt) return {...seDevCache.data,cached:true};
  const [arcade,se,live]=await Promise.allSettled([arcadeCommunitySample(),streamElementsInsights(),twitchLiveStatus()]);
  const arcadeData=arcade.status==='fulfilled'?arcade.value:{error:String(arcade.reason?.message||arcade.reason)};
  const seData=se.status==='fulfilled'?se.value:{configured:!!SE_JWT,error:String(se.reason?.message||se.reason)};
  const liveData=live.status==='fulfilled'?live.value:{configured:false,online:null,error:String(live.reason?.message||live.reason)};
  const h=seData.watchtime?.summary;
  const recommended=h?.p25!=null?{entry:Math.max(5,Math.round(h.p25/5)*5),regular:Math.max(25,Math.round((h.median||0)/5)*5),loyal:Math.max(50,Math.round((h.p75||0)/5)*5),legendary:Math.max(100,Math.round((h.p90||0)/5)*5)}:null;
  const data={generatedAt:new Date().toISOString(),arcade:arcadeData,streamElements:seData,twitch:liveData,recommendation:{note:'Use como referência, não como alteração automática de metas.',hours:recommended}};
  seDevCache={data,expiresAt:Date.now()+5*60*1000}; return data;
}

export default async function handler(req, res){
  const action = (req.query && req.query.action) || '';

  try {
    /* ============ CRON (sem sessão; Bearer) ============ */
    if(action === 'cron-presenca'){
      const segredo = process.env.CRON_SECRET;
      if(!segredo) return res.status(500).json({ error: 'CRON_SECRET não configurado' });
      const a = Buffer.from(req.headers.authorization || ''), b = Buffer.from(`Bearer ${segredo}`);
      if(a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ error: 'Não autorizado' });
      return res.status(200).json(await cronPresenca());
    }

    /* ============ CATÁLOGO (público) ============ */
    if(action === 'catalogo'){
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
      return res.status(200).json({
        slots: SLOTS, padrao: BONECO_PADRAO, raridades: RARIDADES,
        catalogo: catalogoPublico(), conquistas: conquistasPublicas(),
        titulos: TITULOS.map(t => ({ id: t.id, nome: t.nome, r: t.r, regra: t.regra })),
        regras: REGRAS_PUBLICAS
      });
    }

    /* ============ RANKING (público) ============ */
    if(action === 'ranking'){
      res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=60');
      const limite = Math.min(100, Math.max(3, Number(req.query.limite) || 50));
      const [flat, total] = await redis([['ZREVRANGE', 'rank:xp', '0', String(limite - 1), 'WITHSCORES'], ['ZCARD', 'rank:xp']]);
      const ids = [], xps = [];
      for(let i = 0; i < (flat || []).length; i += 2){ ids.push(flat[i]); xps.push(Number(flat[i + 1])); }
      if(!ids.length) return res.status(200).json({ total: 0, lista: [] });

      const cmds = [['HMGET', 'accounts', ...ids], ['HMGET', 'user_profiles', ...ids]];
      ids.forEach(id => cmds.push(['HMGET', `g:${id}`, 'boneco', 'titulo', 'melhorStreak']));
      const [contas, perfis, ...gs] = await redis(cmds);

      const titulos = Object.fromEntries(TITULOS.map(t => [t.id, t.nome]));
      const lista = ids.map((id, i) => {
        const conta = jparse(contas[i]), perfil = jparse(perfis[i]);
        const [bruto, titulo] = gs[i];
        const nome = (conta && conta.nick) || (perfil && perfil.username) || 'Anônimo';
        const boneco = validarBoneco(jparse(bruto, BONECO_PADRAO), null, true).boneco;   // só saneia a estrutura
        return {
          pos: i + 1, id, nome, xp: xps[i], nivel: infoNivel(xps[i]).nivel,
          titulo: titulos[titulo] || 'Novato', boneco,
          avatar: (!conta && perfil && perfil.avatar) || null   // Discord legado sem boneco
        };
      });
      return res.status(200).json({ total: Number(total), lista });
    }

    /* As rotas públicas acima não dependem de assinatura de sessão.
       Só as rotas privadas exigem SESSION_SECRET. */
    if(!ENV.SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });

    /* ============ daqui pra baixo: precisa de login ============ */
    const sessao = await sessaoValida(req);
    if(!sessao) return res.status(401).json({ error: 'Faça login' });
    res.setHeader('Cache-Control', 'no-store');
    const id = String(sessao.id);
    const ehDev = (await cargoDe(id, sessao.email)) === 'dev';

    /* ============ DIAGNÓSTICO DA COMUNIDADE (somente DEV) ============ */
    if(action === 'dev-insights'){
      if(req.method !== 'GET') return res.status(405).json({error:'Método não permitido.'});
      if(!ehDev) return res.status(403).json({error:'Acesso restrito à equipe de desenvolvimento.'});
      res.setHeader('Cache-Control','no-store');
      return res.status(200).json(await carregarDevInsights());
    }

    /* ============ PERFIL ============ */
    if(action === 'perfil'){
      // Ao publicar novas conquistas, avalia uma vez o progresso acumulado dos jogadores antigos.
      const [versaoConquistas] = await redis([['HGET', `g:${id}`, 'versaoConquistas']]);
      if(String(versaoConquistas || '') !== VERSAO_CONQUISTAS){
        await avaliarConquistas(id);
        await redis([['HSET', `g:${id}`, 'versaoConquistas', VERSAO_CONQUISTAS]]);
      }
      const S = await lerStats(id);
      S.itens = contarItens(S);
      const [pos, total] = await redis([['ZREVRANK', 'rank:xp', id], ['ZCARD', 'rank:xp']]);
      const nv = infoNivel(S.xp);

      const liberados = {};
      SLOTS.forEach(slot => {
        liberados[slot] = CATALOGO[slot].filter(it => itemLiberado(slot, it, S, ehDev)).map(it => it.id);
      });

      const notifs = await lerNotificacoes(id);
      const conquistas = conquistasPublicas().map(c => ({ ...c, ts: S.ach[c.id] ? Number(S.ach[c.id]) : null, progressoAtual: valorProgresso(S, c.progresso) }));
      const feitas = conquistas.filter(c => c.ts && c.id !== PLATINA.id).length;

      // posições vizinhas (para o card "Sua Posição")
      let vizinhos = [];
      if(pos != null){
        const ini = Math.max(0, Number(pos) - 1), fim = Number(pos) + 1;
        const [f] = await redis([['ZREVRANGE', 'rank:xp', String(ini), String(fim), 'WITHSCORES']]);
        for(let i = 0; i < (f || []).length; i += 2) vizinhos.push({ pos: ini + i / 2 + 1, id: f[i], xp: Number(f[i + 1]) });
      }

      return res.status(200).json({
        id, nick: sessao.username, tipo: sessao.tipo || 'own', cargo: await cargoDe(id, sessao.email),
        moeda: MOEDA,
        nivel: nv.nivel, xp: S.xp, xpNivel: { dentro: nv.dentro, falta: nv.falta, pct: nv.pct, base: nv.base, prox: nv.prox },
        proximosNiveis: [nv.nivel + 1, nv.nivel + 5].filter(n => n <= NIVEL_MAX).map(n => ({ nivel: n, xp: xpDoNivel(n) })),
        coins: S.coins,
        ranking: { pos: pos == null ? null : Number(pos) + 1, total: Number(total), vizinhos },
        stats: {
          lives: S.lives, votos: S.votos, sugestoes: S.sugestoes, sugestoesEnv: S.sugestoesEnv,
          horas: Math.round(S.horas * 10) / 10, minutos: S.minutos, codigos: S.codigos,
          streak: S.streak, melhorStreak: S.melhorStreak
        },
        twitch: S.conta && S.conta.twitch ? { login: S.conta.twitch.login, nome: S.conta.twitch.nome, desde: S.conta.twitch.desde } : null,
        titulo: S.titulo, titulos: titulosDe(S),
        conquistas, progresso: { feitas, total: CONQUISTAS.length, platina: S.platina },
        boneco: S.boneco ? validarBoneco(S.boneco, S, ehDev).boneco : BONECO_PADRAO,
        liberados,
        comprados: [...S.inv],
        notificacoes: notifs.map(n => ({ ...n, nova: n.ts > S.notifLidoTs })),
        regras: REGRAS_PUBLICAS
      });
    }

    /* ============ CÓDIGO SECRETO ============ */
    if(action === 'resgatar' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      if(sessao.tipo !== 'own' && sessao.tipo !== 'discord') return res.status(401).json({ error: 'Faça login' });
      if(!(await rateLimit(`rl:code:${id}`, 6, 60))) return res.status(429).json({ error: 'Devagar! Tente de novo em 1 minuto.' });
      // tentativas erradas: 15 por hora → bloqueio (anti brute-force de códigos)
      const [bloq] = await redis([['GET', `codefail:${id}`]]);
      if(Number(bloq || 0) >= 15) return res.status(429).json({ error: 'Muitas tentativas inválidas. Volte mais tarde.' });

      const codigo = safeStr(req.body?.codigo, 40).toUpperCase().replace(/\s+/g, '');
      const falhar = async msg => {
        const [n] = await redis([['INCR', `codefail:${id}`]]);
        if(Number(n) === 1) await redis([['EXPIRE', `codefail:${id}`, '3600']]);
        return res.status(400).json({ error: msg });
      };
      if(!/^[A-Z0-9-]{4,32}$/.test(codigo)) return falhar('Código inválido ou expirado.');

      const [raw] = await redis([['HGET', 'codes', codigo]]);
      const c = jparse(raw);
      if(!c || !c.ativo || (c.expiraEm && Date.now() > c.expiraEm)) return falhar('Código inválido ou expirado.');

      // 1 vez por pessoa (SADD é atômico)
      const [novoUso] = await redis([['SADD', `codes:used:${codigo}`, id]]);
      if(Number(novoUso) !== 1) return res.status(409).json({ error: 'Você já resgatou este código.' });
      // limite global de usos (INCR é atômico → sem corrida)
      const [cnt] = await redis([['INCR', `codes:cnt:${codigo}`]]);
      if(c.maxUsos && Number(cnt) > c.maxUsos){
        await redis([['DECR', `codes:cnt:${codigo}`], ['SREM', `codes:used:${codigo}`, id]]);
        return res.status(410).json({ error: 'Este código já atingiu o limite de usos.' });
      }

      let premio = '';
      if(c.tipo === 'xp'){ await creditar(id, { xp: c.valor, silencioso: true }); premio = `+${c.valor} XP`; }
      else if(c.tipo === 'moedas'){ await creditar(id, { coins: c.valor, silencioso: true }); premio = `+${c.valor} ${MOEDA.nome}`; }
      else if(c.tipo === 'item'){
        const [slot, itemId] = String(c.item || '').split(':');
        const it = acharItem(slot, itemId);
        if(!it){ await redis([['DECR', `codes:cnt:${codigo}`], ['SREM', `codes:used:${codigo}`, id]]); return res.status(500).json({ error: 'Código com item inválido. Avise a Soso!' }); }
        await redis([['SADD', `inv:${id}`, `${slot}:${itemId}`]]);
        premio = `Item: ${it.nome} (${RARIDADES[it.r].nome})`;
      }
      await redis([['HINCRBY', `g:${id}`, 'codigos', '1']]);
      await notificar(id, 'codigo', `Código resgatado: ${premio}`);
      const novas = await avaliarConquistas(id);
      return res.status(200).json({ ok: true, premio, conquistas: novas });
    }

    /* ============ LOJA ============ */
    if(action === 'comprar' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      if(!(await rateLimit(`rl:buy:${id}`, 20, 60, false))) return res.status(429).json({ error: 'Devagar!' });
      const slot = safeStr(req.body?.slot, 20), itemId = safeStr(req.body?.id, 30);
      const it = acharItem(slot, itemId);
      if(!it || it.regra.t !== 'loja') return res.status(400).json({ error: 'Este item não está à venda.' });
      const preco = precoDe(it);
      const chave = `${slot}:${itemId}`;
      const [ja] = await redis([['SISMEMBER', `inv:${id}`, chave]]);
      if(Number(ja) === 1) return res.status(409).json({ error: 'Você já tem este item.' });

      // débito atômico; se ficou negativo, estorna
      const [saldo] = await redis([['HINCRBY', `g:${id}`, 'coins', String(-preco)]]);
      if(Number(saldo) < 0){
        await redis([['HINCRBY', `g:${id}`, 'coins', String(preco)]]);
        return res.status(402).json({ error: `Faltam ${-Number(saldo)} ${MOEDA.nome}.` });
      }
      await redis([['SADD', `inv:${id}`, chave]]);
      await notificar(id, 'item', `Comprou: ${it.nome} (-${preco} ${MOEDA.nome})`);
      await avaliarConquistas(id);
      return res.status(200).json({ ok: true, coins: Number(saldo) });
    }

    /* ============ TÍTULO ============ */
    if(action === 'titulo' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      const tid = safeStr(req.body?.id, 30);
      const S = await lerStats(id);
      const t = titulosDe(S).find(x => x.id === tid);
      if(!t) return res.status(400).json({ error: 'Título inexistente.' });
      if(!t.liberado && !ehDev) return res.status(403).json({ error: `Bloqueado: ${t.regra}` });
      await redis([['HSET', `g:${id}`, 'titulo', tid]]);
      return res.status(200).json({ ok: true, titulo: tid });
    }

    if(action === 'notif-lidas' && req.method === 'POST'){
      await redis([['HSET', `g:${id}`, 'notifLidoTs', String(Date.now())]]);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch(e){
    // O detalhe fica nos logs da Vercel (nunca na resposta pública), permitindo
    // diagnosticar falhas de catálogo/Redis/import sem expor dados internos.
    console.error(`[game-api] Falha na ação "${action || 'nenhuma'}":`, e);
    return res.status(500).json({ error: 'Erro interno', action: action || null });
  }
}
