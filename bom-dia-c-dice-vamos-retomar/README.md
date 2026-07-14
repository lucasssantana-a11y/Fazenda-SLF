# Simulador Pecuário API-first

MVP inicial de um sistema para gestão de recria/engorda, com interface web e API JSON.

## O que já existe

- Cadastro de lotes.
- Cadastro de animais individuais vinculados a lotes.
- Lançamento de despesas com vínculo a lote e foto da notinha.
- Cadastro de pastagens.
- Registro de entrada/saída de lotes em pastos.
- Cadastro de suplementos e custo por kg.
- Cotação manual da arroba.
- Importação da cotação atual CEPEA/ESALQ, quando houver acesso de rede.
- Série histórica anual nominal de R$/@ desde 1998 para estudo inicial de ciclo.
- Módulo Leilão para comparar dois lotes por peso, preço da arroba, custo até a meta, margem e ROI.
- Módulo Empréstimos para avaliar compra financiada, juros, parcela, capital próprio, lucro após dívida e CDI.
- Histórico automático de comparações de leilão, simulações de venda e cenários de crédito.
- Central de Relatórios com visão executiva, ações recomendadas e diagnóstico de prontidão para Postgres.
- OCR de notinhas por IA visual quando `OPENAI_API_KEY` estiver configurada, com fallback local para triagem.
- Brief de decisão por lote, usando regra determinística e enriquecimento OpenAI quando houver chave.
- Motor de simulação de viabilidade:
  - peso vivo atual e alvo;
  - kg a ganhar;
  - dias até venda por GMD;
  - consumo de Fortis e Comigo;
  - custo diário, mensal e acumulado;
  - receita, lucro, margem, ROI e ROI mensal;
  - risco por prazo até venda.
  - comparação venda agora versus venda futura de curto prazo.
  - decisão obrigatória: vender agora ou segurar por prazo definido.
  - leitura do ciclo pecuário na recomendação.

## Como rodar

```bash
npm run dev
```

Depois abra:

```text
http://localhost:4173
```

Neste ambiente eu rodei com o Node bundled do Codex:

```bash
/Users/lucassantana/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node src/server.js
```

## Publicação e celular

O sistema agora está preparado como PWA para uso no celular. Com HTTPS, ele pode ser aberto pelo navegador e instalado na tela inicial do iPhone ou Android.

Arquivos de publicação:

- `Dockerfile`
- `.env.example`
- `public/manifest.webmanifest`
- `public/service-worker.js`
- `docs/deploy-mobile.md`

O acesso aos módulos exige login. Em uma base nova, o usuário inicial vem de `.env.local`:

- `INITIAL_ADMIN_NAME`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`

Se `data/db.json` já existir, o app preserva os usuários do banco atual. Antes de publicar para uso real, troque a senha inicial e mantenha o diretório `data/` em disco persistente, porque o banco atual fica em `data/db.json`.

## Jornada da interface

- Visão geral: KPIs, fluxo de trabalho e atalhos para as decisões.
- Rebanho: cadastro de lotes e animais individuais.
- Custos: lançamento de despesas, fotos de notinhas e suplementos.
- Pastos: cadastro de pastagens e movimentação de entrada/saída.
- Mercado: cotações e insumos monitorados.
- Leilão: comparação rápida de dois lotes usando o mesmo motor econômico da simulação.
- Empréstimos: viabilidade de tomar dinheiro no banco para comprar animais.
- Relatórios: KPIs executivos, decisões recentes, ações recomendadas e prontidão para banco real.
- Simular: hipótese de venda com GMD, meta, preço da arroba, suplementação e resultado.
- IA: ranking de lotes, brief de decisão e recursos OpenAI para OCR/pesagem quando configurados.

## API principal

- `GET /api/db`
- `GET /api/lots`
- `POST /api/lots`
- `GET /api/animals`
- `POST /api/animals`
- `GET /api/expenses`
- `POST /api/expenses`
- `GET /api/pastures`
- `POST /api/pastures`
- `GET /api/pastureMovements`
- `POST /api/pastureMovements`
- `GET /api/supplements`
- `POST /api/supplements`
- `GET /api/marketQuotes`
- `POST /api/marketQuotes`
- `GET /api/marketHistory`
- `POST /api/marketHistory`
- `POST /api/market/cepea-latest`
- `POST /api/auction/compare`
- `POST /api/loans/simulate`
- `GET /api/reports/executive`
- `GET /api/admin/db-readiness`
- `POST /api/ocr/receipt`
- `POST /api/ai/decision-brief`
- `POST /api/simulate`
- `POST /api/ai/hypothesis`
- `GET /api/intelligence/insights`

## Fontes de mercado

- Cotação atual: página pública do Indicador do Boi Gordo CEPEA/ESALQ.
- Série histórica anual inicial: compilação pública nominal baseada em CEPEA/Farmnews, carregada para análise exploratória de ciclo. Antes de decisões comerciais, substituir ou reconciliar com a série oficial completa exportada do CEPEA.

## Inteligência de ciclo pecuário

O motor considera o modelo operacional:

- Alta: retenção de fêmeas, menor oferta e preço em alta.
- Expansão: aumento de produção.
- Baixa: excesso de oferta e preço pressionado.
- Descarte: redução de rebanho e preparação de nova alta.

Regras implementadas:

- Bezerro sobe antes do boi gordo.
- Margem aperta no início da alta.
- Melhor fase para engorda: meio da alta.
- Pior fase: reposição cara com arroba ainda baixa.
- Cenário-base atual: transição de baixa para alta, reposição cara, arroba em alta gradual e margem curta.
- A recomendação nunca deve ser neutra: o sistema escolhe vender agora ou segurar por prazo curto.
- O módulo de inteligência não é cadastro manual de risco; ele consolida sinais de ciclo, mercado, CDI/IPCA, fechamento mensal e fontes futuras para gerar insights acionáveis.

## Próximos módulos naturais

- Banco real: PostgreSQL ou SQLite com Prisma/Drizzle.
- Autenticação e fazendas por usuário.
- Upload real de imagens em storage.
- OCR das notinhas.
- Integração com APIs de cotação da arroba.
- Integração com APIs ou scraping controlado de suplementos.
- Motor IA com OpenAI/Gemini para explicar cenários, validar hipóteses e sugerir pontos de venda.
- App mobile ou PWA para uso no curral/campo.
