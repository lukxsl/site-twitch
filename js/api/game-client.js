/* ============================================================
   API — CLIENTE DO ARCADE
   Centraliza as chamadas de autenticação e de jogo.
   Regra de ouro: o front só LÊ o estado e PEDE ações.
   NUNCA calcula XP, nível, moedas ou inventário.
   ============================================================ */
const API_AUTH = '/api/auth';
const API_GAME = '/api/game';

/**
 * Chama a API e devolve sempre { ok, status, data }.
 * Erros de rede/JSON também viram uma resposta previsível.
 */
async function api(base, action, { method = 'GET', body = null, query = null } = {}) {
  const url = new URL(base, window.location.origin);
  if (action) url.searchParams.set('action', action);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    });
  }

  const opts = {
    method: String(method || 'GET').toUpperCase(),
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  };

  if (opts.method !== 'GET' && opts.method !== 'HEAD') {
    opts.headers['Content-Type'] = 'application/json';
    if (body !== null && body !== undefined) opts.body = JSON.stringify(body);
  }

  try {
    const res = await fetch(url.toString(), opts);
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }

    if (res.status === 401 && action !== 'login' && action !== 'register' && action !== 'me') {
      window.dispatchEvent(new CustomEvent('soso:unauthorized'));
    }

    return { ok: res.ok, status: res.status, data };
  } catch (_) {
    return {
      ok: false,
      status: 0,
      data: { error: 'Sem conexão com o servidor. Tente novamente.' }
    };
  }
}

window.API_AUTH = API_AUTH;
window.API_GAME = API_GAME;
window.api = api;
