/* ============================================================
   CLIENTE DE API — autenticação e rotas da comunidade
   ============================================================ */
const API_AUTH = '/api/auth';

async function api(base, action, { method = 'GET', body = null, query = null } = {}) {
  const url = new URL(base, window.location.origin);
  if (action) url.searchParams.set('action', action);
  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    });
  }
  const options = {
    method: String(method || 'GET').toUpperCase(),
    credentials: 'same-origin',
    headers: { Accept: 'application/json' }
  };
  if (options.method !== 'GET' && options.method !== 'HEAD') {
    options.headers['Content-Type'] = 'application/json';
    if (body !== null && body !== undefined) options.body = JSON.stringify(body);
  }
  try {
    const response = await fetch(url.toString(), options);
    let data = null;
    try { data = await response.json(); } catch (_) { data = null; }
    if (response.status === 401 && !['login', 'register', 'me'].includes(action)) {
      window.dispatchEvent(new CustomEvent('soso:unauthorized'));
    }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    console.error('[API]', endpointName(base, action), error);
    return { ok: false, status: 0, data: { error: 'Sem conexão com o servidor. Tente novamente.' } };
  }
}
function endpointName(base, action) { return `${base || ''}${action ? `?action=${action}` : ''}`; }
window.API_AUTH = API_AUTH;
window.api = api;
