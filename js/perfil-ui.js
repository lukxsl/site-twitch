/* ============================================================
   PERFIL UI — visão geral, inventário, conquistas e configurações
   O estado do jogador continua vindo exclusivamente do servidor.
   ============================================================ */
(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  const SLOT_NAMES = {
    base: 'Corpo', pele: 'Tom de pele', rosto: 'Rosto', cabelo: 'Cabelo',
    cabeloCor: 'Cor do cabelo', roupa: 'Roupa', roupaCor: 'Cor da roupa',
    calcado: 'Calçado', calcadoCor: 'Cor do calçado', acessorio: 'Acessório',
    acessorioCor: 'Cor do acessório', efeito: 'Efeito', animacao: 'Animação', moldura: 'Moldura'
  };
  const SLOT_ICONS = {
    base: '🧍', pele: '🎨', rosto: '😊', cabelo: '💇', cabeloCor: '🎨',
    roupa: '👕', roupaCor: '🎨', calcado: '👟', calcadoCor: '🎨',
    acessorio: '🕶️', acessorioCor: '🎨', efeito: '✨', animacao: '🎮', moldura: '🖼️'
  };
  const SLOT_FILTER = {
    base: 'base', pele: 'base', rosto: 'rosto', cabelo: 'cabelo', cabeloCor: 'cabelo',
    roupa: 'roupa', roupaCor: 'roupa', calcado: 'calcado', calcadoCor: 'calcado',
    acessorio: 'acessorio', acessorioCor: 'acessorio', efeito: 'efeito', animacao: 'animacao', moldura: 'moldura'
  };
  const RARITY_NAMES = {
    comum: 'Comum', incomum: 'Incomum', raro: 'Raro', epico: 'Épico',
    lendario: 'Lendário', limitado: 'Limitado'
  };
  const RARITY_ORDER = { comum: 0, incomum: 1, raro: 2, epico: 3, lendario: 4, limitado: 5 };
  // Tradução visual inspirada nos troféus de console: a raridade interna continua intacta.
  const TROPHY_GRADE = {
    comum: { nome: 'Bronze', classe: 'bronze' },
    incomum: { nome: 'Bronze', classe: 'bronze' },
    raro: { nome: 'Prata', classe: 'silver' },
    epico: { nome: 'Ouro', classe: 'gold' },
    lendario: { nome: 'Ouro', classe: 'gold' },
    limitado: { nome: 'Edição especial', classe: 'special' }
  };
  const MILESTONE_ICONS = ['🔥', '⚡', '💜', '👑'];
  const money = value => Number(value || 0).toLocaleString('pt-BR');
  const fmtHours = value => value == null || !Number.isFinite(Number(value))
    ? '—'
    : `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}h`;

  let perfil = null;
  let catalogo = null;
  let active = 'visao-geral';
  let loading = false;
  let loadAllRequestId = 0;
  let inventoryFilter = 'todos';
  let inventoryPreviewChanges = {};
  let inventoryPreviewLabel = '';
  let achievementFilter = 'andamento';
  let devInsights = null;
  let devInsightsError = '';
  let devInsightsLoading = false;

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };
  const button = (text, className, onClick) => {
    const node = el('button', className, text);
    node.type = 'button';
    node.addEventListener('click', onClick);
    return node;
  };
  const empty = text => el('p', 'pf-empty', text);
  const setText = (id, value) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value == null ? '—' : String(value);
  };

  function notify(message, type = 'ok') {
    if (typeof window.toast === 'function') window.toast(message, type);
  }

  function usuarioAtual() {
    try {
      return typeof USUARIO !== 'undefined' && USUARIO ? USUARIO : null;
    } catch (_) {
      return null;
    }
  }

  function renderBoneco(target, boneco, label, mini = false) {
    if (!target) return;
    target.replaceChildren();
    if (!window.PixelAvatar || typeof window.PixelAvatar.render !== 'function') {
      target.textContent = '🕹️';
      return;
    }
    try {
      const svg = window.PixelAvatar.render(boneco || window.PixelAvatar.PADRAO, {
        label: label || 'Personagem do jogador', mini, animar: !mini
      });
      if (svg) target.appendChild(svg);
      else target.textContent = '🕹️';
    } catch (error) {
      console.warn('[PerfilUI] Não foi possível desenhar o boneco:', error);
      target.textContent = '🕹️';
    }
  }

  async function loadAll(force = false) {
    if (loading && !force) return;
    const requestId = ++loadAllRequestId;
    loading = true;
    try {
      const state = window.GameState;
      const autenticado = !!(usuarioAtual() || state?.perfil);
      const perfilPromise = autenticado && state
        ? state.carregarPerfil({ forcar: force })
        : Promise.resolve(null);
      const catalogoPromise = state
        ? state.carregarCatalogo({ forcar: force })
        : Promise.resolve(null);
      const [perfilResult, catalogoResult] = await Promise.allSettled([perfilPromise, catalogoPromise]);
      if (requestId !== loadAllRequestId) return;

      perfil = perfilResult.status === 'fulfilled' ? perfilResult.value : null;
      catalogo = catalogoResult.status === 'fulfilled' ? catalogoResult.value : null;

      // Fallbacks independentes: uma falha de perfil não invalida o catálogo e vice-versa.
      if (autenticado && !perfil) {
        const result = await api(API_GAME, 'perfil');
        if (result.ok) perfil = result.data;
        else console.error('[PerfilUI] Falha ao carregar perfil:', result.status, result.data);
      }
      if (requestId !== loadAllRequestId) return;
      if (!catalogo?.catalogo) {
        const result = await api(API_GAME, 'catalogo');
        if (requestId !== loadAllRequestId) return;
        if (result.ok && result.data?.catalogo) catalogo = result.data;
        else console.error('[PerfilUI] Falha ao carregar catálogo:', result.status, result.data);
      }
      if (requestId !== loadAllRequestId) return;
      updateAll();
    } catch (error) {
      if (requestId !== loadAllRequestId) return;
      console.error('[PerfilUI] Falha ao atualizar interface:', error);
      notify('Não foi possível atualizar o perfil agora.', 'erro');
    } finally {
      if (requestId === loadAllRequestId) loading = false;
    }
  }

  function updateAll() {
    if (!perfil) {
      renderGuest();
      return;
    }
    if (window.__pfAtualizarNomeBanner) window.__pfAtualizarNomeBanner(perfil);
    if (active === 'visao-geral') renderOverview();
    if (active === 'inventario') renderInventory();
    if (active === 'loja') renderShop();
    if (active === 'conquistas') renderAchievements();
    if (active === 'configuracoes') renderSettings();
    renderAvatarPlaces();
  }

  function renderGuest() {
    setText('pfBannerNome', '@convidado');
    setText('pfNickLarge', 'Entre para criar seu personagem');
    setText('pfCurrentTitle', 'Visitante');
    setText('pfLevelLarge', '1');
    setText('pfXpText', '0 / 100 XP');
    setText('pfXpTotal', 'Total acumulado: 0 XP');
    setText('pfXpFaltam', 'Entre para começar sua jornada');
    setText('pfXpPercent', '0%');
    setText('pfTitlesProgress', '1 disponível');
    setText('pfPositionNumber', '—');
    setText('pfPositionTotal', 'Entre no Arcade para aparecer no placar.');
    setText('pfStreakCurrent', '0');
    setText('pfStreakBest', '0');
    setText('pfStreakNext', '—');
    ['pfLivesCount', 'pfVotesCount', 'pfSuggestionsCount', 'pfApprovedSuggestionsCount', 'pfCodesCount', 'pfWatchHoursCount', 'pfCoinsValue'].forEach(id => setText(id, '0'));
    const fill = $('#pfXpBarFill');
    if (fill) fill.style.width = '0%';
    const track = $('#pfXpBarTrack');
    if (track) track.setAttribute('aria-valuenow', '0');
    renderBoneco($('#pfAvatarLarge'), window.PixelAvatar?.PADRAO, 'Prévia do Arcade');

    const titleSelect = $('#pfTituloSelect');
    if (titleSelect) {
      titleSelect.replaceChildren(new Option('Novato', 'novato'));
      titleSelect.value = 'novato';
      titleSelect.disabled = true;
    }
    const titleCatalog = $('#pfTitleCatalog');
    if (titleCatalog) titleCatalog.replaceChildren(el('span', 'pf-title-chip is-current', 'Novato'));
    const rules = $('#pfXpRules');
    if (rules) rules.replaceChildren(empty('Entre no Arcade para acompanhar as atividades que dão XP.'));
    const milestones = $('#pfStreakMilestones .pf-milestone-list');
    if (milestones) milestones.replaceChildren(empty('Vincule sua Twitch para registrar presença.'));
    const recent = $('#pfRecentAchievements');
    if (recent) recent.replaceChildren(empty('Crie sua conta e participe das lives para desbloquear conquistas.'));

    const inventory = $('#pfInventoryGrid');
    if (inventory) inventory.replaceChildren(empty('Entre no Arcade para desbloquear e guardar peças.'));
    setText('pfInventoryCount', '0 itens');
    renderInventoryPreview();
    const achievements = $('#pfAchievementsGrid');
    if (achievements) achievements.replaceChildren(empty('Entre no Arcade para começar a desbloquear conquistas.'));
    setText('pfAchievementProgress', '0 / 0');
    const shopBalance = $('#pfShopBalance');
    if (shopBalance) shopBalance.textContent = '0';
    renderSettings();
  }

  function renderAvatarPlaces() {
    if (!perfil) return;
    renderBoneco($('#pfAvatarLarge'), perfil.boneco, `Boneco de ${perfil.nick || 'jogador'}`);
    const navAvatar = $('.nav-mini-avatar');
    if (navAvatar) {
      renderBoneco(navAvatar, perfil.boneco, 'Seu boneco', true);
      navAvatar.classList.remove('is-empty');
    }
  }

  function renderTitleSelector() {
    const titles = Array.isArray(perfil?.titulos) ? perfil.titulos : [];
    const unlocked = titles.filter(title => title.liberado);
    const currentId = perfil?.titulo || 'novato';
    const selected = unlocked.some(title => title.id === currentId) ? currentId : (unlocked[0]?.id || 'novato');
    const select = $('#pfTituloSelect');
    if (select) {
      select.replaceChildren();
      unlocked
        .sort((a, b) => (RARITY_ORDER[a.r] ?? 99) - (RARITY_ORDER[b.r] ?? 99) || a.nome.localeCompare(b.nome, 'pt-BR'))
        .forEach(title => select.add(new Option(`${title.nome} · ${RARITY_NAMES[title.r] || 'Título'}`, title.id)));
      if (!unlocked.length) select.add(new Option('Novato', 'novato'));
      select.value = selected;
      select.disabled = unlocked.length <= 1;
    }
    const currentTitle = titles.find(title => title.id === selected) || titles.find(title => title.id === currentId);
    setText('pfCurrentTitle', currentTitle?.nome || 'Novato');
    const hint = currentTitle?.regra
      ? `Equipado · ${currentTitle.regra}`
      : 'Desbloqueie títulos participando das lives e atividades do Arcade.';
    setText('pfTitleHint', hint);
    setText('pfTitlesProgress', `${unlocked.length} de ${titles.length || 1} liberados`);

    const collection = $('#pfTitleCatalog');
    if (!collection) return;
    collection.replaceChildren();
    const unlockedSorted = [...unlocked].sort((a, b) =>
      (RARITY_ORDER[b.r] ?? 99) - (RARITY_ORDER[a.r] ?? 99) || a.nome.localeCompare(b.nome, 'pt-BR')
    );
    const lockedSorted = titles.filter(title => !title.liberado).sort((a, b) =>
      (RARITY_ORDER[a.r] ?? 99) - (RARITY_ORDER[b.r] ?? 99) || a.nome.localeCompare(b.nome, 'pt-BR')
    );
    const visible = [
      ...unlocked.filter(title => title.id === selected),
      ...unlockedSorted.filter(title => title.id !== selected).slice(0, 4),
      ...lockedSorted.slice(0, 3)
    ];
    if (!visible.length) {
      collection.appendChild(el('span', 'pf-title-chip is-current', 'Novato'));
      return;
    }
    visible.forEach(title => {
      const chip = el('span', `pf-title-chip${title.id === selected ? ' is-current' : ''}${title.liberado ? '' : ' is-locked'}`,
        `${title.liberado ? '✦ ' : '🔒 '}${title.nome}`);
      chip.title = title.regra || title.nome;
      collection.appendChild(chip);
    });
  }

  function renderOverview() {
    const player = perfil;
    const stats = player.stats || {};
    const level = player.xpNivel || {};
    const percentage = Math.max(0, Math.min(100, Number(level.pct) || 0));
    const currentLevelXp = Number(level.dentro) || 0;
    const levelXpTotal = Math.max(0, (Number(level.prox) || 0) - (Number(level.base) || 0));

    setText('pfNickLarge', `@${player.nick || 'Jogador'}`);
    setText('pfLevelLarge', player.nivel || 1);
    setText('pfXpText', `${money(currentLevelXp)} / ${money(levelXpTotal)} XP`);
    setText('pfXpTotal', `Total acumulado: ${money(player.xp)} XP`);
    setText('pfXpFaltam', Number(level.falta) > 0 ? `Faltam ${money(level.falta)} XP` : 'Nível máximo alcançado');
    setText('pfXpPercent', `${Math.round(percentage)}%`);

    const fill = $('#pfXpBarFill');
    if (fill) fill.style.width = `${percentage}%`;
    const track = $('#pfXpBarTrack');
    if (track) track.setAttribute('aria-valuenow', String(Math.round(percentage)));

    setText('pfLivesCount', money(stats.lives));
    setText('pfWatchHoursCount', fmtHours(stats.horas));
    setText('pfVotesCount', money(stats.votos));
    setText('pfSuggestionsCount', money(stats.sugestoesEnv));
    setText('pfApprovedSuggestionsCount', `${money(stats.sugestoes)} aprovadas`);
    setText('pfCodesCount', money(stats.codigos));
    setText('pfCoinsValue', money(player.coins));

    const rank = player.ranking || {};
    setText('pfPositionNumber', rank.pos ? `#${money(rank.pos)}` : '—');
    setText('pfPositionTotal', rank.total
      ? `de ${money(rank.total)} jogadores no placar`
      : 'Você ainda não entrou no placar.');
    setText('pfShopBalance', money(player.coins));

    renderTitleSelector();
    renderProgression(stats, player.regras || {});
    renderRecentAchievements();
    renderAvatarPlaces();
  }

  function renderProgression(stats, rules) {
    const ruleBox = $('#pfXpRules');
    if (ruleBox) {
      ruleBox.replaceChildren();
      const intro = el('p', 'pf-xp-rules-intro', 'Você evolui participando do cantinho. Cada atividade tem um limite ou condição; os pontos são registrados pelo servidor.');
      ruleBox.appendChild(intro);
      const rulesList = Array.isArray(rules.xp) ? rules.xp : [];
      const icons = ['🗳️', '💡', '✨', '📺', '🔥', '🔑', '⭐'];
      if (!rulesList.length) ruleBox.appendChild(empty('As atividades de XP não foram disponibilizadas pela API.'));
      rulesList.forEach((rule, index) => {
        const row = el('div', 'pf-rule-item');
        row.append(el('span', 'pf-rule-icon', icons[index] || '✦'), el('span', 'pf-rule-text', rule));
        ruleBox.appendChild(row);
      });
    }

    const current = Math.max(0, Number(stats.streak) || 0);
    const best = Math.max(0, Number(stats.melhorStreak) || 0);
    setText('pfStreakCurrent', money(current));
    setText('pfStreakBest', money(best));

    const milestones = Object.entries(rules.streak?.marcos || {})
      .map(([lives, coins]) => ({ lives: Number(lives), coins: Number(coins) }))
      .filter(item => Number.isFinite(item.lives) && item.lives > 0)
      .sort((a, b) => a.lives - b.lives);
    const next = milestones.find(item => item.lives > current);
    setText('pfStreakNext', next
      ? `${next.lives} lives · faltam ${next.lives - current}`
      : (milestones.length ? 'Todos' : '—'));

    const list = $('#pfStreakMilestones .pf-milestone-list');
    if (list) {
      list.replaceChildren();
      if (!milestones.length) list.appendChild(empty('Nenhum marco de sequência foi configurado.'));
      milestones.forEach((milestone, index) => {
        const reachedNow = current >= milestone.lives;
        const reachedBefore = best >= milestone.lives;
        const status = reachedNow
          ? 'Nesta sequência'
          : (reachedBefore ? 'Recorde pessoal' : `Faltam ${milestone.lives - current}`);
        const card = el('span', `pf-milestone${reachedNow ? ' is-reached' : (reachedBefore ? ' is-record' : '')}`);
        card.append(
          el('span', 'pf-milestone-icon', MILESTONE_ICONS[index] || '✦'),
          el('strong', '', `${milestone.lives} lives`),
          el('span', 'pf-milestone-reward', `+${money(milestone.coins)} SC`),
          el('span', 'pf-milestone-status', status)
        );
        list.appendChild(card);
      });
    }
    setText('pfStreakRuleText', rules.streak?.texto || 'Sua sequência aumenta quando sua presença é confirmada em lives consecutivas. Vincule sua Twitch nas configurações.');
  }

  function renderRecentAchievements() {
    const box = $('#pfRecentAchievements');
    if (!box) return;
    box.replaceChildren();
    const unlocked = (perfil?.conquistas || [])
      .filter(achievement => achievement.ts)
      .sort((a, b) => Number(b.ts) - Number(a.ts))
      .slice(0, 3);
    if (!unlocked.length) {
      box.appendChild(empty('Ainda sem conquistas. Monte seu boneco e participe das lives para começar.'));
      return;
    }
    unlocked.forEach(achievement => {
      const item = el('div', 'pf-recent-ach');
      item.append(el('span', 'pf-ach-icon', achievement.icone || '🏆'), el('span', 'pf-ach-name', achievement.nome));
      box.appendChild(item);
    });
  }

  function itemOwned(slot, item) {
    return (perfil?.liberados?.[slot] || []).includes(item.id)
      || (perfil?.comprados || []).includes(`${slot}:${item.id}`);
  }

  function itemEquipped(slot, item) {
    return perfil?.boneco?.[slot] === item.id;
  }

  function itemColor(slot, item) {
    if (item.cor) return item.cor;
    const palettes = {
      pele: { clara: '#f2c9a0', media: '#d99a6c', bronze: '#b87345', morena: '#8a5230', escura: '#5c3521', alien: '#7dd3a8' },
      cabeloCor: { preto: '#2b2540', roxo: '#8b5cf6', loiro: '#f2c94c', ruivo: '#c2531b', prata: '#cbd5e1', rosa: '#ff6ec7', ciano: '#22d3ee' },
      roupaCor: { roxo: '#7c3aed', grafite: '#454560', preto: '#28233c', vermelho: '#dc2626', ciano: '#06b6d4', dourado: '#f5b82e' },
      calcadoCor: { branco: '#f5f3ff', preto: '#1a1330', vermelho: '#dc2626', roxo: '#7c3aed', ciano: '#22d3ee' },
      acessorioCor: { dourado: '#ffd166', lilas: '#c084fc', azul: '#7dd3fc', rosa: '#ff6ec7', branco: '#f5f3ff' }
    };
    return palettes[slot]?.[item.id] || null;
  }

  function previewLook(){
    const base = perfil?.boneco || catalogo?.padrao || window.PixelAvatar?.PADRAO || {};
    return { ...base, ...inventoryPreviewChanges };
  }

  function renderInventoryPreview(){
    const stage = $('#pfInventoryAvatarPreview');
    if (!stage) return;
    renderBoneco(stage, previewLook(), 'Provador do inventário', false);
    setText('pfInventoryTryonLabel', inventoryPreviewLabel || (Object.keys(inventoryPreviewChanges).length
      ? `${Object.keys(inventoryPreviewChanges).length} peça(s) na prévia · não salva automaticamente.`
      : 'Seu visual atual. Escolha peças para montar um kit.'));
    const reset = $('#pfInventoryPreviewReset');
    if (reset) reset.disabled = !Object.keys(inventoryPreviewChanges).length;
  }

  function miniaturaItem(slot, item) {
    const preview = el('div', 'pf-item-preview pf-item-preview-character');
    const base = perfil?.boneco || catalogo?.padrao || window.PixelAvatar?.PADRAO || {};
    const look = { ...base, [slot]: item.id };
    const avatar = el('div', 'pf-item-avatar-thumb');

    if (window.PixelAvatar?.render) {
      try {
        // Mostrar o personagem inteiro com a peça aplicada deixa acessórios,
        // roupas e efeitos muito mais fáceis de reconhecer do que camadas soltas.
        const svg = window.PixelAvatar.render(look, {
          label: `Prévia de ${item.nome || 'item do inventário'}`,
          mini: false,
          animar: false
        });
        if (svg) {
          svg.classList.add('pf-item-avatar-art');
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          avatar.appendChild(svg);
        } else {
          avatar.textContent = item.icone || '✦';
        }
      } catch (error) {
        console.warn('[PerfilUI] Falha ao gerar miniatura da peça:', error);
        avatar.textContent = item.icone || '✦';
      }
    } else {
      avatar.textContent = item.icone || '✦';
    }

    preview.append(avatar, el('span', 'pf-item-slot-caption', SLOT_NAMES[slot] || slot));
    return preview;
  }

  function experimentarItem(slot, item) {
    inventoryPreviewChanges = { ...inventoryPreviewChanges, [slot]: item.id };
    inventoryPreviewLabel = `${item.nome || 'Peça'} adicionada à prévia. Você pode escolher outras peças para combinar.`;
    renderInventory();
  }

  function itemCard(slot, item) {
    const rarity = String(item.r || 'comum').toLowerCase();
    const equipped = itemEquipped(slot, item);
    const card = el('article', `pf-item-card rarity-${rarity} is-owned${equipped ? ' is-equipped' : ''}`);
    card.dataset.rarity = rarity;
    const header = el('div', 'pf-item-card-top');
    header.append(
      el('span', 'pf-item-slot', SLOT_NAMES[slot] || slot),
      el('span', 'pf-rarity pf-rarity-badge', RARITY_NAMES[rarity] || 'Item')
    );
    card.append(header, miniaturaItem(slot, item), el('h3', 'pf-item-name', item.nome || 'Item do Arcade'));
    if (equipped) card.appendChild(el('span', 'pf-item-equipped', '✓ FAZ PARTE DO VISUAL ATUAL'));
    else card.appendChild(el('p', 'pf-item-rule', item.regraTxt || 'Desbloqueado · pronto para experimentar.'));
    const actions = el('div', 'pf-item-actions');
    const isPreviewed = inventoryPreviewChanges[slot] === item.id;
    const previewButton = button(isPreviewed ? 'Na prévia ✓' : (equipped ? 'Visual atual' : 'Experimentar'), 'pf-btn pf-btn-secondary', () => experimentarItem(slot, item));
    previewButton.setAttribute('aria-pressed', isPreviewed ? 'true' : 'false');
    if (isPreviewed || equipped) previewButton.disabled = true;
    actions.appendChild(previewButton);
    card.appendChild(actions);
    return card;
  }

  function renderInventory() {
    const grid = $('#pfInventoryGrid');
    if (!grid) return;
    grid.replaceChildren();
    const owned = [];
    Object.entries(catalogo?.catalogo || {}).forEach(([slot, items]) => {
      (items || []).filter(item => itemOwned(slot, item)).forEach(item => owned.push({ slot, item }));
    });
    setText('pfInventoryCount', `${owned.length} ${owned.length === 1 ? 'item' : 'itens'}`);
    setText('pfInventoryHint', `${owned.filter(({ slot, item }) => itemEquipped(slot, item)).length} peça(s) atualmente equipada(s).`);

    const filtered = inventoryFilter === 'todos'
      ? owned
      : owned.filter(({ slot }) => SLOT_FILTER[slot] === inventoryFilter);
    renderInventoryPreview();
    if (!filtered.length) {
      grid.appendChild(empty(owned.length
        ? 'Nenhuma peça dessa categoria foi desbloqueada ainda.'
        : 'Seu inventário está vazio por enquanto. Desbloqueie peças participando da comunidade e evoluindo no Arcade.'));
      return;
    }
    filtered.sort((a, b) => {
      const rarityDiff = (RARITY_ORDER[a.item.r] ?? 99) - (RARITY_ORDER[b.item.r] ?? 99);
      return rarityDiff || (SLOT_NAMES[a.slot] || a.slot).localeCompare(SLOT_NAMES[b.slot] || b.slot, 'pt-BR')
        || String(a.item.nome).localeCompare(String(b.item.nome), 'pt-BR');
    });
    filtered.forEach(({ slot, item }) => grid.appendChild(itemCard(slot, item)));
  }

  function renderShop() {
    setText('pfShopBalance', money(perfil?.coins));
  }

  function renderAchievements() {
    const grid = $('#pfAchievementsGrid');
    if (!grid) return;
    grid.replaceChildren();
    const achievements = perfil?.conquistas || [];
    const normal = achievements.filter(item => item.id !== 'platina');
    const unlockedCount = normal.filter(item => !!item.ts).length;
    setText('pfAchievementProgress', `${unlockedCount} / ${normal.length}`);

    const platinumUnlocked = achievements.some(item => item.id === 'platina' && !!item.ts);
    const counts = {
      andamento: normal.length - unlockedCount,
      desbloqueadas: unlockedCount + (platinumUnlocked ? 1 : 0),
      todas: achievements.length
    };
    setText('pfAchievementHint', `${money(counts[achievementFilter] ?? counts.andamento)} conquista(s) nesta visualização.`);
    $$('[data-achievement-filter]').forEach(filterButton => {
      const activeFilter = filterButton.dataset.achievementFilter === achievementFilter;
      filterButton.classList.toggle('is-active', activeFilter);
      filterButton.setAttribute('aria-pressed', activeFilter ? 'true' : 'false');
    });

    let visible = [...achievements];
    if (achievementFilter === 'andamento') visible = visible.filter(item => item.id === 'platina' ? !item.ts : !item.ts);
    if (achievementFilter === 'desbloqueadas') visible = visible.filter(item => !!item.ts);
    visible.sort((a, b) => {
      const aUnlocked = !!a.ts;
      const bUnlocked = !!b.ts;
      if (achievementFilter === 'andamento') {
        const aGoal = Math.max(1, Number(a.progresso?.meta) || 1);
        const bGoal = Math.max(1, Number(b.progresso?.meta) || 1);
        const aPct = Math.min(1, (Number(a.progressoAtual) || 0) / aGoal);
        const bPct = Math.min(1, (Number(b.progressoAtual) || 0) / bGoal);
        return bPct - aPct || a.nome.localeCompare(b.nome, 'pt-BR');
      }
      if (aUnlocked !== bUnlocked) return Number(bUnlocked) - Number(aUnlocked);
      return Number(b.ts || 0) - Number(a.ts || 0) || a.nome.localeCompare(b.nome, 'pt-BR');
    });

    if (!visible.length) {
      grid.appendChild(empty(achievementFilter === 'andamento'
        ? 'Tudo em dia! Você já desbloqueou todos os troféus disponíveis. A Platina aparece aqui quando completar a coleção. 💜'
        : 'Nenhuma conquista encontrada nesse filtro.'));
      return;
    }

    visible.forEach((achievement, index) => {
      const unlocked = !!achievement.ts;
      const isPlatinum = achievement.id === 'platina';
      const progress = isPlatinum ? { unidade: 'troféus' } : (achievement.progresso || null);
      const current = isPlatinum
        ? unlockedCount
        : (progress ? Math.max(0, Number(achievement.progressoAtual) || 0) : (unlocked ? 1 : 0));
      const goal = isPlatinum ? Math.max(1, normal.length) : (progress ? Math.max(1, Number(progress.meta) || 1) : 1);
      const percent = Math.max(0, Math.min(100, Math.round(current / goal * 100)));
      const rarity = String(achievement.r || 'comum').toLowerCase();
      const grade = TROPHY_GRADE[rarity] || TROPHY_GRADE.comum;
      const trophyClass = isPlatinum ? 'platinum' : grade.classe;
      const card = el('article', `pf-achievement-card trophy-${trophyClass}${unlocked ? ' is-unlocked' : ' is-locked'}${isPlatinum ? ' is-platinum' : ''}`);
      card.dataset.rarity = rarity;
      card.setAttribute('aria-label', `${achievement.nome}: ${unlocked ? 'desbloqueado' : 'bloqueado'}`);

      const top = el('div', 'pf-trophy-top');
      top.append(
        el('span', 'pf-trophy-number', `TROFÉU ${String(index + 1).padStart(2, '0')}`),
        el('span', 'pf-trophy-grade', isPlatinum ? 'PLATINA' : grade.nome.toUpperCase())
      );

      const medal = el('div', 'pf-trophy-medal');
      medal.appendChild(el('span', 'pf-trophy-icon', achievement.icone || '🏆'));
      medal.setAttribute('aria-hidden', 'true');

      card.append(
        top,
        medal,
        el('h3', 'pf-achievement-name', achievement.nome),
        el('p', 'pf-achievement-desc', achievement.desc || '')
      );

      if (progress && !unlocked) {
        const wrap = el('div', 'pf-achievement-progress');
        const meta = el('div', 'pf-achievement-progress-meta');
        const amount = isPlatinum
          ? `${current} / ${goal} troféus`
          : progress.unidade === 'horas'
            ? `${current.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} / ${goal}h`
            : `${money(Math.floor(current))} / ${money(goal)} ${progress.unidade || ''}`.trim();
        meta.append(el('span', '', 'PROGRESSO'), el('strong', '', amount));

        const track = el('div', 'pf-achievement-progress-track');
        track.setAttribute('role', 'progressbar');
        track.setAttribute('aria-valuemin', '0');
        track.setAttribute('aria-valuemax', String(goal));
        track.setAttribute('aria-valuenow', String(Math.min(goal, current)));
        track.setAttribute('aria-label', `Progresso de ${achievement.nome}`);
        const fill = el('span', 'pf-achievement-progress-fill');
        fill.style.width = `${percent}%`;
        track.appendChild(fill);
        wrap.append(meta, track);
        card.appendChild(wrap);
      }

      const reward = achievement.premio || {};
      const rewards = [];
      if (Number(reward.xp) > 0) rewards.push(`+${money(reward.xp)} XP`);
      if (Number(reward.coins) > 0) rewards.push(`+${money(reward.coins)} SosoCoins`);
      if (rewards.length) card.appendChild(el('p', 'pf-achievement-reward', `Recompensa: ${rewards.join(' · ')}`));

      card.appendChild(el('span', 'pf-achievement-status', unlocked ? '✓ TROFÉU DESBLOQUEADO' : '○ TROFÉU EM ANDAMENTO'));
      if (unlocked && achievement.ts) {
        const timestamp = Number(achievement.ts);
        const date = new Date(timestamp);
        if (Number.isFinite(timestamp) && !Number.isNaN(date.getTime())) {
          card.appendChild(el('small', 'pf-achievement-date', `Conquistado em ${date.toLocaleDateString('pt-BR')}`));
        }
      }
      grid.appendChild(card);
    });
  }

  function renderSettings() {
    const user = usuarioAtual() || {};
    const legacyDiscord = user.tipo === 'discord';
    const loggedIn = !!user.id;
    setText('pfSettingsEmail', user.email || 'E-mail não vinculado');
    const playerId = perfil?.id || user.id || '';
    setText('pfSettingsPlayerId', playerId || 'Entre para ver seu ID');
    const copyId = $('#pfCopyPlayerId'); if (copyId) copyId.disabled = !playerId;
    setText('pfSettingsAccount', user.metodoLogin === 'google'
      ? 'Google'
      : (legacyDiscord ? 'Discord antigo — migração necessária' : (loggedIn ? 'Conta antiga / senha' : 'Não conectado')));

    const nickInput = $('#pfSettingsNick');
    const saveNick = $('#pfSaveNick');
    if (nickInput) {
      if (document.activeElement !== nickInput) nickInput.value = perfil?.nick || user.nick || '';
      nickInput.disabled = !loggedIn || legacyDiscord;
    }
    if (saveNick) saveNick.disabled = !loggedIn || legacyDiscord;

    const googleLink = $('#pfGoogleLink');
    if (googleLink) {
      googleLink.hidden = !loggedIn || user.metodoLogin === 'google';
      googleLink.textContent = legacyDiscord
        ? 'Migrar para Google e preservar meu progresso'
        : 'Vincular conta Google';
    }
    const logout = $('#pfSettingsLogout');
    if (logout) logout.hidden = !loggedIn;

    const twitch = perfil?.twitch || user.twitch;
    const status = $('#pfTwitchStatus');
    const link = $('#pfTwitchLink');
    const unlink = $('#pfTwitchUnlink');
    if (legacyDiscord) {
      if (status) status.textContent = 'Migre sua conta para Google para gerenciar a conexão Twitch.';
      if (link) link.hidden = true;
      if (unlink) unlink.hidden = true;
    } else if (!loggedIn) {
      if (status) status.textContent = 'Entre com sua conta para conectar a Twitch.';
      if (link) link.hidden = true;
      if (unlink) unlink.hidden = true;
    } else {
      if (status) status.textContent = twitch
        ? `Conectada: ${twitch.nome || twitch.login || 'conta Twitch'}`
        : 'Twitch não vinculada — a presença nas lives não será contabilizada.';
      if (link) link.hidden = !!twitch;
      if (unlink) unlink.hidden = !twitch;
    }

    const devBox = $('#pfDevInsights');
    const isDev = perfil?.cargo === 'dev';
    if (devBox) {
      devBox.hidden = !isDev;
      if (isDev) renderDevInsights();
    }
  }

  function statTile(label, value, detail = '') {
    const tile = el('div', 'pf-dev-stat');
    tile.append(el('small', '', label), el('strong', '', value), el('span', '', detail));
    return tile;
  }

  function devSection(title, description = '') {
    const section = el('section', 'pf-dev-source');
    section.appendChild(el('h4', '', title));
    if (description) section.appendChild(el('p', '', description));
    return section;
  }

  function renderDevInsights() {
    const root = $('#pfDevInsightsContent');
    const status = $('#pfDevInsightsStatus');
    const refreshButton = $('#pfDevRefresh');
    if (!root) return;
    root.replaceChildren();
    if (refreshButton) refreshButton.disabled = devInsightsLoading;

    if (devInsightsLoading) {
      if (status) status.textContent = 'Consultando as fontes do Arcade…';
      root.appendChild(empty('Buscando estatísticas da base, StreamElements e Twitch.'));
      return;
    }
    if (devInsightsError) {
      if (status) status.textContent = 'A consulta do diagnóstico não foi concluída.';
      const errorCard = devSection('Não foi possível acessar o diagnóstico', devInsightsError);
      errorCard.appendChild(el('p', 'pf-dev-warning', 'Confira se sua conta continua com cargo DEV e se a rota /api/game está respondendo.'));
      root.appendChild(errorCard);
      return;
    }
    if (!devInsights) {
      if (status) status.textContent = 'Nenhuma consulta realizada nesta sessão.';
      root.appendChild(empty('Clique em “Atualizar dados” para executar o diagnóstico.'));
      return;
    }

    const generated = new Date(devInsights.generatedAt || '');
    if (status) status.textContent = `Atualizado em ${Number.isNaN(generated.getTime()) ? 'horário não informado' : generated.toLocaleString('pt-BR')}${devInsights.cached ? ' · resultado em cache de 5 min' : ''}`;

    // Base do Arcade
    const arcade = devInsights.arcade || {};
    const arcadeStats = arcade.stats || {};
    const arcadeCard = devSection('Base do Soso Arcade', `${money(arcade.players)} contas no ranking · ${money(arcade.sampleSize)} contas analisadas · ${arcade.complete ? 'base completa' : 'amostra estratificada'}`);
    if (arcade.error) arcadeCard.appendChild(el('p', 'pf-dev-warning', `Falha ao consultar Redis: ${arcade.error}`));
    const arcadeGrid = el('div', 'pf-dev-stat-grid');
    arcadeGrid.append(
      statTile('Média de horas', fmtHours(arcadeStats.hours?.mean), `Mediana ${fmtHours(arcadeStats.hours?.median)}`),
      statTile('P75 / P90 de horas', `${fmtHours(arcadeStats.hours?.p75)} / ${fmtHours(arcadeStats.hours?.p90)}`, 'Distribuição de watchtime do Arcade'),
      statTile('Média de lives', arcadeStats.lives?.mean == null ? '—' : Number(arcadeStats.lives.mean).toFixed(1), `Mediana ${arcadeStats.lives?.median ?? '—'}`),
      statTile('Média de votos', arcadeStats.votes?.mean == null ? '—' : Number(arcadeStats.votes.mean).toFixed(1), `P75 ${arcadeStats.votes?.p75 ?? '—'}`),
      statTile('Sugestões enviadas', arcadeStats.suggestions?.mean == null ? '—' : Number(arcadeStats.suggestions.mean).toFixed(1), `Aprovadas: ${arcadeStats.approvedSuggestions?.mean == null ? '—' : Number(arcadeStats.approvedSuggestions.mean).toFixed(1)} em média`)
    );
    arcadeCard.appendChild(arcadeGrid);
    root.appendChild(arcadeCard);

    // StreamElements — configuração e falhas são exibidas como estado, não como tela quebrada.
    const streamElements = devInsights.streamElements || {};
    const watch = streamElements.watchtime || {};
    const summary = watch.summary || {};
    const seDescription = !streamElements.configured
      ? (streamElements.error || 'Token do StreamElements não configurado.')
      : (streamElements.connected === false
        ? 'O token está cadastrado, mas o servidor não conseguiu consultar o canal.'
        : `Canal ${streamElements.channelId || 'identificado'} · ${money(watch.sampled)} viewers com watchtime interpretado · ${watch.complete ? 'paginação completa' : 'amostra limitada'}`);
    const seCard = devSection('StreamElements', seDescription);
    if (!streamElements.configured) {
      seCard.appendChild(el('p', 'pf-dev-warning', streamElements.error || 'Configure STREAMELEMENTS_JWT nas variáveis de ambiente da Vercel.'));
    } else if (streamElements.connected === false) {
      seCard.appendChild(el('p', 'pf-dev-warning', `Falha de conexão: ${streamElements.error || 'erro não informado'}`));
      if (streamElements.hint) seCard.appendChild(el('p', 'pf-dev-footnote', streamElements.hint));
      seCard.appendChild(el('p', 'pf-dev-footnote', 'O token não é exibido nem enviado ao navegador. Não é necessário pedir outro token antes de investigar esta mensagem.'));
    } else {
      const subscribers = streamElements.subscribers || {};
      const donations = streamElements.donations || {};
      const seGrid = el('div', 'pf-dev-stat-grid');
      seGrid.append(
        statTile('Média de watchtime', fmtHours(summary.mean), `Mediana ${fmtHours(summary.median)}`),
        statTile('P75 / P90', `${fmtHours(summary.p75)} / ${fmtHours(summary.p90)}`, `${money(watch.unparsed)} registros sem formato reconhecido`),
        statTile('Inscritos ativos', money(subscribers.activeTotal ?? subscribers.activeInFetchedPages), `${money(subscribers.sampleCount)} registros lidos${subscribers.complete ? '' : ' · amostra'}`),
        statTile('Doações neste mês', donations.month?.length
          ? donations.month.map(item => `${item.currency} ${money(item.total)}`).join(' · ')
          : 'Sem registros', `${money(donations.tipsInMonth)} doação(ões) · ${money(donations.recordsFetched)} registros lidos`)
      );
      seCard.appendChild(seGrid);

      if (watch.leaderboard?.length) {
        const board = el('div', 'pf-dev-leaderboard');
        board.appendChild(el('h5', '', 'Top 5 de watchtime'));
        watch.leaderboard.slice(0, 5).forEach(row => board.appendChild(el('p', '', `#${row.pos} ${row.nome} · ${fmtHours(row.horas)}`)));
        seCard.appendChild(board);
      }
      if (streamElements.points?.leaderboard?.length) {
        const board = el('div', 'pf-dev-leaderboard');
        board.appendChild(el('h5', '', 'Top 5 de pontos do StreamElements'));
        streamElements.points.leaderboard.slice(0, 5).forEach(row => board.appendChild(el('p', '', `#${row.pos} ${row.nome} · ${money(row.points)} pontos`)));
        seCard.appendChild(board);
      }
      if (watch.unparsed) {
        seCard.appendChild(el('p', 'pf-dev-warning', `${money(watch.unparsed)} registros de watchtime não foram interpretados. Unidade numérica configurada: ${watch.numericUnit || 'nenhuma'}. Não configure a unidade sem confirmar o formato retornado pela API.`));
        if (watch.fieldShapeSample?.length) {
          const sample = el('details', 'pf-dev-sample-details');
          sample.append(el('summary', '', 'Ver amostra dos campos (sem identificadores)'), el('pre', 'pf-dev-json-sample', JSON.stringify(watch.fieldShapeSample, null, 2)));
          seCard.appendChild(sample);
        }
      }
      if ((!subscribers.complete && !streamElements.errors?.subscribers) || (!donations.complete && !streamElements.errors?.tips)) {
        seCard.appendChild(el('p', 'pf-dev-warning', 'A leitura de inscritos ou doações atingiu o limite de paginação. Esses números representam a amostra lida, não necessariamente o total do canal.'));
      }
      const sourceErrors = Object.entries(streamElements.errors || {}).filter(([, message]) => message);
      if (sourceErrors.length) {
        sourceErrors.forEach(([source, message]) => seCard.appendChild(el('p', 'pf-dev-warning', `${source}: ${message}`)));
      }
    }
    root.appendChild(seCard);

    // Twitch
    const twitch = devInsights.twitch || {};
    const twitchCard = devSection('Status da Twitch', twitch.online === true
      ? `AO VIVO · ${money(twitch.viewers)} espectadores · ${twitch.title || 'sem título'}${twitch.game ? ` · ${twitch.game}` : ''}`
      : (twitch.online === false ? 'Canal offline neste momento.' : (twitch.error || 'Status da live indisponível.')));
    if (!twitch.configured) twitchCard.appendChild(el('p', 'pf-dev-warning', 'TWITCH_CLIENT_ID e TWITCH_CLIENT_SECRET precisam estar configurados na Vercel.'));
    else if (twitch.online === null) twitchCard.appendChild(el('p', 'pf-dev-warning', twitch.error || 'A Twitch não retornou um status válido.'));
    root.appendChild(twitchCard);

    // Configuração usada pelo cron que contabiliza a presença dos espectadores.
    const presence = devInsights.twitchPresence || {};
    const presenceCard = devSection('Contabilização de presença nas lives', presence.pronta
      ? `Canal @${presence.broadcasterLogin || 'asemtet0'} identificado. ${presence.broadcasterRefreshToken ? 'Autorização da Twitch armazenada no servidor.' : 'Falta autorizar o canal.'}`
      : 'O aplicativo será identificado automaticamente. A leitura de participantes exige uma autorização da broadcaster.');
    const scopeLabel = presence.scopeOk === true ? 'Permissão confirmada' : (presence.scopeOk === false ? 'Permissão ausente' : 'Ainda não verificada');
    const presenceGrid = el('div', 'pf-dev-stat-grid');
    presenceGrid.append(
      statTile('App Twitch', presence.clientCredentials ? 'Configurado' : 'Pendente', 'TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET'),
      statTile('Canal', presence.broadcasterId ? `@${presence.broadcasterLogin || 'asemtet0'}` : 'Não identificado', presence.broadcasterUserId ? `ID ${presence.broadcasterUserId}` : 'Identificado pelo login público'),
      statTile('Autorização da Soso', presence.broadcasterRefreshToken ? 'Salva no servidor' : 'Aguardando', 'O token fica somente no Redis'),
      statTile('Permissão do chat', scopeLabel, presence.scopeNecessario || 'moderator:read:chatters'),
      statTile('Token temporário', presence.accessTokenEmCache ? 'Em cache' : 'Gerado sob demanda', 'Renovado automaticamente pelo servidor')
    );
    presenceCard.appendChild(presenceGrid);
    if (presence.broadcasterError) presenceCard.appendChild(el('p', 'pf-dev-warning', `Não foi possível identificar o canal: ${presence.broadcasterError}`));
    if (presence.lastCron?.status === 'error' || presence.lastCron?.status === 'test-error') {
      presenceCard.appendChild(el('p', 'pf-dev-warning', `Última falha (${new Date(presence.lastCron.at || Date.now()).toLocaleString('pt-BR')}): ${presence.lastCron.message || presence.lastCron.result?.message || 'erro não detalhado'}`));
    } else if (presence.lastCron?.at) {
      presenceCard.appendChild(el('p', 'pf-dev-footnote', `Última execução/teste: ${new Date(presence.lastCron.at).toLocaleString('pt-BR')} · ${presence.lastCron.status || 'registrada'}`));
    }

    if (presence.clientCredentials && presence.broadcasterId && (!presence.broadcasterRefreshToken || presence.scopeOk === false || presence.lastCron?.status === 'error' || presence.lastCron?.status === 'test-error')) {
      const authActions = el('div', 'pf-dev-actions');
      const authButton = button('Gerar link seguro para a Soso autorizar', 'pf-btn pf-btn-primary', async () => {
        authButton.disabled = true;
        authButton.textContent = 'Gerando link…';
        try {
          const result = await window.api(window.API_AUTH || '/api/auth', 'twitch-broadcaster-link', { method: 'POST' });
          if (!result.ok || !result.data?.url) throw new Error(result.data?.error || 'Não foi possível gerar o link.');
          linkInput.value = result.data.url;
          linkBox.hidden = false;
          try { await navigator.clipboard.writeText(result.data.url); notify('Link copiado. Envie para a Soso; ele expira em 15 minutos.', 'ok'); }
          catch (_) { linkInput.focus(); linkInput.select(); notify('Link gerado. Copie o endereço exibido e envie para a Soso.', 'ok'); }
        } catch (error) {
          notify(error.message || 'Falha ao gerar o link de autorização.', 'erro');
        } finally {
          authButton.disabled = false;
          authButton.textContent = 'Gerar novo link de autorização';
        }
      });
      const linkBox = el('div', 'pf-dev-link-box');
      const linkLabel = el('label', 'pf-dev-link-label', 'Link temporário de autorização (válido por 15 minutos; uso único)');
      const linkRow = el('div', 'pf-dev-copy-row');
      const linkInput = el('input', 'pf-dev-copy-input');
      linkInput.type = 'text'; linkInput.readOnly = true; linkInput.autocomplete = 'off';
      const copyLink = button('Copiar link', 'pf-btn pf-btn-secondary', async () => {
        if (!linkInput.value) return;
        try { await navigator.clipboard.writeText(linkInput.value); notify('Link copiado.', 'ok'); }
        catch (_) { linkInput.focus(); linkInput.select(); notify('Pressione Ctrl+C para copiar.', 'info'); }
      });
      linkRow.append(linkInput, copyLink);
      linkBox.append(linkLabel, linkRow, el('p', 'pf-dev-footnote', 'A Soso só precisa abrir o link, entrar na Twitch correta e clicar em Autorizar. O token é enviado diretamente para o servidor e salvo no Redis; ela não precisa copiar nem compartilhar nenhum segredo.'));
      linkBox.hidden = true;
      authActions.append(authButton, linkBox);
      presenceCard.appendChild(authActions);
    }

    const callbackBox = el('div', 'pf-dev-link-box');
    callbackBox.appendChild(el('label', 'pf-dev-link-label', 'URL de retorno cadastrada no aplicativo Twitch Developers'));
    const callbackRow = el('div', 'pf-dev-copy-row');
    const callbackInput = el('input', 'pf-dev-copy-input');
    callbackInput.type = 'text'; callbackInput.readOnly = true; callbackInput.value = presence.callbackUrl || 'https://asemtet0.vercel.app/api/twitch-callback';
    const copyCallback = button('Copiar callback', 'pf-btn pf-btn-secondary', async () => {
      try { await navigator.clipboard.writeText(callbackInput.value); notify('Callback copiado.', 'ok'); }
      catch (_) { callbackInput.focus(); callbackInput.select(); notify('Pressione Ctrl+C para copiar.', 'info'); }
    });
    callbackRow.append(callbackInput, copyCallback);
    callbackBox.append(callbackRow, el('p', 'pf-dev-footnote', 'Esse endereço precisa estar cadastrado exatamente igual no campo OAuth Redirect URLs do app Twitch. Não use localhost. O callback não é um segredo.'));
    presenceCard.appendChild(callbackBox);

    if (presence.broadcasterRefreshToken && presence.broadcasterId) {
      const testActions = el('div', 'pf-dev-actions');
      const testOutput = el('p', 'pf-dev-test-output', 'O teste consulta a Twitch, mas nunca credita XP, moedas ou presença.');
      const testButton = button('Testar conexão sem dar XP', 'pf-btn pf-btn-secondary', async () => {
        testButton.disabled = true; testButton.textContent = 'Testando Twitch…';
        testOutput.textContent = 'Consultando status da live e, se estiver ao vivo, participantes do chat…';
        try {
          const result = await window.api(window.API_GAME || '/api/game', 'twitch-presence-test', { method: 'POST', body: {} });
          if (!result.ok) throw new Error(result.data?.error || `Erro HTTP ${result.status}`);
          testOutput.textContent = result.data?.message || 'Conexão consultada.';
          notify(result.data?.online ? 'Twitch conectada e chatters consultados.' : 'Canal identificado; está offline agora.', 'ok');
        } catch (error) {
          testOutput.textContent = error.message || 'Falha ao testar a Twitch.';
          notify(testOutput.textContent, 'erro');
        } finally {
          testButton.disabled = false; testButton.textContent = 'Testar conexão novamente';
          loadDevInsights(true);
        }
      });
      testActions.append(testButton, testOutput);
      presenceCard.appendChild(testActions);
    }
    presenceCard.appendChild(el('p', 'pf-dev-footnote', `A API lista participantes somente com OAuth ${presence.scopeNecessario || 'moderator:read:chatters'}. O agendador deve chamar /api/game?action=cron-presenca a cada 5 minutos com Authorization: Bearer CRON_SECRET. O site não usa o watchtime acumulado do StreamElements para inventar presença por live. Consulte CONFIGURACAO-VERCEL.md.`));
    root.appendChild(presenceCard);

    const recommendation = devInsights.recommendation?.hours;
    if (recommendation) {
      const card = devSection('Referência de metas por percentil', 'Sugestão baseada na distribuição de watchtime do StreamElements. Revise a cobertura da amostra antes de alterar qualquer regra.');
      const grid = el('div', 'pf-dev-stat-grid');
      grid.append(
        statTile('Entrada', `${recommendation.entry}h`, 'P25 arredondado'),
        statTile('Frequente', `${recommendation.regular}h`, 'Mediana arredondada'),
        statTile('Fiel', `${recommendation.loyal}h`, 'P75 arredondado'),
        statTile('Lendária', `${recommendation.legendary}h`, 'P90 arredondado')
      );
      card.appendChild(grid);
      root.appendChild(card);
    }

    root.appendChild(el('p', 'pf-dev-footnote', 'O watchtime do StreamElements é apenas uma fonte de análise. Ele não altera XP nem horas do Arcade: esses créditos continuam sendo feitos pelo cron de presença para evitar duplicidade.'));
  }

  async function loadDevInsights(force = false) {
    if (devInsightsLoading || (!force && devInsights)) return;
    devInsightsLoading = true;
    devInsightsError = '';
    renderDevInsights();
    try {
      const result = await api(API_GAME, 'dev-insights', { query: force ? { force: 1 } : null });
      if (!result.ok) {
        const message = result.data?.error || `A API respondeu HTTP ${result.status || 'desconhecido'}.`;
        throw new Error(message);
      }
      if (!result.data || typeof result.data !== 'object') throw new Error('A API retornou uma resposta vazia ou inválida.');
      devInsights = result.data;
      devInsightsError = '';
    } catch (error) {
      devInsights = null;
      devInsightsError = error?.message || 'Erro desconhecido ao consultar o diagnóstico.';
      console.error('[PerfilUI] Diagnóstico DEV:', error);
    } finally {
      devInsightsLoading = false;
      renderDevInsights();
    }
  }

  function activateTab(tab) {
    if (!tab) return;
    active = tab.dataset.pfTab;
    const tabs = $$('[data-pf-tab]');
    const panels = $$('[data-pf-panel]');
    tabs.forEach(item => {
      const selected = item === tab;
      item.classList.toggle('on', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      item.tabIndex = selected ? 0 : -1;
    });
    panels.forEach(panel => {
      const selected = panel.dataset.pfPanel === active;
      panel.classList.toggle('on', selected);
      panel.hidden = !selected;
    });

    if (active === 'boneco') {
      window.dispatchEvent(new CustomEvent('soso:boneco-open'));
    } else if (!perfil) {
      renderGuest();
    } else {
      updateAll();
    }
  }

  function initTabs() {
    const tabs = $$('[data-pf-tab]');
    if (!tabs.length) return;
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab));
      tab.tabIndex = tab.classList.contains('on') ? 0 : -1;
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        tabs[next].focus();
        activateTab(tabs[next]);
      });
    });
    $$('[data-pf-go]').forEach(link => {
      link.addEventListener('click', () => $(`[data-pf-tab="${link.dataset.pfGo}"]`)?.click());
    });
  }

  function bindActions() {
    $('#pfTituloSelect')?.addEventListener('change', async event => {
      const titleId = event.target.value;
      if (!titleId || !perfil) return;
      event.target.disabled = true;
      const result = await api(API_GAME, 'titulo', { method: 'POST', body: { id: titleId } });
      if (!result.ok) {
        notify(result.data?.error || 'Não foi possível equipar o título.', 'erro');
      } else {
        notify('Título equipado!', 'ok');
        await loadAll(true);
      }
      event.target.disabled = false;
    });

    $('#pfOpenGlobalRanking')?.addEventListener('click', () => window.mudarAba?.('ranking'));

    $('#pfInventoryFilter')?.addEventListener('change', event => {
      inventoryFilter = event.target.value || 'todos';
      renderInventory();
    });
    $('#pfInventoryPreviewReset')?.addEventListener('click', () => {
      inventoryPreviewChanges = {}; inventoryPreviewLabel = ''; renderInventory();
    });
    $('#pfInventoryEditLook')?.addEventListener('click', () => {
      const tab = $('[data-pf-tab="boneco"]');
      if (tab) tab.click();
      const changes = Object.entries(inventoryPreviewChanges);
      changes.forEach(([slot, id], index) => window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('soso:experimentar-item', { detail: { slot, id } }));
      }, index * 240));
      if (!changes.length) window.dispatchEvent(new CustomEvent('soso:boneco-open'));
    });


    $('#pfAchievementFilters')?.addEventListener('click', event => {
      const target = event.target.closest('[data-achievement-filter]');
      if (!target) return;
      achievementFilter = target.dataset.achievementFilter;
      renderAchievements();
    });

    $('#pfSaveNick')?.addEventListener('click', async () => {
      const input = $('#pfSettingsNick');
      const note = $('#pfSettingsNickNote');
      const nick = String(input?.value || '').trim();
      if (nick.length < 3 || nick.length > 24) {
        if (note) note.textContent = 'Use um nick de 3 a 24 caracteres.';
        return;
      }
      const saveButton = $('#pfSaveNick');
      if (saveButton) saveButton.disabled = true;
      if (note) note.textContent = 'Salvando seu nick…';
      try {
        const result = await api(API_AUTH, 'change-nick', { method: 'POST', body: { nick } });
        if (!result.ok) throw new Error(result.data?.error || 'Não foi possível salvar o nick.');
        if (note) note.textContent = 'Nick atualizado com sucesso!';
        await window.checarLogin?.();
        await loadAll(true);
        notify('Nick atualizado!', 'ok');
      } catch (error) {
        if (note) note.textContent = error.message || 'Não foi possível salvar o nick.';
      } finally {
        if (saveButton) saveButton.disabled = false;
        renderSettings();
      }
    });

    $('#pfSettingsLogout')?.addEventListener('click', () => window.sair?.());
    $('#pfCopyPlayerId')?.addEventListener('click', async () => { const id = String(perfil?.id || usuarioAtual()?.id || ''); if(!id) return; try { await navigator.clipboard.writeText(id); notify('ID copiado!','ok'); } catch(e) { notify('Não consegui copiar o ID neste navegador.','warn'); } });
    $('#pfDevRefresh')?.addEventListener('click', () => loadDevInsights(true));
    $('#pfGoogleLink')?.addEventListener('click', event => {
      event.preventDefault();
      window.location.href = '/api/auth?action=google-login';
    });
    $('#pfTwitchLink')?.addEventListener('click', () => {
      window.location.href = '/api/auth?action=twitch-link';
    });
    $('#pfTwitchUnlink')?.addEventListener('click', async () => {
      if (!confirm('Desvincular sua conta Twitch? A presença nas lives deixará de ser contabilizada.')) return;
      const result = await api(API_AUTH, 'twitch-unlink', { method: 'POST' });
      if (!result.ok) {
        notify(result.data?.error || 'Não foi possível desvincular.', 'erro');
        return;
      }
      notify('Twitch desvinculada.', 'ok');
      await window.checarLogin?.();
      await loadAll(true);
    });
  }

  function init() {
    initTabs();
    bindActions();
    if (window.GameState) {
      window.GameState.on('perfil', updatedProfile => {
        perfil = updatedProfile;
        if (perfil) updateAll();
        else renderGuest();
      });
      window.GameState.on('catalogo', updatedCatalog => {
        catalogo = updatedCatalog;
        if (active === 'inventario') renderInventory();
      });
    }

    window.addEventListener('soso:auth', event => {
      if (!event.detail) {
        perfil = null;
        window.GameState?.limpar();
        renderGuest();
      } else {
        loadAll(true);
      }
    });
    window.addEventListener('soso:logout', () => {
      perfil = null;
      renderGuest();
    });
    window.addEventListener('soso:aba', event => {
      if (event.detail === 'perfil') loadAll(false);
    });

    if (window.GameState?.perfil) perfil = window.GameState.perfil;
    if (window.GameState?.catalogo) catalogo = window.GameState.catalogo;
    if (perfil) updateAll();
    else renderGuest();
    loadAll(false);
  }

  window.PerfilUI = {
    init,
    refresh: () => loadAll(true),
    get perfilAtual() { return perfil; },
    carregarVisaoGeral: renderOverview,
    carregarInventario: renderInventory,
    carregarConquistas: renderAchievements,
    carregarConfiguracoes: renderSettings
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
