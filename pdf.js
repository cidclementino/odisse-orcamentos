// ==========================================================================
// Geração do PDF final — formato espelhado no modelo de proposta comercial
// da Odisse (ex: PC050/2024), 100% no navegador via jsPDF + autotable.
// ==========================================================================

const OdissePdf = (() => {
  const MARGIN = 48;
  const PAGE_W = 595.28; // A4 pt
  const CONTENT_W = PAGE_W - MARGIN * 2;
  const INK = [26, 26, 26];
  const COPPER = [127, 103, 95];
  const MUTED = [90, 90, 90];

  function novaFolha(doc) {
    doc.addPage();
    rodape(doc);
  }

  function rodape(doc) {
    const y = 800;
    doc.setDrawColor(...COPPER);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, y, PAGE_W - MARGIN, y);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text('Av. Bananeiras, 361. Sala 101 — Manaíra, João Pessoa – PB, Brasil', MARGIN, y + 14);
    doc.text('contato@odisse.com.br · +55 83 999 220 474 · www.odisse.com.br', MARGIN, y + 26);
  }

  function checarQuebra(doc, cursorY, alturaNecessaria) {
    if (cursorY + alturaNecessaria > 780) {
      novaFolha(doc);
      return 60;
    }
    return cursorY;
  }

  function paragrafo(doc, texto, x, y, largura, tamanho = 10) {
    doc.setFontSize(tamanho);
    doc.setTextColor(...INK);
    const linhas = doc.splitTextToSize(texto, largura);
    doc.text(linhas, x, y);
    return y + linhas.length * (tamanho * 1.35);
  }

  function tituloSecao(doc, texto, y) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...COPPER);
    doc.text(texto, MARGIN, y);
    doc.setFont('helvetica', 'normal');
    return y + 20;
  }

  function listaBullets(doc, itens, y) {
    doc.setFontSize(10);
    doc.setTextColor(...INK);
    for (const item of itens) {
      const linhas = doc.splitTextToSize('•  ' + item, CONTENT_W - 10);
      y = checarQuebra(doc, y, linhas.length * 13);
      doc.text(linhas, MARGIN + 6, y);
      y += linhas.length * 13 + 2;
    }
    return y + 8;
  }

  function gerar(state, data) {
    if (!window.jspdf) { alert('Biblioteca de PDF ainda carregando — tente novamente em instantes.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const r = state._calcResult;
    const hoje = state.dataProposta ? new Date(state.dataProposta + 'T00:00:00') : new Date();
    const dataFmt = hoje.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

    let y = 70;
    doc.setFontSize(9.5);
    doc.setTextColor(...MUTED);
    doc.text(`João Pessoa, ${dataFmt}`, MARGIN, y);

    y += 36;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.setTextColor(...INK);
    doc.text('Proposta Comercial', MARGIN, y);
    if (state.numeroProposta) {
      y += 20;
      doc.setFontSize(11);
      doc.setTextColor(...MUTED);
      doc.text(state.numeroProposta, MARGIN, y);
    }
    doc.setFont('helvetica', 'normal');

    y += 34;
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(`${state.cliente.nome},`, MARGIN, y);

    const endereco = enderecoCompleto(state.cliente);
    if (endereco) {
      y += 16;
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text(endereco, MARGIN, y);
      doc.setTextColor(...INK);
    }

    y += 22;
    const intro = `Agradecemos o interesse em trabalhar com o Odisse Arquitetos, e a consequente oportunidade de apresentar-lhe nossa proposta comercial. Abaixo, detalhamos nosso entendimento do escopo dos serviços solicitados, assim como cronograma e honorários propostos.`;
    y = paragrafo(doc, intro, MARGIN, y, CONTENT_W);

    y += 16;
    y = tituloSecao(doc, 'Entendimento do Projeto', y);
    y = paragrafo(doc, state.entendimentoProjeto || '—', MARGIN, y, CONTENT_W);

    if (state.tetoOrcamentario) {
      y += 16;
      y = tituloSecao(doc, 'Limite Orçamentário', y);
      y = paragrafo(doc, `O limite antecipado do custo construtivo foi estimado em ${state.tetoOrcamentario}.`, MARGIN, y, CONTENT_W);
    }

    // ---- Escopo ----
    y = checarQuebra(doc, y, 60);
    y += 16;
    y = tituloSecao(doc, 'Escopo', y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('Compreende o serviço:', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    y += 16;
    const compreendeTextos = data.escopoMaster.compreende.filter(i => state.compreendeSelecionados.includes(i.id)).map(i => i.texto);
    y = listaBullets(doc, compreendeTextos.length ? compreendeTextos : ['—'], y);

    y = checarQuebra(doc, y, 40);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
    doc.text('O escopo desta proposta não inclui:', MARGIN, y);
    doc.setFont('helvetica', 'normal');
    y += 16;
    const naoCompreendeTextos = data.escopoMaster.nao_compreende.filter(i => state.naoCompreendeSelecionados.includes(i.id)).map(i => i.texto);
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
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
        doc.setTextColor(...INK);
        doc.text(faseAtual, MARGIN, y);
        doc.setFont('helvetica', 'normal');
        y += 16;
      }
      y = checarQuebra(doc, y, 40);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      doc.text(etapa.nome + ':', MARGIN + 8, y);
      doc.setFont('helvetica', 'normal');
      y += 13;
      y = paragrafo(doc, etapa.descricao, MARGIN + 8, y, CONTENT_W - 8, 9.5);
      y += 4;
    }

    // ---- Cronograma ----
    if (state.dataInicio && etapasSel.length) {
      const selComSemanas = etapasSel.map(e => ({ ...e, semanas: state.etapasSemanas[e.id] }));
      const linhas = OdisseCalc.montarCronograma(state.dataInicio, selComSemanas);
      novaFolha(doc);
      y = 60;
      y = tituloSecao(doc, 'Cronograma', y);
      doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Fase', 'Etapa', 'Início', 'Fim', 'Duração']],
        body: linhas.map(l => [l.fase, l.nome, OdisseCalc.fmtData(l.inicio), OdisseCalc.fmtData(l.fim), `${l.semanas} sem.`]),
        styles: { fontSize: 8.5, textColor: INK, cellPadding: 5 },
        headStyles: { fillColor: INK, textColor: 255 },
        alternateRowStyles: { fillColor: [245, 242, 240] }
      });
      y = doc.lastAutoTable.finalY + 24;
    }

    // ---- Honorários ----
    y = checarQuebra(doc, y, 100);
    y += 8;
    y = tituloSecao(doc, 'Honorários', y);
    if (r) {
      const distrib = OdisseCalc.distribuirPorEtapa(r.valorFinal, etapasSel.map(e => ({ nome: e.nome, semanas: state.etapasSemanas[e.id] })));
      doc.autoTable({
        startY: y,
        margin: { left: MARGIN, right: MARGIN },
        body: [
          ...distrib.map(d => [d.nome, OdisseCalc.fmtMoeda(d.valor)]),
          ['TOTAL', OdisseCalc.fmtMoeda(r.valorFinal)]
        ],
        styles: { fontSize: 9.5, textColor: INK, cellPadding: 6 },
        columnStyles: { 1: { halign: 'right' } },
        didParseCell: (d) => {
          if (d.row.index === distrib.length) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [245, 242, 240]; }
        }
      });
      y = doc.lastAutoTable.finalY + 20;

      y = checarQuebra(doc, y, 140);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
      doc.text('Formas de Pagamento', MARGIN, y);
      doc.setFont('helvetica', 'normal');
      y += 16;

      const plano = OdisseCalc.planoPagamento(r.valorFinal, data, { descontoAvista: state.descontoAvista, pctEntrada: state.pctEntrada });

      y = paragrafo(doc, `À vista: ${OdisseCalc.fmtMoeda(plano.avista)} (desconto de ${Math.round((state.descontoAvista || 0) * 100)}%)`, MARGIN, y, CONTENT_W, 9.5);
      y += 10;

      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text('Cartão de crédito:', MARGIN, y);
      doc.setFont('helvetica', 'normal');
      y += 4;
      doc.autoTable({
        startY: y + 6,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Parcelas', 'Valor total', 'Valor da parcela']],
        body: plano.cartao.slice(0, 8).map(p => [`${p.parcelas}x`, OdisseCalc.fmtMoeda(p.total), OdisseCalc.fmtMoeda(p.valorParcela)]),
        styles: { fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: INK, textColor: 255 }
      });
      y = doc.lastAutoTable.finalY + 18;

      y = checarQuebra(doc, y, 120);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
      doc.text(`Entrada + boletos (entrada de ${OdisseCalc.fmtMoeda(plano.entrada)}):`, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.autoTable({
        startY: y + 6,
        margin: { left: MARGIN, right: MARGIN },
        head: [['Parcelas restantes', 'Valor da parcela']],
        body: plano.entradaBoletos.map(p => [`${p.parcelas}x`, OdisseCalc.fmtMoeda(p.valorParcela)]),
        styles: { fontSize: 8.5, cellPadding: 5 },
        headStyles: { fillColor: INK, textColor: 255 }
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
      y = paragrafo(doc, 'O cliente deverá providenciar o reembolso em até 30 dias, contados do recebimento dos respectivos comprovantes.', MARGIN, y, CONTENT_W, 9.5);
    }

    // ---- Acompanhamento de obra ----
    if (state.incluirAcompanhamentoObra) {
      y = checarQuebra(doc, y, 90);
      y += 16;
      y = tituloSecao(doc, 'Acompanhamento da Execução da Obra', y);
      y = paragrafo(doc, 'Durante o período de execução da obra, a equipe do Odisse Arquitetos fornecerá suporte técnico ao cliente/construtora, a fim de esclarecer dúvidas ou suprir eventuais lacunas de informação. Visitas mensais à obra serão efetuadas por um arquiteto integrante da equipe, contando a partir da data de início da mesma até sua conclusão, desde que não ultrapasse um período de 4 anos.', MARGIN, y, CONTENT_W, 9.5);
    }

    // ---- Informações adicionais ----
    y = checarQuebra(doc, y, 110);
    y += 16;
    y = tituloSecao(doc, 'Informações Adicionais', y);
    y = paragrafo(doc, 'Todo o material gráfico eventualmente produzido não tem como objetivo atender a critérios de marketing — sua produção objetiva servir como material de apoio ao cliente, visando sua melhor compreensão do projeto arquitetônico nas suas diversas etapas. Uma vez entregue ao cliente, este poderá fazer uso do material com fins de marketing, tendo desde já o consentimento do Odisse Arquitetos. Eventuais solicitações de revisão do material gráfico sob critérios de marketing não serão atendidas — recomendamos, para tanto, a contratação de uma equipe especializada.', MARGIN, y, CONTENT_W, 9.5);
    y += 10;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text('Esta proposta tem validade de 30 dias.', MARGIN, y);
    doc.setFont('helvetica', 'normal');

    y += 40;
    y = checarQuebra(doc, y, 60);
    doc.text('Cordialmente,', MARGIN, y);
    y += 32;
    doc.setFont('helvetica', 'bold');
    doc.text('Odisse Arquitetos', MARGIN, y);
    doc.setFont('helvetica', 'normal');

    rodape(doc);

    const nomeArquivo = `${state.numeroProposta || 'Proposta'}_${(state.cliente.nome || 'cliente').replace(/[^\w]+/g, '_')}.pdf`;
    doc.save(nomeArquivo);
  }

  return { gerar };
})();
