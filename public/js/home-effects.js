/* ============================================================
   HOME — microinterações da capa (spotlight + inclinação leve)
   Puro enfeite: nada aqui é necessário para usar o site.
   Desligado em toque, em prefers-reduced-motion e sem hover.
   ============================================================ */
(function () {
  'use strict';

  const sec = document.getElementById('sec-inicio');
  if (!sec) return;

  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
  const semHover = window.matchMedia('(hover: none)');
  const monitor = sec.querySelector('.portrait-monitor');
  const retrato = sec.querySelector('.home-portrait');

  const ativo = () => !semMovimento.matches && !semHover.matches;

  let alvo = null;
  let frame = 0;
  let px = 0;
  let py = 0;

  function pintar() {
    frame = 0;
    if (!alvo) return;
    const caixa = alvo.getBoundingClientRect();
    if (!caixa.width || !caixa.height) return;
    const x = ((px - caixa.left) / caixa.width) * 100;
    const y = ((py - caixa.top) / caixa.height) * 100;
    alvo.style.setProperty('--mx', x.toFixed(1) + '%');
    alvo.style.setProperty('--my', y.toFixed(1) + '%');
  }

  function inclinar() {
    if (!monitor || !retrato) return;
    const caixa = retrato.getBoundingClientRect();
    if (!caixa.width || !caixa.height) return;
    const nx = ((px - caixa.left) / caixa.width - 0.5) * 2;
    const ny = ((py - caixa.top) / caixa.height - 0.5) * 2;
    const limite = (v) => Math.max(-1, Math.min(1, v));
    monitor.style.setProperty('--ry', (limite(nx) * 3).toFixed(2) + 'deg');
    monitor.style.setProperty('--rx', (limite(-ny) * 2.2).toFixed(2) + 'deg');
  }

  function zerarInclinacao() {
    if (!monitor) return;
    monitor.style.setProperty('--rx', '0deg');
    monitor.style.setProperty('--ry', '0deg');
  }

  sec.addEventListener('pointermove', (e) => {
    if (!ativo() || e.pointerType === 'touch') return;
    px = e.clientX;
    py = e.clientY;

    const card = e.target.closest ? e.target.closest('.home-grid > .card, .home-portrait') : null;
    alvo = card && sec.contains(card) ? card : null;

    if (retrato && retrato.contains(e.target)) inclinar();
    else zerarInclinacao();

    if (!frame) frame = requestAnimationFrame(pintar);
  }, { passive: true });

  sec.addEventListener('pointerleave', () => {
    alvo = null;
    zerarInclinacao();
  });

  // Se o usuário trocar a preferência de movimento com a página aberta, zera o estado.
  if (semMovimento.addEventListener) {
    semMovimento.addEventListener('change', () => {
      if (semMovimento.matches) zerarInclinacao();
    });
  }
})();
