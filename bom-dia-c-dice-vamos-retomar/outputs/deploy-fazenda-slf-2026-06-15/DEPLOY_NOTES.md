# Deploy Fazenda SLF

Esta pasta esta pronta para subir no GitHub.

Inclui:
- aplicacao web em `public/`
- servidor em `src/`
- `Dockerfile`, `package.json`, `README.md` e `docker-compose.yml`
- documentacao em `docs/`
- `data/.gitkeep` para manter a pasta de dados sem publicar o banco real

Nao inclui:
- `.env.local`
- `node_modules`
- `.git`
- `data/db.json`
- arquivos de `outputs/`

No Render, use:
- runtime: Docker ou Node
- start command, se usar Node: `npm start`
- variaveis de ambiente conforme `.env.example`
- disco persistente montado em `/app/data` se quiser manter o JSON entre deploys
