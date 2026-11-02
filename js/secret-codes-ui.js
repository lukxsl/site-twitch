/* ============================================================
   CÓDIGOS SECRETOS UI — terminal de resgate de códigos
   ============================================================ */
(function() {
  'use strict';

  const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
  const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

  function initSecretCodes() {
    const secretCodesInput = $('#secretCodesInput');
    const secretCodesRedeemBtn = $('#secretCodesRedeemBtn');
    const secretCodesResult = $('#secretCodesResult');
    const secretCodesSuccess = $('#secretCodesSuccess');
    const secretCodesError = $('#secretCodesError');
    const secretCodesErrorMessage = $('#secretCodesErrorMessage');
    const secretCodesErrorDetails = $('#secretCodesErrorDetails');
    const secretCodesErrorDetailsText = $('#secretCodesErrorDetailsText');
    const secretCodesErrorCooldown = $('#secretCodesErrorCooldown');
    const secretCodesCooldownSeconds = $('#secretCodesCooldownSeconds');
    const secretCodesHistoryList = $('#secretCodesHistoryList');

    if (!secretCodesInput) return;

    let cooldownTimer = null;
    let cooldownSeconds = 0;

    function formatCode(input) {
      let value = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (value.length > 16) value = value.substring(0, 16);

      let formatted = '';
      for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0 && i < value.length) {
          formatted += '-';
        }
        formatted += value[i];
      }
      return formatted;
    }

    function atualizarBotoes() {
      const codigo = secretCodesInput.value;
      const botaoValido = codigo.length === 15 && codigo.match(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);

      if (secretCodesRedeemBtn) {
        secretCodesRedeemBtn.disabled = !botaoValido;
      }
    }

    function limparResultado() {
      if (secretCodesResult) {
        secretCodesResult.style.display = 'none';
        secretCodesResult.className = 'secret-codes-result';
      }
      if (secretCodesSuccess) {
        secretCodesSuccess.style.display = 'none';
      }
      if (secretCodesError) {
        secretCodesError.style.display = 'none';
      }
    }

    function mostrarSucesso(dados) {
      limparResultado();

      if (secretCodesResult) {
        secretCodesResult.style.display = 'block';
        secretCodesResult.className = 'secret-codes-result success';
      }

      if (secretCodesSuccess) {
        secretCodesSuccess.style.display = 'block';

        const premio = dados.premio || {};
        const conquistasNovas = dados.conquistasNovas || [];

        const premioHTML = premio.id ? `
          <div class="secret-codes-prize-item">
            <div class="secret-codes-prize-icon">🎁</div>
            <div class="secret-codes-prize-info">
              <div class="secret-codes-prize-name">${premio.nome || 'Recompensa'}</div>
              <div class="secret-codes-prize-desc">${premio.descricao || 'Premiação especial'}</div>
            </div>
          </div>
        ` : '';

        const conquistasHTML = conquistasNovas.length ? `
          <div class="secret-codes-new-achievements">
            <h4>Novas conquistas!</h4>
            <div class="secret-codes-achievements-list">
              ${conquistasNovas.map(conquista => `
                <div class="secret-codes-achievement-item">
                  <div class="secret-codes-achievement-icon">🏆</div>
                  <div class="secret-codes-achievement-info">
                    <div class="secret-codes-achievement-name">${conquista.nome || 'Conquista'}</div>
                    <div class="secret-codes-achievement-desc">${conquista.descricao || 'Nova conquista desbloqueada'}</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : '';

        if (secretCodesSuccess) {
          secretCodesSuccess.innerHTML = `
            <div class="secret-codes-success-header">
              <span class="secret-codes-success-icon">🎉</span>
              <h3>Código resgatado com sucesso!</h3>
            </div>
            <div class="secret-codes-success-content">
              <p>Parabéns! Você recebeu uma premiação especial.</p>
              <div class="secret-codes-prize" id="secretCodesPrize">
                ${premioHTML}
              </div>
              ${conquistasHTML}
            </div>
          `;
        }
      }

      adicionarAoHistorico(dados.codigo, 'sucesso', dados);
    }

    function mostrarErro(erro) {
      limparResultado();

      if (secretCodesResult) {
        secretCodesResult.style.display = 'block';
        secretCodesResult.className = 'secret-codes-result error';
      }

      if (secretCodesError) {
        secretCodesError.style.display = 'block';
      }

      const mensagem = typeof erro === 'string' ? erro : (erro?.mensagem || 'Código inválido');
      const codigo = typeof erro === 'object' ? erro.codigo : null;

      if (secretCodesErrorMessage) {
        secretCodesErrorMessage.textContent = mensagem;
      }

      const ehCooldown = typeof erro === 'object' && erro.tipo === 'cooldown';
      const ehLimite = typeof erro === 'object' && erro.tipo === 'limite';

      if (secretCodesErrorDetails) {
        if (ehCooldown || ehLimite) {
          secretCodesErrorDetails.style.display = 'block';
          if (ehCooldown) {
            cooldownSeconds = erro.tempoRestante || 30;
            if (secretCodesCooldownSeconds) {
              secretCodesCooldownSeconds.textContent = cooldownSeconds;
            }
            if (secretCodesErrorCooldown) {
              secretCodesErrorCooldown.style.display = 'block';
            }
            iniciarCooldown();
          }

          if (secretCodesErrorDetailsText) {
            if (ehLimite) {
              secretCodesErrorDetailsText.textContent = erro.mensagemDetalhada || 'Você atingiu o limite de resgates por dia.';
            } else {
              secretCodesErrorDetailsText.textContent = 'Tente novamente em alguns instantes.';
            }
          }
        } else {
          secretCodesErrorDetails.style.display = 'none';
          secretCodesErrorCooldown.style.display = 'none';
        }
      }

      if (!ehCooldown && !ehLimite) {
        limparCooldown();n      }

      adicionarAoHistorico(codigo, 'erro', erro);
    }

    function iniciarCooldown() {
      if (cooldownTimer) clearTimeout(cooldownTimer);

      if (secretCodesRedeemBtn) {
        secretCodesRedeemBtn.disabled = true;
        secretCodesRedeemBtn.textContent = `Tente novamente em ${cooldownSeconds}s`;
      }

      const tick = () => {
        cooldownSeconds--;
        if (secretCodesCooldownSeconds) {
          secretCodesCooldownSeconds.textContent = cooldownSeconds;
        }
        if (secretCodesRedeemBtn) {
          secretCodesRedeemBtn.textContent = `Tente novamente em ${cooldownSeconds}s`;
        }

        if (cooldownSeconds <= 0) {
          limparCooldown();
        } else {
          cooldownTimer = setTimeout(tick, 1000);
        }
      };

      cooldownTimer = setTimeout(tick, 1000);
    }

    function limparCooldown() {
      if (cooldownTimer) {
        clearTimeout(cooldownTimer);
        cooldownTimer = null;
      }
      cooldownSeconds = 0;
      if (secretCodesRedeemBtn) {
        secretCodesRedeemBtn.disabled = false;
        secretCodesRedeemBtn.textContent = 'Resgatar';
      }
      if (secretCodesErrorCooldown) {
        secretCodesErrorCooldown.style.display = 'none';
      }
    }

    function adicionarAoHistorico(codigo, tipo, dados) {
      const item = {
        codigo: codigo,
        tipo: tipo,
        timestamp: Date.now(),
        dados: dados
      };

      const historico = JSON.parse(localStorage.getItem('secretCodesHistory') || '[]');
      historico.unshift(item);
      localStorage.setItem('secretCodesHistory', JSON.stringify(historico.slice(0, 50)));

      renderizarHistorico();
    }

    function renderizarHistorico() {
      const historico = JSON.parse(localStorage.getItem('secretCodesHistory') || '[]');

      if (secretCodesHistoryList) {
        if (historico.length === 0) {
          secretCodesHistoryList.innerHTML = `
            <div class="secret-codes-history-empty">
              <p>Você ainda não resgatou nenhum código.</p>
            </div>
          `;
          return;
        }

        secretCodesHistoryList.innerHTML = historico.map(item => {
          const data = new Date(item.timestamp);
          const dataFormatada = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

          return `
            <div class="secret-codes-history-item">
              <div class="secret-codes-history-header">
                <div class="secret-codes-history-code">${item.codigo}</div>
                <div class="secret-codes-history-date">${dataFormatada}</div>
              </div>
              <div class="secret-codes-history-result">
                ${item.tipo === 'sucesso' ? '<span class="secret-codes-history-success">✅ Sucesso</span>' : '<span class="secret-codes-history-error">❌ Erro</span>'}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    function resgatarCodigo() {
      const codigo = secretCodesInput.value;
      if (!codigo) return;

      limparResultado();

      if (secretCodesRedeemBtn) {
        secretCodesRedeemBtn.classList.add('is-loading');
        secretCodesRedeemBtn.disabled = true;
      }

      api(API_GAME, 'resgatar', {
        method: 'POST',
        body: { codigo }
      }).then(res => {
        if (secretCodesRedeemBtn) {
          secretCodesRedeemBtn.classList.remove('is-loading');
          secretCodesRedeemBtn.disabled = false;
        }

        if (!res.ok) {
          mostrarErro(res.data || 'Código inválido');
          return;
        }

        mostrarSucesso(res.data);

        secretCodesInput.value = '';
        atualizarBotoes();
      }).catch(erro => {
        if (secretCodesRedeemBtn) {
          secretCodesRedeemBtn.classList.remove('is-loading');
          secretCodesRedeemBtn.disabled = false;
        }
        mostrarErro('Erro ao resgatar código.');
      });
    }

    if (secretCodesInput) {
      secretCodesInput.addEventListener('input', () => {
        const valor = formatCode(secretCodesInput.value);
        secretCodesInput.value = valor;
        atualizarBotoes();
      });

      secretCodesInput.addEventListener('paste', e => {
        e.preventDefault();
        const texto = (e.clipboardData || window.clipboardData).getData('text');
        const formatado = formatCode(texto);
        secretCodesInput.value = formatado;
        atualizarBotoes();
      });
    }

    if (secretCodesRedeemBtn) {
      secretCodesRedeemBtn.addEventListener('click', resgatarCodigo);
    }

    renderizarHistorico();
  }

  window.SecretCodesUI = { init: initSecretCodes };
  window.addEventListener('DOMContentLoaded', () => {
    window.SecretCodesUI.init();
  });
})();