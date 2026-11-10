// Normalização compartilhada das listas públicas e administrativas.
// Valores persistidos são sempre texto simples e números/enums validados.
import { randomUUID } from 'crypto';

const TIERS = new Set(['S', 'A', 'B', 'C', 'NR']);
const STATUS = {
  jogos: new Set(['Jogando', 'Zerado', 'Dropado', 'Na fila']),
  filmes: new Set(['Assistindo', 'Assistido', 'Dropado', 'Na fila']),
  animes: new Set(['Assistindo', 'Assistido', 'Dropado', 'Na fila'])
};

function texto(value, max = 500) {
  return String(value == null ? '' : value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function numero(value, min, max, inteiro = false) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  const limitado = Math.max(min, Math.min(max, n));
  return inteiro ? Math.floor(limitado) : Math.round(limitado * 10) / 10;
}

function urlImagem(value) {
  const raw = texto(value, 1500);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function idSeguro(value) {
  const raw = texto(value, 100).replace(/[^a-zA-Z0-9:_-]/g, '');
  return raw || randomUUID();
}

export function sanitizarItemTier(item, tipo = 'jogos') {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const listaTipo = ['jogos', 'filmes', 'animes'].includes(tipo) ? tipo : 'jogos';
  const nome = texto(item.nome, 180);
  if (!nome) return null;

  const statusPadrao = listaTipo === 'jogos' ? 'Na fila' : 'Na fila';
  const status = STATUS[listaTipo].has(item.status) ? item.status : statusPadrao;
  const tier = TIERS.has(item.tier) ? item.tier : 'NR';
  const generos = Array.isArray(item.generos)
    ? item.generos.slice(0, 12).map(g => texto(g, 60)).filter(Boolean)
    : [];

  const limpo = {
    id: idSeguro(item.id),
    nome,
    tier,
    status,
    nota: numero(item.nota, 0, 10),
    capa: urlImagem(item.capa),
    comentario: texto(item.comentario || item.sinopse, 4200),
    sinopse: texto(item.sinopse || item.comentario, 4200),
    generos,
    adicionadoEm: texto(item.adicionadoEm, 40) || new Date().toISOString()
  };

  if (listaTipo === 'jogos') {
    const appid = numero(item.appid, 0, 999999999, true);
    if (appid > 0) limpo.appid = appid;
    limpo.horas = numero(item.horas, 0, 1000000);
    const obtidas = numero(item.conquistas?.obtidas, 0, 1000000, true);
    const total = numero(item.conquistas?.total, 0, 1000000, true);
    if (total > 0 || obtidas > 0) limpo.conquistas = { obtidas: Math.min(obtidas, total || obtidas), total };
    const atualizado = texto(item.conquistasAtualizadoEm, 40);
    if (atualizado) limpo.conquistasAtualizadoEm = atualizado;
  } else if (listaTipo === 'filmes') {
    limpo.duracao = numero(item.duracao, 0, 2000, true);
    const ano = numero(item.ano, 0, 2100, true);
    limpo.ano = ano >= 1900 ? ano : null;
  } else {
    limpo.episodios = numero(item.episodios, 0, 100000, true);
    limpo.episodiosVistos = Math.min(
      numero(item.episodiosVistos, 0, 100000, true),
      limpo.episodios || 100000
    );
    const ano = numero(item.ano, 0, 2100, true);
    limpo.ano = ano >= 1900 ? ano : null;
  }

  return limpo;
}

export function sanitizarListaTier(lista, tipo = 'jogos') {
  if (!Array.isArray(lista)) return [];
  return lista.slice(0, 500)
    .map(item => sanitizarItemTier(item, tipo))
    .filter(Boolean);
}
