// ==========================================================================
// Orquestração geral: estado, navegação entre etapas, ficha de valores
// (senha e autenticação vivem em auth.js + login.html)
// ==========================================================================

let STATE = null;
let DATA = null;
let currentStepIndex = 0;

const RASCUNHO_KEY = 'odisse-orcamento-rascunho';

function salvarRascunho() {
  try {
    localStorage.setItem(RASCUNHO_KEY, JSON.stringify({ state: STATE, currentStepIndex }));
  } catch (_) { /* localStorage indisponível ou cheio — segue sem salvar */ }
}

function carregarRascunho() {
  try {
    const bruto = localStorage.getItem(RASCUNHO_KEY);
    if (!bruto) return null;
    return JSON.parse(bruto);
  } catch (_) {
    return null;
  }
}

function limparRascunho() {
  try { localStorage.removeItem(RASCUNHO_KEY); } catch (_) { /* ignora */ }
}

// Mescla o rascunho salvo por cima de um estado inicial fresco, para que
// campos novos adicionados depois de salvo o rascunho (ex: numa atualização
// da ferramenta) sempre tenham um valor padrão em vez de "undefined".
function mesclarComPadrao(base, salvo) {
  if (!salvo || typeof salvo !== 'object') return base;
  const resultado = { ...base };
  for (const chave of Object.keys(salvo)) {
    const valorBase = base[chave];
    const valorSalvo = salvo[chave];
    if (valorBase && typeof valorBase === 'object' && !Array.isArray(valorBase) &&
        valorSalvo && typeof valorSalvo === 'object' && !Array.isArray(valorSalvo)) {
      resultado[chave] = { ...valorBase, ...valorSalvo };
    } else {
      resultado[chave] = valorSalvo;
    }
  }
  return resultado;
}

function estadoInicial() {
  return {
    cliente: {
      nome: '', email: '', telefone: '', representacao: 'PF', documento: '',
      cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidadeUf: ''
    },
    numeroProposta: '',
    numeroPropostaStatus: '', // '', 'gerando', 'ok', 'erro'
    dataProposta: new Date().toISOString().slice(0, 10),
    tetoOrcamentario: '',
    tetoOrcamentarioNumero: 0,
    prazoEsperadoCliente: '',
    entendimentoProjeto: '',
    servicoId: '',
    macroCategoriaSelecionada: '',
    tipologiaItem: null,
    modificadorIntervencao: 1,
    areaConstruida: 0,
    areaExterna: 0,
    areaTerreno: 0,
    contagemRepeticoes: 0,
    icValores: { empenho_porte: 1, qtd_especialistas: 1, qtd_aprovacoes: 1, grau_detalhamento: 1, grau_resp_civil: 1, grau_intervencao_cliente: 1, expectativa_plastica: 1, grau_controle_custo: 1, indefinicao_escopo: 1, indefinicao_prazo: 1, demanda_midia: 1 },
    fatorAjuste: 1.25,
    reducaoEscopoPercentual: 1,
    etapasSelecionadas: [],
    etapasSemanas: {},
    etapasEntregaveis: {},
    assessoramentoSelecionados: [],
    dataInicio: '',
    descontoAvista: 0.08,
    pctEntrada: 0.35,
    incluirDespesasReembolsaveis: true,
    _calcResult: null,
    _userName: '',
    _maxUnlocked: 0
  };
}

function enderecoCompleto(cliente) {
  const partes = [];
  let linha1 = cliente.logradouro || '';
  if (cliente.numero) linha1 += (linha1 ? ', ' : '') + cliente.numero;
  if (cliente.complemento) linha1 += ' – ' + cliente.complemento;
  if (linha1) partes.push(linha1);
  if (cliente.bairro) partes.push(cliente.bairro);
  if (cliente.cidadeUf) partes.push(cliente.cidadeUf);
  if (cliente.cep) partes.push('CEP ' + cliente.cep);
  return partes.join(' — ');
}

function duracaoTotalSemanas() {
  const data = DATA;
  if (!data) return 0;
  return data.etapas
    .filter(e => STATE.etapasSelecionadas.includes(e.id))
    .reduce((soma, e) => soma + (STATE.etapasSemanas[e.id] || 0), 0);
}

function updateTicket() {
  const ticketTotal = document.getElementById('ticket-total');
  const ticketSub = document.getElementById('ticket-sub');
  const ticketDuracao = document.getElementById('ticket-prazo-duracao');
  const ticketDatas = document.getElementById('ticket-prazo-datas');

  if (STATE.tipologiaItem && STATE.areaConstruida > 0) {
    const resultado = OdisseCalc.calcular({
      tipologia: STATE.tipologiaItem,
      areaConstruida: STATE.areaConstruida,
      areaExterna: STATE.areaExterna,
      contagemRepeticoes: STATE.contagemRepeticoes,
      icValores: STATE.icValores,
      modificadorIntervencao: STATE.modificadorIntervencao,
      fatorAjuste: STATE.fatorAjuste,
      reducaoEscopoPercentual: STATE.reducaoEscopoPercentual
    }, DATA);
    STATE._calcResult = resultado;
    ticketTotal.textContent = OdisseCalc.fmtMoeda(resultado.valorFinal);
    ticketSub.textContent = `Área ${STATE.areaConstruida} m² · fp ${(resultado.fp * 100).toFixed(2)}% · IC ${resultado.ic.toFixed(2)} · ajuste ÷${STATE.fatorAjuste}`;
  } else {
    STATE._calcResult = null;
    ticketTotal.textContent = 'R$ 0,00';
    ticketSub.textContent = 'Preencha a classificação do serviço para iniciar o cálculo';
  }

  const totalSemanas = duracaoTotalSemanas();
  if (totalSemanas > 0 && STATE.dataInicio) {
    const linhas = OdisseCalc.montarCronograma(STATE.dataInicio, DATA.etapas
      .filter(e => STATE.etapasSelecionadas.includes(e.id))
      .map(e => ({ ...e, semanas: STATE.etapasSemanas[e.id] || 0 })));
    const fim = linhas.length ? linhas[linhas.length - 1].fim : null;
    const inicio = new Date(STATE.dataInicio + 'T00:00:00');
    ticketDuracao.textContent = `${totalSemanas} semana${totalSemanas === 1 ? '' : 's'}`;
    ticketDatas.textContent = fim ? `${OdisseCalc.fmtData(inicio)} – ${OdisseCalc.fmtData(fim)}` : '';
  } else if (totalSemanas > 0) {
    ticketDuracao.textContent = `${totalSemanas} semana${totalSemanas === 1 ? '' : 's'}`;
    ticketDatas.textContent = '';
  } else {
    ticketDuracao.textContent = '—';
    ticketDatas.textContent = '';
  }

  renderAlertaOrcamento();
  renderAlertaPrazo();
}

function alertaHtml(texto, tipo) {
  const cor = tipo === 'atencao' ? 'var(--danger)' : 'var(--copper-strong)';
  return `<p class="ticket__alerta" style="color:${cor}">${texto}</p>`;
}

function renderAlertaOrcamento() {
  const box = document.getElementById('ticket-alerta-orcamento');
  if (!box) return;
  const teto = STATE.tetoOrcamentarioNumero;
  const atual = STATE._calcResult ? STATE._calcResult.valorFinal : null;
  if (!teto || !atual) { box.innerHTML = ''; return; }
  const diff = atual - teto;
  const pct = (Math.abs(diff) / teto) * 100;
  if (diff > 0) {
    box.innerHTML = alertaHtml(`Orçamento ${pct.toFixed(0)}% acima do teto do cliente (${OdisseCalc.fmtMoeda(teto)})`, 'atencao');
  } else {
    box.innerHTML = alertaHtml(`Dentro do teto do cliente (${OdisseCalc.fmtMoeda(teto)}) — ${pct.toFixed(0)}% de folga`, 'ok');
  }
}

function renderAlertaPrazo() {
  const box = document.getElementById('ticket-alerta-prazo');
  if (!box) return;
  const opcao = (typeof PRAZO_CLIENTE_OPCOES !== 'undefined') ? PRAZO_CLIENTE_OPCOES.find(o => o.label === STATE.prazoEsperadoCliente) : null;
  const semanasCliente = opcao ? opcao.semanas : null;
  const semanasProjeto = duracaoTotalSemanas();
  if (!semanasCliente || !semanasProjeto) { box.innerHTML = ''; return; }
  const diff = semanasProjeto - semanasCliente;
  if (diff > 0) {
    box.innerHTML = alertaHtml(`Cronograma ${diff} semana${diff === 1 ? '' : 's'} além do prazo esperado pelo cliente (${semanasCliente} sem.)`, 'atencao');
  } else {
    box.innerHTML = alertaHtml(`Dentro do prazo esperado pelo cliente (${semanasCliente} sem.) — ${Math.abs(diff)} sem. de folga`, 'ok');
  }
}

function renderSidebar() {
  const sidebar = document.getElementById('sidebar-steps');
  sidebar.innerHTML = STEPS.map((s, i) => {
    const estado = i === currentStepIndex ? 'is-active' : i <= STATE._maxUnlocked ? 'is-done' : 'is-locked';
    return `
      <button type="button" class="sidebar__step ${estado}" data-step="${i}" ${i > STATE._maxUnlocked ? 'disabled' : ''}>
        <span class="sidebar__step-num">${i + 1}</span>
        <span>${s.title}</span>
      </button>
    `;
  }).join('');
  sidebar.querySelectorAll('.sidebar__step.is-done, .sidebar__step.is-active').forEach(btn => {
    btn.onclick = () => {
      const i = parseInt(btn.dataset.step, 10);
      if (i <= STATE._maxUnlocked) {
        irParaEtapa(i);
      }
    };
  });
  document.getElementById('rail-user').textContent = STATE._userName ? `Olá, ${STATE._userName}` : '';
}

function mostrarConfirmacao() {
  const container = document.getElementById('step-container');
  const nomeCliente = STATE.cliente.nome || 'cliente';
  container.innerHTML = `
    <p class="step__eyebrow">Concluído</p>
    <h1 class="step__title">Orçamento gerado</h1>
    <p class="step__desc">O orçamento de <strong>${nomeCliente}</strong> foi gerado com sucesso${STATE.numeroProposta ? ` — proposta <strong>${STATE.numeroProposta}</strong>` : ''}.</p>
    <div class="row-2">
      <button class="btn btn--ghost" id="btn-baixar-de-novo" type="button">Baixar PDF novamente</button>
      <button class="btn btn--primary" id="btn-novo-orcamento" type="button">Gerar novo orçamento</button>
    </div>
  `;
  document.getElementById('btn-baixar-de-novo').onclick = () => OdissePdf.gerar(STATE, DATA);
  document.getElementById('btn-novo-orcamento').onclick = () => {
    const nome = STATE._userName;
    STATE = estadoInicial();
    STATE._userName = nome;
    currentStepIndex = 0;
    document.querySelector('#ticket .ticket__nav').style.display = '';
    renderStep();
    window.scrollTo(0, 0);
  };
  document.querySelector('#ticket .ticket__nav').style.display = 'none';
  renderSidebar();
}

function renderStep() {
  document.querySelector('#ticket .ticket__nav').style.display = '';
  const step = STEPS[currentStepIndex];
  const container = document.getElementById('step-container');
  container.innerHTML = `
    <p class="step__eyebrow">${step.eyebrow}</p>
    <h1 class="step__title">${step.title}</h1>
    <p class="step__desc">${step.desc}</p>
    ${step.render(STATE, DATA)}
  `;
  step.bind(container, STATE, DATA, { rerender: renderStep, updateTicket });
  renderSidebar();

  document.getElementById('btn-prev').disabled = currentStepIndex === 0;
  document.getElementById('btn-prev').style.display = currentStepIndex === 0 ? 'none' : '';
  const nextBtn = document.getElementById('btn-next');
  nextBtn.textContent = currentStepIndex === STEPS.length - 1 ? 'Concluído' : 'Continuar';
  nextBtn.style.display = currentStepIndex === STEPS.length - 1 ? 'none' : '';

  updateTicket();
  salvarRascunho();
}

// Rola pro topo só quando a pessoa efetivamente troca de etapa (Continuar,
// Voltar, clique na barra lateral) — nunca em re-renderizações internas da
// mesma etapa (ex: marcar uma checkbox), que antes causavam esse mesmo salto.
function irParaEtapa(indice) {
  currentStepIndex = indice;
  salvarRascunho();
  renderStep();
  window.scrollTo(0, 0);
}

function goNext() {
  const step = STEPS[currentStepIndex];
  const ok = step.validate(STATE);
  if (ok !== true) {
    alert(ok);
    return;
  }
  if (currentStepIndex < STEPS.length - 1) {
    STATE._maxUnlocked = Math.max(STATE._maxUnlocked, currentStepIndex + 1);
    irParaEtapa(currentStepIndex + 1);
  }
}

function goPrev() {
  if (currentStepIndex > 0) {
    irParaEtapa(currentStepIndex - 1);
  }
}

async function initApp() {
  document.getElementById('app').hidden = false;
  document.getElementById('btn-next').onclick = goNext;
  document.getElementById('btn-prev').onclick = goPrev;
  document.getElementById('btn-logout').onclick = (e) => {
    e.preventDefault();
    logout();
    window.location.href = 'login.html';
  };
  document.getElementById('btn-reset').onclick = () => {
    if (confirm('Recomeçar limpa todos os dados preenchidos. Confirma?')) {
      const nome = STATE._userName;
      STATE = estadoInicial();
      STATE._userName = nome;
      currentStepIndex = 0;
      limparRascunho();
      renderStep();
      window.scrollTo(0, 0);
    }
  };

  DATA = await OdisseData.load();

  const rascunho = carregarRascunho();
  STATE = mesclarComPadrao(estadoInicial(), rascunho ? rascunho.state : null);
  STATE._userName = getUserName();
  if (rascunho && Number.isInteger(rascunho.currentStepIndex)) {
    currentStepIndex = Math.max(0, Math.min(rascunho.currentStepIndex, STEPS.length - 1));
  }

  // Salva o progresso automaticamente a cada campo preenchido (o formulário
  // continua de onde parou se a pessoa trocar de página) — só é apagado ao
  // clicar em Recomeçar ou ao gerar o PDF final.
  document.getElementById('step-container').addEventListener('input', salvarRascunho);
  document.getElementById('step-container').addEventListener('change', salvarRascunho);

  renderStep();
}

if (isAuthenticated()) initApp();
