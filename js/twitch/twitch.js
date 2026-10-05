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
async function verificarStatusTwitch() {
  const g = id => document.getElementById(id);
  const iframe = g('twitchIframe'), panel = g('offlinePanel'), badge = g('bannerLiveBadge');
  try {
    const response = await fetch('/api/twitch');
    if (!response.ok) throw new Error('api');
    const data = await response.json();

    atualizarMeta('goalSeg', data.followers, MARCOS, true);
    atualizarMeta('goalDc', data.discord, MARCOS, true);

    const live = !!data.stream;
    inicioLive = live && data.stream.started_at ? new Date(data.stream.started_at) : null;
    tickUptime();

    if (live && !toastLiveMostrado) {
      toastLiveMostrado = true;
      setTimeout(() => toast('🔴 Soso tá ao vivo! Vem pro chat 💜', 'ok'), 800);
    }

    if (data.horasMes != null && g('tmHoras')) {
      g('tmHoras').textContent = (typeof data.horasMes === 'number' ? data.horasMes : Number(data.horasMes)).toLocaleString('pt-BR') + 'h';
    } else if (g('tmHoras')) {
      g('tmHoras').textContent = '—';
    }

    if (data.discord && $('dcMembros'))
      $('dcMembros').textContent = `${data.discord.toLocaleString('pt-BR')} membros · avisos de live, resenha e novidades.`;

    vodAtual = data.video;
    videosTw = data.videos || (data.video ? [data.video] : []);
    g('tmStatus').textContent = live ? '● AO VIVO' : 'OFFLINE';
    g('tmSeg').textContent = data.followers != null ? data.followers.toLocaleString('pt-BR') : '—';
    g('tmLbl').textContent = live ? 'AO VIVO AGORA' : 'ÚLTIMA LIVE';
    g('tmSub').textContent = live
      ? `${data.stream.title} · ${data.stream.game_name || ''} · ${data.stream.viewer_count} assistindo`
      : (videosTw[0] && videosTw[0].created_at ? `${tempoAtras(videosTw[0].created_at)} · ${videosTw[0].title}` : 'Canal offline no momento.');
    g('tmVods').innerHTML = videosTw.slice(0, 3).map((v, i) =>
      `<button class="tm-vod" data-i="${i}">${v.thumbnail ? `<img src="${esc(v.thumbnail)}" alt="" loading="lazy" onerror="this.remove()">` : ''}<div><b>${esc(v.title || 'Live')}</b><span>${v.created_at ? tempoAtras(v.created_at) : ''}${v.duration ? ' · ' + durTw(v.duration) : ''}${v.views != null ? ' · 👁 ' + v.views : ''}</span></div><em>▶</em></button>`
    ).join('') || '<span class="tm-h4">Nenhuma live gravada ainda.</span>';

    atualizarFoco(data.game, !!data.stream);
    renderClips(data.clips);
    g('btnVod').style.display = vodAtual ? '' : 'none';
    setLivePulse(live);

    if (data.user) {
      if (data.user.profile_image_url) { const av = g('offlineAvatarImg'); if(av) av.src = data.user.profile_image_url; }
      if (data.user.offline_image_url) panel.style.backgroundImage = `linear-gradient(rgba(10,5,17,.7),rgba(10,5,17,.9)),url(${data.user.offline_image_url})`;
    }

    if (data.stream) {
      assistindoVod = false;
      panel.style.display = 'none';
      iframe.style.display = 'block';
      if (!iframe.src.includes('channel=')) iframe.src = `https://player.twitch.tv/?channel=asemtet0&parent=${HOST}`;
      badge.style.display = 'flex';
      g('bannerLiveText').textContent = `AO VIVO • ${data.stream.game_name || 'Jogando'} (${data.stream.viewer_count} espectadores)`;
      g('viewerCountStatus').textContent = `${data.stream.viewer_count} assistindo`;
      g('playerNoteText').textContent = `Transmitindo: ${data.stream.title}`;
    } else {
      badge.style.display = 'none';
      g('viewerCountStatus').textContent = '@asemtet0';
      if (!assistindoVod) {
        iframe.style.display = 'none'; iframe.src = '';
        panel.style.display = 'flex';
        g('playerNoteText').textContent = 'Quando a Soso estiver ao vivo, a transmissão aparece aqui. 🎮';
      }
    }
  } catch (err) {
    console.error('Erro ao buscar dados da Twitch:', err);
    atualizarFoco(null, false);
    ['goalSeg','goalDc'].forEach(p => { const el = $(p+'Num'); if (el && el.textContent === '…') atualizarMeta(p, null); });
    setLivePulse(false);
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