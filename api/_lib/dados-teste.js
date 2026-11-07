// Heurística conservadora para reconhecer sugestões de teste.
// Usada só para esconder (leitura pública) e para a limpeza manual do admin.
const NOMES_TESTE = new Set([
  'teste', 'test', 'testes', 'aaa', 'aa', 'aaaa', 'anonimo', 'anonima',
  'asdf', 'qwer', 'abc', 'fulano', 'beltrano', 'a', 'b'
]);

const normalizar = (v) => String(v || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .trim();

export function pareceTeste(item) {
  if (!item || typeof item !== 'object') return false;
  const nome = normalizar(item.nome).replace(/^@/, '');
  const texto = normalizar(item.texto).replace(/\s+/g, ' ');
  const semEspaco = texto.replace(/\s/g, '');

  if (!nome && !texto) return true;
  if (NOMES_TESTE.has(nome)) return true;
  if (/^teste?[-_0-9]*$/.test(nome)) return true;
  if (nome.length > 0 && nome.length <= 2) return true;
  if (/(.)\1{6,}/.test(semEspaco)) return true;
  if (/^(teste|test)(\s+(de|do|da)?\s*(teste|test))?$/.test(texto)) return true;
  if (/^(asdf|qwer|zxcv|1234|abcd|abc|aaa|bbb|ccc)+$/.test(semEspaco)) return true;
  if (semEspaco.length >= 10 && new Set(semEspaco).size <= 3) return true;

  return false;
}
