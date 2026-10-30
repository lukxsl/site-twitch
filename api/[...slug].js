// api/[...slug].js
export default async function handler(req, res) {
  const { slug } = req.query;
  // Pega o nome da rota (ex: se a url for /api/votos, o slug será ['votos'])
  const route = Array.isArray(slug) ? slug[0] : slug;

  if (!route) {
    return res.status(404).json({ error: 'Rota não especificada' });
  }

  try {
    // Importa dinamicamente o handler que está na pasta api_handlers
    const module = await import(`../api_handlers/${route}.js`);
    const routeHandler = module.default || module;

    // Executa a função original
    return await routeHandler(req, res);
  } catch (error) {
    console.error(`[API Router] Erro ao carregar a rota /api/${route}:`, error);
    return res.status(404).json({ error: `Rota /api/${route} não encontrada ou erro interno.` });
  }
}