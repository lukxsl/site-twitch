/* ============================================================
   TWITCH
   ============================================================ */
function assistirVod(v){
  v = v || vodAtual; if (!v) return;
  vodAtual = v; assistindoVod = true;
  const panel = document.getElementById('offlinePanel');
  if(panel) panel.style.display = 'none';
  const f = document.getElementById('twitchIframe');
  if(!f) return;
  f.style.display = 'block';
  f.src = `https://player.twitch.tv/?video=v${vodAtual.id}&parent=${HOST}&autoplay=false`;
  const noteEl = document.getElementById('playerNoteText');
  if(noteEl) noteEl.textContent = `Reprise: ${vodAtual.title}`;
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

function _atualizarProfileStatus(isLive){
  const el = document.getElementById('profileStatus');
  if(!el) return;
  el.classList.toggle('online', !!isLive);
  el.title = isLive ? '🟢 Online agora' : '⚫ Offline';
}

function _atualizarStatsStrip(data){
  const seg = document.getElementById('stripSeg');
  const horas = document.getElementById('stripHoras');
  const discord = document.getElementById('stripDiscord');
  const live = document.getElementById('stripLive');
  const liveSep = document.getElementById('stripLiveSep');
  const viewers = document.getElementById('stripViewers');

  if(seg) seg.textContent = data.followers != null ? Number(data.followers).toLocaleString('pt-BR') : '—';
  if(horas) horas.textContent = data.horasMes != null ? Number(data.horasMes).toLocaleString('pt-BR') : '—';
  if(discord) discord.textContent = data.discord != null ? Number(data.discord).toLocaleString('pt-BR') : '—';

  const isLive = !!(data.stream && data.stream.viewer_count != null);
  if(live) live.style.display = isLive ? '' : 'none';
  if(liveSep) liveSep.style.display = isLive ? '' : 'none';
  if(viewers && isLive) viewers.textContent = Number(data.stream.viewer_count).toLocaleString('pt-BR');
}

/* 🆕 Banner dinâmico: mostra só quando ao vivo */
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
      kicker.textContent = `🎮 Jogando: ${game}`;
      title.innerHTML = `Assistindo agora com <em>${viewers.toLocaleString('pt-BR')} ${viewers === 1 ? 'viewer' : 'viewers'}</em>`;
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

    _atualizarPlayerHeader(live);
    _atualizarProfileStatus(live);
    _atualizarBanner(data);

    const isMature = !!(data.stream && data.stream.is_mature);

    if (live && !toastLiveMostrado) {
      toastLiveMostrado = true;
      setTimeout(() => toast('🔴 Soso tá ao vivo! Vem pro chat 💜', 'ok'), 800);
    }

    if (data.discord && $('dcMembros'))
      $('dcMembros').textContent = `${data.discord.toLocaleString('pt-BR')} membros · avisos de live, resenha e novidades.`;

    vodAtual = data.video;
    videosTw = data.videos || (data.video ? [data.video] : []);

    if (data.user) {
      if (data.user.profile_image_url) { const av = g('offlineAvatarImg'); if(av) av.src = data.user.profile_image_url; }
      if (data.user.offline_image_url && panel) panel.style.backgroundImage = `linear-gradient(rgba(10,5,17,.7),rgba(10,5,17,.9)),url(${data.user.offline_image_url})`;
    }

    if (data.stream && isMature) {
      // 🔞 +18: NUNCA carregar iframe. Sempre limpar com about:blank.
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
      g('playerNoteText').textContent = `🔞 Conteúdo +18 — clica em "Assistir na Twitch" acima.`;
    } else if (data.stream) {
      assistindoVod = false;
      if(panel) panel.style.display = 'none';
      if(iframe){
        iframe.style.display = 'block';
        const novoSrc = `https://player.twitch.tv/?channel=asemtet0&parent=${HOST}`;
        if (iframe.src !== novoSrc) iframe.src = novoSrc;
      }
      g('viewerCountStatus').textContent = `${data.stream.viewer_count} assistindo`;
      g('playerNoteText').textContent = `Transmitindo: ${data.stream.title}`;
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
            <div class="offline-actions">
              <a class="btn" href="https://www.twitch.tv/asemtet0" target="_blank" rel="noopener">Seguir na Twitch</a>
              <button class="btn ghost" id="btnVod" onclick="assistirVod()" style="display:none">▶ Última live</button>
            </div>
          `;
          const btnVodEl = g('btnVod');
          if(btnVodEl) btnVodEl.style.display = vodAtual ? '' : 'none';
        }
        g('playerNoteText').textContent = 'Quando a Soso estiver ao vivo, a transmissão aparece aqui. 🎮';
      }
    }

    atualizarFoco(data.game, !!data.stream);
    renderClips(data.clips);
    setLivePulse(live);
  } catch (err) {
    console.error('Erro ao buscar dados da Twitch:', err);
    atualizarFoco(null, false);
    ['goalSeg','goalDc'].forEach(p => { const el = $(p+'Num'); if (el && el.textContent === '…') atualizarMeta(p, null); });
    setLivePulse(false);
    _atualizarPlayerHeader(false);
    _atualizarProfileStatus(false);
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

/* ============================================================
   BOOT EXTRA — ticker antigo desativado (não usamos mais)
   ============================================================ */