// ==========================================================================
// Orquestração geral: estado, navegação entre etapas, ficha de valores
// (senha e autenticação vivem em auth.js + login.html)
// ==========================================================================

let STATE = null;
let DATA = null;
let currentStepIndex = 0;

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
    entendimentoProjeto: '',
    servicoId: '',
    tipologiaItem: null,
    modificadorIntervencao: 1,
    areaConstruida: 0,
    areaExterna: 0,
    areaTerreno: 0,
    contagemRepeticoes: 0,
    icValores: { empenho_porte: 1, qtd_especialistas: 1, qtd_aprovacoes: 1, grau_detalhamento: 1, grau_resp_civil: 1, grau_intervencao_cliente: 1, expectativa_plastica: 1, grau_controle_custo: 1, indefinicao_escopo: 1, indefinicao_prazo: 1 },
    fatorAjuste: 1.25,
    reducaoEscopoPercentual: 1,
    compreendeSelecionados: [],
    naoCompreendeSelecionados: [],
    etapasSelecionadas: [],
    etapasSemanas: {},
    dataInicio: '',
    descontoAvista: 0.08,
    pctEntrada: 0.35,
    incluirAcompanhamentoObra: true,
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
  const stepData = STEPS[currentStepIndex];
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

  // se a etapa de revisão ou pagamento estiver ativa, re-renderiza para refletir o valor novo
  if (stepData && (stepData.id === 'revisao' || stepData.id === 'pagamento')) renderStep();
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
        currentStepIndex = i;
        renderStep();
      }
    };
  });
  document.getElementById('rail-user').textContent = STATE._userName ? `Olá, ${STATE._userName}` : '';
}

function renderStep() {
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
  document.getElementById('btn-prev').style.visibility = currentStepIndex === 0 ? 'hidden' : 'visible';
  const nextBtn = document.getElementById('btn-next');
  nextBtn.textContent = currentStepIndex === STEPS.length - 1 ? 'Concluído' : 'Continuar';
  nextBtn.style.display = currentStepIndex === STEPS.length - 1 ? 'none' : '';

  window.scrollTo(0, 0);
  updateTicket();
}

function goNext() {
  const step = STEPS[currentStepIndex];
  const ok = step.validate(STATE);
  if (ok !== true) {
    alert(ok);
    return;
  }
  if (currentStepIndex < STEPS.length - 1) {
    currentStepIndex++;
    STATE._maxUnlocked = Math.max(STATE._maxUnlocked, currentStepIndex);
    renderStep();
  }
}

function goPrev() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    renderStep();
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
      renderStep();
    }
  };

  DATA = await OdisseData.load();
  STATE = estadoInicial();
  STATE._userName = getUserName();

  renderStep();
}

if (isAuthenticated()) initApp();
