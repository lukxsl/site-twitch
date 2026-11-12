# Home — Broadcast 2.0 (12/11/2026)

Rodada focada só na **Home**. Nenhuma outra seção, endpoint ou integração foi alterada.

## O que mudou

- **Capa nova**: título com gradiente, chips de números, botões em pílula e o retrato dentro de uma moldura de monitor ("CAM 01 · ASEMTET0") com LED de status, varredura sutil e inclinação leve que segue o mouse.
- **Monitor da Twitch**: o card do player ganhou barra de monitor, borda de tela e moldura interna. Quando a Soso está **offline**, o painel mostra a **foto real de perfil da Twitch** (vinda de `/api/twitch`) dentro do monitor, sobre a thumb desfocada da última live, com chips de status e o botão da última live.
- **Grade sem buracos**: o mosaico agora usa uma composição fechada (player 7 colunas / perfil 5; música 4 / jogos 4 / apoiadores 4; assinar em linha inteira) com `align-items: stretch` e rodapés fixados por `margin-top: auto`. Não sobram células vazias em nenhuma largura.
- **Cards**: cantos de 12 px, gradiente de superfície, brilho que segue o cursor (`--mx/--my`), elevação no hover e tipografia de metadados em IBM Plex Mono.
- **Jogos/votação**: capa em pôster 3:4 ao lado do texto, em vez de um banner gigante que esticava o card.
- **Assinar**: virou faixa horizontal (texto · perks 2×2 · emotes · CTA).
- **Foco programático**: títulos de seção recebem `tabindex="-1"` e `.focus()` ao trocar de aba; o anel nativo dourado do Chrome aparecia em cima do `<h1>`. Correção global em `core.css` (`[tabindex="-1"]:focus{outline:none}`), mantendo o foco para leitores de tela.

## Arquivos

- `public/css/home-broadcast.css` **(novo)** — camada final da Home. Carregada depois de `home.css` e `redesign.css`; todas as regras são escopadas em `#sec-inicio`.
- `public/js/home-effects.js` **(novo)** — spotlight nos cards e inclinação do retrato. Desligado em `hover: none` e `prefers-reduced-motion`.
- `public/index.html` — nova marcação da capa/retrato, `monitor-dots` no header do player, tags no perfil, `<link>` e `<script>` novos.
- `public/js/twitch.js` — painel offline reconstruído com a foto de perfil da Twitch e a thumb da última live; `_atualizarHero()` liga `#sec-inicio.is-live` (LED + etiqueta do retrato). Removidos os `background-image` inline que eram definidos no painel.
- `public/css/core.css` — regra de foco em `[tabindex="-1"]`.

## Contratos preservados

Todos os IDs usados por JS continuam iguais (`offlinePanel`, `offlineFoto`, `offlineArt`, `twitchIframe`, `btnVod`, `playerNoteText`, `liveNow`, `statsStrip`, `stripSeg/Horas/Discord`, `profileStatus`, `profileStatusDinamica`, `recadoCard/Texto/Data`, `midpix*`, `emotesMiniGrid`). `.home-grid > .card.reveal` continua sendo o seletor do `setupReveal()`. Nenhuma função de negócio, endpoint, regra de XP/SosoCoins ou autenticação foi tocada.

## Como conferir

1. `vercel dev` ou o Preview da Vercel (a Home depende de `/api/twitch`, `/api/lastfm`, `/api/config`, `/api/midpix`).
2. Larguras: 1440, 1280, 1024, 768, 390 e 320 px — nada de célula vazia, nada de scroll horizontal.
3. Estados: offline (com foto), ao vivo (iframe), +18, reprise (`▶ Última live`) e votação aberta/fechada.
4. Mouse sobre os cards: brilho acompanhando o cursor + elevação; sobre o retrato: inclinação leve.
5. `prefers-reduced-motion` ativo e navegação por toque: sem inclinação e sem brilho.
