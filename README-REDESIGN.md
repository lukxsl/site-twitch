# asemtet0 — Redesign editorial

Este pacote reúne o redesign visual do site da Soso. A implementação prioriza uma identidade editorial escura, tipografia forte, superfícies sólidas, linhas discretas e uma navegação lateral no desktop.

## Direção visual

- **Títulos:** Archivo.
- **Texto e interface:** DM Sans.
- **Metadados e etiquetas:** IBM Plex Mono.
- **Base:** preto carvão e superfícies grafite.
- **Identidade:** lavanda e violeta como acentos, sem depender de brilho ou gradientes luminosos.
- **Componentes:** cantos pequenos, bordas finas e sombras contidas.

Os tokens e os principais ajustes estão em `css/redesign.css`, carregado por último no `index.html` para centralizar a nova camada visual sem apagar as folhas específicas das páginas.

## Navegação

- **Desktop (acima de 1180 px):** navegação fixa no canto esquerdo.
- **Tablet (até 1180 px):** barra superior compacta, com menu expansível.
- **Celular (até 760 px):** barra inferior para as áreas principais e menu superior para as demais opções.
- No menu expansível, `Escape` fecha a navegação e devolve o foco ao botão.

## Home

A Home agora usa um masthead editorial com retrato e chamada textual, em vez do banner horizontal ocupando a abertura inteira. O banner original foi preservado em metadados de compartilhamento e na identidade visual do login.

Os cards da Home estão diretamente dentro da grade e seguem a ordem de leitura: transmissão, perfil, música, jogos, recado, apoiadores e assinatura. A grade é assimétrica no desktop e vira uma coluna no celular.

## Integrações e funcionalidades preservadas

O redesign é de apresentação e navegação. Os contratos de integração foram preservados, incluindo os identificadores usados pelos scripts de:

- autenticação por e-mail/senha, Google e Twitch;
- status, estatísticas e player da Twitch;
- música atual e histórico do Spotify;
- jogos, votação e resultados;
- apoiadores e meta do MidPix;
- navegação entre seções, comunidade, perfil, Setup e administração.

Os arquivos da pasta `api/` foram mantidos byte a byte iguais aos do projeto enviado. Não foram alteradas rotas, variáveis de ambiente, regras de autenticação, armazenamento ou contratos com serviços externos.

## Arquivos principais alterados

- `index.html` — fontes, estrutura do login, navegação, masthead e ordem semântica da Home.
- `css/redesign.css` — nova camada de identidade visual, sidebar, Home e refinamentos das páginas.
- `css/core.css` — tokens base e remoção do cenário virtual e dos antigos estilos de vidro do login.
- `css/components.css` — remoção de efeitos decorativos globais que deixaram de ser usados.
- `css/home.css` — limpeza de regras antigas do banner e de estilos responsivos obsoletos.
- `js/main.js` — remoção de tilt/parallax decorativos, sincronização de navegação e fechamento acessível do menu.
- `js/twitch.js` — remoção somente da atualização do banner que saiu da Home.

As folhas `pages.css`, `setup.css` e `admin.css` continuam separadas para preservar a organização e os comportamentos específicos de cada área. O Setup mantém sua camada lúdica por ser uma experiência interativa própria do site.

## Validações realizadas

- HTML analisado: IDs duplicados, IDs de integração e referências locais.
- CSS: parsing de todas as folhas sem erros de sintaxe.
- JavaScript: `node --check` em todos os arquivos JS.
- IDs usados por autenticação, Twitch, Spotify, votação e MidPix conferidos.
- Referências locais para imagens, scripts e folhas de estilo conferidas.
- Arquivos de API comparados com o ZIP original e confirmados sem alterações.

## Antes de publicar

Faça um preview no ambiente Vercel do projeto e valide as integrações com as credenciais reais da instalação. Em particular, teste login OAuth, player/status da Twitch, atualização do Spotify, votação e retorno do MidPix. Essas integrações dependem de serviços externos e credenciais que não podem ser simulados apenas pela validação estática local.
