/* ============================================================
   GAME STATE — cache em memória do estado do Arcade
   O servidor é a única fonte da verdade. Nada é persistido no
   navegador: este cache vive só enquanto a página está aberta.
   ============================================================ */
(function(){
  'use strict';

  const estado = {
    perfil: null,
    perfilTs: 0,
    catalogo: null,
    catalogoTs: 0
  };

  let perfilEmVoo = null;
  let catalogoEmVoo = null;
  let versaoPerfil = 0;
  const ouvintes = new Map();

  function on(evento, fn){
    if (!ouvintes.has(evento)) ouvintes.set(evento, new Set());
    ouvintes.get(evento).add(fn);
    return () => ouvintes.get(evento)?.delete(fn);
  }

  function emitir(evento, detalhe){
    const set = ouvintes.get(evento);
    if (!set) return;
    set.forEach(fn => {
      try { fn(detalhe); } catch (e) { console.warn('[GameState] ouvinte:', e); }
    });
  }

  async function carregarPerfil({ forcar = false } = {}){
    if (!forcar && estado.perfil) return estado.perfil;
    if (perfilEmVoo) return perfilEmVoo;

    const versao = versaoPerfil;
    const promessa = (async () => {
      const res = await api(API_GAME, 'perfil');
      if (versao !== versaoPerfil) return null;
      if (res.ok && res.data) {
        estado.perfil = res.data;
        estado.perfilTs = Date.now();
        emitir('perfil', res.data);
        return res.data;
      }
      if (res.status === 401) {
        estado.perfil = null;
        estado.perfilTs = 0;
        versaoPerfil++;
        emitir('perfil', null);
        return null;
      }
      emitir('erro', { tipo: 'perfil', resposta: res });
      return estado.perfil;
    })().finally(() => {
      if (perfilEmVoo === promessa) perfilEmVoo = null;
    });

    perfilEmVoo = promessa;
    return promessa;
  }

  async function carregarCatalogo({ forcar = false } = {}){
    if (!forcar && estado.catalogo) return estado.catalogo;
    if (catalogoEmVoo) return catalogoEmVoo;

    catalogoEmVoo = (async () => {
      const res = await api(API_GAME, 'catalogo');
      if (res.ok && res.data) {
        estado.catalogo = res.data;
        estado.catalogoTs = Date.now();
        emitir('catalogo', res.data);
        return res.data;
      }
      emitir('erro', { tipo: 'catalogo', resposta: res });
      return estado.catalogo;
    })().finally(() => { catalogoEmVoo = null; });

    return catalogoEmVoo;
  }

  function limpar(){
    versaoPerfil++;
    perfilEmVoo = null;
    estado.perfil = null;
    estado.perfilTs = 0;
    emitir('perfil', null);
  }

  window.GameState = {
    get perfil(){ return estado.perfil; },
    get perfilTs(){ return estado.perfilTs; },
    get catalogo(){ return estado.catalogo; },
    get catalogoTs(){ return estado.catalogoTs; },
    carregarPerfil,
    carregarCatalogo,
    limpar,
    on
  };
})();
