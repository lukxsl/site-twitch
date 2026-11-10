# Soso Arcade — revisão técnica e organização

Este pacote contém uma rodada de correções de segurança, integridade de dados e organização posterior ao redesign visual.

## Organização do projeto

- `public/`: arquivos estáticos publicados (HTML, CSS, JS, imagens, `robots.txt`, `sitemap.xml` e `version.json`).
- `api/`: funções serverless da Vercel e módulos privados em `api/_lib/`.
- `scripts/`: scripts internos de build.
- `README*.md`, `opencode.json` e `vercel.json`: documentação e configuração no diretório do projeto, fora da saída estática.

A configuração da Vercel foi ajustada para `outputDirectory: "public"`. O script `scripts/gen-version.js` agora escreve em `public/version.json`.

**Não remova `api/` nem mova seus arquivos para `public/`.** A Vercel precisa encontrá-los no diretório raiz para criar as funções `/api/*`.

## Correções desta rodada

### Integridade e economia

- A migração de estatísticas em `api/_lib/atividade.js` não apaga mais `g:{id}`. A leitura do perfil preserva XP, SosoCoins, streak e demais dados da economia.
- A presença de Twitch é processada pelo módulo de economia como fonte única; minutos validados, XP, moedas, ranking e presença usam marcadores idempotentes.
- O cron deixa de creditar presença/recompensas a contas banidas.
- Eventos de cadastro, primeiro vínculo Twitch, voto, sugestão enviada e sugestão aprovada foram conectados aos fluxos correspondentes, com proteção idempotente.

### Segurança e moderação

- A Tier List passa por whitelist de campos, limites, enums e normalização no servidor, tanto na API pública quanto na administrativa.
- A API de sugestões não altera status durante GET e não expõe `userId`, avatar ou campos internos na resposta pública.
- Uma conta autenticada banida não consegue contornar o bloqueio marcando a sugestão como anônima.
- Ações de banimento verificam hierarquia e protegem contas administrativas fixas e cargos superiores.
- A verificação de e-mail do Google é exigida para liberar votos; contas também podem votar após vincular Twitch por OAuth. Contas locais ainda não verificadas podem consultar a votação, mas não registrar voto até confirmar uma identidade.
- O limitador de login combina IP e identificador, reduzindo o risco de bloquear globalmente a conta de outra pessoa.
- O IP de origem prioriza `x-real-ip` fornecido pela plataforma.
- Os proxies de atividades/detalhes do StreamElements aplicam rate limit, cache e projeção de campos permitidos.
- A busca do catálogo Spotify usa token oficial de aplicação; foi removida a raspagem do token anônimo do HTML do embed.
- O fluxo de Google pode associar uma conta local não verificada à identidade Google que comprovou o mesmo e-mail, revogando sessões anteriores e removendo a senha local antiga.

### Backups

- O snapshot inclui Tier List (inclusive animes), perfil, contas/índices, admins, banidos, economia, atividade, presenças, ciclos de votos, ranking XP e marcadores de idempotência.
- Hashes, listas e dados sensíveis são criptografados com AES-256-GCM no arquivo de backup.
- Restore e exclusão são restritos ao cargo Dev; a criação/listagem/download continuam disponíveis à administração.
- Antes do restore é criado um snapshot de segurança. A rotação preserva o backup selecionado durante essa operação.

**Limitação importante:** a restauração ainda aplica alterações em lotes de pipeline, não em uma única transação Redis. Uma interrupção durante a aplicação pode deixar dados parcialmente restaurados. Faça backup e use Preview/ambiente controlado antes de qualquer restore de produção.

## Variáveis de ambiente a conferir na Vercel

Além das variáveis que o projeto já utiliza, configure preferencialmente:

- `BACKUP_ENCRYPTION_KEY`: segredo longo, aleatório e exclusivo para criptografar backups. Configure antes de gerar novos backups e mantenha o mesmo valor guardado em local seguro. Se ele for trocado, os backups criptografados com a chave anterior não poderão ser descriptografados. O código mantém fallback temporário para `SESSION_SECRET` para não interromper instalações que ainda não configuraram a chave dedicada.

Não compartilhe essa chave nem a coloque no frontend, Git ou neste README.

## Imagens e desempenho

- `avatar.webp`: versão otimizada para as imagens visíveis do site. `apple-touch-icon.png`: ícone quadrado reduzido para instalação em dispositivos.
- `lukzin.webp`: substitui a imagem PNG usada pelo mascote.
- `quarto-setup.webp`: substitui o fundo de cenário PNG.
- `banner.png`: mantido como imagem social/Open Graph e imagem editorial do login.

Os PNGs antigos de Lukzin e do cenário foram removidos depois de atualizar as referências. A soma dos assets da pasta `img` caiu de aproximadamente 3,5 MB para 900 KB.

## Validações realizadas nesta entrega

- Sintaxe dos arquivos JavaScript (API, frontend e script de build).
- JSON de `vercel.json` válido.
- ZIP íntegro e sem arquivos temporários.
- Referências locais de CSS, JavaScript, imagens, ícones e fontes conferidas.
- IDs HTML duplicados verificados.
- Limite de funções: 11 arquivos diretamente em `api/`.

## Testes que ainda dependem da sua Vercel/Upstash/Twitch/Google

Esta sessão não tem acesso às credenciais nem ao Redis de produção; portanto, não foi possível executar OAuth real, scripts Lua contra dados reais, cron da Twitch, restore real ou um deploy Vercel. Faça primeiro um Preview e verifique:

1. Login Google e Twitch, incluindo conta local antiga com e-mail Google correspondente.
2. Leitura do perfil de um usuário com XP/moedas: abra e atualize a página e confira que `g:{id}` permanece intacto no Redis.
3. Voto com Google verificado ou Twitch vinculada; confirme a mensagem para contas não verificadas.
4. Envio de sugestão autenticado e anônimo; confirme que uma conta banida não consegue contornar a moderação.
5. Tier List pública e edição pelo painel administrativo.
6. Ranking XP, presença durante uma live e recompensas do cron.
7. Criar e baixar backup; testar restore somente em ambiente isolado com dados descartáveis.
8. APIs de StreamElements, Spotify e MidPix.
9. Abrir `/README.md`, `/opencode.json` e `/scripts/gen-version.js` no domínio publicado: devem retornar 404, pois não fazem parte de `public/`.

## Pontos que permanecem para uma próxima rodada

- Remover `unsafe-inline` de `script-src` exige migrar os handlers inline e atributos `onclick` para event delegation; isso não foi feito nesta rodada para evitar quebrar interações que ainda dependem de funções globais.
- O fluxo de restore pode ser melhorado para uma estratégia transacional/staging, validada com o provedor Redis real.
- A migração completa do `main.js` para ES Modules/store por domínio deve ser incremental.
- URLs reais por página, EventSub/Web Push e loja de cosméticos são evoluções futuras, não pré-requisitos para esta correção.
