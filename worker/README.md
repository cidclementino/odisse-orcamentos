# Odisse — API de propostas (Cloudflare Worker)

Guarda a numeração e o histórico de propostas no Workers KV (plano gratuito
da Cloudflare), para que a numeração seja compartilhada entre todo mundo que
usa a ferramenta, sem precisar de nenhum token no navegador.

## Deploy (uma vez só)

Precisa do Node instalado. Rode estes comandos dentro desta pasta (`worker/`):

```bash
npm install -g wrangler
wrangler login                     # abre o navegador para autorizar

wrangler kv namespace create ODISSE_KV
# ⬆ isto imprime algo como:
#   { binding = "ODISSE_KV", id = "abcd1234..." }
# Copie o "id" e cole em wrangler.toml, no lugar de SEU_NAMESPACE_ID_AQUI

wrangler deploy
# ⬆ isto imprime a URL do Worker, algo como:
#   https://odisse-orcamentos-api.SEU-USUARIO.workers.dev
```

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
