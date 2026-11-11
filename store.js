// ==========================================================================
// Numeração automática + histórico de propostas, via o Worker do Cloudflare
// (ver worker/README.md). Sem CONFIG.workerUrl configurado, cai para um
// contador local — funciona, mas não compartilhado entre navegadores.
// ==========================================================================

const OdisseStore = (() => {
  function temWorker() {
    return !!(CONFIG.workerUrl && CONFIG.workerUrl.trim());
  }

  // fetch ao Worker com a senha; se ela for recusada, volta ao login.
  async function chamar(caminho, opcoes = {}) {
    const res = await fetch(`${CONFIG.workerUrl}${caminho}`, { ...opcoes, headers: cabecalhosAuth(opcoes.headers) });
    if (res.status === 401) {
      senhaRecusada();
      throw new Error('senha recusada');
    }
    return res;
  }

  async function proximoNumero() {
    const ano = new Date().getFullYear();

    if (temWorker()) {
      try {
        const controlador = new AbortController();
        const timeout = setTimeout(() => controlador.abort(), 8000);
        const res = await chamar('/proximo-numero', { method: 'POST', signal: controlador.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`API respondeu ${res.status}`);
        const dados = await res.json();
        return { ...dados, fonte: 'worker' };
      } catch (e) {
        console.error('Falha ao numerar via Worker, caindo para contador local:', e);
        return numeroLocal(ano, `Não consegui falar com a API (${e.message}) — número gerado localmente.`);
      }
    }
    return numeroLocal(ano, 'Nenhum Worker configurado — número gerado localmente (não aparece no histórico compartilhado).');
  }

  function numeroLocal(ano, aviso) {
    const chave = 'odisse-contador-local';
    const ultimo = parseInt(localStorage.getItem(chave) || '0', 10);
    const novo = ultimo + 1;
    localStorage.setItem(chave, String(novo));
    return { numero: novo, numeroFormatado: `PC-${String(novo).padStart(4, '0')}-${ano}`, fonte: 'local', aviso };
  }

  // Salva o snapshot completo da proposta — só funciona com o Worker configurado.
  async function salvarRegistro(numeroFormatado, snapshot) {
    if (!temWorker()) return { ok: false, motivo: 'sem-worker' };
    try {
      const resumo = { data: snapshot.dataProposta, cliente: snapshot.cliente.nome };
      const res = await chamar('/salvar-proposta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numeroFormatado, snapshot, resumo })
      });
      if (!res.ok) throw new Error(`API respondeu ${res.status}`);
      return { ok: true };
    } catch (e) {
      console.error('Falha ao salvar o registro da proposta:', e);
      return { ok: false, motivo: e.message };
    }
  }

  async function listarPropostas() {
    if (!temWorker()) return { propostas: [], semWorker: true };
    const res = await chamar('/listar-propostas');
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    return await res.json();
  }

  async function buscarProposta(numero) {
    const res = await chamar(`/proposta?numero=${encodeURIComponent(numero)}`);
    if (!res.ok) throw new Error(`API respondeu ${res.status}`);
    const dados = await res.json();
    return dados.snapshot;
  }

  return { proximoNumero, salvarRegistro, listarPropostas, buscarProposta, temWorker };
})();
