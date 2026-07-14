# Publicação e uso no celular

O sistema é uma aplicação Node com interface PWA. Publicado com HTTPS, ele abre no navegador do celular e pode ser adicionado à tela inicial.

## Requisitos

- Hospedagem Node ou Docker.
- HTTPS ativo.
- Disco persistente montado no diretório `data/`, porque o banco atual fica em `data/db.json`.
- Porta pública apontando para `PORT`, por padrão `4173`.

## Segurança

O sistema exige login antes de liberar os módulos e APIs.

Em uma base nova, configure o usuário inicial no `.env.local`:

- `INITIAL_ADMIN_NAME`
- `INITIAL_ADMIN_EMAIL`
- `INITIAL_ADMIN_PASSWORD`

Se `data/db.json` já existir, o app mantém os usuários atuais. Troque qualquer senha inicial antes de uso real em produção.

## Publicação rápida com Docker

```bash
docker build -t fazenda-slf .
docker run -d \
  --name fazenda-slf \
  -p 4173:4173 \
  -v "$(pwd)/data:/app/data" \
  --env-file .env \
  fazenda-slf
```

Depois configure o domínio ou subdomínio com HTTPS apontando para a aplicação.

## Uso no celular

1. Abra a URL publicada no navegador.
2. Faça login.
3. No iPhone, toque em Compartilhar e depois em `Adicionar à Tela de Início`.
4. No Android, abra o menu do navegador e toque em `Adicionar à tela inicial` ou `Instalar app`.

## Módulos incluídos

- Visão geral.
- Rebanho.
- Custos e apropriação por lote.
- Pastos/piquetes.
- Mercado.
- Leilão.
- Empréstimos.
- Simular.
- IA, se `OPENAI_API_KEY` estiver configurada.
