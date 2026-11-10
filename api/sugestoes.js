// Vercel serverless: /api/sugestoes.js
// O Redis é a fonte oficial das sugestões. O Discord é apenas uma notificação:
// uma falha no webhook não pode apagar uma sugestão já salva.
import { createHash, randomUUID } from 'crypto';
import { redis, validarSessao, rateLimit, origemOk, ipDe, safeStr } from './_lib/core.js';
import { somarAtividade } from './_lib/atividade.js';
import { evento } from './_lib/game.js';
import { pareceTeste } from './_lib/dados-teste.js';

const LIST_KEY = 'sugestoes:lista';
const MAX_ITENS = 200;
const MAX_TEXTO = 200;
const MIN_TEXTO = 10;

function safeUrl(value) {
  const url = safeStr(value, 500);
  return /^https?:\/\//i.test(url) ? url : null;
}

function tipoConfig(categoria) {
  const tipo = String(categoria || '').toLowerCase();
  if (tipo.includes('bug')) return { cor: 0xef4444, icone: '🐛', titulo: 'Novo bug reportado', label: 'Bug' };
  if (tipo.includes('jogo')) return { cor: 0x3b82f6, icone: '🎮', titulo: 'Nova sugestão de jogo', label: 'Jogo' };
  if (tipo.includes('feedback')) return { cor: 0x10b981, icone: '💬', titulo: 'Novo feedback', label: 'Feedback' };
  return { cor: 0xa855f7, icone: '💡', titulo: 'Nova ideia', label: 'Sugestão' };
}

function validarTexto(msg) {
  const texto = String(msg || '').trim();
  if (texto.length < MIN_TEXTO) return `Escreva pelo menos ${MIN_TEXTO} caracteres`;
  if (/(.)\1{7,}/.test(texto)) return 'Evite repetir o mesmo caractere várias vezes';

  const semEspaco = texto.replace(/\s+/g, '');
  const unicos = new Set(semEspaco).size;
  if (semEspaco.length > 15 && unicos < 6) return 'Texto muito repetitivo, escreva uma ideia de verdade 💜';

  const palavras = texto.toLowerCase().split(/\s+/).filter(Boolean);
  if (palavras.length > 5 && new Set(palavras).size / palavras.length < 0.3) {
    return 'Texto muito repetitivo, escreva uma ideia de verdade 💜';
  }
  if (/^(.)\1*$/.test(semEspaco) || /^(0123456789|abcdefghij|abcdefghijklmnopqrstuvwxyz)+$/i.test(semEspaco)) {
    return 'Texto muito repetitivo';
  }
  return null;
}


export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=15, stale-while-revalidate=45');
    try {
      const [flat] = await redis([['LRANGE', LIST_KEY, '0', '-1']]);
      // Resposta pública usa uma projeção explícita: nunca envia userId, avatar,
      // dados internos de moderação ou qualquer informação da conta.
      const itens = (flat || [])
        .map(raw => { try { return JSON.parse(raw); } catch { return null; } })
        .filter(Boolean)
        .filter(item => !pareceTeste(item))
        .map(item => ({
          id: safeStr(item.id, 80),
          nome: safeStr(item.nome || 'Anônimo', 40),
          tipo: safeStr(item.tipo || 'Sugestão / ideia', 40),
          texto: safeStr(item.texto, MAX_TEXTO),
          status: ['nova','analise','aceita','recusada','concluido'].includes(item.status) ? item.status : 'nova',
          data: safeStr(item.data, 40),
          motivo: item.status === 'recusada' ? safeStr(item.motivo, 200) : null
        }));
      return res.status(200).json({ itens });
    } catch (error) {
      console.error('[Sugestões] Falha ao consultar lista:', error?.message || error);
      return res.status(503).json({ error: 'Não foi possível carregar as sugestões. Verifique a conexão com o banco e tente novamente.' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  if (!origemOk(req)) return res.status(403).json({ error: 'Origem inválida' });

  const { nome, texto, site, tipo, anonimo } = req.body || {};
  if (site) return res.status(200).json({ ok: true }); // honeypot anti-bot

  const msg = safeStr(texto, MAX_TEXTO);
  if (!msg) return res.status(400).json({ error: 'Escreva uma sugestão' });
  if (msg.length < MIN_TEXTO) return res.status(400).json({ error: `Escreva pelo menos ${MIN_TEXTO} caracteres` });
  const erroValidacao = validarTexto(msg);
  if (erroValidacao) return res.status(400).json({ error: erroValidacao });

  const ip = ipDe(req);
  try {
    // O limite é fechado: se Redis estiver indisponível, não aceita uma operação
    // que depende dele para impedir spam e persistir a sugestão.
    if (!(await rateLimit(`ratelimit:sug:${ip}`, 1, 30))) {
      return res.status(429).json({ error: 'Aguarde um pouco antes de enviar de novo' });
    }

    const hash = createHash('sha256').update(`${ip}|${msg.toLowerCase()}`).digest('hex').slice(0, 24);
    if (!(await rateLimit(`ratelimit:sugdup:${hash}`, 1, 120))) {
      return res.status(429).json({ error: 'Você já enviou essa mensagem. Aguarde.' });
    }

    const sessao = await validarSessao(req);
    // O modo anônimo oculta a autoria pública, mas não pode ser usado para
    // contornar a moderação de uma conta autenticada que esteja banida.
    if(sessao?.id){
      const [banido] = await redis([['HEXISTS', 'banidos', String(sessao.id)]]);
      if(Number(banido) === 1) return res.status(403).json({ error: 'Sua conta não pode enviar sugestões nesta comunidade.' });
    }
    const enviarAnonimo = anonimo === true || anonimo === 'true';
    const userId = !enviarAnonimo && sessao?.id ? String(sessao.id) : null;
    const usernameLogado = userId && sessao?.username ? safeStr(sessao.username, 60) : null;
    const avatarLogado = userId ? safeUrl(sessao?.avatar) : null;
    const autor = userId ? (safeStr(usernameLogado, 40) || 'Membro') : (enviarAnonimo ? 'Anônimo' : (safeStr(nome, 40) || 'Anônimo'));
    const categoria = safeStr(tipo, 40) || 'Sugestão / ideia';

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

    // Persistência obrigatória. Só confirmamos o envio depois que Redis aceitar.
    await redis([
      ['LPUSH', LIST_KEY, JSON.stringify(item)],
      ['LTRIM', LIST_KEY, '0', String(MAX_ITENS - 1)]
    ]);

    // Logs e integrações externas são complementares, nunca bloqueiam o salvamento.
    try {
      const log = JSON.stringify({
        quem: autor,
        cargo: null,
        acao: `Nova sugestão (${categoria}): "${msg.slice(0, 60)}${msg.length > 60 ? '…' : ''}"`,
        ts: Date.now()
      });
      await redis([['LPUSH', 'admin:logs', log], ['LTRIM', 'admin:logs', '0', '199']]);
    } catch (error) {
      console.warn('[Sugestões] Não foi possível registrar log administrativo:', error?.message || error);
    }

    let estatisticaPendente = false;
    if (userId) {
      try {
        await somarAtividade(userId, 'suggestions', 1);
        await evento(userId, 'sugestao_enviada', item.id);
      }
      catch (error) { estatisticaPendente = true; console.error('[Sugestões] Sugestão salva, mas a estatística ficou pendente:', error?.message || error); }
    }

    let discordNotificado = false;
    const hook = process.env.DISCORD_WEBHOOK_URL;
    if (hook) {
      const config = tipoConfig(categoria);
      const embed = {
        author: {
          name: `@${autor}${userId ? '' : ' (anônimo)'}`,
          ...(avatarLogado ? { icon_url: avatarLogado } : {})
        },
        title: `${config.icone} ${config.titulo}`,
        description: msg,
        color: config.cor,
        fields: [
          { name: '🏷️ Tipo', value: `${config.icone} ${config.label}`, inline: true },
          { name: '📊 Status', value: '🟡 Nova', inline: true },
          { name: '👤 Canal', value: userId ? '🔒 Logado' : '👤 Anônimo', inline: true }
        ],
        footer: { text: `ID: ${item.id.slice(0, 8)}` },
        timestamp: new Date().toISOString()
      };
      try {
        const response = await fetch(hook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ allowed_mentions: { parse: [] }, embeds: [embed] })
        });
        discordNotificado = response.ok;
        if (!response.ok) console.warn('[Sugestões] Discord respondeu HTTP', response.status);
      } catch (error) {
        console.warn('[Sugestões] Notificação Discord indisponível:', error?.message || error);
      }
    }

    return res.status(201).json({
      ok: true,
      id: item.id,
      discordNotificado,
      estatisticaPendente,
      aviso: !discordNotificado ? 'A sugestão foi salva no site. A notificação do Discord não foi enviada.' : null
    });
  } catch (error) {
    console.error('[Sugestões] Falha ao salvar sugestão:', error?.message || error);
    return res.status(503).json({ error: 'Não foi possível salvar sua sugestão agora. Nenhum envio foi confirmado; tente novamente mais tarde.' });
  }
}
