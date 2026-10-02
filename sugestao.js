// Vercel serverless: /api/sugestao.js
const recentes = new Map();

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  const hook = process.env.DISCORD_WEBHOOK_URL;
  if (!hook) return res.status(500).json({ error: 'Webhook não configurado' });

  const { nome, texto, site, tipo } = req.body || {};
  const categoria = String(tipo || '').trim().slice(0, 40);
  if (site) return res.status(200).json({ ok: true }); 
  const msg = String(texto || '').trim().slice(0, 1000);
  const autor = String(nome || '').trim().slice(0, 40) || 'Anônimo';
  if (!msg) return res.status(400).json({ error: 'Escreva uma sugestão' });

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const agora = Date.now();
  if (agora - (recentes.get(ip) || 0) < 30000) return res.status(429).json({ error: 'Aguarde um pouco' });
  recentes.set(ip, agora);

  const r = await fetch(hook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      allowed_mentions: { parse: [] },
      embeds: [{ title: categoria ? `💡 Nova mensagem · ${categoria}` : '💡 Nova mensagem', description: msg, color: 0xa855f7,
                 footer: { text: `De: ${autor}` }, timestamp: new Date().toISOString() }]
    })
  });
  return r.ok ? res.status(200).json({ ok: true }) : res.status(502).json({ error: 'Falha ao enviar' });
}