// ==========================================================================
// Geração do PDF final — formato espelhado no modelo de proposta comercial
// da Odisse (ex: PC050/2024), 100% no navegador via jsPDF + autotable.
//
// Sistema de estilos de texto (6 no total, todos em preto puro, sem
// transparência):
//   1. Nome do cliente        — negrito, corpo levemente maior
//   2. Nº da proposta         — negrito, corpo normal
//   3. Título de seção        — negrito sublinhado, corpo normal
//   4. Corpo do texto         — normal
//   5. Rodapé (texto normal)  — normal, pequeno
//   6. Rodapé (texto negrito) — negrito, pequeno
// ==========================================================================

const OdissePdf = (() => {
  const PAGE_W = 595.28; // A4 pt
  const PAGE_H = 841.89;

  // Documento deslocado à direita: margem esquerda maior que a direita —
  // mas só para o corpo do texto. Cabeçalho e rodapé mantêm a margem original.
  const LEFT = 165;
  const RIGHT = 48;
  const CONTENT_W = PAGE_W - LEFT - RIGHT;

  const MARGIN_HF = 48; // margem de cabeçalho/rodapé — não afetada pelo deslocamento acima

  const PRETO = [0, 0, 0];

  const TOPO_CONTEUDO = 118;   // onde o corpo do texto pode começar, abaixo do cabeçalho
  const FUNDO_LIMITE = 700;    // limite antes de quebrar página — deixa espaço livre até o rodapé
  const RODAPE_Y = 725;

  function garantirFonteInter(doc) {
    if (typeof INTER_REGULAR_B64 === 'undefined') return; // fallback: segue com a fonte padrão do jsPDF
    doc.addFileToVFS('Inter-Regular.ttf', INTER_REGULAR_B64);
    doc.addFont('Inter-Regular.ttf', 'Inter', 'normal');
    doc.addFileToVFS('Inter-Bold.ttf', INTER_BOLD_B64);
    doc.addFont('Inter-Bold.ttf', 'Inter', 'bold');
    doc.setFont('Inter', 'normal');
  }

  // ---------- estilos (tamanhos aumentados — corpo passa de 10 para 12) ----------
  function estiloNomeCliente(doc) { doc.setFont('Inter', 'bold'); doc.setFontSize(14); doc.setTextColor(...PRETO); }
  function estiloNumero(doc) { doc.setFont('Inter', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...PRETO); }
  function estiloTitulo(doc) { doc.setFont('Inter', 'bold'); doc.setFontSize(11.5); doc.setTextColor(...PRETO); }
  function estiloCorpo(doc, tamanho = 11) { doc.setFont('Inter', 'normal'); doc.setFontSize(tamanho); doc.setTextColor(...PRETO); }
  function estiloCorpoBold(doc, tamanho = 11) { doc.setFont('Inter', 'bold'); doc.setFontSize(tamanho); doc.setTextColor(...PRETO); }
  function estiloRodapePequeno(doc) { doc.setFont('Inter', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...PRETO); }
  function estiloRodapePequenoBold(doc) { doc.setFont('Inter', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...PRETO); }

  function novaFolha(doc) {
    doc.addPage();
  }

  // Cabeçalho: "ODISSE," / "ARQUITETOS" em duas linhas à esquerda, espaço
  // reservado para a logo à direita (a caixa tracejada é só um placeholder de
  // desenvolvimento — trocar por doc.addImage() assim que a logo for enviada).
  function cabecalho(doc) {
    const topY = 42;
    estiloNumero(doc);
    doc.text('ODISSE,', MARGIN_HF, topY);
    doc.text('ARQUITETOS', MARGIN_HF, topY + 13);

    const logoW = 90, logoH = 32;
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.4);
    doc.setLineDashPattern([2, 2], 0);
    doc.rect(PAGE_W - MARGIN_HF - logoW, topY - 20, logoW, logoH);
    doc.setLineDashPattern([], 0);

    doc.setDrawColor(...PRETO);
    doc.setLineWidth(0.6);
    doc.line(MARGIN_HF, topY + 24, PAGE_W - MARGIN_HF, topY + 24);
  }

  function rodape(doc) {
    doc.setDrawColor(...PRETO);
    doc.setLineWidth(0.5);
    doc.line(MARGIN_HF, RODAPE_Y, PAGE_W - MARGIN_HF, RODAPE_Y);

    let ly = RODAPE_Y + 15;
    estiloRodapePequeno(doc);
    doc.text('Av. Bananeiras, 361. Sala 101', MARGIN_HF, ly); ly += 10;
    doc.text('Manaíra, João Pessoa – PB, Brasil', MARGIN_HF, ly); ly += 18;

    estiloRodapePequenoBold(doc);
    doc.text('E: contato@odisse.com.br', MARGIN_HF, ly); ly += 10;
    doc.text('T: +55 83 999 220 474', MARGIN_HF, ly); ly += 18;

    estiloRodapePequeno(doc);
    doc.text('www.odisse.com.br', MARGIN_HF, ly);
  }

  function checarQuebra(doc, cursorY, alturaNecessaria) {
    if (cursorY + alturaNecessaria > FUNDO_LIMITE) {
      novaFolha(doc);
      return TOPO_CONTEUDO;
    }
    return cursorY;
  }

  function paragrafo(doc, texto, x, y, largura, tamanho = 11) {
    estiloCorpo(doc, tamanho);
    const linhas = doc.splitTextToSize(texto, largura);
    doc.text(linhas, x, y);
    return y + linhas.length * (tamanho * 1.35);
  }

  function tituloSecao(doc, texto, y) {
    estiloTitulo(doc);
    doc.text(texto, LEFT, y);
    const largura = doc.getTextWidth(texto);
    doc.setDrawColor(...PRETO);
    doc.setLineWidth(0.6);
    doc.line(LEFT, y + 2.5, LEFT + largura, y + 2.5);
    return y + 20;
  }

  function listaBullets(doc, itens, y) {
    estiloCorpo(doc);
    for (const item of itens) {
      const linhas = doc.splitTextToSize('•  ' + item, CONTENT_W - 10);
      y = checarQuebra(doc, y, linhas.length * 13);
      doc.text(linhas, LEFT + 6, y);
      y += linhas.length * 13 + 2;
    }
    return y + 8;
  }

  // Estilo de tabela com grade fina (todas as bordas), sem zebra — usado no
  // Cronograma e nas tabelas de forma de pagamento.
  const ESTILO_TABELA_GRADE = {
    theme: 'grid',
    styles: { font: 'Inter', fontSize: 9.5, textColor: PRETO, lineColor: PRETO, lineWidth: 0.5, cellPadding: 6 },
    headStyles: { fillColor: [255, 255, 255], textColor: PRETO, fontStyle: 'bold', lineColor: PRETO, lineWidth: 0.5 }
  };

  // Estilo de tabela só com linha embaixo de cada linha (sem grade, sem
  // zebra) — usado na tabela de Honorários.
  const ESTILO_TABELA_LINHA_INFERIOR = {
    theme: 'plain',
    styles: { font: 'Inter', fontSize: 10.5, textColor: PRETO, cellPadding: 7, lineColor: PRETO, lineWidth: { bottom: 0.5, top: 0, left: 0, right: 0 } }
  };

  // Agrupa linhas consecutivas com a mesma "fase", mesclando a coluna via
  // rowSpan (evita repetir "Projeto Conceitual" três vezes seguidas).
  function agruparPorFase(linhas) {
    const corpo = [];
    let i = 0;
    while (i < linhas.length) {
      let j = i;
      while (j < linhas.length && linhas[j].fase === linhas[i].fase) j++;
      const tamanhoGrupo = j - i;
      for (let k = i; k < j; k++) {
        const l = linhas[k];
        const linha = [
          l.nome,
          OdisseCalc.fmtData(l.inicio),
          OdisseCalc.fmtData(l.fim),
          `${l.semanas} sem.`
        ];
        if (k === i) linha.unshift({ content: l.fase, rowSpan: tamanhoGrupo, styles: { valign: 'middle' } });
        corpo.push(linha);
      }
      i = j;
    }
    return corpo;
  }

  function gerar(state, data) {
    if (!window.jspdf) { alert('Biblioteca de PDF ainda carregando — tente novamente em instantes.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    garantirFonteInter(doc);
    const r = state._calcResult;
    const hoje = state.dataProposta ? new Date(state.dataProposta + 'T00:00:00') : new Date();
    const dataFmt = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    let y = TOPO_CONTEUDO;
    estiloCorpo(doc);
    doc.text(`João Pessoa, ${dataFmt}`, LEFT, y);

    y += 30;
    estiloCorpo(doc);
    doc.text('Proposta Comercial', LEFT, y);
    if (state.numeroProposta) {
      y += 17;
      estiloNumero(doc);
      doc.text(state.numeroProposta, LEFT, y);
    }

    y += 30;
    estiloNomeCliente(doc);
    doc.text(`${state.cliente.nome},`, LEFT, y);

    y += 22;
    const intro = `Agradecemos o interesse em trabalhar com o Odisse Arquitetos, e a consequente oportunidade de apresentar-lhe nossa proposta comercial. Abaixo, detalhamos nosso entendimento do escopo dos serviços solicitados, assim como cronograma e honorários propostos.`;
    y = paragrafo(doc, intro, LEFT, y, CONTENT_W);

    y += 16;
    y = tituloSecao(doc, 'Entendimento do Projeto', y);
    y = paragrafo(doc, state.entendimentoProjeto || '—', LEFT, y, CONTENT_W);

    if (state.tetoOrcamentario) {
      y += 16;
      y = tituloSecao(doc, 'Limite Orçamentário', y);
      y = paragrafo(doc, `O limite antecipado do custo construtivo foi estimado em ${state.tetoOrcamentario}.`, LEFT, y, CONTENT_W);
    }

    // ---- Escopo (derivado dos subitens de cada etapa + assessoramento) ----
    const compreendeTextos = [];
    const naoCompreendeTextos = [];
    data.etapas.forEach(etapa => {
      const marcados = state.etapasSubitens[etapa.id] || [];
      etapa.subitens.forEach(si => {
        (marcados.includes(si.id) ? compreendeTextos : naoCompreendeTextos).push(si.texto);
      });
    });
    data.assessoramento.subitens.forEach(si => {
      const marcado = (state.assessoramentoSelecionados || []).includes(si.id);
      (marcado ? compreendeTextos : naoCompreendeTextos).push(si.texto_curto);
    });

    y = checarQuebra(doc, y, 60);
    y += 16;
    y = tituloSecao(doc, 'Escopo', y);
    estiloCorpoBold(doc, 11);
    doc.text('Compreende o serviço:', LEFT, y);
    y += 16;
    y = listaBullets(doc, compreendeTextos.length ? compreendeTextos : ['—'], y);

    y = checarQuebra(doc, y, 40);
    estiloCorpoBold(doc, 11);
    doc.text('O escopo desta proposta não inclui:', LEFT, y);
    y += 16;
    y = listaBullets(doc, naoCompreendeTextos.length ? naoCompreendeTextos : ['—'], y);

    // ---- Etapas de desenvolvimento ----
    const etapasSel = data.etapas.filter(e => state.etapasSelecionadas.includes(e.id));
    y = checarQuebra(doc, y, 60);
    y += 10;
    y = tituloSecao(doc, 'Etapas de Desenvolvimento do Projeto', y);
    let faseAtual = null;
    for (const etapa of etapasSel) {
      if (etapa.fase !== faseAtual) {
        faseAtual = etapa.fase;
        y = checarQuebra(doc, y, 30);
        estiloCorpoBold(doc, 10.5);
        doc.text(faseAtual, LEFT, y);
        y += 16;
      }
      y = checarQuebra(doc, y, 40);
      estiloCorpoBold(doc, 11);
      doc.text(etapa.nome + ':', LEFT + 8, y);
      y += 13;
      y = paragrafo(doc, etapa.descricao, LEFT + 8, y, CONTENT_W - 8, 10.5);
      y += 4;
    }

    // ---- Cronograma ----
    if (state.dataInicio && etapasSel.length) {
      const selComSemanas = etapasSel.map(e => ({ ...e, semanas: state.etapasSemanas[e.id] }));
      const linhas = OdisseCalc.montarCronograma(state.dataInicio, selComSemanas);
      novaFolha(doc);
      y = TOPO_CONTEUDO;
      y = tituloSecao(doc, 'Cronograma', y);
      y = paragrafo(doc, 'A prestação do serviço ocorrerá em acordo com o planejamento preliminar abaixo:', LEFT, y, CONTENT_W);
      y += 10;
      doc.autoTable({
        startY: y,
        margin: { left: LEFT, right: RIGHT },
        head: [['Fase', 'Etapa', 'Início', 'Fim', 'Duração']],
        body: agruparPorFase(linhas),
        ...ESTILO_TABELA_GRADE,
        columnStyles: { 0: { cellWidth: 62 } }
      });
      y = doc.lastAutoTable.finalY + 18;
      y = checarQuebra(doc, y, 60);
      y = paragrafo(doc, '*A etapa de Projeto Executivo de Arquitetura e suas etapas subsequentes apenas poderão ter datas confirmadas após aprovação do projeto legal junto aos órgãos competentes.', LEFT, y, CONTENT_W, 10.5);
      y += 12;
      y = checarQuebra(doc, y, 60);
      y = paragrafo(doc, 'O serviço apenas se inicia após assinatura de contrato e pagamento da 1ª parcela dos honorários. Assim sendo, as datas acima descritas estão sujeitas à alteração.', LEFT, y, CONTENT_W);
      y += 24;
    }

    // ---- Honorários ----
    y = checarQuebra(doc, y, 100);
    y += 8;
    y = tituloSecao(doc, 'Honorários', y);
    if (r) {
      y = paragrafo(doc, 'Como remuneração pelos serviços profissionais objetos desta proposta, segue:', LEFT, y, CONTENT_W, 10.5);
      y += 10;
      const distrib = OdisseCalc.distribuirPorEtapa(r.valorFinal, etapasSel.map(e => ({ nome: e.nome, semanas: state.etapasSemanas[e.id] })));
      doc.autoTable({
        startY: y,
        margin: { left: LEFT, right: RIGHT },
        body: [
          ...distrib.map(d => [d.nome, OdisseCalc.fmtMoeda(d.valor)]),
          ['TOTAL', OdisseCalc.fmtMoeda(r.valorFinal)]
        ],
        ...ESTILO_TABELA_LINHA_INFERIOR,
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (d) => {
          if (d.row.index === distrib.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fontSize = 14; }
        }
      });
      y = doc.lastAutoTable.finalY + 20;

      y = checarQuebra(doc, y, 140);
      y = tituloSecao(doc, 'Formas de Pagamento', y);

      const plano = OdisseCalc.planoPagamento(r.valorFinal, data, { descontoAvista: state.descontoAvista, pctEntrada: state.pctEntrada });

      y = paragrafo(doc, 'A cobrança dos valores é feita preferencialmente por meio de boleto bancário, parcelado conforme detalhado abaixo — mas, caso seja mais conveniente, o pagamento no cartão de crédito também está disponível como alternativa.', LEFT, y, CONTENT_W);
      y += 12;
      y = paragrafo(doc, 'Os honorários poderão ser pagos em até 10 parcelas iguais, vencendo a primeira no ato de assinatura do contrato, com carência de até 3 dias para sua quitação.', LEFT, y, CONTENT_W);
      y += 12;

      y = paragrafo(doc, `À vista: ${OdisseCalc.fmtMoeda(plano.avista)} (desconto de ${Math.round((state.descontoAvista || 0) * 100)}%)`, LEFT, y, CONTENT_W, 10.5);
      y += 10;

      estiloCorpoBold(doc, 10.5);
      doc.text(`Entrada + boletos (entrada de ${OdisseCalc.fmtMoeda(plano.entrada)}):`, LEFT, y);
      y += 4;
      doc.autoTable({
        startY: y + 6,
        margin: { left: LEFT, right: RIGHT },
        head: [['Parcelas restantes', 'Valor da parcela']],
        body: plano.entradaBoletos.map(p => [`${p.parcelas}x`, OdisseCalc.fmtMoeda(p.valorParcela)]),
        ...ESTILO_TABELA_GRADE,
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 1) d.cell.styles.fontStyle = 'bold';
        }
      });
      y = doc.lastAutoTable.finalY + 18;

      y = checarQuebra(doc, y, 120);
      estiloCorpoBold(doc, 10.5);
      doc.text('Cartão de crédito:', LEFT, y);
      doc.autoTable({
        startY: y + 6,
        margin: { left: LEFT, right: RIGHT },
        head: [['Parcelas', 'Valor total', 'Valor da parcela']],
        body: plano.cartao.slice(0, 8).map(p => [`${p.parcelas}x`, OdisseCalc.fmtMoeda(p.total), OdisseCalc.fmtMoeda(p.valorParcela)]),
        ...ESTILO_TABELA_GRADE,
        didParseCell: (d) => {
          if (d.section === 'body' && d.column.index === 2) d.cell.styles.fontStyle = 'bold';
        }
      });
      y = doc.lastAutoTable.finalY + 20;
    }

    // ---- Despesas reembolsáveis ----
    if (state.incluirDespesasReembolsaveis) {
      y = checarQuebra(doc, y, 100);
      y += 8;
      y = tituloSecao(doc, 'Despesas Reembolsáveis', y);
      y = listaBullets(doc, [
        'Impressão (plotagem) de material gráfico para aprovação do projeto junto a órgãos competentes e/ou suporte técnico à execução da obra.',
        'Viagens cujo destino esteja fora da área metropolitana de João Pessoa – PB, incluindo combustível, passagens e hospedagem.',
        'Taxas e similares referentes a certidões, alvarás e afins junto aos órgãos competentes.'
      ], y);
      y = paragrafo(doc, 'O cliente deverá providenciar o reembolso em até 30 dias, contados do recebimento dos respectivos comprovantes.', LEFT, y, CONTENT_W, 10.5);
    }

    // ---- Assessoramento (bloco independente, texto por subitem marcado) ----
    const assessSelecionados = data.assessoramento.subitens.filter(si => (state.assessoramentoSelecionados || []).includes(si.id));
    if (assessSelecionados.length) {
      y = checarQuebra(doc, y, 90);
      y += 16;
      y = tituloSecao(doc, data.assessoramento.titulo, y);
      y = paragrafo(doc, data.assessoramento.descricao_abertura, LEFT, y, CONTENT_W, 10.5);
      y += 6;
      y = listaBullets(doc, assessSelecionados.map(si => si.texto_pdf), y);
    }

    // ---- Informações adicionais ----
    y = checarQuebra(doc, y, 110);
    y += 16;
    y = tituloSecao(doc, 'Informações Adicionais', y);
    y = paragrafo(doc, 'Todo o material gráfico eventualmente produzido não tem como objetivo atender a critérios de marketing — sua produção objetiva servir como material de apoio ao cliente, visando sua melhor compreensão do projeto arquitetônico nas suas diversas etapas. Uma vez entregue ao cliente, este poderá fazer uso do material com fins de marketing, tendo desde já o consentimento do Odisse Arquitetos. Eventuais solicitações de revisão do material gráfico sob critérios de marketing não serão atendidas — recomendamos, para tanto, a contratação de uma equipe especializada.', LEFT, y, CONTENT_W, 10.5);
    y += 10;
    estiloCorpoBold(doc, 10.5);
    doc.text('Esta proposta tem validade de 30 dias.', LEFT, y);

    y += 40;
    y = checarQuebra(doc, y, 70);
    estiloCorpo(doc, 12);
    doc.text('Cordialmente,', LEFT, y);
    y += 30;
    if (state.responsavelNome) {
      estiloCorpoBold(doc, 11);
      const linhaNome = state.responsavelCau ? `${state.responsavelNome}, ${state.responsavelCau}` : state.responsavelNome;
      doc.text(linhaNome, LEFT, y);
      y += 13;
      estiloCorpo(doc, 12);
      doc.text('Arquiteto(a),', LEFT, y);
      y += 13;
    }
    estiloCorpoBold(doc, 11);
    doc.text('Odisse Arquitetos', LEFT, y);

    // ---- Cabeçalho e rodapé em todas as páginas ----
    const totalPaginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      cabecalho(doc);
      rodape(doc);
    }

    const nomeArquivo = `${state.numeroProposta || 'Proposta'}_${(state.cliente.nome || 'cliente').replace(/[^\w]+/g, '_')}.pdf`;
    doc.save(nomeArquivo);
  }

  return { gerar };
})();
