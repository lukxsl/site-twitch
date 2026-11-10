/* ============================================================
   TWITCH — status da live, player, banner, foco do jogo e clipes
   ============================================================ */
const FORCAR_REPRISE_NA_TWITCH = false; // deixa a Twitch decidir
let canalMature = FORCAR_REPRISE_NA_TWITCH;

/* ============================================================
   FOCO — último jogo / jogo ao vivo (casa com a Tier List)
   ============================================================ */
function atualizarFoco(game, isLive){
  const cover = document.getElementById('focoCover');
  const nome  = document.getElementById('focoNome');
  const meta  = document.getElementById('focoMeta');
  const horas = document.getElementById('focoHoras');
  const label = document.getElementById('focoLabel');
  const bar   = document.getElementById('focoBar');
  const barI  = document.getElementById('focoBarI');
  const pct   = document.getElementById('focoPct');
  if(!cover || !nome) return;

  ultGame = game || null;
  ultVivo = !!isLive;

  if(!game || !game.name){
    cover.classList.remove('skeleton');
    cover.removeAttribute('src');
    cover.style.display = 'none';
    nome.textContent = isLive ? 'Live sem categoria' : 'Sem jogo recente';
    if(label) label.textContent = isLive ? '🎮 Jogando agora' : '🎮 Último jogo jogado';
    if(meta) meta.innerHTML = '';
    if(horas){
      horas.hidden = false;
      horas.textContent = isLive ? 'Sem categoria definida na Twitch.' : 'Quando a Soso jogar, aparece aqui.';
    }
    if(bar) bar.style.display = 'none';
    const s0 = document.getElementById('focoSub'); if(s0) s0.hidden = true;
    const l0 = document.getElementById('focoLive');
    if(l0){
      const st = window.__streamInfo;
      if(isLive && st){
        l0.innerHTML = `<span>👀 ${Number(st.viewer_count || 0).toLocaleString('pt-BR')} assistindo</span>`;
        l0.hidden = false;
      } else { l0.innerHTML = ''; l0.hidden = true; }
    }
    return;
  }

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

  if(meta){
    const chips = [];
    if(jogoTL){
      if(jogoTL.tier && jogoTL.tier !== 'NR') chips.push(`<span class="foco-chip tr">Tier ${esc(jogoTL.tier)}</span>`);
      if(jogoTL.nota > 0) chips.push(`<span class="foco-chip">⭐ ${n1(jogoTL.nota)}</span>`);
      if(jogoTL.status) chips.push(`<span class="foco-chip">${esc(jogoTL.status)}</span>`);
      if(jogoTL.horas > 0) chips.push(`<span class="foco-chip">⏱ ${fh(jogoTL.horas)}</span>`);
      if(jogoTL.conquistas && jogoTL.conquistas.total > 0) chips.push(`<span class="foco-chip">🏆 ${jogoTL.conquistas.obtidas}/${jogoTL.conquistas.total}</span>`);
    } else {
      chips.push(`<span class="foco-chip">Novo na biblioteca</span>`);
    }
    meta.innerHTML = chips.join('');
  }

  if(horas){
    const temDados = !!(jogoTL && (jogoTL.horas > 0 || (jogoTL.conquistas && jogoTL.conquistas.total > 0)));
    if(temDados){
      horas.hidden = true;
      horas.textContent = '';
    } else {
      horas.hidden = false;
      horas.textContent = isLive ? 'Assistindo agora na Twitch' : 'Sem dados extras na tier list ainda.';
    }
  }

  const sub = document.getElementById('focoSub');
  if(sub){
    const partes = [];
    if(jogoTL && jogoTL.generos && jogoTL.generos.length) partes.push(jogoTL.generos.slice(0, 3).join(', '));
    if(jogoTL && jogoTL.ano) partes.push(String(jogoTL.ano));
    sub.textContent = partes.join(' · ');
    sub.hidden = !partes.length;
  }

  const liveBox = document.getElementById('focoLive');
  if(liveBox){
    const st = window.__streamInfo;
    if(isLive && st){
      const chips = [`<span>👀 ${Number(st.viewer_count || 0).toLocaleString('pt-BR')} assistindo</span>`];
      if(st.uptime) chips.push(`<span>⏱ no ar há ${esc(st.uptime)}</span>`);
      liveBox.innerHTML = chips.join('');
      liveBox.hidden = false;
    } else { liveBox.innerHTML = ''; liveBox.hidden = true; }
  }

  if(bar && barI && pct){
    if(jogoTL && jogoTL.conquistas && jogoTL.conquistas.total > 0){
      const p = Math.round((jogoTL.conquistas.obtidas / jogoTL.conquistas.total) * 100);
      bar.style.display = '';
      barI.style.width = p + '%';
      pct.textContent = `${p}%`;
    } else {
      bar.style.display = 'none';
    }
  }
}
window.atualizarFoco = atualizarFoco;

/* ============================================================
   VOD / REPRISE
   ============================================================ */
function assistirVod(v){
  v = v || vodAtual; if(!v) return;
  vodAtual = v;
  const urlTwitch = `https://www.twitch.tv/videos/${encodeURIComponent(v.id)}`;
  if(canalMature){
    window.open(urlTwitch, '_blank', 'noopener');
    if(typeof toast === 'function') toast('🔞 Reprise +18: abrindo na Twitch', 'ok');
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
    dyn.className = 'profile-status-dinamica offline';
    dyn.textContent = (vod && vod.created_at)
      ? `Offline · última live ${tempoAtras(vod.created_at)}`
      : 'Offline · sem lives recentes';
  }
}

function _atualizarStatsStrip(data){
  const seg = document.getElementById('stripSeg');
  const horas = document.getElementById('stripHoras');
  const discord = document.getElementById('stripDiscord');
  const live = document.getElementById('stripLive');
  const liveSep = document.getElementById('stripLiveSep');
  const viewers = document.getElementById('stripViewers');
  const strip = document.getElementById('statsStrip');
  const temEstatistica = [data.followers, data.horasMes, data.discord]
    .some(valor => valor !== null && valor !== undefined && Number.isFinite(Number(valor)));
  if(strip) strip.hidden = !temEstatistica;

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

/* Barra do card do player: título da live, uptime e viewers.
   Deixa o card útil quando a Soso está ao vivo (antes só tinha o iframe). */
function _atualizarLiveNow(data){
  const box = document.getElementById('liveNow');
  if(!box) return;
  const st = data && data.stream;
  if(!st){ box.hidden = true; return; }
  box.hidden = false;
  const titulo = document.getElementById('liveNowTitle');
  if(titulo) titulo.textContent = st.title || 'Ao vivo agora';
  const viewers = document.getElementById('liveNowViewers');
  if(viewers) viewers.textContent = Number(st.viewer_count || 0).toLocaleString('pt-BR');
  const uptime = document.getElementById('liveNowUptime');
  if(uptime) uptime.textContent = st.uptime || 'agora';
  const jogo = document.getElementById('liveNowGame');
  if(jogo) jogo.textContent = st.game_name || 'Sem categoria';
}

async function verificarStatusTwitch(){
  const g = id => document.getElementById(id);
  const iframe = g('twitchIframe'), panel = g('offlinePanel');
  try {
    const response = await fetch('/api/twitch');
    if(!response.ok) throw new Error('api');
    const data = await response.json();

    atualizarMeta('goalSeg', data.followers, MARCOS, true);
    atualizarMeta('goalDc', data.discord, MARCOS, true);
    _atualizarStatsStrip(data);

    const live = !!data.stream;
    _atualizarPlayerHeader(live);
    _atualizarProfileStatus(live, data);
    _atualizarLiveNow(data);

    const isMature = !!(data.stream && (data.stream.is_mature || data.canal_mature));

    if(live && !toastLiveMostrado){
      toastLiveMostrado = true;
      setTimeout(() => toast('🔴 Soso tá ao vivo! Vem pro chat!', 'ok'), 800);
    }

    if(data.discord && $('dcMembros'))
      $('dcMembros').textContent = `${data.discord.toLocaleString('pt-BR')} membros · avisos de live, resenha e novidades.`;

    canalMature = FORCAR_REPRISE_NA_TWITCH || !!data.canal_mature;
    vodAtual = data.video;
    videosTw = data.videos || (data.video ? [data.video] : []);

    if(data.user){
      if(data.user.profile_image_url){
        const av = g('offlineAvatarImg');
        if(av) av.src = data.user.profile_image_url;
      }
      if(data.user.offline_image_url && panel && !live){
        panel.style.backgroundImage = `linear-gradient(rgba(10,5,17,.55),rgba(10,5,17,.85)),url(${data.user.offline_image_url})`;
      }
    }

    if(panel) panel.classList.remove('is-mature');

    if(data.stream && isMature){
      assistindoVod = false;
      if(iframe){ iframe.style.display = 'none'; iframe.src = 'about:blank'; }
      if(panel){
        panel.style.display = 'flex';
        panel.classList.add('is-mature');
        panel.style.backgroundImage = 'linear-gradient(rgba(10,5,17,.55),rgba(10,5,17,.85))';
        const st18 = data.stream;
        const fundo18 = st18.thumbnail || (data.game && data.game.box_art) || (data.user && data.user.offline_image_url) || (data.user && data.user.profile_image_url) || 'img/avatar.webp';
        const chips18 = [];
        if(st18.uptime) chips18.push(`<span>⏱ no ar há ${esc(st18.uptime)}</span>`);
        chips18.push(`<span>👀 ${Number(st18.viewer_count || 0).toLocaleString('pt-BR')} assistindo</span>`);
        if(st18.game_name) chips18.push(`<span>🎮 ${esc(st18.game_name)}</span>`);
        panel.innerHTML = `
          ${fundo18 ? `<div class="mature-bg" aria-hidden="true" style="background-image:url('${esc(fundo18)}')"></div>` : ''}
          <div style="font-size:2.6rem;line-height:1">🔞</div>
          <span class="offline-badge"><i aria-hidden="true"></i> AO VIVO +18</span>
          <h4>${esc(st18.title || 'Conteúdo +18 agora')}</h4>
          <p>A Soso tá jogando algo com classificação adulta. O Twitch bloqueia o player embutido nesses casos — assista direto no site deles:</p>
          <div class="offline-info">${chips18.join('')}</div>
          <div class="offline-actions">
            <a class="btn" href="https://www.twitch.tv/asemtet0" target="_blank" rel="noopener">▶ Assistir na Twitch</a>
          </div>
        `;
      }
      const vc = g('viewerCountStatus'); if(vc) vc.textContent = `${data.stream.viewer_count} assistindo`;
      const noteEl = g('playerNoteText');
      if(noteEl){
        noteEl.classList.remove('recado');
        noteEl.textContent = '🔞 Conteúdo +18 — clique em "Assistir na Twitch" acima.';
      }
    } else if(data.stream){
      assistindoVod = false;
      if(panel) panel.style.display = 'none';
      if(iframe){
        iframe.style.display = 'block';
        const novoSrc = `https://player.twitch.tv/?channel=asemtet0&parent=${HOST}`;
        if(iframe.src !== novoSrc) iframe.src = novoSrc;
      }
      const vc = g('viewerCountStatus'); if(vc) vc.textContent = `${data.stream.viewer_count} assistindo`;
      const noteEl = g('playerNoteText');
      if(noteEl && !noteEl.classList.contains('recado')) noteEl.innerHTML = '💬 O chat rola na Twitch — <a href="https://www.twitch.tv/asemtet0" target="_blank" rel="noopener">abrir o canal ↗</a>';
    } else {
      const vc = g('viewerCountStatus'); if(vc) vc.textContent = '@asemtet0';
      if(!assistindoVod){
        if(iframe){ iframe.style.display = 'none'; iframe.src = 'about:blank'; }
        if(panel){
          panel.style.display = 'flex';
          panel.innerHTML = `
            <img id="offlineAvatarImg" src="img/avatar.webp" alt="Soso" onerror="this.style.display='none'">
            <span class="offline-badge"><i aria-hidden="true"></i> Offline</span>
            <h4>Hoje tô fora do ar.</h4>
            <p>Quando eu voltar, a live aparece por aqui. Os avisos chegam no Discord.</p>
            <div class="offline-info">
              <span>Ao vivo quando der</span>
              <a href="https://discord.gg/J4gGaKWFPZ" target="_blank" rel="noopener">🔔 Avisos no Discord</a>
            </div>
            <div class="offline-actions">
              <a class="btn twitch-accent" href="https://www.twitch.tv/asemtet0" target="_blank" rel="noopener">Seguir na Twitch</a>
              <button class="btn ghost" id="btnVod" onclick="assistirVod()" style="display:none">▶ Última live${canalMature ? ' ↗' : ''}</button>
            </div>
          `;
          if(data.user && data.user.offline_image_url) panel.style.backgroundImage = `linear-gradient(rgba(10,5,17,.55),rgba(10,5,17,.85)),url(${data.user.offline_image_url})`;
          else panel.style.backgroundImage = ''; // volta a arte de fundo (espaço) do CSS
          const btnVodEl = g('btnVod');
          if(btnVodEl) btnVodEl.style.display = vodAtual ? '' : 'none';
        }
        const noteEl = g('playerNoteText');
        if(noteEl && !noteEl.classList.contains('recado')){
          noteEl.textContent = 'Quando a Soso estiver ao vivo, a transmissão aparece aqui. 🎮';
        }
      }
    }

    const fbVod = g('vodFallback');
    if(fbVod) fbVod.style.display = assistindoVod ? '' : 'none';

    window.__streamInfo = data.stream || null;
    atualizarFoco(data.game, live);
    if(typeof window.setJogoAoVivo === 'function'){
      window.setJogoAoVivo(data.stream && data.game ? data.game.name : null);
    }
    renderClips(data.clips);
    setLivePulse(live);
  } catch(err){
    console.error('Erro ao buscar dados da Twitch:', err);
    atualizarFoco(null, false);
    if(typeof window.setJogoAoVivo === 'function') window.setJogoAoVivo(null);
    ['goalSeg','goalDc'].forEach(p => { const el = $(p + 'Num'); if(el && el.textContent === '…') atualizarMeta(p, null); });
    setLivePulse(false);
    _atualizarPlayerHeader(false);
    _atualizarProfileStatus(false, null);
    _atualizarLiveNow(null);
  }
}

document.addEventListener('click', e => {
  const b = e.target.closest('.tm-vod');
  if(b && videosTw[+b.dataset.i]) assistirVod(videosTw[+b.dataset.i]);
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
  dlgClip.innerHTML = `<iframe id="clipIframe" allowfullscreen title="Clipe"></iframe><div class="cm-foot"><b id="clipTitle"></b><span id="clipViews"></span></div>`;
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
