# Entrega — ASEMTET0 Glass Arcade (10 de novembro de 2026)

> **Nota (12/11/2026):** a camada *Glass Arcade* descrita abaixo foi removida do site. `public/css/identity.css` e `public/js/glass-effects.js` não existem mais; a base visual voltou para `core.css` + `components.css` + `pages.css` + `setup.css` + `admin.css` + `home.css` + `redesign.css`, e o topo da home foi redesenhado. Este documento fica como registro da rodada anterior.


## Objetivo

Recuperar o visual de vidro e interatividade que o usuário gostava na versão anterior, mantendo a estrutura e as correções técnicas do projeto mais recente. Esta rodada não tenta deixar o site minimalista: busca profundidade, cor, luz e microinterações, sem sacrificar leitura e acessibilidade.

## O que foi feito

### Identidade visual

- Direção **Glass Arcade**: fundo escuro em camadas, luz ambiente violeta/rosa/ciano, superfícies translúcidas, bordas iluminadas, blur e sombras em camadas.
- Cards e painéis com reflexo em gradiente e sensação de profundidade.
- Botões com gradiente, brilho controlado, hover elevado e estado pressionado.
- Navegação, painel administrativo, login e barra inferior alinhados à mesma linguagem visual.
- Bricolage Grotesque nos títulos, Space Grotesk na interface e IBM Plex Mono nos metadados.
- O Setup mantém sua linguagem pixel art, em vez de ser forçado a parecer um card padrão.

### Home

- Hero em composição de capa de transmissão, com retrato real, plano de fundo ilustrado sutil e etiquetas de vidro.
- A faixa ilustrada foi recortada do banner original para remover as palavras antigas incorporadas e exportada em WebP de 19 KB.
- Mantidos os IDs, botões, destinos e dados dinâmicos existentes.
- Estatísticas e conteúdo do hero adaptam-se a telas estreitas.

### Correções de corte de texto

- Título principal: `line-height` aumentado, padding de segurança, largura ajustada e overflow visível.
- Cabeçalhos de seção, Comunidade, Tier List, Perfil e Login: alturas de linha maiores e quebra responsiva.
- Botões: altura mínima, line-height e quebra permitida para não cortar rótulos.
- Estatísticas: labels podem quebrar; separadores decorativos foram removidos quando não ajudam.
- Música e status da Twitch: nomes podem ocupar mais de uma linha.
- Navegação inferior: labels não usam reticências como padrão.
- Permanecem recortes intencionais para imagens, barras de progresso, thumbnails e superfícies que precisam mascarar seus fundos.

### Interação e acessibilidade

- Novo `public/js/glass-effects.js`: o reflexo acompanha mouse/trackpad e aplica inclinação muito leve em cards.
- Efeito desativado em touch, viewport mobile e `prefers-reduced-motion`.
- Blur reduzido em telas pequenas.
- Fallback de fundo sólido caso `backdrop-filter` não seja suportado.
- Foco e contraste existentes foram preservados; não foi alterada a CSP.

## Arquivos alterados/adicionados

- Alterado: `public/index.html`.
- Alterado: `public/css/identity.css` (nova camada Glass Arcade incorporada ao fim do arquivo para evitar uma folha separada).
- Adicionado: `public/js/glass-effects.js`.
- Adicionado: `public/img/banner-detail.webp`.
- Atualizado: `README-REDESIGN.md`.
- Adicionado: `CHECKLIST-PREVIEW-E-PUBLICACAO.md`.

As outras folhas CSS e os arquivos de API/frontend existentes foram preservados. Nenhum endpoint, integração ou funcionalidade foi removido. Não foram alteradas regras de XP, SosoCoins, autenticação, votação, backup ou dados persistidos nesta rodada.

## Verificações realizadas

- `node --check` em 35 arquivos JavaScript de API, frontend e scripts: aprovado.
- Parsing de 8 folhas CSS: zero erros.
- `vercel.json` e JSONs: válidos.
- HTML: 316 IDs, sem duplicações.
- Referências locais de recursos: nenhuma ausente (o iframe `about:blank` é intencional).
- Referências internas `#id`: nenhuma ausente.
- Servidor estático: HTTP 200 em Home, CSS de identidade, JS do efeito, imagem decorativa, avatar e version.json.
- ZIP: integridade verificada com `unzip -t`.

## O que não foi possível testar

- Captura visual com Chromium headless: o navegador não concluiu a captura e encerrou com erros de processo/serviço do ambiente. Não afirmo que vi a renderização em navegador real.
- OAuth, APIs externas, Redis/Upstash, cron, webhooks, concorrência e restauração real: não há credenciais de teste disponíveis.
- Acessibilidade visual completa e cortes em todos os tamanhos: precisam da conferência do Preview em navegador normal; o checklist separa esses testes.

## Como validar

1. Subir este ZIP em um Preview separado na Vercel.
2. Seguir `CHECKLIST-PREVIEW-E-PUBLICACAO.md`.
3. Corrigir qualquer sobreposição ou recorte encontrado em Chrome/Safari mobile.
4. Testar integrações e ações sensíveis com dados descartáveis.
5. Promover para produção somente depois da aprovação.

## Rollback

Nenhum arquivo de funcionalidade foi apagado. Para reverter esta rodada, restaure `public/index.html` e `public/css/identity.css` da versão anterior e remova `public/js/glass-effects.js` e `public/img/banner-detail.webp`, ou reverta o commit inteiro. Mantenha o ZIP anterior e os dados persistidos intactos.
