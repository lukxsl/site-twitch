# asemtet0 — Redesign editorial

> Atualização: a segunda camada visual e a revisão de copy/código de novembro de 2026 estão documentadas em `README-ENTREGA-2026.md`. A camada atualmente carregada por último é `public/css/identity.css`.

Este pacote reúne o redesign visual do site da Soso. A implementação prioriza uma identidade editorial escura, tipografia forte, superfícies sólidas, linhas discretas e uma navegação lateral no desktop.

## Direção visual

- **Títulos:** Instrument Serif.
- **Texto e interface:** DM Sans.
- **Metadados e etiquetas:** IBM Plex Mono.
- **Base:** carvão, superfícies grafite e texto marfim.
- **Identidade:** lavanda como acento e dourado quente nos detalhes; gradientes são usados apenas para profundidade e hierarquia, não como efeito decorativo em cada componente.
- **Componentes:** cantos pequenos, bordas finas e sombras contidas.

Os tokens e os principais ajustes da identidade atual estão em `public/css/identity.css`, carregado por último em `public/index.html`. `redesign.css` continua preservado como base anterior; `identity.css` centraliza a camada final sem apagar as folhas específicas das páginas.

## Navegação

- **Desktop (acima de 1180 px):** navegação fixa no canto esquerdo.
- **Tablet (até 1180 px):** barra superior compacta, com menu expansível.
- **Celular (até 760 px):** barra inferior para as áreas principais e menu superior para as demais opções.
- No menu expansível, `Escape` fecha a navegação e devolve o foco ao botão.

## Home

A Home agora usa um masthead editorial com retrato e chamada textual, em vez do banner horizontal ocupando a abertura inteira. O banner original foi preservado para metadados de compartilhamento; o login e o fallback usam o retrato vertical já otimizado (`img/avatar.webp`), sem o lettering antigo do banner.

Os cards da Home estão diretamente dentro da grade e seguem a ordem de leitura: transmissão, perfil, música, jogos, recado, apoiadores e assinatura. A grade é assimétrica no desktop e vira uma coluna no celular.

## Integrações e funcionalidades preservadas

O redesign é de apresentação e navegação. Os contratos de integração foram preservados, incluindo os identificadores usados pelos scripts de:

- autenticação por e-mail/senha, Google e Twitch;
- status, estatísticas e player da Twitch;
- música atual e histórico do Spotify;
- jogos, votação e resultados;
- apoiadores e meta do MidPix;
- navegação entre seções, comunidade, perfil, Setup e administração.

A camada visual preserva os identificadores e contratos usados pelas integrações. Em uma rodada técnica posterior, APIs e módulos internos receberam correções de segurança, consistência de economia, proteção de dados e backup. Consulte `README-AUDITORIA-TECNICA.md` para o inventário dessas alterações e para as limitações que ainda exigem validação no ambiente Vercel/Upstash real.

## Arquivos principais alterados

- `public/index.html` — fontes, estrutura do login, navegação, masthead e ordem semântica da Home.
- `public/css/redesign.css` — camada editorial anterior, mantida como base de compatibilidade.
- `public/css/identity.css` — camada visual atual, carregada por último e responsável pela identidade consolidada entre páginas.
- `public/css/core.css` — tokens base e remoção do cenário virtual e dos antigos estilos de vidro do login.
- `public/css/components.css` — remoção de efeitos decorativos globais que deixaram de ser usados.
- `public/css/home.css` — limpeza de regras antigas do banner e de estilos responsivos obsoletos.
- `public/js/main.js` — remoção de tilt/parallax decorativos, sincronização de navegação e fechamento acessível do menu.
- `public/js/twitch.js` — remoção somente da atualização do banner que saiu da Home.

As folhas `public/css/pages.css`, `public/css/setup.css` e `public/css/admin.css` continuam separadas para preservar a organização e os comportamentos específicos de cada área. O Setup mantém sua camada lúdica por ser uma experiência interativa própria do site.

## Validações realizadas

- HTML (`public/index.html`) analisado: IDs duplicados, IDs de integração e referências locais.
- CSS: parsing de todas as folhas em `public/css/` sem erros de sintaxe.
- JavaScript: `node --check` em todos os arquivos JS de `api/` e `public/js/`.
- IDs usados por autenticação, Twitch, Spotify, votação e MidPix conferidos.
- Referências locais para imagens, scripts e folhas de estilo conferidas.
- Funções de API revisadas e corrigidas; não foram removidos endpoints públicos do projeto.

## Antes de publicar

Faça um preview no ambiente Vercel do projeto e valide as integrações com as credenciais reais da instalação. Em particular, teste login OAuth, player/status da Twitch, atualização do Spotify, votação e retorno do MidPix. Essas integrações dependem de serviços externos e credenciais que não podem ser simulados apenas pela validação estática local.
