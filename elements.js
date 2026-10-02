// Vercel serverless: /api/atividade.js
// Feed de atividade (último sub, raid, doação...) via StreamElements.
// Variáveis na Vercel: SE_JWT (StreamElements > Account > Channels > Show secrets > JWT Token)
//                      SE_CHANNEL_ID (o "Account ID" da mesma tela)
// Sem as variáveis, devolve lista vazia e o site usa CONFIG.atividadeManual.
const MAPA = { subscriber: 'sub', tip: 'tip', raid: 'raid', host: 'raid', follow: 'follow', cheer: 'cheer' };

export default async function handler(req, res) {
  const jwt = process.env.SE_JWT, canal = process.env.SE_CHANNEL_ID;
  if (!jwt || !canal) return res.status(200).json({ itens: [], aviso: 'StreamElements não configurado' });
  try {
    const r = await fetch(`https://api.streamelements.com/kappa/v2/activities/${canal}?limit=100`, {
      headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' }
    });
    if (!r.ok) return res.status(200).json({ itens: [], aviso: `StreamElements respondeu HTTP ${r.status}` });
    const lista = await r.json();
    const vistos = {}, itens = [];
    for (const a of (Array.isArray(lista) ? lista : [])) {
      const tipo = MAPA[a.type];
      if (!tipo || vistos[tipo]) continue;
      vistos[tipo] = true;
      const d = a.data || {};
      itens.push({ tipo, usuario: d.displayName || d.username || 'alguém', valor: d.amount || null, data: a.createdAt });
    }
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=60');
    return res.status(200).json({ itens });
  } catch (e) {
    return res.status(200).json({ itens: [], aviso: 'Erro ao consultar o StreamElements' });
  }
}