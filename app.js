// ==========================================================================
// Orçamento: estado, guia dos passos (esquerda), formulário (centro) e
// prévia de custos e prazos (direita). Os passos não se travam: a guia só
// mostra o que já está completo; o que falta é conferido ao finalizar.
// (senha e autenticação vivem em auth.js + login.html)
// ==========================================================================

let STATE = null;
let DATA = null;      // tabelas de referência do vendas (data/*.json)
let CAT = null;       // catálogo publicado no Universo (catalogo.js)
let currentStepIndex = 0;

const RASCUNHO_KEY = 'odisse-orcamento-rascunho';

function salvarRascunho() {
  try {
    const s = { ...STATE }; delete s._rubricas;
    localStorage.setItem(RASCUNHO_KEY, JSON.stringify({ state: s, currentStepIndex }));
  } catch (_) { /* localStorage indisponível ou cheio — segue sem salvar */ }
}
function carregarRascunho() {
  try { const b = localStorage.getItem(RASCUNHO_KEY); return b ? JSON.parse(b) : null; } catch (_) { return null; }
}
function limparRascunho() {
  try { localStorage.removeItem(RASCUNHO_KEY); } catch (_) { /* ignora */ }
}

// Mescla o rascunho salvo por cima de um estado inicial fresco (campos novos ganham o padrão).
function mesclarComPadrao(base, salvo) {
  if (!salvo || typeof salvo !== 'object') return base;
  const resultado = { ...base };
  for (const chave of Object.keys(salvo)) {
    const vb = base[chave], vs = salvo[chave];
    if (vb && typeof vb === 'object' && !Array.isArray(vb) && vs && typeof vs === 'object' && !Array.isArray(vs)) resultado[chave] = { ...vb, ...vs };
    else resultado[chave] = vs;
  }
  return resultado;
}

function estadoInicial() {
  return {
    versao: 2,
    // projeto
    servicoId: '',
    categoriaId: '',
    usoId: '',
    tipologiaItem: null,          // retrato da tipologia usada no cálculo (calc.js)
    nomeProjeto: '',
    entendimentoProjeto: '',
    areaConstruida: 0,
    areaExterna: 0,
    areaTerreno: 0,
    contagemRepeticoes: 0,
    imovel: { cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidadeUf: '' },
    tetoOrcamentario: '',
    tetoOrcamentarioNumero: 0,
    prazoEsperadoCliente: '',
    // escopo
    etapasSelecionadas: [],
    entregasSelecionadas: {},     // etapa → [entrega]
    clausulasSelecionadas: [],    // eventos opcionais (O) com cláusula marcados
    clausulasQtd: {},             // evento → número que entra no lugar do N
    semanasManual: {},            // etapa → semanas digitadas (sem isso, vale o prazo do PGT)
    icValores: { empenho_porte: 1, qtd_especialistas: 1, qtd_aprovacoes: 1, grau_detalhamento: 1, grau_resp_civil: 1, grau_intervencao_cliente: 1, expectativa_plastica: 1, grau_controle_custo: 1, indefinicao_escopo: 1, indefinicao_prazo: 1, demanda_midia: 1 },
    reducaoEscopoPercentual: 1,
    dataInicio: hojeISO(),
    // honorários e pagamento
    fatorAjuste: 1.25,
    valorFixo: 0,                 // serviços sem preço calculado (ex.: Concurso)
    descontoAvista: 0.08,
    pctEntrada: 0.35,
    maxParcelasCartao: 8,
    maxParcelasBoleto: 8,
    incluirDespesasReembolsaveis: true,
    despesasReembolsaveisSelecionadas: (DATA && DATA.despesasReembolsaveis) ? DATA.despesasReembolsaveis.map(d => d.id) : [],
    // cliente e emissão
    cliente: { nome: '', email: '', telefone: '', representacao: 'PF', documento: '' },
    dataProposta: hojeISO(),
    assinantes: [],               // cópias de quem assina (base/v1/assinantes.js do Universo)
    numeroProposta: '',
    numeroPropostaStatus: '',
    _calcResult: null,
    _versoes: null,               // versões do catálogo usadas (Bases, PGT, Honorários)
    // ligação com o Universo (ver comercial.js)
    _clienteId: null,
    _oportunidadeId: null,
    _propostaId: null,
    _revisaoDe: null,
    _revisaoDeCodigo: null,
    _revisaoDeSimulacao: false,
    _simulacao: false,
    _pdfCongelado: false,
    _erroFinalizar: '',
    _vistos: [],
    _userName: ''
  };
}

function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function enderecoCompleto(im) {
  im = im || {};
  const partes = [];
  let linha1 = im.logradouro || '';
  if (im.numero) linha1 += (linha1 ? ', ' : '') + im.numero;
  if (im.complemento) linha1 += ' – ' + im.complemento;
  if (linha1) partes.push(linha1);
  if (im.bairro) partes.push(im.bairro);
  if (im.cidadeUf) partes.push(im.cidadeUf);
  if (im.cep) partes.push('CEP ' + im.cep);
  return partes.join(' — ');
}

// ---------------------------------------------------------------- derivados
// Semanas de cada etapa: o que foi digitado ou, sem isso, o prazo do PGT (sequência das entregas
// marcadas × faixa de área).
function prazoCalculado(state, etapaId) {
  const f = Catalogo.faixa(state.areaConstruida);
  const p = Catalogo.prazoEtapa(etapaId, state.servicoId, state.entregasSelecionadas[etapaId] || [], state.clausulasSelecionadas, f.mult);
  return { semanas: Catalogo.semanasDe(p.turnos), semPrazo: p.semPrazo };
}
function semanasDaEtapa(state, etapaId) {
  const m = state.semanasManual[etapaId];
  return m != null && m !== '' ? Number(m) : prazoCalculado(state, etapaId).semanas;
}
// Etapas contratadas na ordem do PGT, com fase e semanas.
function etapasContratadas(state) {
  return Catalogo.etapasDoServico(state.servicoId).filter(e => state.etapasSelecionadas.includes(e.id))
    .map(e => ({ ...e, semanas: semanasDaEtapa(state, e.id) }));
}
function duracaoTotalSemanas() {
  return etapasContratadas(STATE).reduce((s, e) => s + (e.semanas || 0), 0);
}

function recalcular(state) {
  const srv = Catalogo.servico(state.servicoId);
  state.tipologiaItem = Catalogo.tipologia(state.usoId);
  state.reducaoEscopoPercentual = Catalogo.percentual(state.servicoId, state.etapasSelecionadas).percentual;
  state._versoes = CAT ? Object.fromEntries(Object.entries(CAT.versoes).map(([k, v]) => [k, v.numero])) : null;
  if (srv && !srv.com_preco) {
    state._calcResult = state.valorFixo > 0 ? { semPreco: true, valorFinal: state.valorFixo } : null;
    return;
  }
  if (srv && state.tipologiaItem && state.areaConstruida > 0) {
    state._calcResult = OdisseCalc.calcular({
      tipologia: state.tipologiaItem,
      areaConstruida: state.areaConstruida,
      areaExterna: state.areaExterna,
      contagemRepeticoes: state.contagemRepeticoes,
      icValores: state.icValores,
      modificadorIntervencao: srv.modificador || 1,
      fatorAjuste: state.fatorAjuste,
      reducaoEscopoPercentual: state.reducaoEscopoPercentual
    }, DATA);
  } else {
    state._calcResult = null;
  }
}

// ---------------------------------------------------------------- prévia (coluna da direita)
function alertaHtml(texto, tipo) {
  return `<p class="previa__alerta ${tipo === 'atencao' ? 'is-atencao' : 'is-ok'}">${texto}</p>`;
}

function updateTicket() {
  recalcular(STATE);
  const box = document.getElementById('orc-previa');
  if (!box) return;
  const s = STATE, r = s._calcResult, srv = Catalogo.servico(s.servicoId);
  const etapas = etapasContratadas(s);
  const total = etapas.reduce((a, e) => a + (e.semanas || 0), 0);
  let fim = null;
  if (total > 0 && s.dataInicio) {
    const l = OdisseCalc.montarCronograma(s.dataInicio, etapas.filter(e => e.semanas > 0));
    fim = l.length ? l[l.length - 1].fim : null;
  }
  const fmt = OdisseCalc.fmtMoeda;
  const pct = Catalogo.percentual(s.servicoId, s.etapasSelecionadas);
  const valor = r ? r.valorFinal : 0;
  const distrib = r && etapas.length ? distribuirHonorario(s, valor, etapas) : [];
  const semPrazo = etapas.filter(e => !e.semanas).length;

  let alertas = '';
  if (s.tetoOrcamentarioNumero && r) {
    const diff = valor - s.tetoOrcamentarioNumero, p = (Math.abs(diff) / s.tetoOrcamentarioNumero) * 100;
    alertas += diff > 0 ? alertaHtml(`${p.toFixed(0)}% acima do teto do cliente (${fmt(s.tetoOrcamentarioNumero)})`, 'atencao')
      : alertaHtml(`Dentro do teto do cliente (${fmt(s.tetoOrcamentarioNumero)}), ${p.toFixed(0)}% de folga`, 'ok');
  }
  const opc = PRAZO_CLIENTE_OPCOES.find(o => o.label === s.prazoEsperadoCliente);
  if (opc && opc.semanas && total) {
    const d = total - opc.semanas;
    alertas += d > 0 ? alertaHtml(`${d} semana${d === 1 ? '' : 's'} além do prazo esperado (${opc.semanas} sem.)`, 'atencao')
      : alertaHtml(`Dentro do prazo esperado (${opc.semanas} sem.), ${Math.abs(d)} sem. de folga`, 'ok');
  }
  if (semPrazo) alertas += alertaHtml(`${semPrazo} etapa${semPrazo === 1 ? '' : 's'} sem prazo: as entregas ainda não têm duração no PGT. Informe as semanas em Cronograma.`, 'atencao');

  box.innerHTML = `
    <div class="previa__bloco">
      <span class="previa__rotulo">Honorário${srv && !srv.com_preco ? ' (valor fixo)' : ''}</span>
      <span class="previa__valor">${fmt(valor)}</span>
      <span class="previa__sub">${r && !r.semPreco ? `Tabela CAU ${fmt(r.valorCau)} · ÷${String(s.fatorAjuste).replace('.', ',')} · ${Math.round(s.reducaoEscopoPercentual * 100)}% do serviço` : srv && !srv.com_preco ? 'Serviço sem preço calculado: informe o valor em Honorários.' : 'Escolha serviço, tipologia e área para calcular.'}</span>
      ${r && !r.semPreco ? `<span class="previa__sub">BH ${fmt(r.bh)}/m² · fp ${(r.fp * 100).toFixed(2).replace('.', ',')}% · IC ${r.ic.toFixed(2).replace('.', ',')}</span>` : ''}
    </div>
    <div class="previa__bloco">
      <span class="previa__rotulo">Prazo</span>
      <span class="previa__valor previa__valor--m">${total ? `${fmtSemanas(total)}` : '—'}</span>
      <span class="previa__sub">${total && s.dataInicio && fim ? `${OdisseCalc.fmtData(new Date(s.dataInicio + 'T00:00:00'))} – ${OdisseCalc.fmtData(fim)}` : ''}${Catalogo.faixa(s.areaConstruida).indice > 1 ? ` · faixa ${Catalogo.faixa(s.areaConstruida).indice} (×${String(Catalogo.faixa(s.areaConstruida).mult).replace('.', ',')})` : ''}</span>
    </div>
    ${etapas.length ? `<div class="previa__bloco">
      <span class="previa__rotulo">Etapas${pct.porEtapa ? ` · ${Math.round(pct.percentual * 100)}%` : ''}</span>
      <table class="previa__tabela"><tbody>
        ${etapas.map((e, i) => `<tr><td><b>${escHtml(e.sigla)}</b> ${escHtml(e.nome)}</td><td>${e.semanas ? fmtSemanas(e.semanas, true) : '<span class="previa__falta">—</span>'}</td><td>${distrib[i] ? (distrib[i].valor > 0 ? fmt(distrib[i].valor) : 'incluído') : ''}</td></tr>`).join('')}
      </tbody></table>
      ${pct.porEtapa && pct.incremento > 0 ? `<span class="previa__sub">Base ${Math.round(pct.base * 100)}% + ${Math.round(pct.incremento * 100)}% por etapas anteriores não contratadas</span>` : ''}
    </div>` : ''}
    ${alertas ? `<div class="previa__bloco">${alertas}</div>` : ''}
  `;
  renderGuia();
}
const fmtSemanas = (n, curto) => `${String(n).replace('.', ',')} ${curto ? 'sem.' : n === 1 ? 'semana' : 'semanas'}`;

// O que a proposta promete, com os textos do PGT do momento (vai no retrato da proposta e alimenta o PDF):
// fases com a descrição, etapas com descrição, semanas e entregas marcadas; o que não está incluído; cláusulas.
function resumoProposta(state) {
  const srv = Catalogo.servico(state.servicoId);
  const etapas = etapasContratadas(state);
  const valor = state._calcResult ? state._calcResult.valorFinal : 0;
  const dist = etapas.length ? distribuirHonorario(state, valor, etapas) : [];
  const fases = [];
  etapas.forEach((e, i) => {
    let f = fases.find((x) => x.id === e.fase_id);
    if (!f) fases.push(f = { id: e.fase_id, nome: e.fase.nome, descricao: e.fase.descricao || '', etapas: [] });
    const sel = state.entregasSelecionadas[e.id] || [];
    const ents = Catalogo.entregasDaEtapa(e.id, state.servicoId, state.categoriaId);
    f.etapas.push({ id: e.id, sigla: e.sigla, nome: e.nome, descricao: e.descricao || '', semanas: e.semanas || 0,
      valor: dist[i] ? dist[i].valor : null, entregas: ents.filter((x) => sel.includes(x.id)).map((x) => x.texto) });
  });
  const naoInclui = [];
  for (const e of Catalogo.etapasDoServico(state.servicoId)) {
    if (!state.etapasSelecionadas.includes(e.id)) { naoInclui.push(`Etapa ${e.nome}`); continue; }
    const sel = state.entregasSelecionadas[e.id] || [];
    for (const x of Catalogo.entregasDaEtapa(e.id, state.servicoId, state.categoriaId)) if (!sel.includes(x.id)) naoInclui.push(x.texto);
  }
  const clausulas = Catalogo.clausulas(state.etapasSelecionadas, state.servicoId)
    .filter((c) => c.pert === 'P' || state.clausulasSelecionadas.includes(c.id))
    .map((c) => Catalogo.textoClausula(c.clausula, state.clausulasQtd[c.id]));
  return {
    servico: srv ? srv.nome : null, servico_sigla: srv ? srv.sigla : null, preco_por_etapa: !!(srv && srv.preco_por_etapa),
    tipologia: state.tipologiaItem ? state.tipologiaItem.descricao : null,
    etapas: etapas.map((e) => ({ id: e.id, sigla: e.sigla, nome: e.nome, fase: e.fase.nome, semanas: e.semanas || null })),
    fases, naoInclui, clausulas, versoes: state._versoes,
  };
}

// Honorário por etapa: pelo peso publicado (serviço com preço por etapa) ou pela duração.
function distribuirHonorario(state, valor, etapas) {
  const pesos = etapas.map(e => Catalogo.peso(e.id, state.servicoId));
  const soma = pesos.reduce((a, p) => a + (p || 0), 0);
  if (soma > 0) return etapas.map((e, i) => ({ nome: e.nome, sigla: e.sigla, valor: valor * ((pesos[i] || 0) / soma) }));
  return OdisseCalc.distribuirPorEtapa(valor, etapas.map(e => ({ nome: e.nome, sigla: e.sigla, semanas: e.semanas || 0 })));
}

// ---------------------------------------------------------------- guia (coluna da esquerda)
function pendencias(state) {
  return STEPS.map((s, i) => ({ i, titulo: s.title, msg: s.validate(state) })).filter(x => x.msg !== true);
}

function renderGuia() {
  const guia = document.getElementById('orc-guia-passos');
  if (!guia) return;
  guia.innerHTML = STEPS.map((s, i) => {
    // ✓ só depois de passar pelo passo (e, na revisão, depois de numerada); antes disso, o número
    const visto = (STATE._vistos || []).includes(s.id);
    const ok = i === STEPS.length - 1 ? !!STATE.numeroProposta : visto && s.validate(STATE) === true;
    const estado = [i === currentStepIndex ? 'is-active' : '', ok ? 'is-ok' : visto ? 'is-pendente' : ''].join(' ');
    const msg = s.validate(STATE);
    return `<button type="button" class="guia__passo ${estado}" data-step="${i}" title="${ok ? 'Completo' : msg === true ? '' : escHtml(msg)}">
        <span class="guia__num">${ok ? '✓' : i + 1}</span><span>${s.title}</span></button>`;
  }).join('');
  guia.querySelectorAll('[data-step]').forEach(b => { b.onclick = () => irParaEtapa(parseInt(b.dataset.step, 10)); });
  const v = document.getElementById('orc-versoes');
  if (v && CAT) {
    const d = (x) => x ? new Date(x).toLocaleDateString('pt-BR') : '';
    v.innerHTML = `PGT v${CAT.versoes.pgt.numero} · Bases v${CAT.versoes.bases.numero} · Honorários v${CAT.versoes.honorarios.numero}`
      + `<br><span>publicados no Universo (último: ${d([CAT.versoes.pgt, CAT.versoes.bases, CAT.versoes.honorarios].map(x => x.publicado_em).sort().pop())})</span>`;
  }
}

function mostrarConfirmacao() {
  const container = document.getElementById('step-container');
  const nomeCliente = STATE.cliente.nome || (STATE._simulacao ? 'simulação' : 'cliente');
  container.innerHTML = `
    <p class="step__eyebrow">Concluído</p>
    <h1 class="step__title">Orçamento gerado</h1>
    <p class="step__desc">O orçamento de <strong>${escHtml(nomeCliente)}</strong> foi gerado${STATE.numeroProposta ? `: proposta <strong>${escHtml(STATE.numeroProposta)}</strong>` : ''}.</p>
    <div class="row-2">
      <button class="btn btn--ghost" id="btn-baixar-de-novo" type="button">Baixar PDF novamente</button>
      <button class="btn btn--primary u-botao forte" id="btn-novo-orcamento" type="button">Ver em Propostas</button>
    </div>
  `;
  document.getElementById('btn-baixar-de-novo').onclick = () => OdissePdf.gerar(STATE, DATA);
  document.getElementById('btn-novo-orcamento').onclick = () => { location.hash = '#/'; };
  document.getElementById('orc-nav').hidden = true;
}

function marcarVisto() {
  const id = STEPS[currentStepIndex] && STEPS[currentStepIndex].id;
  if (id && !(STATE._vistos || []).includes(id)) STATE._vistos = [...(STATE._vistos || []), id];
}

function renderStep() {
  document.getElementById('orc-nav').hidden = false;
  const step = STEPS[currentStepIndex];
  const container = document.getElementById('step-container');
  container.innerHTML = `
    <p class="step__eyebrow">Passo ${currentStepIndex + 1} de ${STEPS.length}</p>
    <h1 class="step__title">${step.title}</h1>
    <p class="step__desc">${step.desc}</p>
    ${step.render(STATE, DATA)}
  `;
  step.bind(container, STATE, DATA, { rerender: renderStep, updateTicket });

  const prev = document.getElementById('btn-prev'), next = document.getElementById('btn-next');
  prev.hidden = currentStepIndex === 0;
  next.hidden = currentStepIndex === STEPS.length - 1;
  if (!next.hidden) next.textContent = `${STEPS[currentStepIndex + 1].title} →`;
  if (!prev.hidden) prev.textContent = `← ${STEPS[currentStepIndex - 1].title}`;

  updateTicket();
  salvarRascunho();
}

function irParaEtapa(indice) {
  marcarVisto();
  currentStepIndex = Math.max(0, Math.min(indice, STEPS.length - 1));
  salvarRascunho();
  renderStep();
  window.scrollTo(0, 0);
}

// ---------------------------------------------------------------- página Propostas
// Uma página só, como o marketing.odisse: em cima "Nova proposta" (um quadro por serviço, que abre o
// editor), embaixo o histórico de 10 em 10 com navegação de e-mail. O editor (as três colunas acima)
// fica em #/editor; o rascunho em andamento continua no computador e aparece como "Continuar".
const emEditor = () => location.hash.startsWith('#/editor');
let editorPronto = false;
let erroCatalogo = null;

function rota() {
  const ed = emEditor();
  document.getElementById('pp-lista').hidden = ed;
  document.getElementById('pp-editor').hidden = !ed;
  document.title = ed ? 'Nova proposta · Vendas — Odisse' : 'Propostas · Vendas — Odisse';
  if (ed) abrirEditor(); else Lista.abrir();
  window.scrollTo(0, 0);
}

function abrirEditor() {
  const container = document.getElementById('step-container');
  if (erroCatalogo || !CAT) {
    container.innerHTML = `<p class="step__eyebrow">Proposta</p><h1 class="step__title">Não consegui ler o catálogo do Universo</h1>
      <p class="step__desc">Serviços, etapas e honorários vêm das versões publicadas em Bases, Plano Geral de Trabalho e Honorários (${escHtml(erroCatalogo ? erroCatalogo.message : 'carregando')}).
      Confira se as três já foram publicadas e recarregue a página.</p>`;
    document.getElementById('orc-nav').hidden = true;
    return;
  }
  // o rascunho é a fonte: pode ter vindo do funil, de uma revisão ou de um quadro de serviço
  const rascunho = carregarRascunho();
  let salvo = rascunho ? rascunho.state : null;
  document.getElementById('orc-aviso').hidden = true;
  if (salvo && salvo.versao !== 2 && Object.keys(salvo).some(k => !['cliente', '_oportunidadeId', '_clienteId', '_maxUnlocked'].includes(k))) {
    salvo = Catalogo.migrar(salvo, estadoInicial());
    avisoTopo('Este orçamento foi feito antes da leitura do PGT: serviço, tipologia e etapas foram trazidos para a estrutura nova. Confira as entregas e os prazos.');
  } else if (salvo && salvo.versao !== 2) {
    const c = salvo.cliente || {};
    salvo = { ...salvo, versao: 2, cliente: { nome: c.nome || '', email: c.email || '', telefone: c.telefone || '', representacao: c.representacao || 'PF', documento: c.documento || '' } };
  }
  STATE = mesclarComPadrao(estadoInicial(), salvo);
  STATE._userName = getUserName();
  currentStepIndex = rascunho && Number.isInteger(rascunho.currentStepIndex) ? Math.max(0, Math.min(rascunho.currentStepIndex, STEPS.length - 1)) : 0;
  const t = document.getElementById('orc-trilha-atual');
  if (t) t.textContent = STATE._revisaoDeCodigo ? `Revisão de ${STATE._revisaoDeCodigo}` : STATE.numeroProposta || (STATE._simulacao ? 'Nova simulação' : 'Nova proposta');
  if (!editorPronto) {
    container.addEventListener('input', salvarRascunho);
    container.addEventListener('change', salvarRascunho);
    editorPronto = true;
  }
  renderStep();
}

// Começa uma proposta nova (descarta o rascunho), já com o serviço escolhido no quadro.
function novaProposta({ servicoId = '', simulacao = false } = {}) {
  STATE = estadoInicial();
  STATE._simulacao = simulacao;
  if (servicoId) { STATE.servicoId = servicoId; aplicarServico(STATE); }
  currentStepIndex = 0;
  salvarRascunho();
  location.hash = '#/editor';
}

// Rascunho em andamento (para o quadro "Continuar"), sem montar o editor.
function rascunhoEmAndamento() {
  const r = carregarRascunho();
  const s = r && r.state;
  if (!s || s.numeroProposta && s._pdfCongelado) return null;
  const tem = s.servicoId || (s.cliente && s.cliente.nome) || s._oportunidadeId || s._revisaoDe;
  return tem ? { s, passo: Number.isInteger(r.currentStepIndex) ? r.currentStepIndex : 0 } : null;
}

const Lista = (() => {
  const POR_PAGINA = 10;
  let de = 0, q = '', filtro = 'todas', ultimo = null, ligado = false, tBusca = null, rodada = 0;

  const situacaoChip = (p) => {
    const cls = p.situacao === 'aceita' ? 'chip--ok' : p.situacao === 'recusada' || p.situacao === 'expirada' ? 'chip--perda' : p.situacao === 'enviada' ? 'chip--cobre' : '';
    return `<span class="chip ${cls}">${escHtml(nomeDe(SITUACOES_PROPOSTA, p.situacao))}</span>`;
  };

  function quadros() {
    const box = document.getElementById('pp-tiles');
    const r = rascunhoEmAndamento();
    const srvNome = (id) => { const x = CAT && Catalogo.servico(id); return x ? x.nome : ''; };
    const continuar = r ? `<div class="pp-tile pp-tile--rascunho">
        <span class="pp-tile__sigla">Rascunho</span>
        <span class="pp-tile__nome">${escHtml(r.s._revisaoDeCodigo ? 'Revisão de ' + r.s._revisaoDeCodigo : [srvNome(r.s.servicoId), r.s.cliente && r.s.cliente.nome].filter(Boolean).join(' · ') || 'Proposta em andamento')}</span>
        <span class="pp-tile__sub">parado em ${escHtml((STEPS[r.passo] || STEPS[0]).title)}</span>
        <span class="pp-tile__acoes"><button type="button" class="btn btn--small u-botao forte btn--primary" data-continuar>Continuar</button>
          <button type="button" class="btn-link" data-descartar>descartar</button></span>
      </div>` : '';
    const servicos = CAT ? CAT.servicos : [];
    box.innerHTML = continuar + servicos.map(x => `<button type="button" class="pp-tile" data-servico="${x.id}" title="${escHtml(x.descricao || '')}">
        <span class="pp-tile__sigla">${escHtml(x.sigla)}</span><span class="pp-tile__nome">${escHtml(x.nome)}</span>
        ${x.com_preco ? '' : '<span class="pp-tile__sub">sem preço calculado</span>'}</button>`).join('')
      + `<button type="button" class="pp-tile pp-tile--sim" data-simulacao><span class="pp-tile__sigla">Sim</span><span class="pp-tile__nome">Simulação</span><span class="pp-tile__sub">sem cliente, para estimar custo</span></button>`
      + (erroCatalogo ? `<p class="small muted">Não consegui ler os serviços do Universo (${escHtml(erroCatalogo.message)}).</p>` : '');
    const confirmar = () => !r || confirm('Começar uma proposta nova descarta o rascunho em andamento. Continuar?');
    box.querySelectorAll('[data-servico]').forEach(b => { b.onclick = () => { if (confirmar()) novaProposta({ servicoId: b.dataset.servico }); }; });
    box.querySelector('[data-simulacao]').onclick = () => { if (confirmar()) novaProposta({ simulacao: true }); };
    const c = box.querySelector('[data-continuar]');
    if (c) c.onclick = () => { location.hash = '#/editor'; };
    const d = box.querySelector('[data-descartar]');
    if (d) d.onclick = () => { if (confirm('Descartar o rascunho em andamento?')) { limparRascunho(); quadros(); } };
  }

  function parametros() {
    const p = { de, limite: POR_PAGINA };
    if (q) p.q = q;
    if (filtro === 'propostas') p.simulacoes = '0';
    if (filtro === 'simulacoes') p.simulacoes = 'so';
    return p;
  }

  function desenhar(r) {
    ultimo = r;
    const box = document.getElementById('pp-itens');
    const info = document.getElementById('pp-info');
    const pag = document.getElementById('pp-pag');
    const fim = Math.min(r.de + r.itens.length, r.total);
    info.textContent = r.total ? `${r.total} ${r.total === 1 ? 'proposta' : 'propostas'}${q ? ` para “${q}”` : ''}` : '';
    pag.innerHTML = r.total ? `<span class="pp-pag__faixa">${r.de + 1}–${fim} de ${r.total}</span>
      <button type="button" class="pp-pag__seta" data-pag="-1" ${r.de === 0 ? 'disabled' : ''} title="Mais novas" aria-label="Mais novas">‹</button>
      <button type="button" class="pp-pag__seta" data-pag="1" ${fim >= r.total ? 'disabled' : ''} title="Mais antigas" aria-label="Mais antigas">›</button>` : '';
    pag.querySelectorAll('[data-pag]').forEach(b => { b.onclick = () => { de = Math.max(0, de + Number(b.dataset.pag) * POR_PAGINA); carregar(); }; });
    if (!r.itens.length) { box.innerHTML = `<div class="pp-vazio">${q || filtro !== 'todas' ? 'Nenhuma proposta encontrada.' : 'Nenhuma proposta ainda.'}</div>`; return; }
    box.innerHTML = r.itens.map(p => `
      <div class="pp-linha${p.simulacao ? ' pp-linha--sim' : ''}">
        <div class="pp-linha__cod"><strong>${escHtml(p.codigo)}</strong><span class="small muted">${p.data ? new Date(p.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span></div>
        <div class="pp-linha__quem">
          <span class="pp-linha__cliente">${p.simulacao ? 'Simulação' : escHtml(p.cliente_nome || '—')}</span>
          <span class="small muted">${escHtml(p.titulo || '')}${p.oportunidade_id && !p.simulacao ? ` · <a href="crm.html#${p.oportunidade_id}">${escHtml(p.oportunidade_titulo || 'oportunidade')}</a>` : ''}${p.importada_de ? ' · importada' : ''}</span>
        </div>
        <div class="pp-linha__valor tabular">${fmtCentavos(p.valor_total)}</div>
        <div>${situacaoChip(p)}</div>
        <div class="pp-linha__acoes">
          <button class="btn btn--ghost btn--small" data-pdf="${p.id}" title="${p.arquivo_pdf_id ? 'PDF guardado, como foi para o cliente' : 'Sem PDF guardado: remonta pelo cálculo'}">PDF</button>
          <button class="btn btn--ghost btn--small" data-rev="${p.id}" title="Abre no editor com o mesmo número e a revisão seguinte">Revisão</button>
        </div>
      </div>`).join('');
    box.querySelectorAll('[data-pdf]').forEach(b => b.onclick = async () => {
      const rotulo = b.textContent; b.textContent = 'Baixando…'; b.disabled = true;
      try {
        const completo = await Universo.ler('propostas', b.dataset.pdf);
        const como = await Comercial.baixarPdf(completo, DATA);
        if (como === 'remontado') alert('Esta proposta não tem PDF guardado: o PDF foi remontado a partir do cálculo salvo.');
      } catch (e) { alert('Não consegui baixar: ' + e.message); }
      b.textContent = rotulo; b.disabled = false;
    });
    box.querySelectorAll('[data-rev]').forEach(b => b.onclick = async () => {
      const p = await Universo.ler('propostas', b.dataset.rev);
      if (confirm(`Abrir ${p.codigo} no editor como revisão? O rascunho em andamento (se houver) será substituído.`)) Comercial.abrirNoOrcamento(p, { comoRevisao: true });
    });
  }

  async function carregar() {
    const minha = ++rodada;
    const p = parametros();
    const padrao = de === 0 && !q && filtro === 'todas';
    const box = document.getElementById('pp-itens');
    try {
      const buscar = () => Universo.propostas(p);
      const r = padrao ? await comCopia('propostas:p1', buscar, (novo) => { if (minha === rodada) desenhar(novo); }) : await buscar();
      if (minha === rodada) desenhar(r);
    } catch (e) {
      if (minha === rodada) box.innerHTML = `<div class="pp-vazio">Não consegui carregar o histórico agora (${escHtml(e.message)}).</div>`;
    }
  }

  function ligar() {
    if (ligado) return;
    ligado = true;
    const busca = document.getElementById('pp-busca');
    busca.oninput = () => { clearTimeout(tBusca); tBusca = setTimeout(() => { q = busca.value.trim(); de = 0; carregar(); }, 300); };
    document.querySelectorAll('[data-filtro]').forEach(b => b.onclick = () => {
      filtro = b.dataset.filtro; de = 0;
      document.querySelectorAll('[data-filtro]').forEach(x => x.classList.toggle('is-on', x === b));
      carregar();
    });
    avisoMigracao();
  }

  async function avisoMigracao() {
    try {
      const res = await fetch(`${CONFIG.workerUrl}/kv/estado`, { headers: cabecalhosAuth() });
      if (!res.ok) return;
      const kv = await res.json();
      if (!kv.encerrado && kv.total) document.getElementById('pp-aviso').innerHTML =
        `<div class="aviso">Há ${kv.total} propostas no histórico antigo que ainda precisam ser trazidas para o Universo. <a href="migrar.html" style="color:var(--destaque-texto)">Abrir a migração →</a></div>`;
    } catch (_) { /* sem aviso */ }
  }

  function abrir() { ligar(); quadros(); carregar(); }
  return { abrir, quadros };
})();

async function initApp() {
  document.getElementById('app').hidden = false;
  document.getElementById('btn-next').onclick = () => irParaEtapa(currentStepIndex + 1);
  document.getElementById('btn-prev').onclick = () => irParaEtapa(currentStepIndex - 1);
  document.getElementById('btn-reset').onclick = () => {
    if (!confirm('Recomeçar limpa todos os dados preenchidos. Confirma?')) return;
    const nome = STATE._userName;
    STATE = estadoInicial();
    STATE._userName = nome;
    currentStepIndex = 0;
    limparRascunho();
    renderStep();
    window.scrollTo(0, 0);
  };

  // tabelas do vendas e catálogo do Universo: as duas abrem na hora pela cópia local
  [DATA, CAT] = await Promise.all([
    OdisseData.load(),
    Catalogo.carregar({
      aoAtualizar: (novo) => {
        CAT = novo;
        if (emEditor()) {
          avisoTopo(`Nova versão publicada no Universo (PGT v${novo.versoes.pgt.numero}, Bases v${novo.versoes.bases.numero}, Honorários v${novo.versoes.honorarios.numero}). O orçamento passa a usá-la.`);
          renderStep();
        } else Lista.quadros();
      }
    }).catch((e) => { erroCatalogo = e; return null; })
  ]);
  window.addEventListener('hashchange', rota);
  rota();
}

function avisoTopo(texto) {
  const a = document.getElementById('orc-aviso');
  if (!a) return;
  a.innerHTML = `<span>${escHtml(texto)}</span><button type="button" class="btn-link">fechar</button>`;
  a.hidden = false;
  a.querySelector('button').onclick = () => { a.hidden = true; };
}

if (isAuthenticated()) initApp();
