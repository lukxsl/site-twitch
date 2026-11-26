# asemtet0 — site da comunidade

Site da Soso (Twitch: [asemtet0](https://www.twitch.tv/asemtet0)). HTML, CSS e JavaScript puro, sem framework e sem build. Deploy na Vercel, APIs em Node sob `/api` com Upstash Redis.

## Estrutura

- `index.html` — shell (sidebar desktop, barra inferior no mobile, diálogos) e todas as seções por hash.
- `css/tokens.css`, `base.css`, `shell.css`, `components.css`, `home.css` — carregados no início.
- `css/tier.css`, `ranking.css`, `community.css`, `setup.css`, `profile.css`, `admin.css` — injetados pelo router na primeira visita à rota.
- `js/router.js` — `window.mudarAba`, `pushState`, `hashchange`/`popstate`, título/meta por rota e foco no `h1`.
- `js/navbar.js` — sidebar, chip de live, bloco do usuário e sheet “Mais”.
- `js/scheduler.js` — único agendador de polling; pausa com aba oculta e atualiza ao voltar.
- `js/main.js`, `js/twitch/twitch.js`, `js/api/client.js`, `js/auth-ui.js`, `js/profile-summary.js`, `js/ranking-ui.js` — lógica das páginas.
- `js/setup/setup.js` — catálogo do Setup (filtros, busca e ficha em `dialog`).
- `js/admin/*` — carregado sob demanda quando a rota `#admin` abre.

Rotas: `#inicio`, `#tierlist`, `#ranking`, `#comunidade`, `#setup`, `#sugestoes`, `#perfil`, `#admin` e `#admin/<pagina>`. Voltar/avançar do navegador funciona entre todas elas.

## O que existe hoje

- **Home:** hero editorial com cartão CAM 01 (foto offline / player da Twitch ao vivo), pílulas de estatísticas, linha “Agora” (último jogo, próxima votação, música) e um único cartão “Apoie” com Top Doadores, Sub e doação. Sem banner.
- **Tier List:** jogos, filmes e animes; busca, filtros, ordenação, roleta, arrastar no modo admin e edição de nota.
- **Ranking:** cinco abas (horas, pontos, chat, doadores e músicas) com pódio e lista.
- **Comunidade:** Discord, clipes, playlist do Spotify, aba de Sub, comandos e regras.
- **Setup:** somente catálogo com ficha técnica.
- **Sugestões:** votação e envio de ideias.
- **Perfil:** seis estatísticas — lives com presença, horas assistidas, votos registrados, sugestões enviadas, SosoCoins e XP com nível.
- **Admin:** painel completo, restrito a administradores.

Não há mais quarto interativo, Lukzin, tour, easter egg, minijogo, `api/game.js` nem `api/_lib/game-api.js`. `api/_lib/game.js` permanece: é a economia (SosoCoins/XP) usada por `auth.js`, `votos.js` e `sugestoes.js`.

Segurança: não há handlers inline nem `style="..."` no HTML/templates; a CSP em `vercel.json` não usa `'unsafe-inline'` para scripts. Nenhum segredo é enviado ao front-end.

## Variáveis de ambiente da Vercel

Confira se estas variáveis continuam cadastradas em **Production** e, se usa Preview, também no Preview:

- Redis: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (ou os nomes compatíveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`).
- Sessão e segurança: `SESSION_SECRET`, `CRON_SECRET` e, recomendado, `BACKUP_ENCRYPTION_KEY`.
- Twitch: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI` e, para a presença no chat, `TWITCH_BROADCASTER_REFRESH` (ou a autorização salva pelo Diagnóstico DEV). `TWITCH_BROADCASTER_ID` e `TWITCH_BROADCASTER_LOGIN` são opcionais.
- Login Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e, caso use URL personalizada, `GOOGLE_REDIRECT_URI`.
- StreamElements: `STREAMELEMENTS_JWT` e, opcionalmente, `STREAMELEMENTS_CHANNEL_ID`.
- Músicas: `LASTFM_USER` e `LASTFM_API_KEY`. A integração pessoal do Spotify também pode usar `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` e `SPOTIFY_REFRESH_TOKEN`.
- Integrações do painel: `STEAM_API_KEY`, `TMDB_API_KEY` ou `TMDB_TOKEN`, `DISCORD_WEBHOOK_URL`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_ADMIN_IDS` e `GOOGLE_DEV_EMAILS`.
- Site: `SITE_URL`.

Use uma chave forte e estável em `BACKUP_ENCRYPTION_KEY`. Se ela não existir, o backup usa `SESSION_SECRET`. **Não troque essa chave sem guardar a antiga**: backups criptografados com uma chave não podem ser restaurados com outra.

## Login da Twitch

O endereço de retorno cadastrado em Twitch Developers precisa ser exatamente igual a `TWITCH_REDIRECT_URI`. Por padrão, o código usa `https://SEU-DOMINIO/api/twitch-callback`. Sem as credenciais corretas, o botão abre uma mensagem de configuração em vez de concluir o acesso.

## Cron de presença Twitch

Chamado por serviço externo (por exemplo, cron-job.org) a cada 5 minutos:

- URL: `https://SEU-DOMINIO/api/auth?action=cron-presenca`
- Método: `GET`
- Cabeçalho: `Authorization: Bearer SEU_CRON_SECRET`

Ele atualiza somente minutos assistidos e registra uma presença por live.

## Antes de publicar

1. Faça backup do Redis.
2. Confira as variáveis acima.
3. Em Preview, teste login Google/Twitch/e-mail, logout, troca de senha, perfil, voto antes e depois do encerramento, sugestões, tier list, ranking, doadores e painel admin.
4. Teste Voltar/Avançar e o hash manual em 1440px, 1024px e 390px.
5. Confira console sem erros, nenhum 404 em `img/` e o carregamento do player com `parent`.
6. Crie um backup novo e teste a restauração em outro ambiente antes de depender dele.

Não publique credenciais ou tokens dentro deste repositório.
