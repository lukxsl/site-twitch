/* Interações extras (não alteram a lógica do app.js) */
(function(){
  const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const barra = document.getElementById('progress');
  addEventListener('scroll', () => {
    const h = document.documentElement;
    barra.style.width = (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight) * 100) + '%';
  }, { passive: true });

  // corações ao clicar em botões
  document.addEventListener('click', e => {
    if (reduz || !e.target.closest('.btn')) return;
    for (let i = 0; i < 4; i++) {
      const s = document.createElement('span');
      s.className = 'heart'; s.textContent = '💜';
      s.style.left = (e.clientX - 9) + 'px'; s.style.top = (e.clientY - 9) + 'px';
      s.style.setProperty('--dx', (Math.random() * 70 - 35) + 'px');
      document.body.appendChild(s); setTimeout(() => s.remove(), 900);
    }
  });

  // rota por hash (#tierlist, #setup...) + volta ao topo ao trocar de aba
  const abas = ['inicio','tierlist','comunidade','setup','sugestoes','admin'];
  const original = window.mudarAba;
  if (typeof original === 'function') {
    window.mudarAba = function(nome, ...r){
      const res = original.call(this, nome, ...r);
      if (abas.includes(nome)) history.replaceState(null, '', '#' + nome);
      scrollTo({ top: 0, behavior: reduz ? 'auto' : 'smooth' });
      return res;
    };
  }
  addEventListener('load', () => {
    const h = location.hash.slice(1);
    if (abas.includes(h) && h !== 'admin') window.mudarAba(h);
  });

  // "/" foca na busca da tier list
  addEventListener('keydown', e => {
    const q = document.getElementById('q');
    if (e.key === '/' && q && q.offsetParent && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); q.focus(); }
  });
})();