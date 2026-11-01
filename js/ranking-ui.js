/* ============================================================
   RANKING UI — seção de ranking com pódio e posição fixa
   ============================================================ */
(function() {
  'use strict';

  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

  function initRanking() {
    const rankingContainer = $('#rankingContainer');
    const rankingConteudo = $('#rankingConteudo');
    const rankingYourPosition = $('#rankingYourPosition');
    const rankingRefreshBtn = $('#rankingRefreshBtn');
    const rankingLoginBtn = $('#rankingLoginBtn');
    
    if (!rankingContainer) return;

    const usuario = window.GameState?.perfil?.id || null;
    
    if (usuario) {
      rankingConteudo.style.display = 'none';
      rankingYourPosition.style.display = 'block';
      carregarRankingCompleto();
    } else {
      rankingConteudo.style.display = 'none';
      rankingYourPosition.style.display = 'block';
      rankingYourPosition.innerHTML = `
        <div class="ranking-empty-state">
          <p>Você não está no ranking ainda.</p>
          <button class="ranking-login-btn" id="rankingLoginBtn">Entre para participar →</button>
        </div>
      `;
    }

    if (rankingRefreshBtn) {
      rankingRefreshBtn.addEventListener('click', () => {
        if (usuario) carregarRankingCompleto();
      });
    }

    if (rankingLoginBtn) {
      rankingLoginBtn.addEventListener('click', () => {
        if (window.AuthUI) window.AuthUI.open('entrar');
        else window.location.href = '/?entrar=1';
      });
    }

    function carregarRankingCompleto() {
      const container = $('#rankingYourContent');
      if (!container) return;

      container.innerHTML = `
        <div class="ranking-skeleton">
          <div class="ranking-skeleton-avatar"></div>
          <div class="ranking-skeleton-info">
            <div class="ranking-skeleton-line"></div>
            <div class="ranking-skeleton-line"></div>
            <div class="ranking-skeleton-line"></div>
          </div>
        </div>
      `;

      if (!window.GameState) return;

      window.GameState.carregarPerfil({ forcar: true }).then(perfil => {
        if (!perfil) return;

        api(API_GAME, 'ranking', { action: 'listar' }).then(res => {
          if (!res.ok || !res.data) return;

          const ranking = res.data.ranking || [];
          const meuRanking = res.data.minhasPosicoes || {};

          renderizarPodium(ranking.slice(0, 3));
          renderizarLista(ranking.slice(3));

          if (meuRanking.posicao) {
            const posicao = meuRanking.posicao;
            const vizinhos = res.data.vizinhos || [];
            
            container.innerHTML = `
              <div class="ranking-your-card">
                <div class="ranking-your-header">
                  <div class="ranking-your-avatar">
                    <div class="ranking-avatar-placeholder">👤</div>
                  </div>
                  <div class="ranking-your-info">
                    <div class="ranking-your-position">#${posicao.posicao} de ${posicao.total}</div>
                    <div class="ranking-your-nick">${perfil.nick || perfil.username}</div>
                    <div class="ranking-your-level">Nv ${perfil.nivel}</div>
                  </div>
                </div>
                
                <div class="ranking-your-stats">
                  <div class="ranking-your-xp">${posicao.xp} XP</div>
                  <div class="ranking-your-faltam">Faltam ${posicao.faltamParaProximo} XP para o próximo</div>
                </div>
                
                <div class="ranking-neighbors">
                  <h4>Próximos jogadores</h4>
                  <div class="ranking-neighbors-list">
                    ${vizinhos.map((vizinho, i) => `
                      <div class="ranking-neighbor-item">
                        <div class="ranking-neighbor-pos">#${vizinho.posicao}</div>
                        <div class="ranking-neighbor-avatar">
                          <div class="ranking-neighbor-placeholder">👤</div>
                        </div>
                        <div class="ranking-neighbor-info">
                          <div class="ranking-neighbor-nick">${vizinho.nick}</div>
                          <div class="ranking-neighbor-level">Nv ${vizinho.nivel}</div>
                        </div>
                        <div class="ranking-neighbor-xp">${vizinho.xp} XP</div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              </div>
            `;

            if (perfil && perfil.progresso && perfil.progresso.platina) {
              container.classList.add('has-platina');
            }
          }
        });
      });
    }

    function renderizarPodium(ranking) {
      const podium = $('#rankingPodium');
      if (!podium) return;

      const topo = [1, 0, 2];
      podium.innerHTML = topo.map(i => {
        const jogador = ranking[i];
        if (!jogador) {
          return `<div class="podium-item podium-${['2nd', '1st', '3rd'][i]}" style="--d:${i * 90}ms">
            <div class="podium-avatar">
              <div class="podium-avatar-placeholder">👤</div>
            </div>
            <div class="podium-info">
              <div class="podium-crown">${['🥈', '👑', '🥉'][i]}</div>
              <div class="podium-nick">—</div>
              <div class="podium-title">—</div>
              <div class="podium-level">Nv 0</div>
              <div class="podium-xp">0 XP</div>
            </div>
          </div>`;
        }

        return `<div class="podium-item podium-${['2nd', '1st', '3rd'][i]}" style="--d:${i * 90}ms">
          <div class="podium-avatar">
            <div class="podium-avatar-placeholder">👤</div>
          </div>
          <div class="podium-info">
            <div class="podium-crown">${['🥈', '👑', '🥉'][i]}</div>
            <div class="podium-nick">${jogador.nick}</div>
            <div class="podium-title">${jogador.titulo || '—'}</div>
            <div class="podium-level">Nv ${jogador.nivel}</div>
            <div class="podium-xp">${jogador.xp} XP</div>
          </div>
        </div>`;
      }).join('');
    }

    function renderizarLista(ranking) {
      const lista = $('#rankingList');
      if (!lista) return;

      lista.innerHTML = ranking.map((jogador, i) => {
        const posicao = i + 4;
        return `<div class="ranking-item">
          <div class="ranking-pos">#${posicao}</div>
          <div class="ranking-mini-avatar">
            <div class="ranking-mini-placeholder">👤</div>
          </div>
          <div class="ranking-nick-tit">
            <div class="ranking-nick">${jogador.nick}</div>
            <div class="ranking-title">${jogador.titulo || '—'}</div>
          </div>
          <div class="ranking-mini-level">Nv ${jogador.nivel}</div>
          <div class="ranking-mini-xp">${jogador.xp} XP</div>
        </div>`;
      }).join('');
    }
  }

  window.RankingUI = { init: initRanking };
  window.addEventListener('DOMContentLoaded', () => {
    window.RankingUI.init();
  });
})();