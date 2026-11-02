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
  let versaoCatalogo = 0;
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
    if (!forcar && perfilEmVoo) return perfilEmVoo;
    if (forcar) {
      // Uma recuperação forçada não pode reutilizar uma requisição antiga que falhou.
      versaoPerfil++;
      perfilEmVoo = null;
    }

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
      return forcar ? null : estado.perfil;
    })().finally(() => {
      if (perfilEmVoo === promessa) perfilEmVoo = null;
    });

    perfilEmVoo = promessa;
    return promessa;
  }

  async function carregarCatalogo({ forcar = false } = {}){
    if (!forcar && estado.catalogo) return estado.catalogo;
    if (!forcar && catalogoEmVoo) return catalogoEmVoo;
    if (forcar) {
      // Invalida a consulta anterior para que o botão de tentar novamente busque de fato.
      versaoCatalogo++;
      catalogoEmVoo = null;
    }

    const versao = versaoCatalogo;
    const promessa = (async () => {
      const res = await api(API_GAME, 'catalogo');
      if (versao !== versaoCatalogo) return null;
      if (res.ok && res.data) {
        estado.catalogo = res.data;
        estado.catalogoTs = Date.now();
        emitir('catalogo', res.data);
        return res.data;
      }
      console.error('[GameState] Falha ao carregar catálogo:', {
        status: res && res.status,
        erro: res && res.data && res.data.error,
        resposta: res && res.data
      });
      emitir('erro', { tipo: 'catalogo', resposta: res });
      return forcar ? null : estado.catalogo;
    })().finally(() => {
      if (catalogoEmVoo === promessa) catalogoEmVoo = null;
    });

    catalogoEmVoo = promessa;
    return promessa;
  }

  function limpar(){
    versaoPerfil++;
    versaoCatalogo++;
    perfilEmVoo = null;
    catalogoEmVoo = null;
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
