# asemtet0 — Broadcast Club redesign

> Direção de arte: Broadcast Club, edição Soso. Esta versão substitui a direção editorial minimalista anterior por uma linguagem mais viva, gráfica e ligada à cultura de streaming e comunidade.

## Conceito visual

O site combina 70% Broadcast Club, 20% Internet Scrapbook e 10% Pixel Universe: uma base escura com acentos violeta, rosa, amarelo e ciano; títulos expressivos; composições assimétricas; molduras e selos gráficos; e pequenas referências à cultura de transmissão.

- **Títulos:** Bricolage Grotesque, com peso forte e proporções expressivas.
- **Texto e interface:** Space Grotesk.
- **Metadados:** IBM Plex Mono.
- **Cores:** carvão e superfícies arroxeadas, violeta elétrico, rosa, amarelo quente e ciano.
- **Home:** masthead em formato de capa de canal, retrato real com moldura e selos visuais, CTAs de alto contraste e faixa de assuntos.
- **Áreas internas:** hierarquias próprias para Tier List, Ranking, Comunidade, Setup, Sugestões e Perfil. O Setup preserva sua identidade pixel art.

## Implementação

A direção visual está consolidada em `public/css/identity.css`, carregado por último em `public/index.html`. As folhas `core.css`, `components.css`, `pages.css`, `setup.css`, `admin.css`, `home.css` e `redesign.css` foram preservadas porque contêm a base de componentes, comportamentos e estilos especializados utilizados por diferentes páginas. A nova camada aplica os tokens e a direção visual final sem remover esses contratos.

O HTML ganhou apenas elementos editoriais não funcionais na Home (rótulo da edição e faixa temática), além da troca de tipografia e metadados de cor/nome. IDs, rotas, handlers, scripts, integrações e a ordem das áreas permanecem preservados.

## Responsividade e acessibilidade

- Desktop com navegação lateral e grade assimétrica da Home.
- Tablet com navegação compacta e grade adaptada.
- Celular com composição em coluna, botões com área confortável e navegação inferior preservada.
- Foco visível, contraste revisado para textos principais e respeito a `prefers-reduced-motion`.

## Validações realizadas nesta entrega

- `node --check` em todos os JavaScript de `api/` e `public/js/`.
- Parsing das folhas CSS com `tinycss2` sem erros de sintaxe.
- `vercel.json` e JSONs do projeto validados.
- HTML conferido quanto a IDs duplicados, IDs críticos e referências locais a CSS, JS e imagens.
- Arquivo ZIP verificado quanto à integridade.
- Servidor HTTP estático local consultado para verificar o carregamento dos principais arquivos.

A captura por Chromium headless não foi concluída neste ambiente (o processo do navegador encerrou a rede/zygote). Portanto, não afirmamos ter validado visualmente cada breakpoint por screenshot nesta execução. O preview implantado na Vercel deve ser conferido em Chrome/Firefox/Safari reais, especialmente os estados dinâmicos que dependem de APIs externas.

## Antes de publicar

Suba como Preview na Vercel e confirme: login local/Google/Twitch; status e player Twitch; dados de Spotify/Last.fm; votação e recompensa; ranking; MidPix; Setup; fluxo do admin; e teste de backup/restore somente em uma base descartável. A camada visual não requer novas variáveis de ambiente nem dependências de build.
