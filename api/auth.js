// Vercel serverless: /api/auth.js
// Login PRÓPRIO (e-mail + senha, scrypt), Google e Twitch, tudo em Redis.
//
// Rotas:
//   POST /api/auth?action=register          { email, senha, nick }
//   POST /api/auth?action=login             { email | usuario, senha }
//   GET|POST /api/auth?action=logout
//   GET  /api/auth?action=me
//   GET  /api/auth?action=google-login | google-callback
//   GET  /api/auth?action=twitch-login | twitch-callback
//   POST /api/auth?action=change-password   { atual, nova }
//   POST /api/auth?action=change-nick       { nick }
//   GET  /api/auth?action=twitch-link       → redireciona para a Twitch
//   GET  /api/twitch-callback               (retorno da Twitch; compatível também com a rota antiga)
//   POST /api/auth?action=twitch-unlink
//
// Redis: accounts e vínculos permanecem; métricas da comunidade ficam em activity:{id}.
import { randomBytes } from 'crypto';
import {
  ENV, redis, jparse, rateLimit, ipDe, origemOk, criarToken, lerSessao, validarSessao, setSessao, limparSessao,
  addCookie, pegarCookie, hashSenha, conferirSenha, safeStr, RE_USUARIO, nickValido, cargoDe, SITE
} from './_lib/core.js';
import { lerAtividade } from './_lib/atividade.js';
import { lerStats, infoNivel, MOEDA } from './_lib/game.js';
import { urlVinculo, identificarViewer, twitchConfigurada, urlAutorizacaoBroadcaster, concluirAutorizacaoBroadcaster, cronPresenca } from './_lib/twitch.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRON_SECRET = String(process.env.CRON_SECRET || '').trim();

const GOOGLE_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT = process.env.GOOGLE_REDIRECT_URI || `${SITE.replace(/\/+$/, '')}/api/auth?action=google-callback`;
const TWITCH_REDIRECT = String(process.env.TWITCH_REDIRECT_URI || `${SITE}/api/twitch-callback`).trim().replace(/\/+$/, ''); // precisa ser idêntico ao Redirect URL no Twitch Developers

const CONSUMIR_ESTADO_TWITCH_LUA = `
local value = redis.call('GET', KEYS[1])
if not value then return nil end
redis.call('DEL', KEYS[1])
return value
`;

const ERRO_LOGIN = 'Usuário ou senha incorretos.';
const DIA = 86400;

/* ---------- helpers de sessão/conta ---------- */
async function pegarConta(id){
  const [raw] = await redis([['HGET', 'accounts', String(id)]]);
  return jparse(raw, null);
}
async function salvarConta(conta){
  await redis([['HSET', 'accounts', conta.id, JSON.stringify(conta)]]);
}
async function emitirSessao(res, conta){
  // Só e-mail verificado pelo Google pode conceder cargo DEV.
  const emailVerificado = String(conta.google?.email || '').trim().toLowerCase();
  const avatar = conta.google?.picture || conta.avatar || null;
  const cargo = await cargoDe(conta.id, emailVerificado);
  const token = criarToken({
    id: conta.id, username: conta.nick, email: emailVerificado, avatar,
    admin: !!cargo, cargo: cargo || null, sv: conta.sv, tipo: 'own'
  });
  setSessao(res, token);
  return cargo;
}
async function sincronizarPerfil(conta){
  // ranking / votos / webhooks leem daqui
  const avatar = conta.google?.picture || conta.avatar || null;
  await redis([['HSET', 'user_profiles', conta.id, JSON.stringify({ username: conta.nick, avatar, ts: Date.now() })]]);
}

/* Retorna a conta da sessão, já checando a "versão de sessão" (logout global ao trocar senha). */
async function contaDaSessao(req){
  const s = lerSessao(req);
  if(!s || s.tipo !== 'own') return { sessao: s, conta: null };
  const conta = await pegarConta(s.id);
  if(!conta || conta.sv !== s.sv) return { sessao: null, conta: null };
  return { sessao: s, conta };
}
const publico = (conta, cargo) => ({
  logado: true, id: conta.id, username: conta.nick, nick: conta.nick,
  email: conta.google?.email || conta.email || null,
  avatar: conta.google?.picture || conta.avatar || null,
  google: conta.google ? { email: conta.google.email || null } : null,
  tipo: 'own', metodoLogin: conta.google ? 'google' : (conta.loginProvider || (conta.twitch ? 'twitch' : (conta.email ? 'email' : 'senha'))),
  admin: !!cargo, cargo: cargo || null,
  twitch: conta.twitch ? { login: conta.twitch.login, nome: conta.twitch.nome, desde: conta.twitch.desde } : null
});


function nickDoGoogle(nome, email){
  let n = String(nome || '').normalize('NFC').replace(/[^\p{L}\p{N}_. -]/gu, '').trim().slice(0, 24);
  if(!nickValido(n)) n = String(email || '').split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 20);
  if(!nickValido(n)) n = 'Jogador' + randomBytes(2).toString('hex');
  return n;
}
function usuarioDoGoogle(email){
  let u = String(email || '').split('@')[0].normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
  if(u.length < 3) u = `user_${randomBytes(2).toString('hex')}`;
  return u;
}
function usuarioDaTwitch(login){
  let u = String(login || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 20);
  if(u.length < 3) u = `twitch_${randomBytes(2).toString('hex')}`;
  return u;
}
async function buscarOuCriarContaGoogle(me, sessaoAtual){
  const sub = String(me.sub);
  const email = String(me.email || '').trim().toLowerCase();
  if(!sub || !email || me.email_verified !== true) throw new Error('A conta Google precisa ter um e-mail verificado.');

  const [idGoogle] = await redis([['HGET', 'google_idx', sub]]);
  if(idGoogle){
    if(sessaoAtual?.tipo === 'own' && String(sessaoAtual.id) !== String(idGoogle)) throw new Error('Esta conta Google já está vinculada a outro perfil. Saia da conta atual para entrar no perfil correto.');
    const conta = await pegarConta(idGoogle);
    if(!conta) throw new Error('Vínculo Google inconsistente. Entre em contato com a Soso.');
    const [donoEmail] = await redis([['HGET', 'google_email_idx', email]]);
    if(donoEmail && donoEmail !== conta.id) throw new Error('Este e-mail Google já está associado a outra conta.');
    const emailAnterior = String(conta.google?.email || '').toLowerCase();
    conta.google = { sub, email, name: String(me.name || ''), picture: me.picture || null };
    conta.email = email;
    await salvarConta(conta);
    await redis([...(emailAnterior && emailAnterior !== email ? [['HDEL', 'google_email_idx', emailAnterior]] : []), ['HSET', 'google_email_idx', email, conta.id]]);
    await sincronizarPerfil(conta);
    return { conta, novo: false };
  }

  // Se o usuário já entrou com a conta local e iniciou o Google OAuth, vincula à conta existente.
  if(sessaoAtual && sessaoAtual.tipo === 'own'){
    const conta = await pegarConta(sessaoAtual.id);
    if(conta && conta.sv === sessaoAtual.sv){
      if(conta.google?.sub && conta.google.sub !== sub) throw new Error('Esta conta já está vinculada a outro Google.');
      const [donoEmail] = await redis([['HGET', 'google_email_idx', email]]);
      if(donoEmail && donoEmail !== conta.id) throw new Error('Este e-mail Google já está associado a outra conta.');
      conta.google = { sub, email, name: String(me.name || ''), picture: me.picture || null };
      conta.email = email;
      await salvarConta(conta);
      await redis([['HSET', 'google_idx', sub, conta.id], ['HSET', 'google_email_idx', email, conta.id]]);
      await sincronizarPerfil(conta);
      return { conta, novo: false, vinculado: true };
    }
  }

  if(!sessaoAtual){
    const [contaLocal] = await redis([['HGET', 'email_idx', email]]);
    if(contaLocal) throw new Error('Este e-mail já possui acesso por senha. Entre com e-mail e senha para vincular outra opção.');
  }

  const [idEmail] = await redis([['HGET', 'google_email_idx', email]]);
  if(idEmail){
    const conta = await pegarConta(idEmail);
    if(conta){
      if(conta.google?.sub && conta.google.sub !== sub) throw new Error('Este e-mail já está vinculado a outra identidade Google.');
      conta.google = { sub, email, name: String(me.name || ''), picture: me.picture || null };
      conta.email = email;
      await salvarConta(conta);
      await redis([['HSET', 'google_idx', sub, conta.id], ['HSET', 'google_email_idx', email, conta.id]]);
      await sincronizarPerfil(conta);
      return { conta, novo: false };
    }
  }

  const id = 'u_' + randomBytes(8).toString('hex');
  const base = usuarioDoGoogle(email);
  let usuario = base;
  let reservado = false;
  for(let i = 0; i < 100; i++){
    const sufixo = i ? String(i + 1) : '';
    usuario = (base.slice(0, 20 - sufixo.length) + sufixo).slice(0, 20);
    const [ok] = await redis([['HSETNX', 'usernames', usuario, id]]);
    if(Number(ok) === 1){ reservado = true; break; }
  }
  if(!reservado) throw new Error('Não foi possível gerar um usuário único para sua conta Google.');
  const [googleOk] = await redis([['HSETNX', 'google_idx', sub, id]]);
  if(Number(googleOk) !== 1){ await redis([['HDEL', 'usernames', usuario]]); const [winner] = await redis([['HGET', 'google_idx', sub]]); const conta = winner ? await pegarConta(winner) : null; if(conta) return { conta, novo: false }; throw new Error('Não foi possível concluir o login Google. Tente novamente.'); }

  const conta = {
    id, usuario, nick: nickDoGoogle(me.name, email), email,
    google: { sub, email, name: String(me.name || ''), picture: me.picture || null },
    sv: 1, criadoEm: Date.now(), nickAlteradoEm: 0, twitch: null
  };
  await salvarConta(conta);
  await redis([['HSET', 'google_email_idx', email, id]]);
  await sincronizarPerfil(conta);
  return { conta, novo: true };
}

/* ============================================================ */
export default async function handler(req, res){
  const action = (req.query && req.query.action) || '';
  // Catálogo e ranking são públicos; encaminhe antes da validação da sessão.
  // As rotas públicas de presença são processadas antes da validação de sessão.
  if(action === 'cron-presenca' && req.method === 'GET'){
    if(!CRON_SECRET || req.headers.authorization !== `Bearer ${CRON_SECRET}`) return res.status(401).json({ error: 'Não autorizado' });
    try { const dados = await cronPresenca(); return res.status(200).json({ ok: true, ...dados }); }
    catch(error){ console.error('[Twitch cron]', error?.message || error); return res.status(503).json({ ok: false, error: error?.message || 'Falha ao registrar presença.' }); }
  }
  if(!ENV.SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });
  res.setHeader('Cache-Control', 'no-store');

  try {

    /* ====================== TWITCH LOGIN ====================== */
    if(action === 'twitch-login' && req.method === 'GET'){
      if(!twitchConfigurada()){ res.writeHead(302, { Location: `${SITE}/?login=twitch-config#perfil` }); return res.end(); }
      if(!(await rateLimit(`rl:twitch:login:${ipDe(req)}`, 20, 60))){ res.writeHead(302, { Location: `${SITE}/?login=twitch-erro#perfil` }); return res.end(); }
      const state = randomBytes(24).toString('hex');
      addCookie(res, `twitch_login_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      res.writeHead(302, { Location: urlVinculo(TWITCH_REDIRECT, state) });
      return res.end();
    }

    /* ====================== GOOGLE OAUTH ====================== */
    if(action === 'google-login' && req.method === 'GET'){
      if(!GOOGLE_ID || !GOOGLE_SECRET) return res.status(503).send('Login Google ainda não configurado. Configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET na Vercel.');
      if(!(await rateLimit(`rl:google:${ipDe(req)}`, 20, 60))) return res.status(429).send('Muitas tentativas. Aguarde um pouco.');
      const state = randomBytes(24).toString('hex');
      addCookie(res, `google_oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      const params = new URLSearchParams({
        client_id: GOOGLE_ID, redirect_uri: GOOGLE_REDIRECT,
        response_type: 'code', scope: 'openid email profile', state,
        prompt: 'select_account', access_type: 'online'
      });
      res.writeHead(302, { Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
      return res.end();
    }

    if(action === 'google-callback' && req.method === 'GET'){
      const { code, state, error } = req.query || {};
      if(error){ res.writeHead(302, { Location: '/?login=cancelado' }); return res.end(); }
      if(!code || !state || pegarCookie(req, 'google_oauth_state') !== state){
        addCookie(res, 'google_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
        return res.status(400).send('Sessão Google inválida. Volte ao site e tente novamente.');
      }
      addCookie(res, 'google_oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
      if(!GOOGLE_ID || !GOOGLE_SECRET) return res.status(503).send('Login Google não configurado.');
      if(!(await rateLimit(`rl:google:callback:${ipDe(req)}`, 20, 60))) return res.status(429).send('Muitas tentativas. Aguarde um pouco.');

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: GOOGLE_ID, client_secret: GOOGLE_SECRET, code: String(code), grant_type: 'authorization_code', redirect_uri: GOOGLE_REDIRECT })
      });
      const tokenData = await tokenRes.json().catch(() => ({}));
      if(!tokenRes.ok || !tokenData.access_token){ res.writeHead(302, { Location: '/?login=erro-google' }); return res.end(); }

      const userRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      const me = await userRes.json().catch(() => ({}));
      if(!userRes.ok || !me.sub || !me.email || me.email_verified !== true){ res.writeHead(302, { Location: '/?login=email-nao-verificado' }); return res.end(); }

      const atual = lerSessao(req);
      const resultado = await buscarOuCriarContaGoogle(me, atual);
      const cargo = await emitirSessao(res, resultado.conta);
      const qs = new URLSearchParams({ login: 'ok' });
      if(resultado.novo) qs.set('novo', '1');
      if(resultado.vinculado) qs.set('vinculado', '1');
      res.writeHead(302, { Location: `/?${qs.toString()}#perfil` });
      return res.end();
    }

    /* ====================== REGISTRAR ====================== */
    if(action === 'register' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      if(!(await rateLimit(`rl:reg:${ipDe(req)}`, 5, 3600))) return res.status(429).json({ error: 'Muitos cadastros deste IP. Tente mais tarde.' });

      const email = safeStr(req.body?.email, 254).toLowerCase();
      const usuarioSolicitado = safeStr(req.body?.usuario, 20).toLowerCase();
      const baseUsuario = safeStr(usuarioSolicitado || (email ? usuarioDoGoogle(email) : ''), 20).toLowerCase();
      const senha = String(req.body?.senha || '');
      if(email && !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
      if(!RE_USUARIO.test(baseUsuario)) return res.status(400).json({ error: 'Não foi possível gerar um identificador para sua conta.' });
      const nick = safeStr(req.body?.nick || baseUsuario, 24);
      if(!nickValido(nick)) return res.status(400).json({ error: 'Nome: 3 a 24 caracteres (letras, números, espaço, _ . -).' });
      if(senha.length < 8 || senha.length > 72) return res.status(400).json({ error: 'A senha precisa ter de 8 a 72 caracteres.' });
      if(senha.toLowerCase().includes(baseUsuario) || (email && senha.toLowerCase().includes(email.split('@')[0]))) return res.status(400).json({ error: 'A senha não pode conter seu usuário ou e-mail.' });

      const id = 'u_' + randomBytes(8).toString('hex');
      let usuario = baseUsuario, reservado = false;
      const tentativas = usuarioSolicitado ? 1 : 100;
      for(let i = 0; i < tentativas; i++){
        const sufixo = i ? String(i + 1) : '';
        usuario = (baseUsuario.slice(0, 20 - sufixo.length) + sufixo).slice(0, 20);
        const [livre] = await redis([['HSETNX', 'usernames', usuario, id]]);
        if(Number(livre) === 1){ reservado = true; break; }
      }
      if(!reservado) return res.status(409).json({ error: 'Não foi possível gerar um usuário livre para esta conta.' });
      let emailReservado = false;
      if(email){
        const [emailLivre] = await redis([['HSETNX', 'email_idx', email, id]]);
        emailReservado = Number(emailLivre) === 1;
        if(!emailReservado){ await redis([['HDEL', 'usernames', usuario]]); return res.status(409).json({ error: 'Esse e-mail já está cadastrado. Entre com ele ou use a Twitch.' }); }
      }

      const { salt, hash } = await hashSenha(senha);
      const conta = {
        id, usuario, nick, email: email || null, emailVerificado: false,
        loginProvider: email ? 'email' : 'senha', senha: { salt, hash }, sv: 1,
        criadoEm: Date.now(), nickAlteradoEm: 0, twitch: null
      };
      await salvarConta(conta);
      await sincronizarPerfil(conta);
      const cargo = await emitirSessao(res, conta);
      return res.status(200).json({ ...publico(conta, cargo), novo: true });
    }

    /* ====================== LOGIN ====================== */
    if(action === 'login' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      const identificador = safeStr(req.body?.email || req.body?.usuario, 254).toLowerCase();
      const senha = String(req.body?.senha || '');
      const ip = ipDe(req);
      if(!(await rateLimit(`rl:login:ip:${ip}`, 20, 900)) || !(await rateLimit(`rl:login:u:${identificador.slice(0, 120)}`, 8, 900)))
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
      if(!identificador || !senha) return res.status(401).json({ error: ERRO_LOGIN });

      const emailLogin = identificador.includes('@');
      if(emailLogin && !EMAIL_RE.test(identificador)) return res.status(401).json({ error: ERRO_LOGIN });
      if(!emailLogin && !RE_USUARIO.test(identificador)) return res.status(401).json({ error: ERRO_LOGIN });
      const [id] = await redis([[ 'HGET', emailLogin ? 'email_idx' : 'usernames', identificador ]]);
      const conta = id ? await pegarConta(id) : null;
      const pass = conta?.senha;
      const ok = await conferirSenha(senha, pass?.salt || '00'.repeat(16), pass?.hash || '00'.repeat(64));
      if(!conta || !pass || !ok) return res.status(401).json({ error: ERRO_LOGIN });

      const cargo = await emitirSessao(res, conta);
      return res.status(200).json(publico(conta, cargo));
    }

    /* ====================== LOGOUT ====================== */
    if(action === 'logout'){
      limparSessao(res);
      return res.status(200).json({ ok: true });
    }

    /* ====================== ME ====================== */
    if(action === 'me'){
      const s = lerSessao(req);
      if(!s) return res.status(200).json({ logado: false });
      if(s.tipo !== 'own'){ limparSessao(res); return res.status(200).json({ logado: false }); }
      const conta = await pegarConta(s.id);
      if(!conta || conta.sv !== s.sv){ limparSessao(res); return res.status(200).json({ logado: false }); }
      const cargo = await cargoDe(conta.id, conta.google?.email || '');     // somente e-mail Google verificado pode conceder cargo DEV
      return res.status(200).json(publico(conta, cargo));
    }

    /* ====================== PERFIL DE ATIVIDADE ====================== */
    if(action === 'activity-profile' && req.method === 'GET'){
      const sessao = await validarSessao(req);
      if(!sessao?.id) return res.status(401).json({ error: 'Faça login para ver seu perfil.' });
      let conta = null;
      if(sessao.tipo === 'own'){
        conta = await pegarConta(sessao.id);
        if(!conta) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
      }
      const stats = await lerAtividade(sessao.id);
      const economia = await lerStats(sessao.id);
      return res.status(200).json({
        usuario: conta ? publico(conta, await cargoDe(conta.id, conta.google?.email || '')) : { logado: true, id: sessao.id, nick: sessao.username, username: sessao.username, avatar: sessao.avatar, tipo: sessao.tipo, cargo: sessao.cargo || null },
        atividade: stats,
        economia: {
          moeda: MOEDA,
          xp: economia.xp,
          coins: economia.coins,
          nivel: economia.nivel,
          info: infoNivel(economia.xp)
        }
      });
    }

    /* ====================== TROCAR SENHA ====================== */
    if(action === 'change-password' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      const { conta } = await contaDaSessao(req);
      if(!conta) return res.status(401).json({ error: 'Faça login (conta própria).' });
      if(!(await rateLimit(`rl:pw:${conta.id}`, 5, 900))) return res.status(429).json({ error: 'Muitas tentativas. Aguarde.' });

      const atual = String(req.body?.atual || ''), nova = String(req.body?.nova || '');
      if(nova.length < 8 || nova.length > 72) return res.status(400).json({ error: 'A nova senha precisa ter de 8 a 72 caracteres.' });
      if(!(await conferirSenha(atual, conta.senha.salt, conta.senha.hash))) return res.status(403).json({ error: 'Senha atual incorreta.' });

      const { salt, hash } = await hashSenha(nova);
      conta.senha = { salt, hash };
      conta.sv = (conta.sv || 1) + 1;            // derruba todas as outras sessões
      await salvarConta(conta);
      await emitirSessao(res, conta);             // mantém ESTA sessão logada
      return res.status(200).json({ ok: true });
    }

    /* ====================== TROCAR NICK ====================== */
    if(action === 'change-nick' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      const { conta } = await contaDaSessao(req);
      if(!conta) return res.status(401).json({ error: 'Faça login (conta própria).' });
      const nick = safeStr(req.body?.nick, 24);
      if(!nickValido(nick)) return res.status(400).json({ error: 'Nick: 3 a 24 caracteres (letras, números, espaço, _ . -).' });
      const espera = (conta.nickAlteradoEm || 0) + 7 * DIA * 1000 - Date.now();
      if(espera > 0) return res.status(429).json({ error: `Você poderá trocar o nick de novo em ${Math.ceil(espera / (DIA * 1000))} dia(s).` });

      conta.nick = nick; conta.nickAlteradoEm = Date.now();
      await salvarConta(conta);
      await sincronizarPerfil(conta);
      await emitirSessao(res, conta);
      return res.status(200).json({ ok: true, nick });
    }

    /* ====================== TWITCH: LINK ADMINISTRATIVO ====================== */
    // Um DEV gera um link de uso único para a broadcaster. Ela não precisa entrar
    // no site: apenas autoriza a aplicação na Twitch; o token vai direto ao Redis.
    if(action === 'twitch-broadcaster-link' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida. Abra o painel pelo domínio oficial.' });
      const { conta } = await contaDaSessao(req);
      if(!conta) return res.status(401).json({ error: 'Entre com sua conta DEV para gerar o link.' });
      const email = String(conta.google?.email || '').trim().toLowerCase();
      if((await cargoDe(conta.id, email)) !== 'dev') return res.status(403).json({ error: 'Apenas a equipe DEV pode gerar este link.' });
      if(!twitchConfigurada()) return res.status(503).json({ error: 'Configure TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET na Vercel.' });
      if(!(await rateLimit(`rl:twitch:bc-link:${conta.id}`, 5, 3600))) return res.status(429).json({ error: 'Limite de links atingido. Aguarde uma hora.' });
      const state = randomBytes(32).toString('hex');
      const { url, broadcaster } = await urlAutorizacaoBroadcaster(TWITCH_REDIRECT, state);
      await redis([['SET', `twitch:bc:oauth:${state}`, JSON.stringify({ expectedUserId: broadcaster.id, login: broadcaster.login, createdBy: String(conta.id), createdAt: Date.now() }), 'EX', '900']]);
      return res.status(200).json({ ok: true, url, expiresIn: 900, broadcasterLogin: broadcaster.login, callbackUrl: TWITCH_REDIRECT });
    }

    /* ====================== TWITCH: VINCULAR CONTA DE JOGADOR ====================== */
    if(action === 'twitch-link'){
      const { conta } = await contaDaSessao(req);
      if(!conta) { res.writeHead(302, { Location: '/?entrar=1' }); return res.end(); }
      if(!twitchConfigurada()) return res.status(500).json({ error: 'Twitch OAuth não configurado' });
      const state = randomBytes(24).toString('hex');
      addCookie(res, `twitch_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      res.writeHead(302, { Location: urlVinculo(TWITCH_REDIRECT, state) });
      return res.end();
    }

    if(action === 'twitch-callback'){
      const { code, state, error } = req.query || {};
      const stateValue = String(state || '');
      // Primeiro tenta consumir um estado de autorização da broadcaster (sem sessão site).
      if(/^[a-f0-9]{64}$/i.test(stateValue)){
        const stateKey = `twitch:bc:oauth:${stateValue}`;
        const [pendingRaw] = await redis([['EVAL', CONSUMIR_ESTADO_TWITCH_LUA, '1', stateKey]]);
        const pending = jparse(pendingRaw, null);
        if(pending){
          if(error || !code){
            res.writeHead(302, { Location: `${SITE}/?twitch-channel=cancelado` });
            return res.end();
          }
          try {
            const authorized = await concluirAutorizacaoBroadcaster(String(code), TWITCH_REDIRECT, pending.expectedUserId);
            await redis([['SET', 'twitch:presence:last-run', JSON.stringify({ status: 'authorized', at: Date.now(), login: authorized.login }) , 'EX', '2592000']]);
            res.writeHead(302, { Location: `${SITE}/?twitch-channel=ok` });
            return res.end();
          } catch(authorizationError) {
            console.error('[Twitch broadcaster OAuth]', authorizationError?.message || authorizationError);
            const wrongAccount = /conta autorizada|canal esperado/i.test(String(authorizationError?.message || ''));
            res.writeHead(302, { Location: `${SITE}/?twitch-channel=${wrongAccount ? 'conta-errada' : 'erro'}` });
            return res.end();
          }
        }
        res.writeHead(302, { Location: `${SITE}/?twitch-channel=expirado` });
        return res.end();
      }

      // Login direto pela Twitch (state protegido por cookie HttpOnly).
      const loginState = pegarCookie(req, 'twitch_login_state');
      if(loginState){
        addCookie(res, 'twitch_login_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');
        if(error || !code || !state || loginState !== state){ res.writeHead(302, { Location: '/?login=twitch-erro' }); return res.end(); }
        if(!twitchConfigurada()){ res.writeHead(302, { Location: '/?login=twitch-config' }); return res.end(); }
        const tw = await identificarViewer(String(code), TWITCH_REDIRECT);
        if(!tw){ res.writeHead(302, { Location: '/?login=twitch-erro' }); return res.end(); }
        const [donoRaw] = await redis([['HGET', 'twitch_idx', tw.id]]);
        let conta = donoRaw ? await pegarConta(donoRaw) : null;
        let novo = false;
        if(!conta){
          if(donoRaw) await redis([['HDEL', 'twitch_idx', tw.id]]);
          const id = 'u_' + randomBytes(8).toString('hex');
          const base = usuarioDaTwitch(tw.login);
          let usuario = base, reservado = false;
          for(let i = 0; i < 100; i++){
            const sufixo = i ? String(i + 1) : '';
            usuario = (base.slice(0, 20 - sufixo.length) + sufixo).slice(0, 20);
            const [ok] = await redis([['HSETNX', 'usernames', usuario, id]]);
            if(Number(ok) === 1){ reservado = true; break; }
          }
          if(!reservado){ res.writeHead(302, { Location: '/?login=twitch-erro' }); return res.end(); }
          conta = {
            id, usuario, nick: nickValido(tw.nome) ? tw.nome.slice(0, 24) : usuario,
            avatar: tw.avatar || null, loginProvider: 'twitch',
            twitch: { id: tw.id, login: tw.login, nome: tw.nome, desde: Date.now() },
            sv: 1, criadoEm: Date.now(), nickAlteradoEm: 0
          };
          await salvarConta(conta);
          await redis([['HSET', 'twitch_idx', tw.id, id]]);
          await sincronizarPerfil(conta);
          novo = true;
        } else {
          if(!conta.twitch || String(conta.twitch.id) !== tw.id){
            const [dono] = await redis([['HGET', 'twitch_idx', tw.id]]);
            if(dono && String(dono) !== String(conta.id)){ res.writeHead(302, { Location: '/?login=twitch-em-uso' }); return res.end(); }
            conta.twitch = { id: tw.id, login: tw.login, nome: tw.nome, desde: conta.twitch?.desde || Date.now() };
          }
          if(!conta.avatar && !conta.google?.picture && tw.avatar) conta.avatar = tw.avatar;
          await salvarConta(conta);
          await redis([['HSET', 'twitch_idx', tw.id, conta.id]]);
          await sincronizarPerfil(conta);
        }
        const cargo = await emitirSessao(res, conta);
        const qs = new URLSearchParams({ login: 'ok', provider: 'twitch' });
        if(novo) qs.set('novo', '1');
        res.writeHead(302, { Location: `/?${qs.toString()}#perfil` });
        return res.end();
      }

      // Fluxo original de vínculo individual dos jogadores, protegido por cookie/state.
      const { conta } = await contaDaSessao(req);
      if(!conta) { res.writeHead(302, { Location: '/?entrar=1' }); return res.end(); }
      if(error) { res.writeHead(302, { Location: '/?twitch=cancelado' }); return res.end(); }
      if(!code || !state || pegarCookie(req, 'twitch_state') !== state)
        return res.status(400).json({ error: 'State inválido. Volte ao site e tente vincular a Twitch novamente.' });
      addCookie(res, 'twitch_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

      const tw = await identificarViewer(String(code), TWITCH_REDIRECT);
      if(!tw) { res.writeHead(302, { Location: '/?twitch=erro' }); return res.end(); }

      // 1 conta da Twitch ↔ 1 conta do site (impede dividir horas entre contas)
      const [dono] = await redis([['HGET', 'twitch_idx', tw.id]]);
      if(dono && dono !== conta.id){ res.writeHead(302, { Location: '/?twitch=em-uso' }); return res.end(); }
      if(conta.twitch && conta.twitch.id !== tw.id) await redis([['HDEL', 'twitch_idx', conta.twitch.id]]);

      conta.twitch = { id: tw.id, login: tw.login, nome: tw.nome, desde: Date.now() };
      if(!conta.avatar && !conta.google?.picture && tw.avatar) conta.avatar = tw.avatar;
      await salvarConta(conta);
      await redis([['HSET', 'twitch_idx', tw.id, conta.id]]);
      await sincronizarPerfil(conta);
      res.writeHead(302, { Location: '/?twitch=ok' });
      return res.end();
    }

    if(action === 'twitch-unlink' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      const { conta } = await contaDaSessao(req);
      if(!conta || !conta.twitch) return res.status(400).json({ error: 'Nenhuma Twitch vinculada.' });
      if(!(await rateLimit(`rl:unlink:${conta.id}`, 2, 30 * DIA))) return res.status(429).json({ error: 'Você só pode desvincular 2 vezes por mês.' });
      await redis([['HDEL', 'twitch_idx', conta.twitch.id]]);
      conta.twitch = null;
      await salvarConta(conta);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch(e){
    console.error('[AUTH]', action, e?.message || e);
    if(action === 'google-callback'){ res.writeHead(302, { Location: '/?login=erro-google' }); return res.end(); }
    if(action === 'twitch-callback'){ res.writeHead(302, { Location: '/?login=twitch-erro#perfil' }); return res.end(); }
    return res.status(500).json({ error: 'Erro interno' });
  }
}