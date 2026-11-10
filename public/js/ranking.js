/* ============================================================
   RANKING UI — Tudo vindo do StreamElements
   Abas: horas · pontos · chat · músicas
   ============================================================ */
(function () {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const PAGE = 25;

  const MODES = {
    horas:    { titulo: 'Horas assistidas',  desc: 'Tempo de tela registrado pelo StreamElements.',            eyebrow: 'FIDELIDADE · STREAMELEMENTS', vazio: 'Ainda não há tempo assistido registrado.' },
    pontos:   { titulo: 'Pontos do canal',   desc: 'Pontos de fidelidade acumulados no StreamElements.',       eyebrow: 'FIDELIDADE · STREAMELEMENTS', vazio: 'Ainda não há pontos registrados.' },
    chat:     { titulo: 'Mais ativos no chat', desc: 'Quem mais conversa no chat do canal.',                   eyebrow: 'CHAT · STREAMELEMENTS', vazio: 'Ainda não há mensagens contabilizadas.' },
    musicas:  { titulo: 'Músicas mais tocadas', desc: 'Faixas mais tocadas da conta Last.fm vinculada à Soso.', eyebrow: 'MÚSICAS · LAST.FM', vazio: 'Não há dados reais do Last.fm disponíveis no momento.' }
  };

  let mode = 'horas';
  let seq = 0;
  let shown = PAGE;
  let query = '';
  const cache = {}; // modo -> { rows, meta, at }
  const REFRESH_COOLDOWN = 30_000;
  let refreshUntil = 0;
  let refreshTick = null;

  /* ---------- helpers ---------- */
  const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; return e; };
  const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
  const fmt = n => nf.format(Number(n) || 0);
  const norm = s => String(s || '').toLowerCase().replace(/^@/, '').trim();

  function minutos(m) {
    m = Math.max(0, Math.round(Number(m) || 0));
    const h = Math.floor(m / 60), r = m % 60;
    if (!h) return `${r}min`;
    if (h >= 100) return `${fmt(h)}h`;
    return r ? `${h}h ${r}min` : `${h}h`;
  }
  function valorTxt(r) {
    switch (mode) {
      case 'horas': return minutos(r.valor);
      case 'pontos': return fmt(r.valor);
      case 'chat': return `${fmt(r.valor)} msg`;
      case 'musicas': return `${fmt(r.valor)}×`;
    }
    return fmt(r.valor);
  }
  function subTxt(r) {
    switch (mode) {
      case 'horas': return r.pos <= 3 ? 'Presença VIP' : 'Tempo de tela';
      case 'pontos': return 'Pontos do canal';
      case 'chat': return 'Mensagens no chat';
      case 'musicas': return r.artista || 'Faixa do mês';
    }
    return '';
  }

  function avatar(r) {
    const nome = String(r.nome || '?');
    let hue = 0; for (const c of nome) hue = (hue * 31 + c.charCodeAt(0)) % 360;
    const w = el('span', 'rk-av');
    w.style.setProperty('--h', hue);
    w.append(el('span', null, (nome.replace(/^@/, '').charAt(0) || '?').toUpperCase()));
    const url = String(r.avatar || r.capa || '');
    if (/^(https:\/\/|\/|data:image\/)/i.test(url)) {
      const img = new Image();
      img.alt = ''; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer';
      img.onerror = () => img.remove();
      img.src = url;
      w.append(img);
    }
    return w;
  }

  /* ---------- normalização por origem ---------- */
  function normSE(data) {
    if (!data || data.ok === false) {
      const e = new Error(data?.erro || 'Falha ao consultar o StreamElements.');
      e.codigo = data?.codigo; throw e;
    }
    return {
      rows: (data.lista || []).map((r, i) => ({ ...r, pos: r.pos || i + 1, nome: r.nome || 'Anônimo', valor: Number(r.valor) || 0 })),
      meta: {
        total: data.total,
        resumo: data.resumo || null,
        at: data.updatedAt,
        desatualizado: !!data.desatualizado,
        aviso: data.aviso || null
      }
    };
  }

  async function requestMode(m, force) {
    if (m === 'musicas') {
      const response = await fetch('/api/lastfm' + (force ? `?_t=${Date.now()}` : ''), { cache: 'no-store' });
      if (!response.ok) throw new Error(`Erro ao consultar o Last.fm (HTTP ${response.status}).`);
      const data = await response.json();
      const itens = Array.isArray(data?.top?.itens) ? data.top.itens : [];
      const rows = itens.map((item, i) => ({
        pos: i + 1,
        nome: String(item.faixa || '').trim(),
        artista: String(item.artista || '').trim(),
        valor: Math.max(0, Number(item.plays) || 0),
        capa: item.capa || null,
        url: item.url || null
      })).filter(item => item.nome);
      return {
        rows,
        meta: {
          total: rows.length,
          resumo: { faixas: rows.length, totalTocadas: rows.reduce((sum, item) => sum + item.valor, 0), periodo: data?.top?.periodo || null },
          at: data?.updatedAt || Date.now()
        }
      };
    }
    const q = new URLSearchParams({ action: 'ranking-se', modo: m, limit: '100', ...(force ? { _t: String(Date.now()) } : {}) });
    const res = await fetch('/api/config?' + q.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`Erro ao consultar o servidor (HTTP ${res.status}).`);
    return normSE(await res.json());
  }

  /* ---------- sua posição ---------- */
  function meIdentity() {
    const acc = (typeof USUARIO !== 'undefined' && USUARIO) ? USUARIO : {};
    return {
      logado: !!acc?.logado,
      nomes: [acc?.nick, acc?.username, acc?.twitch?.login].filter(Boolean).map(norm),
      nick: acc?.nick || acc?.username || 'Pessoa da comunidade',
      foto: acc?.avatar || acc?.picture || acc?.google?.picture || null,
      p: acc
    };
  }
  function findMe(rows, me) {
    if (!me.logado) return null;
    return rows.find(r => me.nomes.includes(norm(r.nome))) || null;
  }

  function renderMe(rows) {
    const box = $('#rankingYourContent'); if (!box) return;
    const login = $('#rankingLoginBtn');
    const me = meIdentity();

    if (mode === 'musicas') {
      if (login) login.hidden = true;
      box.replaceChildren();
      box.append(el('h4', 'rk-me-title', '🎵 Ranking de músicas'));
      box.append(el('p', 'rk-me-empty', rows
        ? `As ${rows.length} faixas reais retornadas pela conta Last.fm da Soso (${MODES.musicas.titulo.toLowerCase()}).`
        : 'Carregando as músicas mais tocadas do mês…'));
      return;
    }

    if (login) login.hidden = me.logado;
    box.replaceChildren();

    if (!me.logado) {
      box.append(el('h4', 'rk-me-title', 'Sua posição'), el('p', 'rk-me-empty', 'Entre na sua conta para acompanhar sua posição no ranking.'));
      return;
    }
    const mine = rows ? findMe(rows, me) : null;
    const head = el('div', 'rk-me-head');
    const info = el('div'); info.style.minWidth = 0;
    info.append(el('div', 'rk-me-name', me.nick));
    info.append(el('div', 'rk-me-pos', !rows ? MODES[mode].titulo : mine ? `Você está em #${mine.pos} · ${MODES[mode].titulo}` : `Fora do top ${rows.length || 100}`));
    head.append(avatar({ nome: me.nick, avatar: me.foto }), info);
    box.append(head);
    if (!rows) return;

    const lines = el('div', 'rk-me-lines');
    const line = (a, b) => { const l = el('div', 'rk-me-line'); l.append(el('span', null, a), el('b', null, b)); lines.append(l); };
    if (mine) {
      line(MODES[mode].titulo, valorTxt(mine));
      const acima = mine.pos > 1 ? rows[mine.pos - 2] : null;
      if (acima) line('Para subir', mode === 'horas' ? minutos(acima.valor - mine.valor) : fmt(acima.valor - mine.valor));
    } else {
      box.append(el('p', 'rk-me-empty', 'Não encontramos você nesta categoria. Vincule sua conta da Twitch no perfil para aparecer com o mesmo nick do canal.'));
    }
    if (lines.childElementCount) box.append(lines);
  }

  /* ---------- render ---------- */
  function podiumSlot(r, place, meIds) {
    const cls = { 1: 'rk-pod-1', 2: 'rk-pod-2', 3: 'rk-pod-3' }[place];
    const e = el('article', `rk-pod ${cls}` + (r ? '' : ' is-empty') + (r && isMe(r, meIds) ? ' is-me' : ''));
    if (place === 1) e.append(el('span', 'rk-pod-crown', r ? '👑' : '·'));
    const av = el('div', 'rk-pod-av');
    av.append(avatar(r || { nome: '?' }), el('span', 'rk-pod-badge', String(place)));
    const block = el('div', 'rk-pod-block');
    block.append(el('span', 'rk-pod-val', r ? valorTxt(r) : '—'), el('span', 'rk-pod-medal', place === 1 ? '🥇' : place === 2 ? '🥈' : '🥉'));
    e.append(av, el('div', 'rk-pod-name', r ? r.nome : 'Vaga livre'), el('div', 'rk-pod-sub', r ? subTxt(r) : 'pode ser você'), block);
    return e;
  }
  const isMe = (r, me) => me.logado && (me.nomes.includes(norm(r.nome)));

  function renderStats(meta, rows) {
    const box = $('#rkStats'); if (!box) return;
    box.replaceChildren();
    const add = (k, v) => { const s = el('div', 'rk-stat'); const b = el('b'); b.innerHTML = ''; b.textContent = v; s.append(el('small', null, k), b); box.append(s); };
    const total = meta?.total ?? rows.length;
    if (mode === 'musicas') {
      add('Faixas no ranking', fmt(total));
      if (rows[0]) add('Mais tocada', rows[0].nome);
      if (rows[0]) add('Tocadas do líder', valorTxt(rows[0]));
      add('Total de plays', fmt(meta?.resumo?.totalTocadas || rows.reduce((a, r) => a + (Number(r.valor) || 0), 0)));
      box.hidden = false;
      return;
    }
    if (mode === 'chat' && meta?.resumo) {
      add('No ranking', fmt(rows.length));
      if (meta.resumo.mensagens) add('Mensagens no total', fmt(meta.resumo.mensagens));
      const top = meta.resumo.emotes?.[0];
      if (top?.nome) add('Emote mais usado', `${top.nome} · ${fmt(top.usos)}x`);
    } else {
      add('Participantes', fmt(total));
      if (rows[0]) add('Líder', rows[0].nome);
      if (rows[0]) add('Marca do líder', valorTxt(rows[0]));
    }
    if (meta?.aviso) box.append(el('p', 'rk-stale-note', '⚠️ ' + meta.aviso));
    box.hidden = !box.childElementCount;
  }

  function renderList(rows, animar = true) {
    const list = $('#rankingList'), more = $('#rkMore'); if (!list) return;
    const me = meIdentity();
    const q = norm(query);
    const filtered = q ? rows.filter(r => norm(r.nome).includes(q)) : rows.slice(3);
    list.replaceChildren();
    list.classList.toggle('is-refresh', !animar);

    if (!filtered.length) {
      const st = el('div', 'rk-state');
      if (q) st.append(el('span', 'rk-ic', '🔎'), el('div', null, `Ninguém encontrado para “${query}”.`));
      else if (!rows.length) st.append(el('span', 'rk-ic', '🏁'), el('div', null, MODES[mode].vazio));
      else st.append(el('span', 'rk-ic', '✨'), el('div', null, 'O pódio é tudo por enquanto. Os próximos nomes aparecem aqui.'));
      list.append(st);
      if (more) more.hidden = true;
      return;
    }
    const top = rows[0]?.valor || 1;
    filtered.slice(0, shown).forEach((r, i) => {
      const row = el('article', 'rk-row' + (isMe(r, me) ? ' is-me' : ''));
      row.style.setProperty('--i', Math.min(i, 20));
      row.style.setProperty('--w', Math.max(4, Math.round((r.valor / top) * 100)) + '%');
      const who = el('div', 'rk-who'); who.append(el('b', 'rk-nick', r.nome), el('small', 'rk-sub', subTxt(r)));
      row.append(el('strong', 'rk-pos', '#' + r.pos), avatar(r), who, el('strong', 'rk-val', valorTxt(r)));
      list.append(row);
    });
    if (more) {
      const left = filtered.length - shown;
      more.hidden = left <= 0;
      if (left > 0) more.textContent = `Mostrar mais (${left})`;
    }
  }

  let assinaturaPodio = '';

  function render() {
    const c = cache[mode]; if (!c) return;
    const rows = c.rows, me = meIdentity();
    const primeira = !c.pintado;
    const podium = $('#rankingPodium');
    // A atualização automática não deve reanimar o pódio a cada minuto:
    // só redesenha quando o Top 3 realmente mudou.
    const assinatura = mode + ':' + rows.slice(0, 3).map(r => `${r.nome}|${r.valor}`).join('~');
    if (podium && (primeira || assinatura !== assinaturaPodio)) {
      assinaturaPodio = assinatura;
      podium.hidden = false;
      podium.replaceChildren(podiumSlot(rows[1], 2, me), podiumSlot(rows[0], 1, me), podiumSlot(rows[2], 3, me));
    }
    renderStats(c.meta, rows);
    renderList(rows, primeira);
    renderMe(rows);
    c.pintado = true;
    const up = $('#rkUpdated');
    if (up) {
      const at = c.meta?.at || c.at;
      up.hidden = false;
      up.textContent = textoAtualizado(at);
      up.classList.toggle('is-stale', !!c.meta?.desatualizado);
      up.title = at ? `Dados de ${new Date(at).toLocaleString('pt-BR')}` : '';
    }
  }

  // "Atualizado agora / há 5 min / há 2h / há 1 dia"
  function textoAtualizado(ts) {
    if (!ts) return '';
    const seg = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (seg < 60) return 'Atualizado agora';
    const min = Math.floor(seg / 60);
    if (min < 60) return `Atualizado há ${min} min`;
    const horas = Math.floor(min / 60);
    if (horas < 24) return `Atualizado há ${horas}h`;
    const dias = Math.floor(horas / 24);
    return `Atualizado há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  }

  function setAtualizando(ativo) {
    const el = $('#rkUpdating');
    if (el) el.hidden = !ativo;
  }

  function renderHead() {
    const m = MODES[mode];
    const root = $('#rankingContainer'); if (root) root.dataset.mode = mode;
    const t = $('#rkTitle'), d = $('#rkDesc'), e = $('#rkEyebrow');
    if (t) t.textContent = m.titulo; if (d) d.textContent = m.desc; if (e) e.textContent = m.eyebrow;
    const search = $('#rkSearch');
    if (search) search.placeholder = mode === 'musicas' ? 'Buscar música…' : 'Buscar nick…';
    document.querySelectorAll('[data-ranking-mode]').forEach(b => {
      const on = b.dataset.rankingMode === mode;
      b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on));
    });
  }

  function renderLoading() {
    const list = $('#rankingList'); if (!list) return;
    list.replaceChildren(...Array.from({ length: 6 }, () => el('div', 'rk-skel')));
    const more = $('#rkMore'); if (more) more.hidden = true;
  }

  function renderError(err) {
    const list = $('#rankingList'); if (!list) return;
    const podium = $('#rankingPodium'); if (podium) { podium.replaceChildren(); podium.hidden = true; }
    const stats = $('#rkStats'); if (stats) stats.hidden = true;
    const st = el('div', 'rk-state is-error');
    const msg = 'Não conseguimos falar com o StreamElements agora. Tente novamente em instantes.';
    st.append(el('span', 'rk-ic', '⚠️'), el('div', null, msg));
    if (err?.message) { const d = el('small', 'rk-sub', err.message); d.style.whiteSpace = 'normal'; st.append(d); }
    const retry = el('button', 'rk-btn', '↻ Tentar de novo'); retry.type = 'button';
    retry.addEventListener('click', () => load(true, mode));
    st.append(retry);
    list.replaceChildren(st);
    const more = $('#rkMore'); if (more) more.hidden = true;
    renderMe(null);
    console.error('[Ranking]', mode, err?.codigo || '', err?.message || err);
  }

  /* ---------- carregamento ---------- */
  let carregando = false;

  function sincronizarBotaoAtualizar(){
    const btn = $('#rankingRefreshBtn');
    if (!btn) return;
    const restante = Math.max(0, Math.ceil((refreshUntil - Date.now()) / 1000));
    const label = btn.querySelector('.rk-refresh-label');
    if (restante > 0) {
      btn.disabled = true;
      btn.classList.add('is-cooldown');
      if (label) label.textContent = `Aguarde ${restante}s`;
      btn.title = `Você poderá atualizar de novo em ${restante}s`;
      if (!refreshTick) refreshTick = setInterval(sincronizarBotaoAtualizar, 1000);
    } else {
      btn.classList.remove('is-cooldown');
      if (!carregando) btn.disabled = false;
      if (label) label.textContent = 'Atualizar';
      btn.title = 'Atualizar o ranking agora';
      if (refreshTick) { clearInterval(refreshTick); refreshTick = null; }
    }
  }

  function iniciarCooldown(){
    refreshUntil = Date.now() + REFRESH_COOLDOWN;
    sincronizarBotaoAtualizar();
  }

  async function load(force = false, m = mode, automatico = false) {
    if (automatico && carregando) return;
    if (m !== mode) {
      query = '';
      const search = $('#rkSearch');
      if (search) search.value = '';
    }
    mode = m; shown = PAGE;
    const id = ++seq;
    renderHead();
    const btn = $('#rankingRefreshBtn');
    // Com dados já na tela, a atualização acontece por baixo: nada de skeleton.
    if (cache[m]) render(); else { renderLoading(); const p = $('#rankingPodium'); if (p) { p.replaceChildren(); } }
    carregando = true;
    setAtualizando(true);
    btn?.classList.add('is-loading'); if (btn) btn.disabled = true;
    try {
      const r = await requestMode(m, force);
      if (id !== seq) return;
      cache[m] = { ...r, at: Date.now(), pintado: cache[m]?.pintado };
      render();
    } catch (e) {
      if (id !== seq) return;
      if (cache[m]) render(); else renderError(e);
    } finally {
      carregando = false;
      if (id === seq) { setAtualizando(false); }
      btn?.classList.remove('is-loading');
      sincronizarBotaoAtualizar();
    }
  }

  function init() {
    if (!$('#rankingContainer')) return;
    $('#rankingRefreshBtn')?.addEventListener('click', () => {
      if (Date.now() < refreshUntil) return;
      load(true, mode);
      iniciarCooldown();
    });
    $('#rankingLoginBtn')?.addEventListener('click', () => window.AuthUI?.open());
    $('#rkMore')?.addEventListener('click', () => { shown += PAGE; if (cache[mode]) renderList(cache[mode].rows); });
    let t;
    $('#rkSearch')?.addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { query = e.target.value; shown = PAGE; if (cache[mode]) renderList(cache[mode].rows); }, 120); });
    document.querySelectorAll('[data-ranking-mode]').forEach(b => b.addEventListener('click', () => { if (b.dataset.rankingMode !== mode) load(false, b.dataset.rankingMode); }));
    window.addEventListener('soso:auth', () => { if (cache[mode]) render(); load(true, mode); });
    window.addEventListener('soso:aba', e => { if (e.detail === 'ranking') load(true, mode); });

    // Tempo real: o ranking se atualiza sozinho a cada 60s enquanto a aba
    // estiver aberta (sem recarregar a página e sem trocar o que está na tela).
    setInterval(() => {
      if (document.hidden) return;
      if (!$('#sec-ranking')?.classList.contains('ativo')) return;
      load(true, mode, true);
    }, 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      if (!$('#sec-ranking')?.classList.contains('ativo')) return;
      load(true, mode, true);
    });

    load(false, 'horas');
  }

  window.RankingUI = {
    init,
    refresh: () => load(true, mode),
    open: (m) => { if (MODES[m]) load(false, m); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
