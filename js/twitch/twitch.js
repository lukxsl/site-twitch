/* ============================================================
   TWITCH
   ============================================================ */
const FORCAR_REPRISE_NA_TWITCH = true;
let canalMature = FORCAR_REPRISE_NA_TWITCH;

/* ============================================================
   🆕 FOCO — Último jogo / Jogo ao vivo
   Faz match com JOGOS[] pra puxar capa/nota/tier/horas.
   ============================================================ */
function atualizarFoco(game, isLive){
  const cover = document.getElementById('focoCover');
  const nome  = document.getElementById('focoNome');
  const meta  = document.getElementById('focoMeta');
  const horas = document.getElementById('focoHoras');
  const label = document.getElementById('focoLabel');
  const link  = document.getElementById('focoTwitchLink');
  const bar   = document.getElementById('focoBar');
  const barI  = document.getElementById('focoBarI');
  const pct   = document.getElementById('focoPct');
  if(!cover || !nome) return;

  ultGame = game || null;
  ultVivo = !!isLive;

  // ---- Sem jogo ----
  if(!game || !game.name){
    cover.classList.remove('skeleton');
    cover.removeAttribute('src');
    cover.style.display = 'none';
    nome.textContent = isLive ? 'Live sem categoria' : 'Sem jogo recente';
    if(label) label.textContent = isLive ? '🎮 Jogando agora' : '🎮 Último jogo jogado';
    if(meta) meta.innerHTML = '';
    if(horas) horas.textContent = isLive
      ? 'Sem categoria definida na Twitch.'
      : 'Quando a Soso jogar, aparece aqui. 💜';
    if(link) link.style.display = 'none';
    if(bar) bar.style.display = 'none';
    return;
  }

  // ---- Match na tier list ----
  const nomeNorm = norm(game.name);
  const lista = (typeof JOGOS !== 'undefined' ? JOGOS : []);
  const jogoTL = lista.find(j => norm(j.nome) === nomeNorm);

  const nomeFinal = jogoTL ? jogoTL.nome : game.name;
  const capaTL     = jogoTL && jogoTL.capa;
  const capaTwitch = game.box_art || null;
  const capaSteam  = (jogoTL && jogoTL.appid)
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${jogoTL.appid}/library_600x900.jpg`
    : null;
  const capaFinal = capaTL || capaTwitch || capaSteam;

  nome.textContent = nomeFinal;
  if(label) label.textContent = isLive ? '🎮 Jogando agora' : '🎮 Último jogo jogado';

  if(capaFinal){
    cover.classList.remove('skeleton');
    cover.onerror = () => { cover.style.display = 'none'; };
    cover.src = capaFinal;
    cover.style.display = 'block';
  } else {
    cover.classList.add('skeleton');
    cover.removeAttribute('src');
    cover.style.display = 'block';
  }

  // ---- Chips de meta ----
  if(meta){
    const chips = [];
    if(jogoTL){
      if(jogoTL.tier && jogoTL.tier !== 'NR') chips.push(`<span class="foco-chip tr">Tier ${esc(jogoTL.tier)}</span>`);
      if(jogoTL.nota > 0) chips.push(`<span class="foco-chip">⭐ ${n1(jogoTL.nota)}</span>`);
      if(jogoTL.status) chips.push(`<span class="foco-chip">${esc(jogoTL.status)}</span>`);
      if(jogoTL.horas > 0) chips.push(`<span class="foco-chip">⏱ ${fh(jogoTL.horas)}</span>`);
    } else {
      chips.push(`<span class="foco-chip">Novo na biblioteca</span>`);
    }
    meta.innerHTML = chips.join('');
  }

  // ---- Linha de horas/extra ----
  if(horas){
    if(jogoTL && jogoTL.horas > 0){
      const cq = (jogoTL.conquistas && jogoTL.conquistas.total)
        ? ` · 🏆 ${jogoTL.conquistas.obtidas}/${jogoTL.conquistas.total}`
        : (jogoTL.status ? ` · ${jogoTL.status}` : '');
      horas.textContent = `${fh(jogoTL.horas)} jogadas${cq}`;
    } else {
      horas.textContent = isLive
        ? 'Assistindo agora na Twitch 💜'
        : 'Sem dados extras na tier list ainda.';
    }
  }

  // ---- Barra de progresso (conquistas) ----
  if(bar && barI && pct){
    if(jogoTL && jogoTL.conquistas && jogoTL.conquistas.total > 0){
      const p = Math.round((jogoTL.conquistas.obtidas / jogoTL.conquistas.total) * 100);
      bar.style.display = '';
      barI.style.width = p + '%';
      pct.textContent = p + '%';
    } else {
      bar.style.display = 'none';
    }
  }

  // ---- Link Twitch ----
  if(link){
    link.style.display = isLive ? '' : 'none';
    link.href = 'https://www.twitch.tv/asemtet0';
  }
}
window.atualizarFoco = atualizarFoco;

/* ============================================================
   VOD / REPRISE
   ============================================================ */
function assistirVod(v){
  v = v || vodAtual; if (!v) return;
  vodAtual = v;
  const urlTwitch = `https://www.twitch.tv/videos/${encodeURIComponent(v.id)}`;
  if (canalMature) {
    window.open(urlTwitch, '_blank', 'noopener');
    if (typeof toast === 'function') toast('🔞 Reprise +18: abrindo na Twitch', 'ok');
    return;
  }
  assistindoVod = true;
  const panel = document.getElementById('offlinePanel');
  if(panel) panel.style.display = 'none';
  const f = document.getElementById('twitchIframe');
  if(!f) return;
  f.style.display = 'block';
  f.src = `https://player.twitch.tv/?video=v${vodAtual.id}&parent=${HOST}&autoplay=false`;
  const area = document.querySelector('.twitch-player');
  if(area){
    let fb = document.getElementById('vodFallback');
    if(!fb){
      fb = document.createElement('a');
      fb.id = 'vodFallback'; fb.className = 'vod-fallback';
      fb.target = '_blank'; fb.rel = 'noopener';
      area.appendChild(fb);
    }
    fb.href = urlTwitch;
    fb.textContent = 'Pediu login? Assistir na Twitch ↗';
    fb.style.display = '';
  }
  const noteEl = document.getElementById('playerNoteText');
  if(noteEl){
    noteEl.classList.remove('recado');
    noteEl.innerHTML = `Reprise: ${esc(vodAtual.title)} · <a href="${urlTwitch}" target="_blank" rel="noopener">Não carregou? Abrir na Twitch ↗</a>`;
  }
  const box = document.querySelector('.twitch-player-box');
  if(box) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.assistirVod = assistirVod;

function tickUptime(){
  const el = $('tmUp'); if(!el) return;
  if(!inicioLive){ el.textContent = 'Offline'; return; }
  const m = Math.max(0, Math.floor((Date.now() - inicioLive) / 60000));
  el.textContent = `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
setInterval(tickUptime, 30000);

let toastLiveMostrado = false;

function _atualizarPlayerHeader(isLive){
  const titleEl = document.querySelector('.twitch-player-title');
  if(!titleEl) return;
  titleEl.innerHTML = `<span class="live-indicator" id="headerLiveDot"></span>${isLive ? ' AO VIVO NA TWITCH' : ' CANAL DA SOSO'}`;
  if(typeof setLivePulse === 'function') setLivePulse(isLive);
}

function _atualizarProfileStatus(isLive, data){
  const el = document.getElementById('profileStatus');
  if(el){
    el.classList.toggle('online', !!isLive);
    el.title = isLive ? '🟢 Online agora' : '⚫ Offline';
  }
  const dyn = document.getElementById('profileStatusDinamica');
  if(!dyn) return;
  if(isLive){
    const jogo = (data && data.stream && data.stream.game_name) ? data.stream.game_name : null;
    dyn.className = 'profile-status-dinamica online';
    dyn.textContent = jogo ? `Online agora · jogando ${jogo}` : 'Online agora';
  } else {
    const vod = (data && data.video) ? data.video : vodAtual;
    if(vod && vod.created_at){
      dyn.className = 'profile-status-dinamica offline';
      dyn.textContent = `Offline · última live ${tempoAtras(vod.created_at)}`;
    } else {
      dyn.className = 'profile-status-dinamica offline';
      dyn.textContent = 'Offline · sem lives recentes';
    }
  }
}

function _atualizarStatsStrip(data){
  const seg = document.getElementById('stripSeg');
  const horas = document.getElementById('stripHoras');
  const discord = document.getElementById('stripDiscord');
  const live = document.getElementById('stripLive');
  const liveSep = document.getElementById('stripLiveSep');
  const viewers = document.getElementById('stripViewers');

  const flash = (el, novoValor) => {
    if(!el) return;
    const valorAntigo = el.dataset.valor || el.textContent;
    const novo = String(novoValor);
    el.textContent = novo;
    el.dataset.valor = novo;
    if(valorAntigo && valorAntigo !== '—' && valorAntigo !== novo){
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1200);
    }
  };

  if(seg) flash(seg, data.followers != null ? Number(data.followers).toLocaleString('pt-BR') : '—');
  if(horas) flash(horas, data.horasMes != null ? Number(data.horasMes).toLocaleString('pt-BR') : '—');
  if(discord) flash(discord, data.discord != null ? Number(data.discord).toLocaleString('pt-BR') : '—');

  const isLive = !!(data.stream && data.stream.viewer_count != null);
  if(live) live.style.display = isLive ? '' : 'none';
  if(liveSep) liveSep.style.display = isLive ? '' : 'none';
  if(viewers && isLive) viewers.textContent = Number(data.stream.viewer_count).toLocaleString('pt-BR');
}

function _atualizarBanner(data){
  const overlay = document.getElementById('bannerOverlay');
  const badge = document.getElementById('bannerLiveBadge');
  const kicker = document.getElementById('bannerKicker');
  const title = document.getElementById('bannerTitle');
  const liveText = document.getElementById('bannerLiveText');

  const isLive = !!data.stream;
  if(isLive){
    const game = data.stream.game_name || 'Jogando';
    const viewers = Number(data.stream.viewer_count || 0);
    if(badge){
      badge.style.display = 'flex';
      badge.classList.add('live');
    }
    if(liveText) liveText.textContent = 'AO VIVO AGORA';
    if(overlay){
      overlay.style.display = '';
      if(kicker) kicker.textContent = `🎮 Jogando: ${game}`;
      if(title) title.innerHTML = `Assistindo agora com <em>${viewers.toLocaleString('pt-BR')} ${viewers === 1 ? 'viewer' : 'viewers'}</em>`;
    }
  } else {
    if(badge){
      badge.style.display = 'none';
      badge.classList.remove('live');
    }
    if(overlay) overlay.style.display = 'none';
  }
}

async function verificarStatusTwitch() {
  const g = id => document.getElementById(id);
  const iframe = g('twitchIframe'), panel = g('offlinePanel');
  try {
    const response = await fetch('/api/twitch');
    if (!response.ok) throw new Error('api');
    const data = await response.json();

    atualizarMeta('goalSeg', data.followers, MARCOS, true);
    atualizarMeta('goalDc', data.discord, MARCOS, true);
    _atualizarStatsStrip(data);

    const live = !!data.stream;
    inicioLive = live && data.stream.started_at ? new Date(data.stream.started_at) : null;
    if(data.stream && data.stream.uptime_seconds){
      window.__uptimeLiveSeg = data.stream.uptime_seconds;
      window.__uptimeLiveTs = Date.now();
    } else {
      window.__uptimeLiveSeg = 0;
    }

    _atualizarPlayerHeader(live);
    _atualizarProfileStatus(live, data);
    _atualizarBanner(data);

    const isMature = !!(data.stream && data.stream.is_mature);

    if (live && !toastLiveMostrado) {
      toastLiveMostrado = true;
      setTimeout(() => toast('🔴 Soso tá ao vivo! Vem pro chat 💜', 'ok'), 800);
    }

    if (data.discord && $('dcMembros'))
      $('dcMembros').textContent = `${data.discord.toLocaleString('pt-BR')} membros · avisos de live, resenha e novidades.`;

    canalMature = FORCAR_REPRISE_NA_TWITCH || !!data.canal_mature;
    vodAtual = data.video;
    videosTw = data.videos || (data.video ? [data.video] : []);

    if (data.user) {
      if (data.user.profile_image_url) {
        const av = g('offlineAvatarImg');
        if (av) av.src = data.user.profile_image_url;
      }
      if (data.user.offline_image_url && panel) {
        panel.style.backgroundImage = `url(${data.user.offline_image_url})`;
      }
    }

    if (data.stream && isMature) {
      assistindoVod = false;
      if(iframe){
        iframe.style.display = 'none';
        iframe.src = 'about:blank';
      }
      if(panel){
        panel.style.display = 'flex';
        panel.innerHTML = `
          <div style="font-size:2.6rem;line-height:1">🔞</div>
          <h4>Conteúdo +18 agora</h4>
          <p>A Soso tá jogando algo com classificação adulta. O Twitch bloqueia o player embutido nesses casos — assiste direto no site deles:</p>
          <div class="offline-actions">
            <a class="btn" href="https://www.twitch.tv/asemtet0" target="_blank" rel="noopener">▶ Assistir na Twitch</a>
          </div>
        `;
      }
      g('viewerCountStatus').textContent = `${data.stream.viewer_count} assistindo`;
      const noteEl = g('playerNoteText');
      if(noteEl){
        noteEl.classList.remove('recado');
        noteEl.textContent = `🔞 Conteúdo +18 — clica em "Assistir na Twitch" acima.`;
      }
    } else if (data.stream) {
      assistindoVod = false;
      if(panel) panel.style.display = 'none';
      if(iframe){
        iframe.style.display = 'block';
        const novoSrc = `https://player.twitch.tv/?channel=asemtet0&parent=${HOST}`;
        if (iframe.src !== novoSrc) iframe.src = novoSrc;
      }
      g('viewerCountStatus').textContent = `${data.stream.viewer_count} assistindo`;
      const noteEl = g('playerNoteText');
      if(noteEl){
        if(!noteEl.classList.contains('recado')){
          noteEl.textContent = `Transmitindo: ${data.stream.title}`;
        }
      }
    } else {
      g('viewerCountStatus').textContent = '@asemtet0';
      if (!assistindoVod) {
        if(iframe){
          iframe.style.display = 'none';
          iframe.src = 'about:blank';
        }
        if(panel){
          panel.style.display = 'flex';
          panel.innerHTML = `
            <img id="offlineAvatarImg" src="img/avatar.png" alt="Soso" onerror="this.style.display='none'">
            <h4>Estamos offline por agora 💜</h4>
            <p>Siga o canal pra ser avisado quando a Soso entrar ao vivo!</p>
            <div class="offline-info">
              <span>📅 Lives toda semana</span>
              <a href="https://discord.gg/J4gGaKWFPZ" target="_blank" rel="noopener">🔔 Avisos no Discord</a>
            </div>
            <div class="offline-actions">
              <a class="btn twitch-accent" href="https://www.twitch.tv/asemtet0" target="_blank" rel="noopener">Seguir na Twitch</a>
              <button class="btn ghost" id="btnVod" onclick="assistirVod()" style="display:none">▶ Última live${canalMature ? ' ↗' : ''}</button>
            </div>
          `;
          if(data.user && data.user.offline_image_url){
            panel.style.backgroundImage = `url(${data.user.offline_image_url})`;
          }
          const btnVodEl = g('btnVod');
          if(btnVodEl) btnVodEl.style.display = vodAtual ? '' : 'none';
        }
        const noteEl = g('playerNoteText');
        if(noteEl){
          if(!noteEl.classList.contains('recado')){
            noteEl.textContent = 'Quando a Soso estiver ao vivo, a transmissão aparece aqui. 🎮';
          }
        }
      }
    }

    const fbVod = g('vodFallback');
    if(fbVod) fbVod.style.display = assistindoVod ? '' : 'none';

    atualizarFoco(data.game, !!data.stream);
    if(typeof window.setJogoAoVivo === 'function'){
      window.setJogoAoVivo(data.stream && data.game ? data.game.name : null);
    }
    renderClips(data.clips);
    setLivePulse(live);
  } catch (err) {
    console.error('Erro ao buscar dados da Twitch:', err);
    atualizarFoco(null, false);
    if(typeof window.setJogoAoVivo === 'function') window.setJogoAoVivo(null);
    ['goalSeg','goalDc'].forEach(p => { const el = $(p+'Num'); if (el && el.textContent === '…') atualizarMeta(p, null); });
    setLivePulse(false);
    _atualizarPlayerHeader(false);
    _atualizarProfileStatus(false, null);
    const overlay = document.getElementById('bannerOverlay');
    if(overlay) overlay.style.display = 'none';
    const badge = document.getElementById('bannerLiveBadge');
    if(badge) badge.style.display = 'none';
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('.tm-vod');
  if (b && videosTw[+b.dataset.i]) assistirVod(videosTw[+b.dataset.i]);
});

/* ============================================================
   CLIPES
   ============================================================ */
function renderClips(list){
  if(clipsOk) return;
  const vazio = $('clipsVazio'), box = $('clipsBox');
  if(!list || !list.length){
    if(vazio) vazio.style.display = 'block';
    if(box) box.style.display = 'none';
    return;
  }
  clipsOk = true;
  clipsCache = list.slice(0, 4);
  const totalViews = clipsCache.reduce((a, c) => a + (Number(c.views) || 0), 0);
  const titulo = $('clipsTitulo');
  if(titulo) titulo.textContent = `🎬 Clipes em destaque · 👁 ${totalViews.toLocaleString('pt-BR')} views`;
  if(box) box.style.display = '';
  if(vazio) vazio.style.display = 'none';
  $('clipsGrid').innerHTML = clipsCache.map(c =>
    `<button class="clip" data-id="${esc(c.id)}" aria-label="${esc(c.title)}">
      <img src="${esc(c.thumbnail)}" alt="" loading="lazy">
      <span class="play">▶</span>
      <span class="vw">👁 ${Number(c.views || 0).toLocaleString('pt-BR')}</span>
      <span class="ct">${esc(c.title)}</span>
    </button>`
  ).join('');
}
function getDlgClip(){
  if(dlgClip) return dlgClip;
  dlgClip = document.createElement('dialog');
  dlgClip.className = 'clip-modal';
  dlgClip.innerHTML = `<iframe id="clipIframe" allowfullscreen></iframe><div class="cm-foot"><b id="clipTitle"></b><span id="clipViews"></span></div>`;
  document.body.appendChild(dlgClip);
  dlgClip.addEventListener('click', e => { if(e.target === dlgClip) fecharClip(); });
  return dlgClip;
}
function abrirClip(id){
  const c = clipsCache.find(x => x.id === id); if(!c) return;
  const d = getDlgClip();
  d.querySelector('#clipIframe').src = `https://clips.twitch.tv/embed?clip=${encodeURIComponent(id)}&parent=${HOST}&autoplay=true`;
  d.querySelector('#clipTitle').textContent = c.title;
  d.querySelector('#clipViews').textContent = `👁 ${Number(c.views || 0).toLocaleString('pt-BR')} views`;
  d.showModal();
}
function fecharClip(){ if(dlgClip){ dlgClip.querySelector('#clipIframe').src = ''; dlgClip.close(); } }
document.addEventListener('click', e => {
  const b = e.target.closest('.clip');
  if(b && b.dataset.id) abrirClip(b.dataset.id);
});