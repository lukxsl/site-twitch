// Vercel serverless: /api/game
// Rota fina: toda a lógica vive em _lib/game-api.js (a pasta "_" não é exposta).
import handler from './_lib/game-api.js';

export default handler;
