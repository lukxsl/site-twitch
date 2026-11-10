# Checklist — ASEMTET0 Glass Arcade

Use esta lista no Preview da Vercel antes de promover a versão para produção.

## 1. Verificações locais já executadas

- [x] `node --check` em todos os arquivos JavaScript de `api/`, `public/js/` e `scripts/` (35 arquivos).
- [x] Parsing das 8 folhas CSS (`tinycss2`): nenhum erro de sintaxe.
- [x] `vercel.json` e arquivos JSON válidos.
- [x] HTML analisado: 316 IDs e nenhum ID duplicado.
- [x] Referências locais de CSS, scripts e imagens encontradas. `about:blank` do iframe é intencional.
- [x] Referências de fragmento `#id` encontradas no documento.
- [x] Servidor HTTP estático retornou `200` para Home, CSS de identidade, JavaScript Glass Effects, banner-detail, avatar e version.json.
- [x] ZIP criado e verificado com `unzip -t`.
- [x] Nenhum endpoint, integração ou folha CSS específica foi apagado.

## 2. Conferência visual no Preview

- [ ] Abrir em desktop largo (1440 px ou maior).
- [ ] Abrir em notebook (1280 px).
- [ ] Abrir em tablet (768–1024 px).
- [ ] Abrir em celular de 390 px.
- [ ] Abrir em celular estreito de 320–360 px.
- [ ] Confirmar que o título da Home não corta ascendentes/descendentes e não cria quebra estranha.
- [ ] Confirmar que o retrato, as duas etiquetas decorativas e os botões não se sobrepõem.
- [ ] Confirmar que estatísticas não cortam labels nem valores.
- [ ] Confirmar que o player mantém 16:9 e que o estado offline cabe no card.
- [ ] Confirmar que títulos das seções, Tier List, Comunidade, Perfil e Login não são cortados.
- [ ] Confirmar que nome/artista da música pode ser lido sem desaparecer.
- [ ] Confirmar que labels da navegação inferior não são abreviados indevidamente.
- [ ] Passar o mouse sobre cards e confirmar reflexo/tilt leves, sem tremulação.
- [ ] Usar a navegação por toque; nenhum tilt deve ser necessário para usar o site.
- [ ] Ativar `prefers-reduced-motion` e confirmar que os efeitos são reduzidos.
- [ ] Confirmar legibilidade dos painéis com blur e quando o navegador não suporta `backdrop-filter`.

## 3. Regressão funcional

- [ ] Navegar entre Início, Tier List, Ranking, Comunidade, Setup, Sugestões e Perfil.
- [ ] Abrir e fechar o menu mobile e testar a barra inferior.
- [ ] Entrar e sair da conta.
- [ ] Testar login por e-mail/senha, Google e Twitch.
- [ ] Testar formulário de sugestões, filtros e estados vazios.
- [ ] Testar votação, troca de voto, fechamento, reinício de ciclo e recompensa.
- [ ] Testar dados de XP, SosoCoins, nível e ranking.
- [ ] Testar Setup, tour, diálogo do Lukzin, som e easter egg.
- [ ] Testar player ao vivo, estado offline, VOD, clipes e música.
- [ ] Conferir painel administrativo com conta autorizada.

## 4. Testes com serviços reais (não executados neste ambiente)

- [ ] Preview conectado a um Redis/Upstash de teste.
- [ ] OAuth Google e Twitch com URLs de Preview e callbacks corretos.
- [ ] Refresh token Twitch sob duas chamadas simultâneas.
- [ ] Cron de presença e cron administrativo.
- [ ] Voto simultâneo, banimento durante voto e troca de ciclo.
- [ ] Falha de rede/timeout de Redis, Twitch, MidPix e webhook.
- [ ] Criar, baixar e restaurar backup somente em dados descartáveis.
- [ ] Confirmar variáveis de ambiente e secrets no projeto Vercel.

## 5. Publicação e rollback

- [ ] Salvar o ZIP anterior e manter a produção atual enquanto o Preview é revisado.
- [ ] Corrigir qualquer diferença visual encontrada em navegador real.
- [ ] Executar a regressão funcional completa.
- [ ] Promover o Preview somente após aprovação.
- [ ] Monitorar logs da Vercel, Redis e integrações após o deploy.
- [ ] Se houver regressão, reverter o commit/deploy para a versão anterior; não apagar dados nem limpar saldos manualmente.

## Limitação conhecida dos testes desta entrega

O Chromium headless disponível no ambiente não concluiu a captura da página e encerrou com erros de processo/serviço de sistema. Por isso a revisão visual final precisa ser feita no Preview, em um navegador normal. As verificações estáticas e os testes HTTP locais foram executados e estão marcados acima.
