// ==========================================================================
// Catálogo do serviço — o que o orçamento lê do Universo (desde nov/2026).
//
// Estrutura e custo vêm das versões PUBLICADAS no Universo, não mais dos
// data/*.json deste repositório:
//   - Bases (Projetos):      serviços, categorias e usos (tipologias), faixas de prazo por área
//   - PGT (Projetos):        fases, etapas, entregas e eventos (com as cláusulas)
//   - Honorários (vendas):   preço dos serviços, pesos das etapas, parcelas
// Ficam no vendas só as tabelas de referência do cálculo: CUB, fator percentual, redutor de
// repetição, critérios do IC, juros do cartão e despesas reembolsáveis (data/*.json).
//
// Cópia local: abre na hora com a última cópia guardada e confere por baixo se houve
// publicação nova (aoAtualizar avisa a tela). A proposta registra as três versões usadas.
// ==========================================================================

const Catalogo = (() => {
  const CHAVE = 'vendas:catalogo';
  const TIPOS = ['bases', 'pgt', 'honorarios'];
  const TURNOS_SEMANA = 10; // 1 turno = 4 h; 1 dia = 2 turnos; 1 semana = 5 dias
  let C = null;

  function ler() { try { return JSON.parse(localStorage.getItem(CHAVE) || 'null'); } catch (_) { return null; } }
  function gravar(p) { try { localStorage.setItem(CHAVE, JSON.stringify(p)); } catch (_) { /* cheio: segue sem cópia */ } }
  const numeros = (p) => TIPOS.map((t) => (p && p[t] ? p[t].numero : 0)).join('.');

  async function buscar() {
    const l = await Promise.all(TIPOS.map((t) => Universo.get('publicacoes/ultima', { tipo: t })));
    return Object.fromEntries(TIPOS.map((t, i) => [t, l[i]]));
  }

  async function carregar({ aoAtualizar } = {}) {
    const guardado = ler();
    if (guardado && TIPOS.every((t) => guardado[t] && guardado[t].dados)) {
      C = montar(guardado);
      buscar().then((novo) => {
        if (numeros(novo) === numeros(guardado)) return;
        gravar(novo);
        C = montar(novo);
        if (aoAtualizar) aoAtualizar(C);
      }).catch(() => { /* sem rede: segue com a cópia */ });
      return C;
    }
    const novo = await buscar();
    gravar(novo);
    C = montar(novo);
    return C;
  }

  // ---------------------------------------------------------------- índices
  function montar(pub) {
    const B = pub.bases.dados, P = pub.pgt.dados, H = pub.honorarios.dados;
    const preco = Object.fromEntries((H.servicos || []).map((s) => [s.id, s]));
    const servicos = B.servicos.map((s) => {
      const h = preco[s.id] || {};
      return { ...s, modificador: h.modificador ?? null, com_preco: !!h.com_preco, preco_por_etapa: !!h.preco_por_etapa };
    });
    const parcelaFase = Object.fromEntries((H.fases || []).map((f) => [f.id, f.parcela]));
    const fases = P.fases.map((f) => ({ ...f, parcela: parcelaFase[f.id] ?? null }));
    const fasePorId = Object.fromEntries(fases.map((f) => [f.id, f]));
    const etapas = P.etapas.filter((e) => fasePorId[e.fase_id]).map((e) => ({ ...e, fase: fasePorId[e.fase_id] }));
    const por = (l) => Object.fromEntries(l.map((x) => [x.id, x]));
    const cats = por(B.categorias);
    return {
      versoes: Object.fromEntries(TIPOS.map((t) => [t, { numero: pub[t].numero, publicado_em: pub[t].publicado_em }])),
      servicos, categorias: B.categorias, usos: B.usos, fases, etapas,
      entregas: P.entregaveis || [], eventos: P.eventos || [],
      faixas: B.faixas_prazo || [], pesos: H.pesos || {},
      parcelaEntrada: H.parametros && H.parametros.parcela_entrada != null ? H.parametros.parcela_entrada : null,
      idx: { servico: por(servicos), categoria: cats, uso: por(B.usos), etapa: por(etapas), fase: fasePorId,
        entrega: por(P.entregaveis || []), evento: por(P.eventos || []) },
    };
  }

  const atual = () => C;

  // ---------------------------------------------------------------- leituras
  const servico = (id) => (C && C.idx.servico[id]) || null;
  const etapa = (id) => (C && C.idx.etapa[id]) || null;

  // Usos agrupados por categoria (e as categorias pelo grupo de cor).
  const GRUPOS = { residencial: 'Residencial', comercial: 'Comercial', institucional: 'Institucional', diversos: 'Diversos' };

  // Tipologia no formato que o motor de cálculo (calc.js) usa.
  function tipologia(usoId) {
    const u = C && C.idx.uso[usoId];
    if (!u) return null;
    return { id: u.id, item: u.item, descricao: u.descricao, categoria: u.categoria_cau, categoria_cub: u.cub_codigo,
      cub: u.cub_referencia, fator_adequacao: u.fator_adequacao, categoria_id: u.categoria_id };
  }

  // Etapas que valem para o serviço (P = vem marcada; O = opcional), na ordem do PGT.
  function etapasDoServico(srvId) {
    if (!C || !srvId) return [];
    return C.etapas.filter((e) => e.servicos && e.servicos[srvId]).map((e) => ({ ...e, pert: e.servicos[srvId].pertinencia }));
  }

  // Entregas da etapa para o serviço (P/O), respeitando a restrição por categoria da tipologia.
  function entregasDaEtapa(etapaId, srvId, categoriaId) {
    if (!C) return [];
    return C.entregas.filter((x) => x.etapa_id === etapaId && x.servicos && (x.servicos[srvId] === 'P' || x.servicos[srvId] === 'O')
      && (!x.categorias || !x.categorias.length || !categoriaId || x.categorias.includes(categoriaId)))
      .map((x) => ({ ...x, pert: x.servicos[srvId] }));
  }
  const entregasPadrao = (etapaId, srvId, categoriaId) => entregasDaEtapa(etapaId, srvId, categoriaId).filter((x) => x.pert === 'P').map((x) => x.id);

  // Cláusulas: eventos com cláusula das etapas contratadas. P = obrigatória (marcada e travada);
  // O = disponível (marcar inclui o evento no escopo). "—" não aparece.
  function clausulas(etapaIds, srvId) {
    if (!C) return [];
    const sel = new Set(etapaIds);
    return C.eventos.filter((v) => v.clausula && !v.encerramento && sel.has(v.etapa_id) && v.servicos && (v.servicos[srvId] === 'P' || v.servicos[srvId] === 'O'))
      .map((v) => ({ ...v, pert: v.servicos[srvId] }));
  }
  // texto da cláusula com a quantidade no lugar do N ("durante N meses")
  const temQuantidade = (texto) => /\bN\b/.test(texto || '');
  const textoClausula = (texto, n) => String(texto || '').replace(/\bN\b/g, n != null && n !== '' ? String(n) : 'N');

  // Faixa de prazo pela área (a última não tem teto).
  function faixa(area) {
    const l = (C && C.faixas) || [];
    if (!l.length || !(area > 0)) return { mult: 1, indice: 0 };
    const i = l.findIndex((f) => f.ate == null || area <= f.ate);
    const k = i < 0 ? l.length - 1 : i;
    return { mult: l[k].mult || 1, indice: k + 1 };
  }

  // Prazo da etapa em turnos, pela sequência de entregas e eventos (como o Universo calcula),
  // só com as entregas marcadas neste orçamento e o multiplicador da faixa de área:
  //   entrega marcada soma o seu prazo (× faixa, se não for de prazo fixo); com junto_anterior, corre junto
  //   com a anterior (conta a mais longa do grupo); evento que vale (P, perpétuo ou cláusula marcada) e é
  //   tempo do estúdio soma a sua duração; o Encerramento fica de fora.
  function prazoEtapa(etapaId, srvId, entregasSel, clausulasSel, mult = 1) {
    if (!C) return { turnos: 0, semPrazo: 0 };
    const sel = new Set(entregasSel || []), cl = new Set(clausulasSel || []);
    const passos = [
      ...C.entregas.filter((x) => x.etapa_id === etapaId).map((x) => ({ ...x, passo: 'entrega' })),
      ...C.eventos.filter((x) => x.etapa_id === etapaId && !x.encerramento).map((x) => ({ ...x, passo: 'evento' })),
    ].sort((a, b) => (a.ordem - b.ordem) || ((a.passo === 'entrega' ? 0 : 1) - (b.passo === 'entrega' ? 0 : 1)) || a.id.localeCompare(b.id));
    let total = 0, grupo = 0, antesEntrega = false, semPrazo = 0;
    for (const x of passos) {
      const p = x.servicos ? x.servicos[srvId] : null;
      if (x.passo === 'entrega') {
        if (!sel.has(x.id)) continue;
        if (!x.prazo_turnos) semPrazo++;
        const t = (x.prazo_turnos || 0) * (x.prazo_fixo ? 1 : mult);
        if (x.junto_anterior && antesEntrega) grupo = Math.max(grupo, t);
        else { total += grupo; grupo = t; }
        antesEntrega = true;
      } else {
        const vale = p === 'P' || p === 'S' || (p === 'O' && cl.has(x.id));
        if (!vale) continue;
        total += grupo; grupo = 0; antesEntrega = false;
        if (x.tempo === 'estudio') total += x.prazo_turnos || 0;
      }
    }
    total += grupo;
    return { turnos: total, semPrazo };
  }
  // turnos → semanas, arredondando para cima em meia semana
  const semanasDe = (turnos) => (turnos > 0 ? Math.ceil((turnos / TURNOS_SEMANA) * 2) / 2 : 0);

  // Percentual do honorário pelas etapas contratadas (Base + 50% da lacuna, ver PRICING.md), com os
  // pesos publicados nos Honorários. Serviço sem preço por etapa: 100%.
  function percentual(srvId, etapasSel) {
    const s = servico(srvId);
    if (!s || !s.preco_por_etapa) return { percentual: 1, base: 1, lacuna: 0, incremento: 0, porEtapa: false };
    const pesos = {};
    for (const e of etapasDoServico(srvId)) {
      const p = C.pesos[e.id] && C.pesos[e.id][srvId];
      if (p != null) pesos[e.id] = p;
    }
    return { ...OdisseCalc.percentualPorEtapas(etapasSel, pesos), porEtapa: true, pesos };
  }
  const peso = (etapaId, srvId) => (C && C.pesos[etapaId] && C.pesos[etapaId][srvId] != null ? C.pesos[etapaId][srvId] : null);

  // Padrão do IC: preset da categoria da tipologia + ajustes do serviço (rótulos baixo/medio/alto).
  function icPadrao(srvId, categoriaId) {
    const cat = C && C.idx.categoria[categoriaId];
    const s = servico(srvId);
    return { ...((cat && cat.ic_preset) || {}), ...((s && s.ic_ajustes) || {}) };
  }

  // Parcelas por fase (Honorários): entrada + uma por fase contratada fora das ilhas.
  function parcelas(etapasSel) {
    if (!C) return [];
    const fasesSel = new Set(etapasSel.map((id) => etapa(id)).filter(Boolean).map((e) => e.fase_id));
    const l = [];
    if (C.parcelaEntrada != null) l.push({ nome: 'Entrada (assinatura)', percentual: C.parcelaEntrada });
    for (const f of C.fases) if (!f.ilha && f.parcela != null && fasesSel.has(f.id)) l.push({ nome: f.nome, percentual: f.parcela, fase_id: f.id });
    return l;
  }

  // ---------------------------------------------------------------- orçamentos antigos
  // Rascunhos e propostas feitos antes da leitura do PGT (data/*.json): traz o que dá para trazer
  // (serviço, tipologia, etapas pelo ref_vendas, endereço do imóvel); o resto volta ao padrão.
  function migrar(antigo, novo) {
    if (!antigo || antigo.versao === 2) return antigo;
    const s = { ...novo };
    for (const k of ['numeroProposta', 'dataProposta', 'tetoOrcamentario', 'tetoOrcamentarioNumero', 'prazoEsperadoCliente', 'entendimentoProjeto',
      'areaConstruida', 'areaExterna', 'areaTerreno', 'contagemRepeticoes', 'icValores', 'fatorAjuste', 'dataInicio', 'descontoAvista', 'pctEntrada',
      'maxParcelasCartao', 'maxParcelasBoleto', 'incluirDespesasReembolsaveis', 'despesasReembolsaveisSelecionadas',
      '_clienteId', '_oportunidadeId', '_propostaId', '_revisaoDe', '_revisaoDeCodigo', '_revisaoDeSimulacao', '_simulacao', '_pdfCongelado']) {
      if (antigo[k] !== undefined) s[k] = antigo[k];
    }
    const c = antigo.cliente || {};
    s.cliente = { ...s.cliente, nome: c.nome || '', email: c.email || '', telefone: c.telefone || '', representacao: c.representacao || 'PF', documento: c.documento || '' };
    s.imovel = { cep: c.cep || '', logradouro: c.logradouro || '', numero: c.numero || '', complemento: c.complemento || '', bairro: c.bairro || '', cidadeUf: c.cidadeUf || '' };
    if (!C) return s;
    const tem = (ref, id) => String(ref || '').split(',').map((x) => x.trim()).includes(id);
    const srv = C.servicos.find((x) => tem(x.ref_vendas, antigo.servicoId));
    if (srv) s.servicoId = srv.id;
    const t = antigo.tipologiaItem;
    if (t) {
      const cat = C.categorias.find((x) => tem(x.ref_vendas, antigo.macroCategoriaSelecionada));
      const uso = C.usos.find((u) => u.item === t.item && (!cat || u.categoria_id === cat.id)) || C.usos.find((u) => u.item === t.item);
      if (uso) { s.usoId = uso.id; s.categoriaId = uso.categoria_id; }
    }
    if (s.servicoId) {
      const validas = etapasDoServico(s.servicoId);
      s.etapasSelecionadas = validas.filter((e) => (antigo.etapasSelecionadas || []).some((id) => tem(e.ref_vendas, id))).map((e) => e.id);
      for (const e of validas) {
        const velho = (antigo.etapasSelecionadas || []).find((id) => tem(e.ref_vendas, id));
        if (velho && antigo.etapasSemanas && antigo.etapasSemanas[velho]) s.semanasManual[e.id] = antigo.etapasSemanas[velho];
      }
      for (const id of s.etapasSelecionadas) s.entregasSelecionadas[id] = entregasPadrao(id, s.servicoId, s.categoriaId);
    }
    s._migrado = true;
    return s;
  }

  return { carregar, atual, servico, etapa, tipologia, etapasDoServico, entregasDaEtapa, entregasPadrao, clausulas, temQuantidade,
    textoClausula, faixa, prazoEtapa, semanasDe, percentual, peso, icPadrao, parcelas, migrar, GRUPOS, TURNOS_SEMANA };
})();
