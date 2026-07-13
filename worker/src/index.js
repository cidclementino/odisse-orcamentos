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
// ==========================================================================

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

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

    try {
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
