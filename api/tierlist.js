// Vercel serverless: /api/tierlist.js
// Se o Redis estiver VAZIO (primeira vez), salva os jogos/filmes padrão.
// Assim admin e público sempre mostram a mesma coisa.
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const JOGOS_PADRAO = [
  {
    id: 'red-dead-2', nome: 'Red Dead Redemption 2', appid: 1174180,
    tier: 'S', status: 'Jogando', nota: 8, horas: 50,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/1174180/library_600x900.jpg',
    comentario: 'Um dos mundos mais vivos e detalhados dos games.'
  },
  {
    id: 'hollow-knight', nome: 'Hollow Knight', tier: 'S', status: 'Zerado', nota: 9, horas: 40,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/367520/library_600x900.jpg',
    comentario: ''
  },
  {
    id: 'stardew-valley', nome: 'Stardew Valley', tier: 'A', status: 'Jogando', nota: 8, horas: 120,
    capa: 'https://cdn.cloudflare.steamstatic.com/steam/apps/413150/library_600x900.jpg',
    comentario: ''
  }
];

const FILMES_PADRAO = [
  {
    id: 'interestelar', nome: 'Interestelar', tier: 'S', status: 'Assistido', nota: 9,
    duracao: 169, ano: 2014,
    capa: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    comentario: 'As reservas naturais da Terra estão chegando ao fim e um grupo de astronautas recebe a missão de verificar possíveis planetas para receberem a população mundial.'
  }
];

async function redis(cmds) {
  const r = await fetch(`${URL_}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  return (await r.json()).map(x => x.result);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });
  if (!URL_ || !TOKEN) {
    return res.status(200).json({ jogos: JOGOS_PADRAO, filmes: FILMES_PADRAO, aviso: 'Redis não configurado' });
  }

  try {
    const [jogosRaw, filmesRaw] = await redis([
      ['GET', 'tierlist:jogos'],
      ['GET', 'tierlist:filmes']
    ]);

    let jogos, filmes;
    let comandoSalvar = [];

    // Se a chave não existe (primeira vez), seed com o padrão
    if (jogosRaw === null || jogosRaw === undefined) {
      jogos = JOGOS_PADRAO;
      comandoSalvar.push(['SET', 'tierlist:jogos', JSON.stringify(jogos)]);
    } else {
      try { jogos = JSON.parse(jogosRaw); if (!Array.isArray(jogos)) jogos = []; } catch(e){ jogos = []; }
    }

    if (filmesRaw === null || filmesRaw === undefined) {
      filmes = FILMES_PADRAO;
      comandoSalvar.push(['SET', 'tierlist:filmes', JSON.stringify(filmes)]);
    } else {
      try { filmes = JSON.parse(filmesRaw); if (!Array.isArray(filmes)) filmes = []; } catch(e){ filmes = []; }
    }

    if (comandoSalvar.length) await redis(comandoSalvar);

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=30');
    return res.status(200).json({ jogos, filmes });
  } catch (e) {
    return res.status(200).json({ jogos: JOGOS_PADRAO, filmes: FILMES_PADRAO, aviso: e.message });
  }
}