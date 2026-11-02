// OAuth callback dedicado da Twitch. Usar um caminho sem query string facilita
// o cadastro exato do Redirect URL no Twitch Developers.
import authHandler from './auth.js';

export default async function handler(req, res) {
  req.query = { ...(req.query || {}), action: 'twitch-callback' };
  return authHandler(req, res);
}
