// ==========================================================================
// Comercial — liga o orçamento ao Universo: cliente (contato), oportunidade,
// proposta numerada e PDF congelado. Usado pelo orçamento (steps.js), pelo
// histórico, pelo funil (crm.html) e pela migração das propostas antigas.
//
// Regras:
//   - O endereço da etapa 1 é do IMÓVEL, não do cliente: fica no retrato do
//     cálculo da proposta (e, mais tarde, no local do projeto), nunca nos
//     dados pessoais. Só o CPF vai para os dados sensíveis da pessoa.
//   - O PDF que o cliente recebe é guardado no Universo no momento em que é
//     gerado ("congelado"). Depois disso, valores e cálculo da proposta não
//     mudam mais; para mudar, cria-se uma revisão (PC-0007-2026-R1).
// ==========================================================================

const ETAPAS_FUNIL = [
  { id: 'lead', nome: 'Lead' },
  { id: 'contato', nome: 'Contato' },
  { id: 'briefing', nome: 'Briefing' },
  { id: 'proposta', nome: 'Proposta' },
  { id: 'negociacao', nome: 'Negociação' },
  { id: 'ganha', nome: 'Ganha' },
  { id: 'perdida', nome: 'Perdida' }
];
const ORIGENS = [
  { id: 'indicacao', nome: 'Indicação' },
  { id: 'instagram', nome: 'Instagram' },
  { id: 'site', nome: 'Site' },
  { id: 'landing_page', nome: 'Landing page' },
  { id: 'herma', nome: 'Herma' },
  { id: 'radar', nome: 'Radar' },
  { id: 'outro', nome: 'Outro' }
];
const NUCLEOS = [
  { id: 'arquitetos', nome: 'Arquitetos' },
  { id: 'estudio', nome: 'Estúdio' },
  { id: 'objetos', nome: 'Objetos' },
  { id: 'elaia', nome: 'Elaia' }
];
const SITUACOES_PROPOSTA = [
  { id: 'rascunho', nome: 'Rascunho' },
  { id: 'enviada', nome: 'Enviada' },
  { id: 'aceita', nome: 'Aceita' },
  { id: 'recusada', nome: 'Recusada' },
  { id: 'expirada', nome: 'Expirada' },
  { id: 'substituida', nome: 'Substituída' }
];
const ORDEM_FUNIL = Object.fromEntries(ETAPAS_FUNIL.map((e, i) => [e.id, i]));
const nomeDe = (lista, id) => (lista.find((x) => x.id === id) || {}).nome || id || '—';

const Comercial = (() => {
  const digitos = (s) => String(s || '').replace(/\D/g, '');
  const fmtCpf = (d) => d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : d;
  const fmtCnpj = (d) => d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : d;
  const fmtTel = (d) => {
    const n = String(d || '').replace(/^55(?=\d{10,11}$)/, '');
    if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
    if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
    return n;
  };

  // "João Pessoa – PB", "João Pessoa/PB", "João Pessoa - PB" → { cidade, uf }
  function separarCidadeUf(s) {
    const m = String(s || '').trim().match(/^(.*?)\s*[–\-\/,]\s*([A-Za-z]{2})$/);
    if (m) return { cidade: m[1].trim() || null, uf: m[2].toUpperCase() };
    return { cidade: String(s || '').trim() || null, uf: null };
  }

  // Campos opcionais que, se vierem inválidos (telefone incompleto, e-mail torto),
  // são deixados de fora em vez de impedir o cadastro. Rótulo (da API) → campo.
  const ROTULOS = { 'E-mail': 'email', 'Telefone': 'telefone', 'WhatsApp': 'whatsapp', 'CNPJ': 'cnpj', 'UF': 'uf', 'CPF': 'cpf', 'Instagram': 'instagram' };

  // Cria tirando os campos opcionais recusados pela validação; devolve { registro, deixados }.
  async function criarTolerante(rota, corpo) {
    const deixados = [];
    let tentativa = { ...corpo };
    for (let i = 0; i < 4; i++) {
      try {
        return { registro: await Universo.criar(rota, tentativa), deixados };
      } catch (e) {
        if (e.status !== 422 || !e.dados.erros) throw e;
        const tirar = e.dados.erros.map((m) => ROTULOS[m.split(':')[0]]).filter((k) => k && tentativa[k]);
        if (!tirar.length) throw e;
        for (const k of tirar) { deixados.push(`${k}: ${tentativa[k]}`); delete tentativa[k]; }
        if (rota !== 'pessoas-sensiveis') {
          tentativa.observacoes = [tentativa.observacoes, `Dados não aceitos no cadastro automático: ${deixados.join('; ')}`].filter(Boolean).join('\n');
        }
      }
    }
    throw new Error('não consegui cadastrar o contato');
  }

  // Cria um contato tratando duplicados. `perguntar`: mostra confirm() na tela;
  // sem isso (migração), usa o cadastro existente que bate.
  async function criarContato(rota, corpo, { perguntar = true } = {}) {
    try {
      return (await criarTolerante(rota, corpo)).registro;
    } catch (e) {
      if (e.status !== 409 || e.dados.erro !== 'possivel_duplicado') throw e;
      const c = e.dados.candidatos[0];
      const bate = Object.entries(c.campos).filter(([, v]) => v === 'bate').map(([k]) => k).join(', ');
      const usar = !perguntar || confirm(
        `Já existe no Universo um cadastro parecido: "${c.registro.nome}" (mesmo ${bate}).\n\n` +
        `OK = usar esse cadastro\nCancelar = criar um cadastro novo`
      );
      if (usar) return c.registro;
      return (await criarTolerante(rota, { ...corpo, confirmar_novo: true })).registro;
    }
  }

  // Garante o cliente do orçamento no Universo e devolve o id (pes_… ou org_…).
  async function garantirCliente(cliente, { clienteId = null, perguntar = true } = {}) {
    const pj = cliente.representacao === 'PJ';
    let id = clienteId;
    if (!id) {
      if (pj) {
        const { cidade, uf } = separarCidadeUf(cliente.cidadeUf);
        const reg = await criarContato('organizacoes', {
          nome: cliente.nome, cnpj: digitos(cliente.documento) || null, email: cliente.email || null,
          telefone: cliente.telefone || null, cidade, uf
        }, { perguntar });
        id = reg.id;
      } else {
        const reg = await criarContato('pessoas', {
          nome: cliente.nome, email: cliente.email || null,
          telefone: cliente.telefone || null, whatsapp: cliente.telefone || null
        }, { perguntar });
        id = reg.id;
      }
    }
    // CPF da pessoa física: só preenche se ainda não houver (nunca sobrescreve)
    const cpf = digitos(cliente.documento);
    if (id.startsWith('pes_') && !pj && cpf.length === 11) {
      const sens = await Universo.talvez('pessoas-sensiveis', id);
      if (!sens) await criarTolerante('pessoas-sensiveis', { id, cpf });
      else if (!sens.cpf) await Universo.alterar('pessoas-sensiveis', id, { versao: sens.versao, cpf });
    }
    return id;
  }

  // Oportunidade da proposta: usa a ligada ao orçamento (avançando para "proposta" se ainda
  // estiver antes) ou cria uma nova já na etapa "proposta".
  async function garantirOportunidade({ oportunidadeId, clienteId, titulo }) {
    if (oportunidadeId) {
      const o = await Universo.ler('oportunidades', oportunidadeId);
      if (ORDEM_FUNIL[o.etapa_funil] < ORDEM_FUNIL.proposta) {
        await Universo.alterar('oportunidades', o.id, { versao: o.versao, etapa_funil: 'proposta' });
      }
      return o.id;
    }
    const o = await Universo.criar('oportunidades', {
      titulo, cliente_id: clienteId, contato_pessoa_id: clienteId.startsWith('pes_') ? clienteId : null,
      nucleo_id: 'arquitetos', etapa_funil: 'proposta'
    });
    return o.id;
  }

  function nomeServico(state, data) {
    const s = (data.servicosOdisse || []).find((x) => x.id === state.servicoId);
    return s ? s.nome : 'Proposta';
  }

  // O que foi usado no cálculo: CUB (região e competência) e a impressão digital de cada
  // tabela de data/ — se uma tabela mudar depois, dá para saber que esta proposta usou a anterior.
  function referencias(state, data) {
    const regiao = data.cub && data.cub.regioes && data.cub.regioes[data.cub.regiao_ativa];
    return {
      ferramenta: 'vendas.odisse',
      cub: regiao ? { regiao: data.cub.regiao_ativa, fonte: regiao.fonte || null, competencia: regiao.competencia_referencia || null } : null,
      tabelas: (typeof OdisseData !== 'undefined' && OdisseData.impressoes) ? OdisseData.impressoes() : null,
      gerada_em: new Date().toISOString()
    };
  }

  // Retrato do estado do orçamento (o que remonta a proposta). Tira o que é só da tela.
  function retrato(state) {
    const r = JSON.parse(JSON.stringify(state));
    delete r._maxUnlocked;
    delete r.numeroPropostaStatus;
    return r;
  }

  // Finalizar: cliente → oportunidade → proposta numerada. Devolve a proposta.
  async function registrarProposta(state, data) {
    const clienteId = await garantirCliente(state.cliente, { clienteId: state._clienteId });
    state._clienteId = clienteId;
    const servico = nomeServico(state, data);
    const oportunidadeId = await garantirOportunidade({
      oportunidadeId: state._oportunidadeId, clienteId, titulo: `${servico} — ${state.cliente.nome}`
    });
    state._oportunidadeId = oportunidadeId;
    const r = state._calcResult;
    const corpo = {
      oportunidade_id: oportunidadeId,
      titulo: servico,
      data: state.dataProposta || null,
      valor_total: r ? centavos(r.valorFinal) : null,
      calculo: retrato(state),
      referencias: referencias(state, data)
    };
    if (state._revisaoDe) corpo.revisao_de = state._revisaoDe;
    return await Universo.criar('propostas', corpo);
  }

  // Guarda o PDF que vai para o cliente e congela a proposta.
  async function congelarPdf(propostaId, blob, nomeArquivo, legenda = null) {
    const arq = await Universo.enviarArquivo(blob, {
      dono_id: propostaId, nome_original: nomeArquivo, categoria: 'pdf_proposta', legenda
    });
    const p = await Universo.ler('propostas', propostaId);
    return await Universo.alterar('propostas', propostaId, { versao: p.versao, arquivo_pdf_id: arq.id });
  }

  // Baixa o PDF de uma proposta: o congelado, se houver; senão remonta a partir do cálculo.
  async function baixarPdf(proposta, data) {
    if (proposta.arquivo_pdf_id) {
      const blob = await Universo.baixarArquivo(proposta.arquivo_pdf_id);
      baixarBlob(blob, `${proposta.codigo}.pdf`);
      return 'congelado';
    }
    const estado = typeof proposta.calculo === 'string' ? JSON.parse(proposta.calculo) : proposta.calculo;
    if (!estado) throw new Error('esta proposta não tem os dados do cálculo');
    estado.numeroProposta = proposta.codigo;
    const { doc, nomeArquivo } = OdissePdf.montar(estado, data);
    doc.save(nomeArquivo);
    return 'remontado';
  }

  // Abre uma proposta no orçamento como revisão (mesmo número, R+1) ou como nova proposta
  // da mesma oportunidade. Grava o rascunho e vai para index.html.
  function abrirNoOrcamento(proposta, { comoRevisao = true } = {}) {
    const estado = typeof proposta.calculo === 'string' ? JSON.parse(proposta.calculo) : proposta.calculo;
    if (!estado) { alert('Esta proposta não tem os dados do cálculo para reabrir.'); return; }
    estado.numeroProposta = '';
    estado.numeroPropostaStatus = '';
    estado._propostaId = null;
    estado._pdfCongelado = false;
    estado._oportunidadeId = proposta.oportunidade_id;
    estado._revisaoDe = comoRevisao ? proposta.id : null;
    estado._revisaoDeCodigo = comoRevisao ? proposta.codigo : null;
    estado.dataProposta = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    estado._maxUnlocked = 6;
    localStorage.setItem('odisse-orcamento-rascunho', JSON.stringify({ state: estado, currentStepIndex: 0 }));
    window.location.href = 'index.html';
  }

  // Novo orçamento já ligado a uma oportunidade (vindo do funil).
  async function novoOrcamentoDaOportunidade(oportunidade) {
    const cliente = { nome: '', email: '', telefone: '', representacao: 'PF', documento: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidadeUf: '' };
    if (oportunidade.cliente_id) {
      const tabela = oportunidade.cliente_id.startsWith('org_') ? 'organizacoes' : 'pessoas';
      const c = await Universo.ler(tabela, oportunidade.cliente_id);
      Object.assign(cliente, { nome: c.nome || '', email: c.email || '', telefone: fmtTel(c.telefone || c.whatsapp) });
      if (tabela === 'organizacoes') {
        cliente.representacao = 'PJ';
        if (c.cnpj) cliente.documento = fmtCnpj(c.cnpj);
      } else {
        const s = await Universo.talvez('pessoas-sensiveis', c.id);
        if (s && s.cpf) cliente.documento = fmtCpf(s.cpf);
      }
    }
    localStorage.setItem('odisse-orcamento-rascunho', JSON.stringify({
      state: { cliente, _oportunidadeId: oportunidade.id, _clienteId: oportunidade.cliente_id || null, _maxUnlocked: 0 },
      currentStepIndex: 0
    }));
    window.location.href = 'index.html';
  }

  return {
    fmtTel, fmtCpf, fmtCnpj, separarCidadeUf, criarContato, criarTolerante, garantirCliente, garantirOportunidade, nomeServico,
    referencias, retrato, registrarProposta, congelarPdf, baixarPdf, abrirNoOrcamento, novoOrcamentoDaOportunidade
  };
})();
