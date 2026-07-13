// ==========================================================================
// Definição das etapas do formulário. Cada etapa expõe:
//   render(state, data)              -> string HTML
//   bind(container, state, data, ctx) -> liga os eventos daquele HTML
//   validate(state)                  -> true | string (mensagem de erro)
// ctx = { rerender(), updateTicket() }
// ==========================================================================

function checkSvg() {
  return '<svg viewBox="0 0 20 20" fill="none"><path d="M4 10l4 4 8-8" stroke="#141414" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function segmented(name, options, current) {
  return `<div class="segmented" data-seg="${name}">` +
    options.map((opt, i) => `
      <input type="radio" name="${name}" id="${name}-${i}" value="${opt.value}" ${String(current) === String(opt.value) ? 'checked' : ''}>
      <label for="${name}-${i}">${opt.label}</label>
    `).join('') +
    `</div>`;
}

function maskTelefone(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function maskDocumento(v, tipo) {
  const d = v.replace(/\D/g, '');
  if (tipo === 'PJ') {
    const s = d.slice(0, 14);
    let out = s.slice(0, 2);
    if (s.length > 2) out += '.' + s.slice(2, 5);
    if (s.length > 5) out += '.' + s.slice(5, 8);
    if (s.length > 8) out += '/' + s.slice(8, 12);
    if (s.length > 12) out += '-' + s.slice(12, 14);
    return out;
  }
  const s = d.slice(0, 11);
  let out = s.slice(0, 3);
  if (s.length > 3) out += '.' + s.slice(3, 6);
  if (s.length > 6) out += '.' + s.slice(6, 9);
  if (s.length > 9) out += '-' + s.slice(9, 11);
  return out;
}

const IC_LABELS = { baixo: 0.7, medio: 1.0, alto: 1.3 };

// input[type=date] em alguns navegadores deixa digitar mais de 4 dígitos no
// ano momentaneamente (ex: "952026") antes de normalizar — isso sanitiza o
// valor bruto (YYYY-MM-DD), descartando qualquer coisa com ano fora de uma
// faixa razoável em vez de deixar passar pro estado.
function dataValidaOuVazia(valor) {
  if (!valor) return '';
  const m = /^(\d{4,})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return '';
  const ano = parseInt(m[1], 10);
  if (m[1].length !== 4 || ano < 2020 || ano > 2035) return '';
  return valor;
}

// Ordem fixa dos 11 critérios — index casa com data/ic-criterios.json.
// 'empenho_porte' e 'grau_detalhamento' NÃO são mais preenchidos manualmente:
// são calculados a partir do escopo/etapas selecionados (ver recomputeIndicadores).
const IC_KEYS_ALL = ['empenho_porte', 'qtd_especialistas', 'qtd_aprovacoes', 'grau_detalhamento', 'grau_resp_civil', 'grau_intervencao_cliente', 'expectativa_plastica', 'grau_controle_custo', 'indefinicao_escopo', 'indefinicao_prazo', 'demanda_midia'];
const MANUAL_COMPLEXIDADE_KEYS = ['qtd_especialistas', 'qtd_aprovacoes', 'grau_resp_civil', 'grau_intervencao_cliente', 'expectativa_plastica', 'grau_controle_custo', 'indefinicao_prazo', 'demanda_midia'];

const REPETICOES_FAIXAS = [
  { label: '0 (nenhuma)', value: 0 },
  { label: '1 a 2', value: 2 },
  { label: '3 a 4', value: 4 },
  { label: '5 a 8', value: 8 },
  { label: '9 a 16', value: 16 },
  { label: '17 a 32', value: 32 },
  { label: '33 a 64', value: 64 },
  { label: '65 a 128', value: 128 },
  { label: 'Acima de 128', value: 129 }
];

const ARQ_ETAPA_IDS = ['programacao_projetual', 'concepcao_esquematica', 'concepcao_basica', 'projeto_basico_legal', 'pre_executivo', 'projeto_executivo_arquitetura', 'detalhamento_executivo'];
const ETAPAS_EXECUTIVAS_IDS = ['pre_executivo', 'projeto_executivo_arquitetura', 'detalhamento_executivo'];

// Usado só pelos serviços que AINDA NÃO têm fórmula própria (ver
// servico.formula_percentual_por_etapa) — atalho antigo de escopo de
// contratação, mantido como provisório até esses serviços ganharem sua
// própria estrutura.
const ETAPAS_POR_ESCOPO = {
  'Projeto Completo': ARQ_ETAPA_IDS,
  'Até Estudo Preliminar': ['programacao_projetual', 'concepcao_esquematica', 'concepcao_basica'],
  'Até Projeto Legal': ['programacao_projetual', 'concepcao_esquematica', 'concepcao_basica', 'projeto_basico_legal'],
  'Só Projeto Legal': ['projeto_basico_legal'],
  'Só Projeto Executivo': ['pre_executivo', 'projeto_executivo_arquitetura', 'detalhamento_executivo']
};

function semanasDefault(etapa, ic) {
  return Math.max(1, Math.min(10, Math.round(etapa.semanas_base * ic)));
}

// ---------- Indicadores calculados (Grau de Detalhamento / Empenho ao Projeto vs Porte) ----------
// NOTA: os cortes de contagem do Empenho (3 / 4-6 / 7+) foram definidos ainda com a lista
// antiga de escopo (~14 itens) e ficaram pendentes de recalibração — a base de contagem
// mudou (agora soma subitens de todas as etapas + assessoramento, tipicamente um número
// bem maior). Mantido assim por ora, por acordo explícito, até revisarmos os cortes.
function computeGrauDetalhamento(etapasSelecionadas) {
  if (etapasSelecionadas.includes('detalhamento_executivo')) return 'alto';
  if (ETAPAS_EXECUTIVAS_IDS.some(id => etapasSelecionadas.includes(id))) return 'medio';
  return 'baixo';
}

function countSubitensSelecionados(state) {
  const etapas = Object.values(state.etapasSubitens || {}).reduce((s, arr) => s + arr.length, 0);
  const assess = (state.assessoramentoSelecionados || []).length;
  return etapas + assess;
}

function computeEmpenhoPorte(total) {
  if (total <= 3) return 'baixo';
  if (total <= 6) return 'medio';
  return 'alto';
}

function recomputeIndicadores(state) {
  state.icValores.grau_detalhamento = IC_LABELS[computeGrauDetalhamento(state.etapasSelecionadas)];
  state.icValores.empenho_porte = IC_LABELS[computeEmpenhoPorte(countSubitensSelecionados(state))];
}

// Recalcula o percentual do serviço a partir das etapas marcadas, só para
// os serviços com fórmula própria (Base + Incremento). Para os demais, não
// mexe em state.reducaoEscopoPercentual (continua vindo do dropdown antigo).
function recomputePercentualServico(state, data) {
  const servico = data.servicosOdisse.find(s => s.id === state.servicoId);
  if (servico && servico.formula_percentual_por_etapa) {
    const r = OdisseCalc.percentualPorEtapas(state.etapasSelecionadas, data.pesosEtapas);
    state.reducaoEscopoPercentual = r.percentual;
  }
}

const PRAZO_CLIENTE_OPCOES = [
  { label: '30 dias', semanas: 4 },
  { label: '2 meses', semanas: 8 },
  { label: '4 meses', semanas: 16 },
  { label: '6 meses', semanas: 24 },
  { label: '12 meses', semanas: 48 },
  { label: '1 ano e 6 meses', semanas: 72 },
  { label: '2 anos', semanas: 96 },
  { label: 'Indefinido', semanas: null }
];

const STEPS = [];

// -------------------------------------------------------------------------
// 1. Cliente & Projeto
// -------------------------------------------------------------------------
STEPS.push({
  id: 'cliente',
  eyebrow: 'Etapa 1 de 7',
  title: 'Cliente & projeto',
  desc: 'Dados de identificação que vão para o cabeçalho da proposta. O número da proposta é gerado automaticamente na revisão final.',
  render(state) {
    const c = state.cliente;
    return `
      <div class="field-group">
        <div class="field">
          <label class="field__label">Nome do cliente / empresa</label>
          <input type="text" id="f-nome" value="${c.nome || ''}" placeholder="Ex: Odisse, Estúdio de Arquitetura e Design">
        </div>
        <div class="row-2">
          <div class="field">
            <label class="field__label">E-mail</label>
            <input type="email" id="f-email" value="${c.email || ''}">
          </div>
          <div class="field">
            <label class="field__label">Telefone</label>
            <input type="tel" id="f-telefone" value="${c.telefone || ''}" placeholder="(83) 99999-9999">
          </div>
        </div>
        <div class="field">
          <label class="field__label">Representação legal</label>
          ${segmented('representacao', [{ value: 'PF', label: 'Pessoa Física' }, { value: 'PJ', label: 'Pessoa Jurídica' }], c.representacao || 'PF')}
        </div>
        <div class="field">
          <label class="field__label">CPF / CNPJ</label>
          <input type="text" id="f-doc" value="${c.documento || ''}">
        </div>
      </div>
      <div class="field-group">
        <div class="row-2">
          <div class="field">
            <label class="field__label">CEP do imóvel / empreendimento</label>
            <input type="text" id="f-cep" value="${c.cep || ''}" placeholder="58000-000" maxlength="9">
            <p class="field__hint" id="cep-status"></p>
          </div>
          <div class="field">
            <label class="field__label">Bairro</label>
            <input type="text" id="f-bairro" value="${c.bairro || ''}">
          </div>
        </div>
        <div class="field">
          <label class="field__label">Logradouro</label>
          <input type="text" id="f-logradouro" value="${c.logradouro || ''}" placeholder="Preenchido automaticamente pelo CEP — edite se precisar">
        </div>
        <div class="row-2">
          <div class="field">
            <label class="field__label">Número</label>
            <input type="text" id="f-numero-end" value="${c.numero || ''}">
          </div>
          <div class="field">
            <label class="field__label">Complemento</label>
            <input type="text" id="f-complemento" value="${c.complemento || ''}" placeholder="Apto, bloco, sala…">
          </div>
        </div>
        <div class="field">
          <label class="field__label">Cidade – UF</label>
          <input type="text" id="f-cidade-uf" value="${c.cidadeUf || ''}">
        </div>
      </div>
      <div class="field-group">
        <div class="field">
          <label class="field__label">Data da proposta</label>
          <input type="date" id="f-data-proposta" value="${state.dataProposta || ''}" min="2020-01-01" max="2035-12-31">
        </div>
        <div class="row-2">
          <div class="field">
            <label class="field__label">Teto orçamentário informado pelo cliente (opcional)</label>
            <input type="text" inputmode="numeric" id="f-teto" value="${state.tetoOrcamentario || ''}" placeholder="Digite só números — a formatação é automática">
          </div>
          <div class="field">
            <label class="field__label">Prazo esperado pelo cliente (opcional)</label>
            <select id="f-prazo-cliente">
              <option value="">Não informado</option>
              ${PRAZO_CLIENTE_OPCOES.map(o => `<option value="${o.label}" ${state.prazoEsperadoCliente === o.label ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  },
  bind(el, state) {
    el.querySelector('#f-nome').oninput = e => state.cliente.nome = e.target.value;
    el.querySelector('#f-email').oninput = e => state.cliente.email = e.target.value;
    el.querySelector('#f-data-proposta').oninput = e => {
      const limpo = dataValidaOuVazia(e.target.value);
      state.dataProposta = limpo;
      if (!limpo && e.target.value) e.target.value = state.dataProposta;
    };

    const telInput = el.querySelector('#f-telefone');
    telInput.oninput = e => {
      const formatado = maskTelefone(e.target.value);
      e.target.value = formatado;
      state.cliente.telefone = formatado;
    };

    const docInput = el.querySelector('#f-doc');
    docInput.oninput = e => {
      const formatado = maskDocumento(e.target.value, state.cliente.representacao);
      e.target.value = formatado;
      state.cliente.documento = formatado;
    };
    el.querySelectorAll('input[name="representacao"]').forEach(r => {
      r.onchange = e => {
        state.cliente.representacao = e.target.value;
        const reformatado = maskDocumento(state.cliente.documento, e.target.value);
        state.cliente.documento = reformatado;
        docInput.value = reformatado;
      };
    });

    el.querySelector('#f-numero-end').oninput = e => state.cliente.numero = e.target.value;
    el.querySelector('#f-logradouro').oninput = e => state.cliente.logradouro = e.target.value;
    el.querySelector('#f-complemento').oninput = e => state.cliente.complemento = e.target.value;
    el.querySelector('#f-bairro').oninput = e => state.cliente.bairro = e.target.value;
    el.querySelector('#f-cidade-uf').oninput = e => state.cliente.cidadeUf = e.target.value;

    const cepInput = el.querySelector('#f-cep');
    const cepStatus = el.querySelector('#cep-status');
    cepInput.oninput = e => {
      let v = e.target.value.replace(/\D/g, '').slice(0, 8);
      if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
      e.target.value = v;
      state.cliente.cep = v;
      const digits = v.replace(/\D/g, '');
      if (digits.length === 8) buscarCep(digits);
    };

    async function buscarCep(cep) {
      cepStatus.textContent = 'Buscando endereço…';
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await res.json();
        if (dados.erro) {
          cepStatus.textContent = 'CEP não encontrado — preencha manualmente.';
          return;
        }
        state.cliente.logradouro = dados.logradouro || '';
        state.cliente.bairro = dados.bairro || '';
        state.cliente.cidadeUf = dados.localidade && dados.uf ? `${dados.localidade} – ${dados.uf}` : '';
        el.querySelector('#f-logradouro').value = state.cliente.logradouro;
        el.querySelector('#f-bairro').value = state.cliente.bairro;
        el.querySelector('#f-cidade-uf').value = state.cliente.cidadeUf;
        cepStatus.textContent = 'Endereço preenchido — confira e edite se precisar.';
      } catch (err) {
        cepStatus.textContent = 'Não consegui buscar o CEP agora — preencha manualmente.';
      }
    }

    const tetoInput = el.querySelector('#f-teto');
    tetoInput.oninput = e => {
      const digits = e.target.value.replace(/\D/g, '');
      if (!digits) { state.tetoOrcamentario = ''; state.tetoOrcamentarioNumero = 0; e.target.value = ''; return; }
      const valor = parseInt(digits, 10) / 100;
      const formatado = valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      e.target.value = formatado;
      state.tetoOrcamentario = formatado;
      state.tetoOrcamentarioNumero = valor;
    };

    el.querySelector('#f-prazo-cliente').onchange = e => {
      state.prazoEsperadoCliente = e.target.value;
    };
  },
  validate(state) {
    if (!state.cliente.nome) return 'Informe o nome do cliente.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 2. Classificação do serviço (inclui entendimento do projeto e áreas)
// -------------------------------------------------------------------------
STEPS.push({
  id: 'classificacao',
  eyebrow: 'Etapa 2 de 7',
  title: 'Classificação do serviço',
  desc: 'Define a base de honorários (CUB/tipologia), o entendimento do projeto e o porte do trabalho.',
  render(state, data) {
    const servicoOpts = data.servicosOdisse.map(s => `<option value="${s.id}" ${state.servicoId === s.id ? 'selected' : ''}>${s.nome}</option>`).join('');
    const servico = data.servicosOdisse.find(s => s.id === state.servicoId);
    const macros = (servico && servico.macro_categorias.length) ? servico.macro_categorias : Object.keys(data.tipologias);
    const tipoOpts = macros.map(macro => {
      const itens = data.tipologias[macro] || [];
      if (!itens.length) return '';
      const opcoes = itens.map(t => `<option value="${macro}|||${t.item}" ${state.tipologiaItem && state.tipologiaItem.item === t.item ? 'selected' : ''}>${t.descricao}</option>`).join('');
      return `<optgroup label="${macro}">${opcoes}</optgroup>`;
    }).join('');

    let intervencaoHtml = '';
    if (servico && (servico.modificadores || []).length > 1) {
      const opts = servico.modificadores.map(m => ({ value: m.valor, label: m.nome }));
      intervencaoHtml = `
        <div class="field">
          <label class="field__label">Tipo de intervenção</label>
          ${segmented('intervencao', opts, state.modificadorIntervencao)}
        </div>`;
    }

    const critEscopo = data.icCriterios[8]; // indefinição do escopo
    const currentEsc = state.icValores.indefinicao_escopo != null ? state.icValores.indefinicao_escopo : 1.0;
    const currentEscLabel = currentEsc === 0.7 ? 'baixo' : currentEsc === 1.3 ? 'alto' : 'medio';

    return `
      <div class="field-group">
        <div class="field">
          <label class="field__label">Serviço Odisse</label>
          <select id="f-servico"><option value="">Selecione…</option>${servicoOpts}</select>
          <p class="field__hint">Define os valores padrão de complexidade, escopo e etapas — tudo ajustável depois. A lista de tipologias abaixo também é filtrada por este serviço.</p>
        </div>
      </div>
      <div class="field-group">
        <div class="field">
          <label class="field__label">Tipologia específica</label>
          <select id="f-tipo" ${servico ? '' : 'disabled'}><option value="">${servico ? 'Selecione…' : 'Escolha o serviço Odisse primeiro'}</option>${tipoOpts}</select>
        </div>
        ${intervencaoHtml}
      </div>
      <div class="field-group">
        <div class="field">
          <label class="field__label">Entendimento do projeto</label>
          <textarea id="f-entendimento" rows="8" placeholder="Ex: O projeto arquitetônico objeto desta proposta trata-se de...">${state.entendimentoProjeto || ''}</textarea>
        </div>
      </div>
      <div class="field-group">
        <div class="row-2">
          <div class="field">
            <label class="field__label">Área do imóvel ou terreno (m²)</label>
            <input type="number" min="0" step="1" id="f-area-terreno" value="${state.areaTerreno || ''}">
          </div>
          <div class="field">
            <label class="field__label">Área Edificada Prevista (m²)</label>
            <input type="number" min="0" step="1" id="f-area" value="${state.areaConstruida || ''}">
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label class="field__label">Área Externa de Intervenção (m²)</label>
            <input type="number" min="0" step="1" id="f-area-ext" value="${state.areaExterna || ''}">
          </div>
          <div class="field">
            <label class="field__label">Contagem de repetições</label>
            <select id="f-repeticoes">
              ${REPETICOES_FAIXAS.map(f => `<option value="${f.value}" ${state.contagemRepeticoes === f.value ? 'selected' : ''}>${f.label}</option>`).join('')}
            </select>
            <p class="field__hint">Unidades/áreas que se repetem integralmente no mesmo projeto.</p>
          </div>
        </div>
        <div class="field">
          <label class="field__label">${critEscopo.criterio}</label>
          ${segmented('ic-indefinicao_escopo', [
            { value: 'baixo', label: 'Baixo' },
            { value: 'medio', label: 'Médio' },
            { value: 'alto', label: 'Alto' }
          ], currentEscLabel)}
          <p class="field__hint" id="ic-hint-indefinicao_escopo">${critEscopo[currentEscLabel]}</p>
        </div>
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    const servicoSel = el.querySelector('#f-servico');

    servicoSel.onchange = e => {
      state.servicoId = e.target.value;
      state.tipologiaItem = null;
      const servico = data.servicosOdisse.find(s => s.id === state.servicoId);
      if (servico) {
        const icNum = {};
        Object.entries(servico.ic_preset).forEach(([k, v]) => { icNum[k] = IC_LABELS[v]; });
        state.icValores = { ...state.icValores, ...icNum };
        state.etapasSelecionadas = [...servico.etapas_default];
        state.etapasSemanas = {};
        state.etapasSubitens = {};
        const icCalc = OdisseCalc.mediaIC(state.icValores);
        servico.etapas_default.forEach(id => {
          const etapa = data.etapas.find(x => x.id === id);
          if (etapa) {
            state.etapasSemanas[id] = semanasDefault(etapa, icCalc);
            state.etapasSubitens[id] = etapa.subitens.map(si => si.id);
          }
        });
        const mods = servico.modificadores || [];
        state.modificadorIntervencao = mods.length ? mods[0].valor : 1;
        recomputeIndicadores(state);
        recomputePercentualServico(state, data);
      }
      ctx.rerender();
    };

    const tipoSel = el.querySelector('#f-tipo');
    if (tipoSel) {
      tipoSel.onchange = e => {
        const [macro, item] = e.target.value.split('|||');
        const list = data.tipologias[macro] || [];
        state.tipologiaItem = list.find(t => t.item === item) || null;
        ctx.updateTicket();
      };
    }
    el.querySelectorAll('input[name="intervencao"]').forEach(r => {
      r.onchange = e => { state.modificadorIntervencao = parseFloat(e.target.value); ctx.updateTicket(); };
    });

    el.querySelector('#f-entendimento').oninput = e => state.entendimentoProjeto = e.target.value;

    el.querySelector('#f-area').oninput = e => { state.areaConstruida = parseFloat(e.target.value) || 0; ctx.updateTicket(); };
    el.querySelector('#f-area-ext').oninput = e => { state.areaExterna = parseFloat(e.target.value) || 0; ctx.updateTicket(); };
    el.querySelector('#f-area-terreno').oninput = e => { state.areaTerreno = parseFloat(e.target.value) || 0; };
    el.querySelector('#f-repeticoes').onchange = e => { state.contagemRepeticoes = parseInt(e.target.value, 10) || 0; ctx.updateTicket(); };

    const critEscopo = data.icCriterios[8];
    el.querySelectorAll('input[name="ic-indefinicao_escopo"]').forEach(r => {
      r.onchange = e => {
        state.icValores.indefinicao_escopo = IC_LABELS[e.target.value];
        el.querySelector('#ic-hint-indefinicao_escopo').textContent = critEscopo[e.target.value];
        ctx.updateTicket();
      };
    });
  },
  validate(state) {
    if (!state.tipologiaItem) return 'Selecione a tipologia do projeto.';
    if (!state.areaConstruida || state.areaConstruida <= 0) return 'Informe a área edificada prevista.';
    if (!state.entendimentoProjeto || state.entendimentoProjeto.trim().length < 10) return 'Escreva um resumo do entendimento do projeto.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 3. Etapas (escopo do serviço + assessoramento + duração de cada etapa).
//    O percentual do honorário é calculado automaticamente pelas etapas
//    marcadas, para os serviços com fórmula própria (Base + Incremento).
// -------------------------------------------------------------------------
STEPS.push({
  id: 'etapas',
  eyebrow: 'Etapa 3 de 7',
  title: 'Etapas',
  desc: 'Todas as etapas típicas do serviço já vêm marcadas. Desmarque o que não for contratado — o percentual do honorário se ajusta sozinho.',
  render(state, data) {
    const ic = OdisseCalc.mediaIC(state.icValores);
    const servico = data.servicosOdisse.find(s => s.id === state.servicoId);
    const usaFormula = servico && servico.formula_percentual_por_etapa;

    let escopoHtml;
    if (usaFormula) {
      const r = OdisseCalc.percentualPorEtapas(state.etapasSelecionadas, data.pesosEtapas);
      escopoHtml = `
        <div class="field-group">
          <div class="data-row"><span class="data-row__label">Percentual do honorário (calculado)</span><span class="data-row__value tabular"><strong id="valor-percentual-etapas">${Math.round(r.percentual * 100)}%</strong></span></div>
          <p class="field__hint" id="detalhe-percentual-etapas">Base ${Math.round(r.base * 100)}% + incremento de ${Math.round(r.incremento * 100)}% (por etapas anteriores não contratadas). Ajusta sozinho conforme você marca/desmarca abaixo.</p>
        </div>
      `;
    } else {
      const reducaoOpts = [{ nome: 'Projeto Completo', percentual: 1 }, ...data.reducaoEscopo];
      let escopoAtualNome = 'Personalizado';
      for (const r of reducaoOpts) { if (r.percentual === state.reducaoEscopoPercentual) { escopoAtualNome = r.nome; break; } }
      const todasOpcoes = [...reducaoOpts, { nome: 'Personalizado' }];
      escopoHtml = `
        <div class="field-group">
          <div class="field">
            <label class="field__label">Escopo de contratação</label>
            <select id="f-escopo-contratacao">
              ${todasOpcoes.map(r => `<option value="${r.nome}" ${escopoAtualNome === r.nome ? 'selected' : ''}>${r.nome}${r.percentual != null ? ' (' + Math.round(r.percentual * 100) + '%)' : ''}</option>`).join('')}
            </select>
            <input type="number" min="1" max="100" step="1" id="f-escopo-custom" value="${Math.round((state.reducaoEscopoPercentual || 1) * 100)}" style="margin-top:10px" ${escopoAtualNome === 'Personalizado' ? '' : 'hidden'}>
            <p class="field__hint">Este serviço ainda usa o percentual fixo por escopo — a fórmula por etapa ainda não foi desenhada para ele.</p>
          </div>
        </div>
      `;
    }

    const grauDetalhamento = computeGrauDetalhamento(state.etapasSelecionadas);
    const empenhoPorte = computeEmpenhoPorte(countSubitensSelecionados(state));
    const labelCap = s => s.charAt(0).toUpperCase() + s.slice(1);

    const etapasAplicaveis = servico ? (servico.etapas_aplicaveis || []) : [];
    const etapasVisiveis = data.etapas.filter(e => etapasAplicaveis.includes(e.id));
    const fasesOrdem = [];
    const etapasPorFase = {};
    etapasVisiveis.forEach(e => {
      if (!etapasPorFase[e.fase]) { etapasPorFase[e.fase] = []; fasesOrdem.push(e.fase); }
      etapasPorFase[e.fase].push(e);
    });

    const listaEtapasHtml = fasesOrdem.length ? fasesOrdem.map(fase => {
      const etapasDaFase = etapasPorFase[fase];
      const todasMarcadas = etapasDaFase.every(e => state.etapasSelecionadas.includes(e.id));
      return `
        <div class="fase-group">
          <label class="check-row check-row__toggle fase-toggle">
            <input type="checkbox" data-fase="${fase}" ${todasMarcadas ? 'checked' : ''}>
            <span class="check-row__box">${checkSvg()}</span>
            <span class="check-row__text fase-toggle__text">${fase}</span>
          </label>
          <div class="fase-etapas">
            ${etapasDaFase.map(etapa => {
              const selecionada = state.etapasSelecionadas.includes(etapa.id);
              const semanasAtual = state.etapasSemanas[etapa.id] != null ? state.etapasSemanas[etapa.id] : semanasDefault(etapa, ic);
              const subitensSel = state.etapasSubitens[etapa.id] || [];
              return `
                <div class="etapa-row ${selecionada ? '' : 'etapa-row--off'}">
                  <label class="check-row check-row__toggle">
                    <input type="checkbox" data-etapa="${etapa.id}" ${selecionada ? 'checked' : ''}>
                    <span class="check-row__box">${checkSvg()}</span>
                    <span class="check-row__text">${etapa.nome}</span>
                  </label>
                  ${selecionada ? `
                    <select class="etapa-semanas" data-semanas="${etapa.id}">
                      ${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<option value="${n}" ${semanasAtual === n ? 'selected' : ''}>${n} sem.</option>`).join('')}
                    </select>
                  ` : ''}
                </div>
                ${selecionada ? `
                  <div class="subitens-list" data-subitens-de="${etapa.id}">
                    ${etapa.subitens.map(si => `
                      <label class="check-row check-row--sub">
                        <input type="checkbox" data-subitem="${etapa.id}::${si.id}" ${subitensSel.includes(si.id) ? 'checked' : ''}>
                        <span class="check-row__box">${checkSvg()}</span>
                        <span class="check-row__text small">${si.texto}</span>
                      </label>
                    `).join('')}
                  </div>
                ` : ''}
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('') : `<p class="muted">Este serviço não usa etapas de projeto — o escopo é definido diretamente na proposta.</p>`;

    return `
      ${escopoHtml}
      <div class="field-group">
        <div class="row-2">
          <div class="data-row"><span class="data-row__label">Grau de Detalhamento (calculado)</span><span class="data-row__value" id="badge-detalhamento">${labelCap(grauDetalhamento)}</span></div>
          <div class="data-row"><span class="data-row__label">Empenho ao Projeto vs Porte (calculado)</span><span class="data-row__value" id="badge-empenho">${labelCap(empenhoPorte)}</span></div>
        </div>
        <p class="field__hint">Atualizam sozinhos conforme as etapas e subitens marcados abaixo.</p>
      </div>
      <div class="field-group">
        ${listaEtapasHtml}
        <p class="field__hint" id="etapas-total" style="margin-top:12px"></p>
      </div>
      <div class="field-group">
        <div class="card__title" style="margin-bottom:6px">${data.assessoramento.titulo}</div>
        <p class="field__hint" style="margin-bottom:14px">Bloco independente — não entra no cronograma nem na soma de semanas.</p>
        <div class="check-list">
          ${data.assessoramento.subitens.map(si => `
            <label class="check-row">
              <input type="checkbox" data-assess="${si.id}" ${(state.assessoramentoSelecionados || []).includes(si.id) ? 'checked' : ''}>
              <span class="check-row__box">${checkSvg()}</span>
              <span class="check-row__text">${si.texto_curto}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    const servico = data.servicosOdisse.find(s => s.id === state.servicoId);
    const usaFormula = servico && servico.formula_percentual_por_etapa;
    const ic = OdisseCalc.mediaIC(state.icValores);

    function atualizarBadges() {
      const detEl = el.querySelector('#badge-detalhamento');
      const empEl = el.querySelector('#badge-empenho');
      const labelCap = s => s.charAt(0).toUpperCase() + s.slice(1);
      if (detEl) detEl.textContent = labelCap(computeGrauDetalhamento(state.etapasSelecionadas));
      if (empEl) empEl.textContent = labelCap(computeEmpenhoPorte(countSubitensSelecionados(state)));
    }
    function atualizarPercentualEtapas() {
      if (!usaFormula) return;
      const r = OdisseCalc.percentualPorEtapas(state.etapasSelecionadas, data.pesosEtapas);
      state.reducaoEscopoPercentual = r.percentual;
      const valorEl = el.querySelector('#valor-percentual-etapas');
      const detalheEl = el.querySelector('#detalhe-percentual-etapas');
      if (valorEl) valorEl.textContent = `${Math.round(r.percentual * 100)}%`;
      if (detalheEl) detalheEl.textContent = `Base ${Math.round(r.base * 100)}% + incremento de ${Math.round(r.incremento * 100)}% (por etapas anteriores não contratadas). Ajusta sozinho conforme você marca/desmarca abaixo.`;
    }
    function atualizarTotal() {
      const total = data.etapas.filter(e => state.etapasSelecionadas.includes(e.id))
        .reduce((s, e) => s + (state.etapasSemanas[e.id] || 0), 0);
      const totalEl = el.querySelector('#etapas-total');
      if (totalEl) totalEl.textContent = `Total: ${total} semana${total === 1 ? '' : 's'}`;
    }
    function garantirSubitens(id) {
      if (state.etapasSubitens[id] == null) {
        const etapa = data.etapas.find(x => x.id === id);
        state.etapasSubitens[id] = etapa.subitens.map(si => si.id);
      }
    }

    if (!usaFormula) {
      const selectEscopo = el.querySelector('#f-escopo-contratacao');
      const inputCustom = el.querySelector('#f-escopo-custom');
      selectEscopo.onchange = e => {
        const nome = e.target.value;
        if (nome === 'Personalizado') {
          inputCustom.hidden = false;
          state.reducaoEscopoPercentual = (parseFloat(inputCustom.value) || 100) / 100;
          ctx.updateTicket();
          return;
        }
        inputCustom.hidden = true;
        const opt = [{ nome: 'Projeto Completo', percentual: 1 }, ...data.reducaoEscopo].find(r => r.nome === nome);
        state.reducaoEscopoPercentual = opt.percentual;
        const etapasArq = ETAPAS_POR_ESCOPO[nome] || [];
        const outras = state.etapasSelecionadas.filter(id => !ARQ_ETAPA_IDS.includes(id));
        state.etapasSelecionadas = [...new Set([...outras, ...etapasArq])];
        etapasArq.forEach(id => {
          if (state.etapasSemanas[id] == null) {
            const etapa = data.etapas.find(x => x.id === id);
            state.etapasSemanas[id] = semanasDefault(etapa, ic);
          }
          garantirSubitens(id);
        });
        recomputeIndicadores(state);
        ctx.rerender();
      };
      inputCustom.oninput = e => {
        state.reducaoEscopoPercentual = (parseFloat(e.target.value) || 0) / 100;
        ctx.updateTicket();
      };
    }

    el.querySelectorAll('input[data-fase]').forEach(cb => {
      cb.onchange = e => {
        const fase = e.target.dataset.fase;
        const etapasDaFase = data.etapas.filter(x => x.fase === fase && (servico.etapas_aplicaveis || []).includes(x.id));
        etapasDaFase.forEach(etapa => {
          const id = etapa.id;
          if (e.target.checked) {
            if (!state.etapasSelecionadas.includes(id)) state.etapasSelecionadas.push(id);
            if (state.etapasSemanas[id] == null) state.etapasSemanas[id] = semanasDefault(etapa, ic);
            garantirSubitens(id);
          } else {
            state.etapasSelecionadas = state.etapasSelecionadas.filter(x => x !== id);
          }
        });
        recomputeIndicadores(state);
        ctx.rerender();
      };
    });
    el.querySelectorAll('input[data-etapa]').forEach(cb => {
      cb.onchange = e => {
        const id = e.target.dataset.etapa;
        if (e.target.checked) {
          state.etapasSelecionadas.push(id);
          if (state.etapasSemanas[id] == null) {
            const etapa = data.etapas.find(x => x.id === id);
            state.etapasSemanas[id] = semanasDefault(etapa, ic);
          }
          garantirSubitens(id);
        } else {
          state.etapasSelecionadas = state.etapasSelecionadas.filter(x => x !== id);
        }
        recomputeIndicadores(state);
        ctx.rerender();
      };
    });
    el.querySelectorAll('select[data-semanas]').forEach(sel => {
      sel.onchange = e => {
        state.etapasSemanas[e.target.dataset.semanas] = parseInt(e.target.value, 10) || 1;
        atualizarTotal();
        ctx.updateTicket();
      };
    });
    el.querySelectorAll('input[data-subitem]').forEach(cb => {
      cb.onchange = e => {
        const [etapaId, subitemId] = e.target.dataset.subitem.split('::');
        garantirSubitens(etapaId);
        if (e.target.checked) {
          if (!state.etapasSubitens[etapaId].includes(subitemId)) state.etapasSubitens[etapaId].push(subitemId);
        } else {
          state.etapasSubitens[etapaId] = state.etapasSubitens[etapaId].filter(x => x !== subitemId);
        }
        recomputeIndicadores(state);
        atualizarBadges();
        ctx.updateTicket();
      };
    });
    el.querySelectorAll('input[data-assess]').forEach(cb => {
      cb.onchange = e => {
        const id = e.target.dataset.assess;
        state.assessoramentoSelecionados = state.assessoramentoSelecionados || [];
        if (e.target.checked) {
          if (!state.assessoramentoSelecionados.includes(id)) state.assessoramentoSelecionados.push(id);
        } else {
          state.assessoramentoSelecionados = state.assessoramentoSelecionados.filter(x => x !== id);
        }
        recomputeIndicadores(state);
        atualizarBadges();
        ctx.updateTicket();
      };
    });

    atualizarTotal();
    atualizarPercentualEtapas();
  },
  validate(state) {
    if (!state.etapasSelecionadas.length) return 'Selecione ao menos uma etapa.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 4. Índice de complexidade (8 critérios manuais — indefinição de escopo
//    fica na Classificação; empenho e detalhamento viraram indicadores
//    calculados, exibidos em Etapas)
// -------------------------------------------------------------------------
STEPS.push({
  id: 'complexidade',
  eyebrow: 'Etapa 4 de 7',
  title: 'Índice de complexidade',
  desc: 'Padrão pré-carregado a partir do serviço escolhido. Ajuste qualquer critério se o padrão não refletir o projeto — refine por último, depois de fechar as etapas.',
  render(state, data) {
    return `
      <div class="field-group">
        ${MANUAL_COMPLEXIDADE_KEYS.map(key => {
          const i = IC_KEYS_ALL.indexOf(key);
          const crit = data.icCriterios[i];
          const current = state.icValores[key] != null ? state.icValores[key] : 1.0;
          const currentLabel = current === 0.7 ? 'baixo' : current === 1.3 ? 'alto' : 'medio';
          return `
            <div class="field">
              <label class="field__label">${crit.criterio}</label>
              ${segmented('ic-' + key, [
                { value: 'baixo', label: 'Baixo' },
                { value: 'medio', label: 'Médio' },
                { value: 'alto', label: 'Alto' }
              ], currentLabel)}
              <p class="field__hint" id="ic-hint-${key}">${crit[currentLabel]}</p>
            </div>
          `;
        }).join('')}
      </div>
      <p class="field__hint">Os critérios "Empenho ao Projeto vs Porte" e "Grau de Detalhamento" não aparecem aqui — são calculados automaticamente a partir do escopo e das etapas selecionadas em "Etapas".</p>
    `;
  },
  bind(el, state, data, ctx) {
    MANUAL_COMPLEXIDADE_KEYS.forEach(key => {
      const i = IC_KEYS_ALL.indexOf(key);
      const crit = data.icCriterios[i];
      el.querySelectorAll(`input[name="ic-${key}"]`).forEach(r => {
        r.onchange = e => {
          state.icValores[key] = IC_LABELS[e.target.value];
          el.querySelector(`#ic-hint-${key}`).textContent = crit[e.target.value];
          ctx.updateTicket();
        };
      });
    });
  },
  validate() { return true; }
});

// -------------------------------------------------------------------------
// 5. Cronograma (data de início + datas de cada etapa contratada)
// -------------------------------------------------------------------------
STEPS.push({
  id: 'cronograma',
  eyebrow: 'Etapa 5 de 7',
  title: 'Cronograma',
  desc: 'Defina a data de início do serviço — as datas de cada etapa contratada se ajustam automaticamente a partir dela.',
  render(state) {
    return `
      <div class="field-group">
        <div class="field">
          <label class="field__label">Data de início do serviço</label>
          <input type="date" id="f-data-inicio" value="${state.dataInicio || ''}" min="2020-01-01" max="2035-12-31">
        </div>
      </div>
      <div class="field-group" id="cronograma-preview"></div>
    `;
  },
  bind(el, state, data, ctx) {
    function renderCronograma() {
      const box = el.querySelector('#cronograma-preview');
      const selecionadas = data.etapas.filter(e => state.etapasSelecionadas.includes(e.id))
        .map(e => ({ ...e, semanas: state.etapasSemanas[e.id] }));
      if (!state.dataInicio || !selecionadas.length) { box.innerHTML = '<p class="muted">Preencha a etapa "Etapas" e a data acima para ver o cronograma.</p>'; return; }
      const linhas = OdisseCalc.montarCronograma(state.dataInicio, selecionadas);
      box.innerHTML = `<div class="card__title">Prévia do cronograma</div><div class="timeline">` +
        linhas.map(l => `
          <div class="timeline__row">
            <div><div class="timeline__name">${l.nome}</div><span class="timeline__fase">${l.fase}</span></div>
            <div class="timeline__weeks small muted">${l.semanas} sem.</div>
            <div class="timeline__dates">${OdisseCalc.fmtData(l.inicio)} – ${OdisseCalc.fmtData(l.fim)}</div>
          </div>
        `).join('') + `</div>`;
    }
    el.querySelector('#f-data-inicio').oninput = e => {
      const limpo = dataValidaOuVazia(e.target.value);
      state.dataInicio = limpo;
      if (!limpo && e.target.value) e.target.value = state.dataInicio;
      renderCronograma();
      ctx.updateTicket();
    };
    renderCronograma();
  },
  validate(state) {
    if (!state.dataInicio) return 'Informe a data de início.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 6. Ajuste de mercado & condições de pagamento
// -------------------------------------------------------------------------
STEPS.push({
  id: 'pagamento',
  eyebrow: 'Etapa 6 de 7',
  title: 'Ajuste de mercado & pagamento',
  desc: 'Ajuste o valor final e defina as condições de pagamento — o preview abaixo atualiza a cada mudança.',
  render(state, data) {
    const fatorAtual = state.fatorAjuste || 1.25;
    const r = state._calcResult;
    const previewHtml = r ? `
      <div class="card">
        <div class="card__title">Honorário final (preview)</div>
        <div class="data-row"><span class="data-row__label">Valor de tabela (CAU)</span><span class="data-row__value tabular">${OdisseCalc.fmtMoeda(r.valorCau)}</span></div>
        <div class="data-row"><span class="data-row__label">Ajuste de mercado (÷ ${state.fatorAjuste})</span><span class="data-row__value tabular">${OdisseCalc.fmtMoeda(r.valorMercado)}</span></div>
        <div class="data-row"><span class="data-row__label">Percentual do serviço (${Math.round(state.reducaoEscopoPercentual * 100)}%)</span><span class="data-row__value tabular"><strong>${OdisseCalc.fmtMoeda(r.valorFinal)}</strong></span></div>
      </div>
    ` : `<p class="muted">Complete a classificação do serviço para ver o preview do honorário.</p>`;

    return `
      ${previewHtml}
      <div class="field-group">
        <div class="field">
          <label class="field__label">Fator de ajuste de mercado</label>
          <div class="segmented" data-seg="fator-preset">
            ${[1, 1.25, 2.25].map(v => `
              <input type="radio" name="fator-preset" id="fator-${v}" value="${v}" ${fatorAtual === v ? 'checked' : ''}>
              <label for="fator-${v}">${v === 1 ? 'Sem ajuste' : '÷ ' + v}</label>
            `).join('')}
            <input type="radio" name="fator-preset" id="fator-custom" value="custom" ${![1, 1.25, 2.25].includes(fatorAtual) ? 'checked' : ''}>
            <label for="fator-custom">Outro</label>
          </div>
          <input type="number" step="0.01" min="1" id="f-fator-custom" value="${fatorAtual}" style="margin-top:10px" ${[1, 1.25, 2.25].includes(fatorAtual) ? 'hidden' : ''}>
          <p class="field__hint">O valor calculado pela tabela CAU é dividido por este fator. 1.25 e 2.25 refletem os dois patamares que a Odisse já costuma praticar.</p>
        </div>
      </div>
      <div class="field-group">
        <div class="row-2">
          <div class="field">
            <label class="field__label">Desconto à vista (%)</label>
            <input type="number" min="0" max="100" step="1" id="f-desconto" value="${Math.round((state.descontoAvista != null ? state.descontoAvista : 0.08) * 100)}">
          </div>
          <div class="field">
            <label class="field__label">Entrada (% do valor, no plano entrada + boletos)</label>
            <input type="number" min="0" max="100" step="1" id="f-entrada" value="${Math.round((state.pctEntrada != null ? state.pctEntrada : 0.35) * 100)}">
          </div>
        </div>
      </div>
      <div class="field-group">
        <div class="switch-row">
          <div class="switch-row__text">
            <div class="switch-row__title">Incluir cláusula de despesas reembolsáveis</div>
            <div class="switch-row__hint">Plotagem, viagens fora da região metropolitana, taxas e certidões</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="f-reembolsaveis" ${state.incluirDespesasReembolsaveis !== false ? 'checked' : ''}>
            <span class="switch__track"></span><span class="switch__thumb"></span>
          </label>
        </div>
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    el.querySelectorAll('input[name="fator-preset"]').forEach(r => {
      r.onchange = e => {
        const custom = el.querySelector('#f-fator-custom');
        if (e.target.value === 'custom') {
          custom.hidden = false;
        } else {
          custom.hidden = true;
          state.fatorAjuste = parseFloat(e.target.value);
          ctx.updateTicket();
          ctx.rerender();
        }
      };
    });
    el.querySelector('#f-fator-custom').oninput = e => {
      state.fatorAjuste = parseFloat(e.target.value) || 1;
      ctx.updateTicket();
    };
    el.querySelector('#f-fator-custom').onchange = () => ctx.rerender();
    el.querySelector('#f-desconto').oninput = e => { state.descontoAvista = (parseFloat(e.target.value) || 0) / 100; ctx.updateTicket(); };
    el.querySelector('#f-entrada').oninput = e => { state.pctEntrada = (parseFloat(e.target.value) || 0) / 100; ctx.updateTicket(); };
    el.querySelector('#f-reembolsaveis').onchange = e => state.incluirDespesasReembolsaveis = e.target.checked;
  },
  validate() { return true; }
});

// -------------------------------------------------------------------------
// 7. Revisão & download (número gerado só ao clicar em "Finalizar orçamento")
// -------------------------------------------------------------------------
STEPS.push({
  id: 'revisao',
  eyebrow: 'Etapa 7 de 7',
  title: 'Revisão & geração do PDF',
  desc: 'Confira os valores calculados. Finalize o orçamento para gerar o número da proposta e liberar o PDF.',
  render(state, data) {
    const r = state._calcResult;
    if (!r) return `<p class="muted">Complete as etapas anteriores para ver o resumo do cálculo.</p>`;

    const numeroBloco = state.numeroProposta
      ? `<div class="numero-proposta"><span class="numero-proposta__label">Nº da proposta</span><span class="numero-proposta__valor">${state.numeroProposta}</span></div>`
      : `<p class="field__hint" style="margin: 4px 0 16px">${state.numeroPropostaStatus === 'gerando' ? 'Finalizando…' : state.numeroPropostaStatus === 'erro' ? 'Não consegui gerar o número — tente novamente.' : 'O número da proposta ainda não foi gerado.'}</p>`;

    return `
      <div class="card">
        <div class="card__title">Memória de cálculo</div>
        <div class="data-row"><span class="data-row__label">Base de Honorários (BH) — CUB vigente</span><span class="data-row__value tabular">${OdisseCalc.fmtMoeda(r.bh)}/m²</span></div>
        <div class="data-row"><span class="data-row__label">Custo estimado da obra (CEO)</span><span class="data-row__value tabular">${OdisseCalc.fmtMoeda(r.ceo)}</span></div>
        <div class="data-row"><span class="data-row__label">Fator percentual (fp)</span><span class="data-row__value tabular">${(r.fp * 100).toFixed(2)}%</span></div>
        <div class="data-row"><span class="data-row__label">Índice de complexidade (IC)</span><span class="data-row__value tabular">${r.ic.toFixed(3)}</span></div>
        <div class="data-row"><span class="data-row__label">Redutor de repetição</span><span class="data-row__value tabular">${r.redutor}</span></div>
        <div class="data-row"><span class="data-row__label">Razão área projetada/construída (R)</span><span class="data-row__value tabular">${r.R.toFixed(3)}</span></div>
        <div class="data-row"><span class="data-row__label">Valor de tabela (CAU)</span><span class="data-row__value tabular">${OdisseCalc.fmtMoeda(r.valorCau)}</span></div>
        <div class="data-row"><span class="data-row__label">Ajuste de mercado (÷ ${state.fatorAjuste})</span><span class="data-row__value tabular">${OdisseCalc.fmtMoeda(r.valorMercado)}</span></div>
        <div class="data-row"><span class="data-row__label">Percentual do serviço</span><span class="data-row__value tabular">${Math.round(state.reducaoEscopoPercentual * 100)}%</span></div>
        <div class="data-row"><span class="data-row__label"><strong>Honorário final</strong></span><span class="data-row__value tabular"><strong>${OdisseCalc.fmtMoeda(r.valorFinal)}</strong></span></div>
      </div>
      ${numeroBloco}
      <div class="row-2">
        <button class="btn btn--ghost" id="btn-finalizar" type="button" ${state.numeroProposta || state.numeroPropostaStatus === 'gerando' ? 'disabled' : ''}>${state.numeroPropostaStatus === 'gerando' ? 'Finalizando…' : 'Finalizar orçamento'}</button>
        <button class="btn btn--primary" id="btn-gerar-pdf" type="button" ${state.numeroProposta ? '' : 'disabled'}>Gerar PDF da proposta</button>
      </div>
      <p class="field__hint" style="margin-top:14px">O PDF é gerado inteiramente no seu navegador — os únicos dados enviados a um servidor são o número e um resumo da proposta, salvos na API de histórico, gravados só ao finalizar.</p>
    `;
  },
  bind(el, state, data, ctx) {
    const btnFinalizar = el.querySelector('#btn-finalizar');
    if (btnFinalizar) {
      btnFinalizar.onclick = async () => {
        state.numeroPropostaStatus = 'gerando';
        ctx.rerender();
        try {
          const resultado = await OdisseStore.proximoNumero();
          state.numeroProposta = resultado.numeroFormatado;
          state.numeroPropostaStatus = 'ok';
          if (resultado.aviso) console.warn(resultado.aviso);
          await OdisseStore.salvarRegistro(resultado.numeroFormatado, state);
        } catch (e) {
          state.numeroPropostaStatus = 'erro';
          console.error(e);
        }
        ctx.rerender();
      };
    }
    const btn = el.querySelector('#btn-gerar-pdf');
    if (btn) btn.onclick = () => {
      OdissePdf.gerar(state, data);
      if (typeof limparRascunho === 'function') limparRascunho();
      if (typeof mostrarConfirmacao === 'function') mostrarConfirmacao();
    };
  },
  validate() { return true; }
});
