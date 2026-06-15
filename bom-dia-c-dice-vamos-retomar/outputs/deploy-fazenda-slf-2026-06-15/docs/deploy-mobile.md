# Publicação e uso no celular

O sistema é uma aplicação Node com interface PWA. Publicado com HTTPS, ele abre no navegador do celular e pode ser adicionado à tela inicial.

## Requisitos

- Hospedagem Node ou Docker.
- HTTPS ativo.
- Disco persistente montado no diretório `data/`, porque o banco atual fica em `data/db.json`.
- Porta pública apontando para `PORT`, por padrão `4173`.

## Segurança

O sistema exige login antes de liberar os módulos e APIs.

Usuário inicial:

- E-mail: `lucas@fazendaslf.com`
- Senha inicial: `FazendaSLF@2026`

Troque essa senha no banco `data/db.json` antes de uso real em produção ou peça para gerar uma nova senha hash.

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
