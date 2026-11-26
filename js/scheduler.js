/* ============================================================
   AGENDADOR — um único relógio, pausa em aba oculta
   ============================================================ */
(function(){
  'use strict';
  const tarefas = new Map();

  function executar(tarefa){
    if(document.hidden) return;
    if(tarefa.quando && !tarefa.quando()) return;
    try{
      const resultado = tarefa.fn();
      if(resultado && typeof resultado.catch === 'function'){
        resultado.catch(err => console.warn(`[scheduler] ${tarefa.id}:`, err));
      }
    }catch(err){ console.warn(`[scheduler] ${tarefa.id}:`, err); }
  }

  function iniciar(tarefa){
    if(tarefa.handle || document.hidden) return;
    executar(tarefa);
    tarefa.handle = setInterval(() => executar(tarefa), tarefa.ms);
  }

  function add(id, fn, ms, opcoes = {}){
    if(tarefas.has(id)) parar(id);
    const tarefa = { id, fn, ms, quando: opcoes.quando || null, handle: null };
    tarefas.set(id, tarefa);
    iniciar(tarefa);
    return tarefa;
  }

  function parar(id){
    const tarefa = tarefas.get(id);
    if(!tarefa) return;
    if(tarefa.handle) clearInterval(tarefa.handle);
    tarefa.handle = null;
    tarefas.delete(id);
  }

  function pausar(){
    tarefas.forEach(tarefa => {
      if(tarefa.handle) clearInterval(tarefa.handle);
      tarefa.handle = null;
    });
  }

  function retomar(){
    if(document.hidden) return;
    tarefas.forEach(iniciar);
  }

  function rodar(id){
    const tarefa = tarefas.get(id);
    if(tarefa) executar(tarefa);
  }

  document.addEventListener('visibilitychange', () => {
    if(document.hidden) pausar();
    else retomar();
  });

  window.Scheduler = { add, parar, pausar, retomar, rodar };
})();
