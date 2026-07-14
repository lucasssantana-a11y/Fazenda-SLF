# Release 0.2.0

Versao preparada para Git com foco em uso local seguro e evolucao do produto pecuario.

## Principais entregas

- Modulo Credito com simulacao de emprestimos e historico automatico.
- Central de Relatorios com visao executiva, acoes recomendadas e impressao/PDF.
- Diagnostico de modo local e caminho opcional para Postgres.
- OCR de notinhas por IA visual quando `OPENAI_API_KEY` estiver configurada, com fallback local.
- Brief de decisao por lote com regra deterministica e enriquecimento por OpenAI quando configurado.
- Validacao integrada por API em `verify_integrated.mjs`.

## Seguranca para repositorio

- `data/*.json`, `.env.local`, `outputs/` e `node_modules/` seguem fora do Git.
- Usuario inicial de bases novas deve ser configurado por variaveis `INITIAL_ADMIN_*`.
- O app pode seguir em modo local com `data/db.json` para uso individual e baixo volume.

## Validacao

- `node --check src/server.js`
- `node --check public/app.js`
- `TEST_EMAIL=... SKIP_UI_ON_BROWSER_FAILURE=1 node verify_integrated.mjs`
