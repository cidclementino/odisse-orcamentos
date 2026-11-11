// ==========================================================================
// Odisse — Orçamentos: API de numeração e histórico de propostas
//
// Roda como um Cloudflare Worker, guardando tudo no Workers KV (plano
// gratuito: 1 GB de armazenamento, 100 mil leituras/dia, 1.000
// escritas/dia — muito acima do necessário aqui).
//
// Rotas:
//   POST /proximo-numero        → incrementa e devolve o próximo número
//   POST /salvar-proposta        → grava o snapshot completo de uma proposta
//   GET  /listar-propostas         → devolve o índice (número, data, cliente)
//   GET  /proposta?numero=PC001/2026  → devolve o snapshot completo de uma proposta
//   GET  /estado                → confere a senha (usado pela tela de login)
//   GET  /kv/estado             → { contador, total, encerrado } (para a migração ao Universo)
//   POST /kv/encerrar           → encerra a numeração antiga (depois da migração)
//   *    /u/v1/…                → repassado à API de dados do Universo (/api/v1/…), como ferramenta "vendas"
//
// Desde a migração ao Universo (passo 2, nov/2026), as propostas, oportunidades e contatos moram no
// banco D1 do Universo. O KV fica só como leitura do histórico antigo; depois de encerrado,
// /proximo-numero e /salvar-proposta recusam (410) para nenhuma página antiga numerar em paralelo.
//
// Todas as rotas exigem o cabeçalho `Authorization: Bearer <VENDAS_SENHA>`.
// VENDAS_SENHA é um secret do Worker, enviado pelo GitHub Actions a partir do
// secret do repositório (ver .github/workflows/worker.yml). Sem o secret
// configurado, o Worker recusa tudo (falha fechada).
// ==========================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Comparação em tempo constante (não revela, pelo tempo de resposta, quantos
// caracteres da senha estão certos).
function iguais(a, b) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let dif = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) dif |= (ea[i] || 0) ^ (eb[i] || 0);
  return dif === 0;
}

function autorizado(request, env) {
  if (!env.VENDAS_SENHA) return false;
  const cab = request.headers.get('Authorization') || '';
  return iguais(cab, `Bearer ${env.VENDAS_SENHA}`);
}

// Repassa /u/v1/… para o hub (service binding), sem a senha do vendas.
async function universo(request, env, url) {
  if (!env.UNIVERSO) return json({ erro: 'ligação com o Universo não configurada' }, 503);
  const destino = 'https://universo/api/v1/' + url.pathname.replace(/^\/u\/v1\/?/, '') + url.search;
  const cab = new Headers();
  for (const k of ['Content-Type', 'Content-Length']) if (request.headers.get(k)) cab.set(k, request.headers.get(k));
  const temCorpo = !['GET', 'HEAD'].includes(request.method);
  const res = await env.UNIVERSO.fetch(destino, { method: request.method, headers: cab, body: temCorpo ? request.body : undefined });
  const saida = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) saida.set(k, v);
  saida.set('Access-Control-Expose-Headers', 'Content-Type, Content-Length');
  return new Response(res.body, { status: res.status, headers: saida });
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    if (!env.VENDAS_SENHA) return json({ erro: 'senha do servidor não configurada' }, 503);
    if (!autorizado(request, env)) return json({ erro: 'senha incorreta' }, 401);

    try {
      if (url.pathname === '/estado' && request.method === 'GET') {
        return json({ ok: true });
      }

      if (url.pathname.startsWith('/u/v1')) return await universo(request, env, url);

      if (url.pathname === '/kv/estado' && request.method === 'GET') {
        const indice = JSON.parse((await env.ODISSE_KV.get('indice')) || '[]');
        return json({
          contador: parseInt((await env.ODISSE_KV.get('contador')) || '0', 10),
          total: indice.length,
          encerrado: (await env.ODISSE_KV.get('encerrado')) || null
        });
      }

      if (url.pathname === '/kv/encerrar' && request.method === 'POST') {
        await env.ODISSE_KV.put('encerrado', new Date().toISOString());
        return json({ ok: true });
      }

      const encerrado = await env.ODISSE_KV.get('encerrado');
      if (encerrado && ['/proximo-numero', '/salvar-proposta'].includes(url.pathname)) {
        return json({ erro: 'numeração antiga encerrada: as propostas agora são numeradas pelo Universo. Recarregue a página.' }, 410);
      }

      if (url.pathname === '/proximo-numero' && request.method === 'POST') {
        const ano = new Date().getFullYear();
        const atual = parseInt((await env.ODISSE_KV.get('contador')) || '0', 10);
        const novo = atual + 1;
        await env.ODISSE_KV.put('contador', String(novo));
        const numeroFormatado = `PC-${String(novo).padStart(4, '0')}-${ano}`;
        return json({ numero: novo, numeroFormatado });
      }

      if (url.pathname === '/salvar-proposta' && request.method === 'POST') {
        const body = await request.json();
        const { numeroFormatado, snapshot, resumo } = body;
        if (!numeroFormatado || !snapshot) return json({ erro: 'numeroFormatado e snapshot são obrigatórios' }, 400);

        await env.ODISSE_KV.put(`proposta:${numeroFormatado}`, JSON.stringify(snapshot));

        const indice = JSON.parse((await env.ODISSE_KV.get('indice')) || '[]');
        indice.unshift({
          numero: numeroFormatado,
          data: (resumo && resumo.data) || '',
          cliente: (resumo && resumo.cliente) || '',
          criado_em: new Date().toISOString()
        });
        await env.ODISSE_KV.put('indice', JSON.stringify(indice));

        return json({ ok: true });
      }

      if (url.pathname === '/listar-propostas' && request.method === 'GET') {
        const indice = JSON.parse((await env.ODISSE_KV.get('indice')) || '[]');
        return json({ propostas: indice });
      }

      if (url.pathname === '/proposta' && request.method === 'GET') {
        const numero = url.searchParams.get('numero');
        if (!numero) return json({ erro: 'parâmetro numero é obrigatório' }, 400);
        const snapshot = await env.ODISSE_KV.get(`proposta:${numero}`);
        if (!snapshot) return json({ erro: 'proposta não encontrada' }, 404);
        return json({ snapshot: JSON.parse(snapshot) });
      }

      return json({ erro: 'rota não encontrada' }, 404);
    } catch (e) {
      return json({ erro: String(e) }, 500);
    }
  }
};
