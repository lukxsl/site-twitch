/* ============================================================
   PERFIL + RANKING DA COMUNIDADE (Twitch vinculada à conta do site)
   ============================================================ */
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
  const httpsURL = (value) => {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  };
  const numberPT = (value) => Number(value || 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 0, maximumFractionDigits: 2
  });
  const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };

  let perfilAtual = null;
  let rankingCarregando = false;
  let perfilCarregando = false;

  function avatarMarkup(url, name, className = '') {
    const safeUrl = httpsURL(url);
    const alt = escapeHTML(name || 'Avatar');
    if (safeUrl) return `<img class="${className}" src="${escapeHTML(safeUrl)}" alt="${alt}" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ranking-avatar-fallback',textContent:'💜'}))">`;
    return `<span class="ranking-avatar-fallback ${className}" aria-hidden="true">💜</span>`;
  }

  function renderPodium(rows) {
    const box = $('rankingPodio');
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = '<div class="ranking-empty-card"><span>🏆</span><b>O ranking ainda está vazio</b><p>Entre na live, participe do chat e apareça por aqui!</p></div>';
      return;
    }
    const podiumRows = [rows[1], rows[0], rows[2]].filter(Boolean);
    const classes = { 1: 'first', 2: 'second', 3: 'third' };
    box.innerHTML = podiumRows.map((row) => {
      const rank = rows.indexOf(row) + 1;
      return `<article class="ranking-podium-card ${classes[rank] || ''}">
        <span class="ranking-position">${rank === 1 ? '👑' : `#${rank}`}</span>
        ${avatarMarkup(row.avatar, row.nome, 'ranking-avatar')}
        <b class="ranking-player-name">${escapeHTML(row.nome || row.login || 'Membro')}</b>
        <span class="ranking-player-points">${numberPT(row.pontos)} pts</span>
        ${row.is_sub ? '<span class="ranking-sub-tag">👑 SUB · +50%</span>' : ''}
      </article>`;
    }).join('');
  }

  function renderRankingList(rows) {
    const list = $('rankingLista');
    if (!list) return;
    if (!rows.length) {
      list.innerHTML = '<li class="ranking-empty">Nenhuma pontuação registrada ainda.</li>';
      return;
    }
    list.innerHTML = rows.map((row, index) => `<li class="ranking-list-item">
      <span class="ranking-list-position">${index + 1}</span>
      ${avatarMarkup(row.avatar, row.nome, 'ranking-list-avatar')}
      <span class="ranking-list-name"><b>${escapeHTML(row.nome || row.login || 'Membro')}</b>${row.is_sub ? '<small>👑 Sub vinculado</small>' : ''}</span>
      <strong>${numberPT(row.pontos)} <small>pts</small></strong>
    </li>`).join('');
  }

  async function carregarRanking(showFeedback = false) {
    if (rankingCarregando) return;
    rankingCarregando = true;
    const list = $('rankingLista');
    const podium = $('rankingPodio');
    if (list && !list.children.length) list.innerHTML = '<li class="ranking-empty">Carregando ranking…</li>';
    if (podium && !podium.children.length) podium.innerHTML = '<p class="ranking-empty">Carregando ranking…</p>';
    try {
      const response = await fetch('/api/ranking?limit=50', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o ranking.');
      const rows = Array.isArray(data.ranking) ? data.ranking : [];
      renderPodium(rows.slice(0, 3));
      renderRankingList(rows);
      const stamp = $('rankingUpdatedAt');
      if (stamp) stamp.textContent = data.atualizadoEm ? `Atualizado ${new Date(data.atualizadoEm).toLocaleString('pt-BR')}` : '';
      if (showFeedback && typeof window.toast === 'function') window.toast('Ranking atualizado!', 'ok');
    } catch (error) {
      if (podium) podium.innerHTML = `<div class="ranking-empty-card"><span>⚠️</span><b>Não foi possível carregar o ranking</b><p>${escapeHTML(error.message)}</p></div>`;
      if (list) list.innerHTML = '';
    } finally {
      rankingCarregando = false;
    }
  }

  function mostrarPreview(perfil) {
    const nome = perfil.nome || (perfil.twitch && perfil.twitch.nome) || 'Seu perfil';
    setText('perfilNomePreview', nome);
    const avatar = httpsURL(perfil.avatar) || (perfil.twitch && httpsURL(perfil.twitch.avatar)) || 'img/avatar.png';
    const avatarEl = $('perfilAvatarPreview');
    if (avatarEl) avatarEl.src = avatar;
    const bannerEl = $('perfilBannerPreview');
    if (bannerEl) {
      const banner = httpsURL(perfil.banner);
      bannerEl.style.backgroundImage = banner
        ? `linear-gradient(90deg,rgba(10,5,17,.82),rgba(10,5,17,.12)),url("${banner.replace(/["\\]/g, '')}")`
        : '';
      bannerEl.classList.toggle('has-image', !!banner);
    }
    const twitchEl = $('perfilTwitchStatus');
    if (twitchEl) twitchEl.textContent = perfil.twitch
      ? `@${perfil.twitch.login || 'Twitch vinculada'}`
      : 'Conta Twitch ainda não vinculada';
    const subBadge = $('perfilSubBadge');
    if (subBadge) subBadge.hidden = !perfil.is_sub;
    const desc = $('perfilTwitchDescricao');
    if (desc) desc.textContent = perfil.twitch
      ? `Vinculada como @${perfil.twitch.login || perfil.twitch.nome}. ${perfil.is_sub ? 'Sua inscrição foi confirmada; bônus de +50% ativo.' : 'A conta não está inscrita no canal no momento.'}`
      : 'Vincule a Twitch para validar sua inscrição e receber o bônus de Sub.';
    const form = $('perfilForm');
    if (form) form.classList.remove('perfil-locked');
  }

  async function carregarMeuPerfil() {
    if (perfilCarregando) return;
    perfilCarregando = true;
    const feedback = $('perfilFeedback');
    if (feedback) feedback.textContent = 'Carregando seu perfil…';
    try {
      const response = await fetch('/api/perfil', { cache: 'no-store' });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        perfilAtual = null;
        if (feedback) feedback.textContent = 'Entre no site para personalizar seu perfil e vincular a Twitch.';
        const link = $('btnVincularTwitch');
        if (link) link.textContent = 'Entrar para vincular';
        mostrarPreview({});
        const form = $('perfilForm');
        if (form) {
          form.classList.add('perfil-locked');
          form.querySelectorAll('input, [type="submit"]').forEach((field) => { field.disabled = true; });
        }
        return;
      }
      if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o perfil.');
      perfilAtual = data.perfil || {};
      const fields = [['perfilNome', 'nome'], ['perfilAvatar', 'avatar'], ['perfilBanner', 'banner']];
      fields.forEach(([id, key]) => { const input = $(id); if (input) input.value = perfilAtual[key] || ''; });
      const form = $('perfilForm');
      if (form) {
        form.classList.remove('perfil-locked');
        form.querySelectorAll('input, [type="submit"]').forEach((field) => { field.disabled = false; });
      }
      mostrarPreview(perfilAtual);
      if (feedback) feedback.textContent = '';
      const button = $('btnVincularTwitch');
      if (button) button.textContent = perfilAtual.twitch ? 'Atualizar vínculo Twitch' : 'Vincular Twitch';
    } catch (error) {
      if (feedback) feedback.textContent = error.message;
    } finally {
      perfilCarregando = false;
    }
  }

  async function salvarPerfil(event) {
    event.preventDefault();
    const feedback = $('perfilFeedback');
    const payload = {
      nome: $('perfilNome')?.value?.trim() || '',
      avatar: $('perfilAvatar')?.value?.trim() || '',
      banner: $('perfilBanner')?.value?.trim() || ''
    };
    if (payload.avatar && !httpsURL(payload.avatar)) {
      if (feedback) feedback.textContent = 'A URL do avatar precisa começar com https://.';
      return;
    }
    if (payload.banner && !httpsURL(payload.banner)) {
      if (feedback) feedback.textContent = 'A URL do banner precisa começar com https://.';
      return;
    }
    const submit = $('perfilForm')?.querySelector('[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Salvando…'; }
    if (feedback) feedback.textContent = '';
    try {
      const response = await fetch('/api/perfil', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Não foi possível salvar o perfil.');
      perfilAtual = { ...(perfilAtual || {}), ...data.perfil, twitch: perfilAtual?.twitch || null };
      mostrarPreview(perfilAtual);
      if (feedback) feedback.textContent = 'Perfil salvo com sucesso! 💜';
    } catch (error) {
      if (feedback) feedback.textContent = error.message;
    } finally {
      if (submit) { submit.disabled = false; submit.textContent = '💾 Salvar perfil'; }
    }
  }

  function configurarPerfil() {
    const form = $('perfilForm');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', salvarPerfil);
      [['perfilNome', 'input'], ['perfilAvatar', 'input'], ['perfilBanner', 'input']].forEach(([id, event]) => {
        const el = $(id);
        if (el) el.addEventListener(event, () => {
          const preview = { ...(perfilAtual || {}), nome: $('perfilNome')?.value || '', avatar: $('perfilAvatar')?.value || '', banner: $('perfilBanner')?.value || '' };
          mostrarPreview(preview);
        });
      });
    }
    const button = $('btnVincularTwitch');
    if (button && !button.dataset.bound) {
      button.dataset.bound = '1';
      button.addEventListener('click', () => {
        if (!perfilAtual && button.textContent.includes('Entrar')) {
          window.location.href = '/api/auth?action=login';
          return;
        }
        window.location.href = '/api/perfil?action=twitch-start';
      });
    }
  }

  window.carregarRanking = carregarRanking;
  window.carregarMeuPerfil = carregarMeuPerfil;

  document.addEventListener('DOMContentLoaded', () => {
    configurarPerfil();
    const twitchStatus = new URLSearchParams(window.location.search).get('twitch');
    if (twitchStatus) {
      if (twitchStatus === 'vinculada') setText('perfilFeedback', 'Twitch vinculada com sucesso! 💜');
      else if (twitchStatus === 'cancelado') setText('perfilFeedback', 'Vínculo cancelado. Você pode tentar novamente quando quiser.');
      if (typeof window.mudarAba === 'function') window.mudarAba('perfil');
      try { history.replaceState(null, '', '#perfil'); } catch { /* ignore */ }
    }
    if (window.location.hash === '#ranking') carregarRanking();
    if (window.location.hash === '#perfil') carregarMeuPerfil();
  });
})();
