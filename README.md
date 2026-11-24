# Odisse — vendas (servidor)

**As telas do vendas moram no Universo desde 24/11/2026: https://universo.odisse.com.br/vendas/**
(repositório `universo-odisse`, pasta `vendas/`; login único com a senha da equipe; menu lateral da `base/v2`).

Este repositório ficou com:

- `worker/` — a API do vendas (Cloudflare Worker `odisse-orcamentos-api`), publicada pelo workflow *Publicar API do vendas*
  a cada mudança em `worker/`. Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `VENDAS_SENHA` (a mesma senha do Universo).
- `vendas.odisse.com.br` (GitHub Pages + `CNAME`) — só redireciona cada página antiga para o mesmo lugar em
  `universo.odisse.com.br/vendas/`; `sw.js` desliga o service worker antigo e apaga o cache nos navegadores que o tinham.

A lógica de preço (`PRICING.md`), os dados (`data/`), a rotina do CUB e a conferência de versões foram junto para
`universo-odisse/vendas/`. Ver `worker/README.md` para a API.
