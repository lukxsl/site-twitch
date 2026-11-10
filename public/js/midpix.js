/* ============================================================
   MIDPIX — apoiadores, meta e clique no botão de apoio
   ============================================================ */
(function(){
  'use strict';
  const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const $ = (selector, root = document) => root.querySelector(selector);
  let ultimaCarga = 0, carregando = false;

  const dinheiro = valor => MOEDA.format(Number(valor) || 0);
  const texto = (node, value) => { if(node) node.textContent = value; };

  function renderRanking(ranking){
    const lista = $('#midpixTop');
    if(!lista) return;
    lista.replaceChildren();
    if(!Array.isArray(ranking) || !ranking.length){
      const vazio = document.createElement('li');
      vazio.className = 'midpix-empty';
      vazio.textContent = 'Seja a primeira pessoa a apoiar o cantinho 💜';
      lista.append(vazio);
      return;
    }
    ranking.slice(0, 5).forEach((apoiador, index) => {
      const nome = String(apoiador?.nome || 'Apoiador').trim() || 'Apoiador';
      const item = document.createElement('li');
      const posicao = document.createElement('span');
      posicao.className = 'midpix-pos';
      posicao.textContent = String(index + 1);
      const rotulo = document.createElement('span');
      rotulo.className = 'midpix-name';
      rotulo.textContent = nome;
      rotulo.title = nome;
      const valor = document.createElement('span');
      valor.className = 'midpix-value';
      valor.textContent = dinheiro(apoiador?.total);
      item.append(posicao, rotulo, valor);
      lista.append(item);
    });
  }

  function renderMeta(meta){
    const box = $('#midpixGoal');
    if(!box) return;
    if(!meta || (!meta.objetivo && !meta.arrecadado)){
      box.hidden = true;
      return;
    }
    box.hidden = false;
    const arrecadado = Number(meta.arrecadado) || 0;
    const objetivo = Number(meta.objetivo) || 0;
    const pct = objetivo > 0 ? Math.min(100, Math.round((arrecadado / objetivo) * 100)) : Math.max(0, Math.round(Number(meta.pct) || 0));
    texto($('#midpixGoalTitle'), meta.titulo || 'Meta da live');
    texto($('#midpixGoalPct'), `${pct}%`);
    const barra = $('#midpixGoalBar');
    if(barra) barra.style.width = `${pct}%`;
    texto($('#midpixGoalAmount'), objetivo > 0
      ? `${dinheiro(arrecadado)} de ${dinheiro(objetivo)}`
      : `${dinheiro(arrecadado)} arrecadados`);
  }

  function renderErro(){
    const lista = $('#midpixTop');
    if(!lista) return;
    lista.replaceChildren();
    const item = document.createElement('li');
    item.className = 'midpix-empty';
    item.textContent = 'Não foi possível carregar os apoiadores agora. Tente de novo em instantes.';
    lista.append(item);
    const box = $('#midpixGoal');
    if(box) box.hidden = true;
  }

  async function carregar(force){
    if(!$('#midpixTop')) return;
    if(carregando) return;
    if(!force && Date.now() - ultimaCarga < 60000) return;
    carregando = true;
    try{
      const resposta = await fetch('/api/config?action=midpix-publico', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const dados = await resposta.json().catch(() => null);
      if(!resposta.ok || !dados?.ok) throw new Error(dados?.error || 'falha');
      renderRanking(dados.ranking);
      renderMeta(dados.meta);
      ultimaCarga = Date.now();
    }catch(_){
      if(!ultimaCarga) renderErro();
    }finally{
      carregando = false;
    }
  }

  function registrarClique(){
    const url = '/api/config?action=midpix-clique';
    try{
      const payload = JSON.stringify({ origem: location.pathname || '/' });
      if(navigator.sendBeacon && navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }))) return;
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
    }catch(_){
      fetch(url, { method: 'POST', keepalive: true }).catch(() => {});
    }
  }

  document.addEventListener('click', event => {
    const alvo = event.target?.closest?.('[data-midpix], .midpix-btn');
    if(alvo) registrarClique();
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible' && Date.now() - ultimaCarga > 300000) carregar(true);
  });

  window.addEventListener('DOMContentLoaded', () => carregar(true));
})();
