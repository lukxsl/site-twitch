// Vercel serverless: /api/auth.js
// Login PRÓPRIO (usuário + senha, scrypt) em Redis + vínculo Twitch + Discord legado (opcional).
//
// Rotas:
//   POST /api/auth?action=register          { usuario, senha, nick }
//   POST /api/auth?action=login             { usuario, senha }
//   GET|POST /api/auth?action=logout
//   GET  /api/auth?action=me
//   POST /api/auth?action=avatar-save       { boneco: {...} }       (validado contra o inventário)
//   POST /api/auth?action=change-password   { atual, nova }
//   POST /api/auth?action=change-nick       { nick }
//   GET  /api/auth?action=twitch-link       → redireciona para a Twitch
//   GET  /api/auth?action=twitch-callback   (retorno da Twitch)
//   POST /api/auth?action=twitch-unlink
//   GET  /api/auth?action=discord-login     (legado — mantém votos/admins antigos)
//
// Redis:  accounts (HASH id→JSON) · usernames (HASH usuario→id) · twitch_idx (HASH twitchId→id)
//         g:{id} (HASH de jogo) · user_profiles (HASH, usado pelo ranking/votos)
import { randomBytes } from 'crypto';
import {
  ENV, redis, jparse, rateLimit, ipDe, origemOk, criarToken, lerSessao, setSessao, limparSessao,
  addCookie, pegarCookie, hashSenha, conferirSenha, safeStr, RE_USUARIO, nickValido, cargoDe, SITE
} from './_lib/core.js';
import { evento, avaliarConquistas, lerStats, validarBoneco, BONECO_PADRAO } from './_lib/game.js';
import { urlVinculo, identificarViewer, twitchConfigurada } from './_lib/twitch.js';

const DISCORD_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_REDIRECT = `${SITE}/api/auth`;                     // já cadastrado no portal Discord
const TWITCH_REDIRECT = `${SITE}/api/auth?action=twitch-callback`; // cadastre este na dev.twitch.tv

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
  const cargo = await cargoDe(conta.id);
  const token = criarToken({
    id: conta.id, username: conta.nick, avatar: null,
    admin: !!cargo, cargo: cargo || null, sv: conta.sv, tipo: 'own'
  });
  setSessao(res, token);
  return cargo;
}
async function sincronizarPerfil(conta){
  // ranking / votos / webhooks leem daqui
  await redis([['HSET', 'user_profiles', conta.id, JSON.stringify({ username: conta.nick, avatar: null, ts: Date.now() })]]);
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
  logado: true, id: conta.id, usuario: conta.usuario, username: conta.nick, nick: conta.nick,
  avatar: null, tipo: 'own', admin: !!cargo, cargo: cargo || null,
  twitch: conta.twitch ? { login: conta.twitch.login, nome: conta.twitch.nome, desde: conta.twitch.desde } : null,
  criadoEm: conta.criadoEm
});

/* ============================================================ */
export default async function handler(req, res){
  if(!ENV.SESSION_SECRET) return res.status(500).json({ error: 'SESSION_SECRET não configurado' });
  const action = (req.query && req.query.action) || '';
  res.setHeader('Cache-Control', 'no-store');

  try {
    /* ====================== REGISTRAR ====================== */
    if(action === 'register' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      if(!(await rateLimit(`rl:reg:${ipDe(req)}`, 5, 3600)))
        return res.status(429).json({ error: 'Muitos cadastros deste IP. Tente mais tarde.' });

      const usuario = safeStr(req.body?.usuario, 20).toLowerCase();
      const senha = String(req.body?.senha || '');
      const nick = safeStr(req.body?.nick || usuario, 24);
      if(!RE_USUARIO.test(usuario)) return res.status(400).json({ error: 'Usuário: 3 a 20 caracteres (letras minúsculas, números e _).' });
      if(!nickValido(nick)) return res.status(400).json({ error: 'Nick: 3 a 24 caracteres (letras, números, espaço, _ . -).' });
      if(senha.length < 8 || senha.length > 72) return res.status(400).json({ error: 'A senha precisa ter de 8 a 72 caracteres.' });
      if(senha.toLowerCase().includes(usuario)) return res.status(400).json({ error: 'A senha não pode conter o usuário.' });

      const id = 'u_' + randomBytes(8).toString('hex');
      // HSETNX é atômico: dois cadastros simultâneos com o mesmo usuário não passam
      const [livre] = await redis([['HSETNX', 'usernames', usuario, id]]);
      if(Number(livre) !== 1) return res.status(409).json({ error: 'Esse usuário já existe.' });

      const { salt, hash } = await hashSenha(senha);
      const conta = {
        id, usuario, nick, senha: { salt, hash }, sv: 1,
        criadoEm: Date.now(), nickAlteradoEm: 0, twitch: null
      };
      await salvarConta(conta);
      await redis([
        ['HSET', `g:${id}`, 'xp', '0', 'coins', '0', 'criadoTs', String(Date.now())],
        ['ZADD', 'rank:xp', '0', id]
      ]);
      await sincronizarPerfil(conta);
      await evento(id, 'cadastro', 'unico');            // +XP/moedas de boas-vindas (servidor)
      const cargo = await emitirSessao(res, conta);
      return res.status(200).json({ ...publico(conta, cargo), novo: true });
    }

    /* ====================== LOGIN ====================== */
    if(action === 'login' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      const usuario = safeStr(req.body?.usuario, 20).toLowerCase();
      const senha = String(req.body?.senha || '');
      const ip = ipDe(req);
      // limite por IP e por usuário (força bruta)
      if(!(await rateLimit(`rl:login:ip:${ip}`, 20, 900)) || !(await rateLimit(`rl:login:u:${usuario}`, 8, 900)))
        return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos.' });
      if(!RE_USUARIO.test(usuario) || !senha) return res.status(401).json({ error: ERRO_LOGIN });

      const [id] = await redis([['HGET', 'usernames', usuario]]);
      const conta = id ? await pegarConta(id) : null;
      // sempre gasta o mesmo tempo (scrypt) → não revela se o usuário existe
      const ok = await conferirSenha(senha, conta ? conta.senha.salt : '00'.repeat(16), conta ? conta.senha.hash : '00'.repeat(64));
      if(!conta || !ok) return res.status(401).json({ error: ERRO_LOGIN });

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
      if(s.tipo === 'own'){
        const conta = await pegarConta(s.id);
        if(!conta || conta.sv !== s.sv){ limparSessao(res); return res.status(200).json({ logado: false }); }
        const cargo = await cargoDe(conta.id);     // cargo sempre ao vivo (revogação vale na hora)
        return res.status(200).json(publico(conta, cargo));
      }
      // sessão Discord legada
      const cargo = await cargoDe(s.id);
      return res.status(200).json({
        logado: true, id: s.id, username: s.username, nick: s.username, avatar: s.avatar,
        tipo: 'discord', admin: !!cargo, cargo: cargo || null, twitch: null
      });
    }

    /* ====================== SALVAR AVATAR (boneco) ====================== */
    if(action === 'avatar-save' && req.method === 'POST'){
      if(!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });
      const { sessao: s } = await contaDaSessao(req);   // já descarta sessão própria revogada (sv)
      if(!s) return res.status(401).json({ error: 'Faça login' });
      if(!(await rateLimit(`rl:avatar:${s.id}`, 40, 60, false))) return res.status(429).json({ error: 'Calma! Muitas alterações seguidas.' });

      const S = await lerStats(s.id);
      const ehDev = (await cargoDe(s.id)) === 'dev';
      const { boneco, rejeitados } = validarBoneco(req.body?.boneco, S, ehDev);
      if(rejeitados.length) return res.status(400).json({ error: 'Alguns itens ainda estão bloqueados.', rejeitados, boneco });

      await redis([['HSET', `g:${s.id}`, 'boneco', JSON.stringify(boneco)]]);
      await avaliarConquistas(s.id);          // "Estilo Próprio"
      return res.status(200).json({ ok: true, boneco });
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

    /* ====================== TWITCH: VINCULAR ====================== */
    if(action === 'twitch-link'){
      const { conta } = await contaDaSessao(req);
      if(!conta) { res.writeHead(302, { Location: '/?entrar=1' }); return res.end(); }
      if(!twitchConfigurada()) return res.status(500).json({ error: 'Twitch OAuth não configurado' });
      const state = randomBytes(16).toString('hex');
      addCookie(res, `twitch_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      res.writeHead(302, { Location: urlVinculo(TWITCH_REDIRECT, state) });
      return res.end();
    }

    if(action === 'twitch-callback'){
      const { conta } = await contaDaSessao(req);
      if(!conta) { res.writeHead(302, { Location: '/?entrar=1' }); return res.end(); }
      const { code, state, error } = req.query || {};
      if(error) { res.writeHead(302, { Location: '/?twitch=cancelado' }); return res.end(); }
      if(!code || !state || pegarCookie(req, 'twitch_state') !== state)
        return res.status(400).json({ error: 'State inválido (CSRF?)' });
      addCookie(res, 'twitch_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');

      const tw = await identificarViewer(String(code), TWITCH_REDIRECT);
      if(!tw) { res.writeHead(302, { Location: '/?twitch=erro' }); return res.end(); }

      // 1 conta da Twitch ↔ 1 conta do site (impede dividir horas entre contas)
      const [dono] = await redis([['HGET', 'twitch_idx', tw.id]]);
      if(dono && dono !== conta.id){ res.writeHead(302, { Location: '/?twitch=em-uso' }); return res.end(); }
      if(conta.twitch && conta.twitch.id !== tw.id) await redis([['HDEL', 'twitch_idx', conta.twitch.id]]);

      conta.twitch = { id: tw.id, login: tw.login, nome: tw.nome, desde: Date.now() };
      await salvarConta(conta);
      await redis([['HSET', 'twitch_idx', tw.id, conta.id]]);
      await evento(conta.id, 'vincular_twitch', tw.id);   // paga uma vez por conta da Twitch
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

    /* ====================== DISCORD (legado, opcional) ====================== */
    if(action === 'discord-login'){
      if(!DISCORD_ID || !DISCORD_SECRET) return res.status(500).json({ error: 'Discord OAuth não configurado' });
      if(!(await rateLimit(`rl:dc:login:${ipDe(req)}`, 10, 60))) return res.status(429).json({ error: 'Muitas tentativas.' });
      const state = randomBytes(16).toString('hex');
      addCookie(res, `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      const params = new URLSearchParams({ client_id: DISCORD_ID, redirect_uri: DISCORD_REDIRECT, response_type: 'code', scope: 'identify', state });
      res.writeHead(302, { Location: `https://discord.com/api/oauth2/authorize?${params}` });
      return res.end();
    }

    if(action === 'callback' || (!action && req.query && req.query.code)){
      if(!(await rateLimit(`rl:dc:cb:${ipDe(req)}`, 10, 60))) return res.status(429).json({ error: 'Muitas tentativas.' });
      const { code, state } = req.query;
      if(!code || !state || pegarCookie(req, 'oauth_state') !== state) return res.status(400).json({ error: 'State inválido (CSRF?)' });
      const tok = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: DISCORD_ID, client_secret: DISCORD_SECRET, grant_type: 'authorization_code', code, redirect_uri: DISCORD_REDIRECT })
      }).then(r => r.json());
      if(!tok.access_token) return res.status(400).json({ error: 'Falha ao obter token' });
      const me = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tok.access_token}` } }).then(r => r.json());
      if(!me.id) return res.status(400).json({ error: 'Falha ao obter usuário' });

      const avatar = me.avatar ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=128` : null;
      const username = safeStr(me.global_name || me.username, 60).replace(/[<>]/g, '') || 'Anônimo';
      await redis([['HSET', 'user_profiles', String(me.id), JSON.stringify({ username, avatar, ts: Date.now() })]]);
      const cargo = await cargoDe(me.id);
      setSessao(res, criarToken({ id: String(me.id), username, avatar, admin: !!cargo, cargo: cargo || null, tipo: 'discord' }));
      res.writeHead(302, { Location: '/?login=ok' });
      return res.end();
    }

    return res.status(400).json({ error: 'Ação inválida.' });
  } catch(e){
    return res.status(500).json({ error: 'Erro interno' });
  }
}