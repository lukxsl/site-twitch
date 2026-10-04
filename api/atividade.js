// Vercel serverless: /api/atividade.js
// StreamElements removido. Sempre retorna lista vazia (frontend esconde o bloco).
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(200).json({ itens: [] });
}