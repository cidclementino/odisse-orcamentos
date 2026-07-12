// ==========================================================================
// Orquestração geral: senha, estado, navegação entre etapas, ficha de valores
// ==========================================================================

const CONFIG = {
  // Hash SHA-256 da senha de acesso. Veja README.md → "Trocar a senha" para
  // gerar um novo hash sem deixar a senha em texto puro no código.
  // Senha padrão de fábrica: "odisse2026" — TROQUE assim que publicar
  // (ver README.md → "Trocar a senha de acesso").
  passwordHash: 'b861c55695a5130cdd716d983135490ff669c5649e67c96d79f172b89ed64747'
};

let STATE = null;
let DATA = null;
let currentStepIndex = 0;

function estadoInicial() {
  return {
    cliente: { nome: '', email: '', telefone: '', representacao: 'PF', documento: '', endereco: '' },
    numeroProposta: '',
    dataProposta: new Date().toISOString().slice(0, 10),
    tetoOrcamentario: '',
    servicoId: '',
    macroCategoria: '',
    tipologiaItem: null,
    modificadorIntervencao: 1,
    areaConstruida: 0,
    areaExterna: 0,
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
    entendimentoProjeto: '',
    _calcResult: null,
    _userName: ''
  };
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function updateTicket() {
  const stepData = STEPS[currentStepIndex];
  const ticketTotal = document.getElementById('ticket-total');
  const ticketSub = document.getElementById('ticket-sub');

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

  // se a etapa de revisão estiver ativa, re-renderiza o resumo com o valor novo
  if (stepData && stepData.id === 'revisao') renderStep();
}

function renderRail() {
  const rail = document.getElementById('rail-steps');
  rail.innerHTML = STEPS.map((s, i) => `
    <div class="rail__step ${i === currentStepIndex ? 'is-active' : i < currentStepIndex ? 'is-done' : ''}">
      <span class="rail__step-num">${i + 1}</span>
      <span>${s.title}</span>
    </div>
  `).join('');
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
  renderRail();

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
    renderStep();
  }
}

function goPrev() {
  if (currentStepIndex > 0) {
    currentStepIndex--;
    renderStep();
  }
}

function initApp() {
  document.getElementById('btn-next').onclick = goNext;
  document.getElementById('btn-prev').onclick = goPrev;
  document.getElementById('btn-reset').onclick = () => {
    if (confirm('Recomeçar limpa todos os dados preenchidos. Confirma?')) {
      STATE = estadoInicial();
      STATE._userName = document.getElementById('rail-user').dataset.name || '';
      currentStepIndex = 0;
      renderStep();
    }
  };
  renderStep();
}

async function handleGate(e) {
  e.preventDefault();
  const pass = document.getElementById('gate-password').value;
  const name = document.getElementById('gate-name').value.trim();
  const hash = await sha256(pass);
  const errEl = document.getElementById('gate-error');

  if (hash !== CONFIG.passwordHash) {
    errEl.hidden = false;
    return;
  }
  errEl.hidden = true;

  // Registro local de acesso (apenas neste navegador — ver README sobre
  // como ligar isso a um registro compartilhado de verdade, se necessário).
  try {
    const log = JSON.parse(localStorage.getItem('odisse-acessos') || '[]');
    log.push({ nome: name, quando: new Date().toISOString() });
    localStorage.setItem('odisse-acessos', JSON.stringify(log.slice(-50)));
  } catch (_) { /* localStorage indisponível — segue sem registrar */ }

  document.getElementById('gate').hidden = true;
  const appEl = document.getElementById('app');
  appEl.hidden = false;

  DATA = await OdisseData.load();
  STATE = estadoInicial();
  STATE._userName = name;

  initApp();
}

document.getElementById('gate-form').addEventListener('submit', handleGate);
