const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  kids.flat().forEach(c => n.append(c instanceof Node ? c : document.createTextNode(c ?? '')));
  return n;
};
const api = async (url, opts) => {
  const r = await fetch(url, { credentials: 'same-origin', ...opts });
  const d = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, d };
};
const seguro = u => (typeof u === 'string' && /^https:\/\//.test(u)) ? u : '';
const img = (src, alt = '') => src && seguro(src) ? el('img', { src, alt, loading: 'lazy', onerror: e => e.target.remove() }) : '';
const tempo = iso => { const m = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60000)); return m < 60 ? `há ${m} min` : m < 1440 ? `há ${Math.round(m / 60)} h` : `há ${Math.round(m / 1440)} d`; };

/* ---------- navegação ---------- */
const ROTAS = ['inicio', 'tierlist', 'votar', 'comunidade'];
function rota() {
  const r = ROTAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
  ROTAS.forEach(id => { $(id).hidden = id !== r; });
  document.querySelectorAll('#menu a').forEach(a => a.classList.toggle('on', a.hash === '#' + r));
  if (r === 'votar') carregarVotos();
  window.scrollTo(0, 0);
}
addEventListener('hashchange', rota);

/* ---------- conta ---------- */
async function conta() {
  const { d } = await api('/api/auth?action=me');
  const box = $('conta'); box.replaceChildren();
  if (!d.logado) { box.append(el('a', { class: 'btn vazio', href: '/api/auth?action=login' }, 'Entrar com Discord')); return; }
  box.append(img(d.avatar), el('span', {}, d.username));
  if (d.admin) box.append(el('a', { class: 'btn vazio', href: '/antigo/#admin' }, 'Admin'));
  box.append(el('button', { class: 'btn vazio', onclick: async () => { await api('/api/auth?action=logout'); location.reload(); } }, 'Sair'));
}

/* ---------- twitch + home ---------- */
async function twitch() {
  const { ok, d } = await api('/api/twitch');
  if (!ok) return;
  const on = !!d.stream;
  $('ponto').classList.toggle('on', on);
  $('tvStatus').textContent = on ? 'Ao vivo' : 'Offline';
  $('tvInfo').textContent = on ? `${d.stream.viewer_count} assistindo · ${d.stream.game_name || ''}` : '@asemtet0';
  if (on && !$('tvTela').querySelector('iframe')) {
    $('tvTela').replaceChildren(el('iframe', { src: `https://player.twitch.tv/?channel=asemtet0&parent=${location.hostname}&muted=true`, allowfullscreen: '', title: 'Live da Soso' }));
  }
  const num = (n, l) => el('div', {}, el('b', {}, n), el('span', {}, l));
  $('numeros').replaceChildren(
    ...(d.followers ? [num(d.followers.toLocaleString('pt-BR'), 'seguidores')] : []),
    ...(d.discord ? [num(d.discord.toLocaleString('pt-BR'), 'no Discord')] : []),
    ...(d.horasMes ? [num(d.horasMes + ' h', 'de live neste mês')] : []),
    ...(on ? [num(d.stream.uptime, 'no ar')] : []));
  if (d.discord) $('dcInfo').textContent = `${d.discord.toLocaleString('pt-BR')} pessoas por lá. Avisos de live, calls de jogo, memes e resenha.`;
  const jogo = d.game;
  $('ultimoJogo').replaceChildren(el('h2', {}, on ? 'Jogando agora' : 'Jogo do canal'),
    jogo ? el('div', { class: 'capa-row' }, img(jogo.box_art), el('div', {}, el('b', {}, jogo.name), el('p', { class: 'mudo' }, on ? 'Passa aqui na live.' : 'Última categoria da live.'))) : el('p', { class: 'mudo' }, 'Sem jogo definido.'));
  $('vodsGrade').replaceChildren(...(d.videos || []).slice(0, 6).map(v =>
    el('a', { href: `https://www.twitch.tv/videos/${encodeURIComponent(v.id)}`, target: '_blank', rel: 'noopener' }, img(v.thumbnail), el('span', {}, `${v.title || 'Live'} · ${tempo(v.created_at)}`))));
  if (!(d.videos || []).length) $('vods').hidden = true;
  if ((d.clips || []).length) $('clipes').replaceChildren(...d.clips.map(c =>
    el('a', { href: `https://clips.twitch.tv/${encodeURIComponent(c.id)}`, target: '_blank', rel: 'noopener' }, img(c.thumbnail), el('span', {}, c.title))));
}
async function config() {
  const { d } = await api('/api/config');
  if (d.aviso && (d.aviso.texto || d.aviso.titulo)) { const a = $('aviso'); a.hidden = false; a.replaceChildren(el('b', {}, d.aviso.titulo || 'Aviso'), ' ', d.aviso.texto || ''); }
  if (d.updatedAt) { const t = new Date(isNaN(d.updatedAt) ? d.updatedAt : Number(d.updatedAt)); if (!isNaN(t)) $('atualizado').textContent = 'atualizado em ' + t.toLocaleDateString('pt-BR'); }
}
async function musica() {
  const { d } = await api('/api/lastfm');
  if (!d.tocando) return;
  $('tocando').replaceChildren(el('h2', {}, 'Na trilha agora'),
    el('div', { class: 'capa-row' }, img(d.capa), el('div', {}, el('b', {}, d.faixa), el('p', { class: 'mudo' }, d.artista))));
}

/* ---------- tier list ---------- */
let TL = { jogos: [], filmes: [] }, modo = 'jogos';
const ORDEM = ['S', 'A', 'B', 'C', 'D', 'E', 'F'];
function desenharTiers() {
  const q = $('busca').value.trim().toLowerCase();
  const lista = (TL[modo] || []).filter(j => !q || String(j.nome).toLowerCase().includes(q));
  const tiers = [...new Set(lista.map(j => String(j.tier || '?').toUpperCase()))].sort((a, b) => (ORDEM.indexOf(a) + 99) % 99 - (ORDEM.indexOf(b) + 99) % 99);
  $('tiers').replaceChildren(...(tiers.length ? tiers.map(t => el('div', { class: 'tier', 'data-t': t },
    el('b', {}, t),
    el('div', { class: 'tier-itens' }, lista.filter(j => String(j.tier || '?').toUpperCase() === t).map(j =>
      el('button', { class: 'item', onclick: () => detalhe(j) }, img(j.capa) || el('div', { class: 'sem' }, '🎮'), el('small', {}, j.nome)))))) : [el('p', { class: 'mudo' }, 'Nada encontrado.')]));
}
function detalhe(j) {
  const info = [j.status, j.nota != null ? `Nota ${j.nota}` : '', j.horas ? `${j.horas} h` : '', j.duracao ? `${j.duracao} min` : '', j.ano].filter(Boolean).join(' · ');
  $('dlgCorpo').replaceChildren(img(j.capa), el('h3', {}, j.nome), el('p', { class: 'mudo' }, `Tier ${j.tier} · ${info}`), j.comentario ? el('p', {}, j.comentario) : '');
  $('dlg').showModal();
}
async function tierlist() { const { d } = await api('/api/tierlist'); TL = { jogos: d.jogos || [], filmes: d.filmes || [] }; desenharTiers(); }
$('busca').addEventListener('input', desenharTiers);
$('modo').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; modo = b.dataset.m; document.querySelectorAll('#modo button').forEach(x => x.classList.toggle('on', x === b)); desenharTiers(); });
$('dlg').addEventListener('click', e => { if (e.target === $('dlg')) $('dlg').close(); });

/* ---------- votos e sugestões ---------- */
async function carregarVotos(escolha) {
  const box = $('votos');
  const { status, d } = await api('/api/votos', escolha ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: escolha }) } : undefined);
  if (status === 401) { box.replaceChildren(el('p', { class: 'mudo' }, 'Entre com o Discord para votar. É um voto por pessoa e dá pra trocar depois.'), el('a', { class: 'btn', href: '/api/auth?action=login' }, 'Entrar com Discord')); return; }
  if (!d.opcoes) { box.replaceChildren(el('p', { class: 'mudo' }, d.error || 'Não deu para carregar a votação.')); return; }
  const max = Math.max(1, ...d.opcoes.map(o => o.votos));
  box.replaceChildren(...d.opcoes.sort((a, b) => b.votos - a.votos).map(o =>
    el('button', { class: 'voto' + (o.id === d.meuVoto ? ' meu' : ''), onclick: () => carregarVotos(o.id) },
      el('i', { style: `width:${Math.round(o.votos / max * 100)}%` }), img(o.capa) || el('span', {}, '🎮'), el('b', {}, o.nome), el('span', {}, `${o.votos} ${o.votos === 1 ? 'voto' : 'votos'}`))));
}
$('form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.target.querySelector('button'), st = $('sStatus');
  btn.disabled = true; st.textContent = 'Enviando…';
  const { ok, d } = await api('/api/sugestoes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: $('sNome').value, tipo: $('sTipo').value, texto: $('sTexto').value, site: $('sSite').value }) });
  st.textContent = ok ? 'Mensagem enviada. Obrigada!' : (d.error || 'Não foi possível enviar. Tente de novo.');
  if (ok) $('sTexto').value = '';
  btn.disabled = false;
});

rota(); conta(); twitch(); config(); musica(); tierlist();
setInterval(twitch, 60000);
