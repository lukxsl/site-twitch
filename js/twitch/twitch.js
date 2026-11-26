/* ============================================================
   TWITCH
   ============================================================ */
const FORCAR_REPRISE_NA_TWITCH = false; // Deixa a Twitch decidir
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
      if(jogoTL.conquistas && jogoTL.conquistas.total > 0) chips.push(`<span class="foco-chip">🏆 ${jogoTL.conquistas.obtidas}/${jogoTL.conquistas.total}</span>`);
    } else {
      chips.push(`<span class="foco-chip">Novo na biblioteca</span>`);
    }
    meta.innerHTML = chips.join('');
  }

  // ---- Linha de horas/extra (só quando a barra de status não tem esses dados) ----
  if(horas){
    const temHoras = !!(jogoTL && jogoTL.horas > 0);
    const temConquistas = !!(jogoTL && jogoTL.conquistas && jogoTL.conquistas.total > 0);
    if(temHoras || temConquistas){
      horas.hidden = true;
      horas.textContent = '';
    } else {
      horas.hidden = false;
      horas.textContent = isLive
        ? 'Assistindo agora na Twitch 💜'
        : 'Sem dados extras na tier list ainda.';
    }
  }

  // ---- Detalhes: gêneros · ano ----
  const sub = document.getElementById('focoSub');
  if(sub){
    const partes = [];
    if(jogoTL && jogoTL.generos && jogoTL.generos.length) partes.push(jogoTL.generos.slice(0, 3).join(', '));
    if(jogoTL && jogoTL.ano) partes.push(String(jogoTL.ano));
    sub.textContent = partes.join(' · ');
    sub.hidden = !partes.length;
  }

  // ---- Info da live (preenche o card quando o jogo não está na tier list) ----
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

  // ---- Barra de progresso (conquistas) ----
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

  // ---- Link Twitch ----
  if(link){
    link.style.display = 'none'; // Escondido para manter o card alinhado
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
  const panel = document.getElementById('camOffline');
  if(panel) panel.hidden = true;
  const f = document.getElementById('twitchIframe');
  if(!f) return;
  f.hidden = false;
  f.src = `https://player.twitch.tv/?video=v${vodAtual.id}&parent=${HOST}&autoplay=false`;
  const area = document.getElementById('camFrame');
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
    fb.hidden = false;
  }
  const noteEl = document.getElementById('playerNoteText');
  if(noteEl){
    noteEl.classList.remove('recado');
    noteEl.innerHTML = `Reprise: ${esc(vodAtual.title)} · <a href="${urlTwitch}" target="_blank" rel="noopener">Não carregou? Abrir na Twitch ↗</a>`;
  }
  const box = document.getElementById('camCard');
  if(box) box.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'center'
  });
}
window.assistirVod = assistirVod;

let toastLiveMostrado = false;

function _atualizarPlayerHeader(isLive){
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

  const flash = (el, valor) => {
    if(!el || valor == null) return;
    const novo = Number(valor).toLocaleString('pt-BR');
    const antigo = el.dataset.valor;
    el.classList.remove('skeleton');
    el.textContent = novo;
    el.dataset.valor = novo;
    if(antigo && antigo !== novo){
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1200);
    }
  };

  if(seg) flash(seg, data.followers);
  if(horas) flash(horas, data.horasMes);
  if(discord) flash(discord, data.discord);

  const isLive = !!(data.stream && data.stream.viewer_count != null);
  if(live) live.hidden = !isLive;
  if(liveSep) liveSep.hidden = !isLive;
  if(viewers && isLive) viewers.textContent = Number(data.stream.viewer_count).toLocaleString('pt-BR');
}

function _atualizarCam(data){
  const cam = document.getElementById('camCard');
  const selo = document.getElementById('camSelo');
  const ultima = document.getElementById('camLastLive');
  const isLive = !!data.stream;

  if(cam) cam.classList.toggle('is-live', isLive);
  if(selo) selo.textContent = isLive ? 'AO VIVO' : 'OFFLINE';
  if(ultima && data.video && data.video.created_at){
    ultima.textContent = `Última live ${tempoAtras(data.video.created_at)}.`;
  } else if(ultima){
    ultima.textContent = 'Enquanto isso, dá uma olhada no cantinho.';
  }
  if(!isLive){
    const mature = document.getElementById('camMature');
    if(mature) mature.hidden = true;
  }
}

async function verificarStatusTwitch() {
  const g = id => document.getElementById(id);
  const iframe = g('twitchIframe'), panel = g('camOffline');
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
    _atualizarCam(data);

    // Força o bloqueio se a API avisar que é adulto OU se o jogo for conhecido como +18
    const isMature = !!(data.stream && (data.stream.is_mature || data.canal_mature));

    if (live && !toastLiveMostrado) {
      toastLiveMostrado = true;
      setTimeout(() => toast('🔴 Soso tá ao vivo! Vem pro chat 💜', 'ok'), 800);
    }

    if (data.discord && $('dcMembros'))
      $('dcMembros').textContent = `${data.discord.toLocaleString('pt-BR')} membros · avisos de live, resenha e novidades.`;

    canalMature = FORCAR_REPRISE_NA_TWITCH || !!data.canal_mature;
    vodAtual = data.video;
    videosTw = data.videos || (data.video ? [data.video] : []);

    const matureBox = g('camMature');
    if (matureBox) matureBox.hidden = !(data.stream && isMature);
    if (data.stream && isMature) {
      assistindoVod = false;
      if(iframe){ iframe.hidden = true; iframe.src = 'about:blank'; }
      if(panel) panel.hidden = true;
      const cnt = g('viewerCountStatus');
      if(cnt) cnt.textContent = `${data.stream.viewer_count} assistindo`;
      const noteEl = g('playerNoteText');
      if(noteEl) noteEl.textContent = 'Conteúdo +18 — abra na Twitch para assistir.';
    } else if (data.stream) {
      assistindoVod = false;
      if(panel) panel.hidden = true;
      if(iframe){
        iframe.hidden = false;
        const novoSrc = `https://player.twitch.tv/?channel=asemtet0&parent=${HOST}`;
        if (iframe.src !== novoSrc) iframe.src = novoSrc;
      }
      const cnt = g('viewerCountStatus');
      if(cnt) cnt.textContent = `${data.stream.viewer_count} assistindo`;
      const noteEl = g('playerNoteText');
      if(noteEl && !noteEl.classList.contains('recado')) noteEl.textContent = `Transmitindo: ${data.stream.title}`;
    } else {
      const cnt = g('viewerCountStatus');
      if(cnt) cnt.textContent = '@asemtet0';
      if (!assistindoVod) {
        if(iframe){ iframe.hidden = true; iframe.src = 'about:blank'; }
        if(panel) panel.hidden = false;
        const noteEl = g('playerNoteText');
        if(noteEl && !noteEl.classList.contains('recado')){
          noteEl.textContent = 'Quando a Soso estiver ao vivo, a transmissão aparece aqui.';
        }
      }
    }
    const btnVodEl = g('btnVod');
    if(btnVodEl) btnVodEl.hidden = !vodAtual;

    const fbVod = g('vodFallback');
    if(fbVod) fbVod.hidden = !assistindoVod;

    window.__streamInfo = data.stream || null;
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
    const matureBox = document.getElementById('camMature');
    if(matureBox) matureBox.hidden = true;
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
    if(vazio) vazio.hidden = false;
    if(box) box.hidden = true;
    return;
  }
  clipsOk = true;
  clipsCache = list.slice(0, 4);
  const totalViews = clipsCache.reduce((a, c) => a + (Number(c.views) || 0), 0);
  const titulo = $('clipsTitulo');
  if(titulo) titulo.textContent = `Clipes em destaque · ${totalViews.toLocaleString('pt-BR')} views`;
  if(box) box.hidden = false;
  if(vazio) vazio.hidden = true;

  const grid = $('clipsGrid');
  if(grid){
    const botoes = clipsCache.map(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'clip';
      btn.dataset.id = String(c.id || '');
      btn.setAttribute('aria-label', String(c.title || 'Assistir clipe'));
      if(c.thumbnail){
        const img = document.createElement('img');
        img.src = String(c.thumbnail);
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        btn.append(img);
      }
      const play = document.createElement('span');
      play.className = 'play';
      play.setAttribute('aria-hidden','true');
      play.textContent = '▶';
      const views = document.createElement('span');
      views.className = 'vw';
      views.textContent = `${Number(c.views || 0).toLocaleString('pt-BR')} views`;
      const title = document.createElement('span');
      title.className = 'ct';
      title.textContent = String(c.title || '');
      btn.append(play, views, title);
      return btn;
    });
    grid.replaceChildren(...botoes);
  }
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