# Odisse — API de propostas (Cloudflare Worker)

Guarda a numeração e o histórico de propostas no Workers KV (plano gratuito
da Cloudflare), para que a numeração seja compartilhada entre todo mundo que
usa a ferramenta, sem precisar de nenhum token no navegador.

## Deploy

Automático pelo GitHub Actions (`.github/workflows/worker.yml`) a cada mudança
em `worker/`, ou à mão em Actions → "Publicar API do vendas" → Run workflow.

Secrets necessários no repositório (Settings → Secrets and variables → Actions):

- `CLOUDFLARE_API_TOKEN`: token próprio deste repositório (modelo "Edit
  Cloudflare Workers"), separado dos tokens das outras ferramentas.
- `CLOUDFLARE_ACCOUNT_ID`: id da conta da Cloudflare.
- `VENDAS_SENHA`: a senha de acesso da ferramenta.

O workflow acha o namespace KV `ODISSE_KV` já existente pelo nome (nunca cria
um novo, para não esvaziar o histórico), grava a senha no Worker e publica.

## Conectar com a ferramenta

Copie a URL impressa no `deploy` e cole em `config.js` (na raiz do
repositório principal, não aqui), no campo `CONFIG.workerUrl`:

```js
const CONFIG = {
  ...
  workerUrl: 'https://odisse-orcamentos-api.SEU-USUARIO.workers.dev'
};
```

Pronto — a numeração automática e o histórico de propostas (`historico.html`)
passam a funcionar para todo mundo que acessar a ferramenta, sem precisar
configurar nada em cada navegador.

## Sem isso configurado

Se `workerUrl` ficar vazio, a ferramenta cai automaticamente para um
contador local (por navegador, não compartilhado) e a página de histórico
fica vazia — tudo continua funcionando, só sem o compartilhamento entre
pessoas.

## Custo

Gratuito para o volume de uso desta ferramenta. O plano gratuito do
Workers KV inclui 1 GB de armazenamento, 100 mil leituras/dia e 1.000
escritas/dia — muito acima do que um escritório de arquitetura gera de
orçamentos por dia.
