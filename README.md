# Soso Arcade — Cantinho da asemtet0

Site em HTML, CSS e JavaScript simples (sem build), com APIs Node.js na Vercel e Redis/Upstash.

## Estrutura

- `index.html` — página única com todas as seções.
- `css/core.css` — tokens, reset, layout, navbar, rodapé e o grid do bento da Home.
- `css/components.css` — botões, cards, player, música, hall de doadores, votação, diálogos e toast.
- `css/pages.css` — Tier List, Ranking, Perfil da comunidade e modal de login.
- `css/setup.css` — mini-game do quarto (Lukzin, tour, gato, catálogo) e seus estilos.
- `css/admin.css` — painel administrativo (carregado sempre, usado só na aba Admin).
- `js/core.js` — helpers de DOM/formatação e o cliente HTTP `api()`.
- `js/auth-ui.js` — modal de login (e-mail, Google e Twitch) e a navbar da comunidade.
- `js/twitch.js` — status da live, player, banner, foco do jogo e clipes.
- `js/setup.js` — mini-game do setup + áudio do site.
- `js/main.js` — config, navegação, votação, hall, música, sugestões, Tier List e boot.
- `js/profile.js` e `js/ranking.js` — página de perfil e página de ranking.
- `js/admin/*` — carregados sob demanda quando a aba Admin abre.

## Mini-game do Setup

O quarto interativo, o Lukzin, o tour guiado, o easter egg do gato e o catálogo de peças
fazem parte do site (não são opcionais). Os sons só tocam depois do primeiro clique do
visitante e podem ser desligados no botão de mudo.

## Variáveis de ambiente da Vercel

Confira se estas variáveis continuam cadastradas no ambiente **Production** e, se usa Preview, também no Preview:

- Redis: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN` (ou os nomes compatíveis `KV_REST_API_URL` e `KV_REST_API_TOKEN`).
- Sessão e segurança: `SESSION_SECRET`, `CRON_SECRET` e, recomendado, `BACKUP_ENCRYPTION_KEY`.
- Twitch: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `TWITCH_REDIRECT_URI` e, para a presença no chat, `TWITCH_BROADCASTER_REFRESH` (ou a autorização salva pelo Diagnóstico DEV). `TWITCH_BROADCASTER_ID` e `TWITCH_BROADCASTER_LOGIN` são opcionais.
- Login Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e, caso use URL personalizada, `GOOGLE_REDIRECT_URI`.
- StreamElements: `STREAMELEMENTS_JWT` e, opcionalmente, `STREAMELEMENTS_CHANNEL_ID`.
- Músicas: `LASTFM_USER` e `LASTFM_API_KEY`. A integração pessoal do Spotify também pode usar `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` e `SPOTIFY_REFRESH_TOKEN`.
- Integrações já usadas pelo painel: `STEAM_API_KEY`, `TMDB_API_KEY` ou `TMDB_TOKEN`, `DISCORD_WEBHOOK_URL`, `DISCORD_ADMIN_IDS` e `GOOGLE_DEV_EMAILS`.
- Site: `SITE_URL`.

O login pelo Discord foi descontinuado. As variáveis `DISCORD_CLIENT_ID` e
`DISCORD_CLIENT_SECRET` podem ser removidas do painel da Vercel; `DISCORD_WEBHOOK_URL`
(avisos no servidor) e `DISCORD_ADMIN_IDS` (lista de administradores) continuam em uso.

Use uma chave forte e estável em `BACKUP_ENCRYPTION_KEY`. Se ela não existir, o backup usa `SESSION_SECRET`. **Não troque essa chave sem guardar a antiga**: backups criptografados com uma chave não podem ser restaurados com outra.

## Login da Twitch

O endereço de retorno cadastrado em Twitch Developers precisa ser exatamente igual a `TWITCH_REDIRECT_URI`. Por padrão, o código usa `https://SEU-DOMINIO/api/twitch-callback`. O login depende também de `TWITCH_CLIENT_ID` e `TWITCH_CLIENT_SECRET`; sem as credenciais corretas, o botão abre uma mensagem de configuração em vez de concluir o acesso.

## Cron de presença Twitch

O cron de presença é chamado por um serviço externo, como cron-job.org, a cada 5 minutos:

- URL: `https://SEU-DOMINIO/api/auth?action=cron-presenca`
- Método: `GET`
- Cabeçalho: `Authorization: Bearer SEU_CRON_SECRET`

Ele atualiza somente minutos assistidos e registra uma presença por live.

## Antes de publicar

1. Guarde o ZIP antigo e faça backup do Redis.
2. Confira as variáveis de ambiente listadas acima.
3. Em Preview, teste login Google/Twitch/e-mail, logout, troca de senha, perfil, voto antes e depois do encerramento, sugestões, tier list, ranking, doadores e painel administrativo.
4. Teste a contagem de presença com o cron externo e confirme que uma mesma pessoa não ganha duas presenças na mesma live.
5. Crie um backup novo e teste a restauração em outro banco/ambiente antes de depender dele.

Não publique credenciais ou tokens dentro deste repositório.
