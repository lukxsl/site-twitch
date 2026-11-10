# Entrega — redesign asemtet0 (novembro de 2026)

## O que mudou

### Identidade visual

- Criada `public/css/identity.css`, carregada depois das folhas existentes. Ela unifica tokens de cor, tipografia, bordas, superfícies, navegação, botões, formulários, estados e espaçamentos.
- Direção escolhida: **Revista de madrugada** — base escura, marfim para leitura, lavanda como acento, dourado para detalhes, Instrument Serif nos títulos, DM Sans no corpo e IBM Plex Mono nos metadados.
- Home reorganizada visualmente em masthead editorial com retrato, estatísticas, player, perfil, música, jogos, recado, MidPix e inscrição. A grade é assimétrica no desktop e vira coluna no celular.
- Refinados Tier List, Ranking, Comunidade, Setup, Sugestões, Perfil, login e painel administrativo.
- Estados de foco visíveis, controles com altura mínima de 44 px e tratamento de movimento reduzido.
- As folhas antigas não foram apagadas: ficam como base de compatibilidade para os módulos e estados existentes. A camada nova sobrescreve os estilos necessários sem mudar IDs nem contratos do JavaScript.

### Conteúdo e voz

- Reescritos masthead, painel offline, login, comunidade, apoiadores, sub, sugestões, perfil e rodapé.
- Atualizadas também as mensagens dinâmicas usadas pelo JavaScript após o carregamento dos dados.
- Removidas da interface pública as expressões genéricas solicitadas e as ocorrências do coração roxo repetido. O tom passa a depender mais da frase e menos do emoji.
- A mensagem de offline não promete uma agenda semanal fixa.

### Imagens

- Login e fallback visual de live +18 passaram a usar `public/img/avatar.webp` (48 KB), uma foto vertical da Soso, em vez do banner PNG de 602 KB que trazia texto e corações embutidos.
- `public/img/banner.png` foi preservado para metadados de compartilhamento; não foi apagado nem sobrescrito.

### Código e confiabilidade

- `api/_lib/game-api.js`: removida a validação duplicada de sessão; usa `validarSessao()` central, que exige sessão própria e compara a versão da conta normalizada.
- `api/_lib/core.js`: chamadas Redis com timeout de 8 segundos.
- `api/_lib/twitch.js`: chamadas externas com timeout de 8 segundos; lock de refresh da Twitch usa token exclusivo e só pode ser liberado pelo processo que o adquiriu.
- `api/votos.js`: a gravação atômica confere banimento e ciclo no Redis no momento do commit. Uma marca de recompensa pendente é criada junto do voto e permite nova tentativa idempotente na próxima consulta/voto autenticado da mesma pessoa. **Não é um worker em segundo plano**: se a pessoa nunca voltar, a marca expira após 90 dias.
- `public/js/main.js`: polling da Twitch, música e foco é pausado enquanto a aba fica oculta; status e música são atualizados ao voltar à aba.

## Arquivos principais

- `public/css/identity.css` — nova camada visual completa.
- `public/index.html` — fontes, copy, texto e chamadas principais.
- `public/img/avatar.webp` — retrato usado também no login e no fallback offline.
- `public/js/auth-ui.js`, `profile.js`, `midpix.js`, `setup.js`, `twitch.js`, `main.js` — copy dinâmica, fallback e polling.
- `api/_lib/core.js`, `game-api.js`, `twitch.js`, `api/votos.js` — correções de confiabilidade descritas acima.

## Verificações executadas

- `node --check` em todos os arquivos JavaScript de `api/`, `public/js/` e `scripts/` — aprovado.
- Parsing de `vercel.json` — aprovado.
- Parsing das 8 folhas CSS em `public/css/` — zero erros de sintaxe.
- HTML analisado: 316 IDs, sem IDs duplicados.
- Referências locais de CSS, scripts e imagens declaradas no HTML — nenhuma ausente.
- Conferência do texto público: zero ocorrências das expressões proibidas e zero corações roxos repetidos.
- Foto vertical `avatar.webp` conferida e referência local validada; banner PNG original preservado.

## O que não foi possível testar neste ambiente

- A prévia visual com Chromium foi bloqueada pelo ambiente de execução (`ERR_BLOCKED_BY_ADMINISTRATOR`), inclusive usando o servidor local. Portanto, não há uma captura real de navegador que eu possa afirmar ter inspecionado.
- Não há credenciais de produção nem Redis/Upstash/Twitch/MidPix disponíveis aqui. OAuth, cron, chamadas reais, concorrência Lua e restauração de backup precisam de teste no Preview da Vercel com ambiente de teste.
- Não foi executado restore em produção nem alterado qualquer dado remoto.

## Checklist antes de publicar

1. Criar um Preview na Vercel, sem substituir a produção.
2. Conferir a Home em celular (360–390 px), tablet e desktop largo; validar especialmente o player, o retrato e a navegação.
3. Entrar por e-mail, Google e Twitch; conferir logout e sessão após trocar senha.
4. Simular duas requisições de voto, troca de voto, fechamento, troca de ciclo e banimento durante uma tentativa; conferir contagem e recompensa.
5. Testar refresh token da Twitch com duas chamadas concorrentes e verificar que o lock não é removido por outro processo.
6. Conferir live, offline, VOD, aviso no Discord, música e MidPix.
7. Fazer backup e restore exclusivamente em dados descartáveis antes de liberar o novo código.
8. Só então promover o Preview para produção.

## Rollback

- O ZIP de entrega preserva todas as páginas, endpoints, imagens e folhas CSS antigas.
- As mudanças estão concentradas nos arquivos listados acima. Em caso de regressão, reverta o commit da entrega ou restaure esses arquivos a partir do backup do repositório.
- Não apague `banner.png`, folhas CSS antigas, IDs ou endpoints nesta etapa.

---

# Rodada visual adicional — Broadcast Club

A direção editorial anterior foi substituída por uma identidade mais expressiva e colorida, com a combinação de Broadcast Club, scrapbook digital e detalhes pixel art. A tipografia agora usa Bricolage Grotesque em títulos, Space Grotesk na interface e IBM Plex Mono em metadados. A paleta ganhou violeta, rosa, amarelo e ciano sobre superfícies escuras.

A Home recebeu uma nova composição: chamada maior, retrato com moldura e selos gráficos, botões de alto contraste e faixa de assuntos. Tier List, Ranking, Comunidade, Setup, Sugestões, Perfil, Login, Admin, navegação e rodapé também receberam uma camada visual coerente. Nenhum endpoint, identificador de integração, arquivo JavaScript ou folha específica de página foi removido nesta rodada.

Validações desta rodada: sintaxe JavaScript, parsing CSS, JSON, IDs/referências locais do HTML, integridade do ZIP e respostas HTTP do servidor estático. O Chromium headless disponível no ambiente encerrou a própria rede/zygote antes de produzir uma captura; por isso screenshots de desktop/mobile não puderam ser confirmados aqui. O teste visual final deve ocorrer no Preview implantado com navegador normal.
