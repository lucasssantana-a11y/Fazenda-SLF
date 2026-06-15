# Arquitetura do Simulador Pecuário

## Camadas atuais

- `public/index.html`: estrutura da interface.
- `public/app.js`: estado de tela, CRUDs, dashboards, simulações e renderização dos relatórios.
- `public/styles.css`: design system visual do app.
- `src/server.js`: API local, persistência JSON, integrações externas, motor de simulação e inteligência.
- `data/db.json`: banco local atual.
- `db/schema.sql`: referência para migração futura ao Postgres.

## Núcleo de domínio

O motor econômico está concentrado na função `simulate()` em `src/server.js`.
Ela calcula:

- prazo até meta por GMD;
- consumo de proteinado e proteico energético;
- custo alimentar, operacional e terra própria;
- receita, lucro, margem, ROI e ponto de equilíbrio;
- comparação contra CDI;
- custo da arroba produzida e benchmark de mercado;
- decisão de compra ou venda.

## Próximos cortes recomendados

1. Extrair `simulate()` para `src/domain/simulation.js`.
2. Extrair cálculos zootécnicos para `src/domain/animalPerformance.js`.
3. Extrair custos/rateios para `src/domain/costAllocation.js`.
4. Isolar integrações externas em `src/integrations/`.
5. Trocar `data/db.json` por Postgres usando `db/schema.sql` como base.
6. Criar testes automatizados para compra, venda, terra própria, CDI e rateios.

## Regra de ouro

Interface pode mudar sem alterar regra de negócio. Toda regra crítica deve ficar no backend/API para manter histórico, auditoria e consistência.
