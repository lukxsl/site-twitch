# ASEMTET0 — Glass Arcade

> **Nota (12/11/2026):** a camada *Glass Arcade* descrita abaixo foi removida do site. `public/css/identity.css` e `public/js/glass-effects.js` não existem mais; a base visual voltou para `core.css` + `components.css` + `pages.css` + `setup.css` + `admin.css` + `home.css` + `redesign.css`, e o topo da home foi redesenhado. Este documento fica como registro da rodada anterior.


## Direção visual

A identidade desta rodada recupera a estética de vidro do site antigo, com mais controle de contraste, profundidade e legibilidade.

- Fundo escuro em camadas com luz ambiente violeta, rosa e ciano.
- Cards translúcidos com `backdrop-filter`, borda iluminada, reflexo interno e sombras em camadas.
- Botões com gradiente, brilho discreto, estado pressionado e foco visível.
- Hover com elevação e inclinação muito leve em mouse/trackpad; sem tilt em toque ou quando `prefers-reduced-motion` está ativo.
- Home em formato de capa de transmissão, usando o retrato atual e um recorte decorativo do banner antigo sem o lettering embutido.
- Setup preserva sua estética pixel art própria.

## Paleta e fontes

- Fundo: `#0B0815` / `#110D1F`.
- Superfícies: violeta escuro translúcido.
- Roxo principal: `#9B6BFF`.
- Rosa: `#F07ACB`.
- Ciano: `#75D7F2`.
- Amarelo: `#FFD477`.
- Display: Bricolage Grotesque.
- Interface: Space Grotesk.
- Metadados: IBM Plex Mono.

## Mudanças visuais

- Vidro e iluminação restaurados em cards, painéis, navegação, login e barra inferior.
- Reflexo acompanha o ponteiro em dispositivos com mouse/trackpad.
- Home refinada com fundo ilustrado de baixa intensidade, moldura translúcida no retrato e etiquetas flutuantes.
- Títulos e labels principais receberam line-height mais generoso e permissão de quebra.
- Botões podem quebrar texto sem cortar a altura do rótulo.
- Música, status da Twitch, estatísticas e labels da navegação mobile podem ocupar mais de uma linha.
- Blur reduzido em telas pequenas para aliviar o custo de renderização.

## Arquivos desta rodada

- `public/css/identity.css`: recebeu no final a camada Glass Arcade, unificando a direção visual sem adicionar uma folha CSS extra.
- `public/js/glass-effects.js`: reflexo e tilt suave por ponteiro, com suporte a movimento reduzido e sem efeito em touch.
- `public/img/banner-detail.webp`: recorte decorativo otimizado do banner antigo, sem o texto incorporado.
- `public/index.html`: carrega o novo script e inclui duas etiquetas decorativas na Home; IDs e chamadas existentes foram preservados.

## Preservação

Nenhum endpoint, módulo de negócio, arquivo CSS especializado, integração, formulário, ID do DOM ou funcionalidade foi removido nesta rodada. As folhas existentes (`core.css`, `components.css`, `pages.css`, `setup.css`, `admin.css`, `home.css` e `redesign.css`) foram mantidas. A unificação visual foi feita na camada final `identity.css`, para evitar remover CSS que ainda possa sustentar componentes ou estados dinâmicos.
