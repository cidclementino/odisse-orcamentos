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

function segmented(name, options, current, onchangeAttr) {
  return `<div class="segmented" data-seg="${name}">` +
    options.map((opt, i) => `
      <input type="radio" name="${name}" id="${name}-${i}" value="${opt.value}" ${current === opt.value ? 'checked' : ''}>
      <label for="${name}-${i}">${opt.label}</label>
    `).join('') +
    `</div>`;
}

const IC_LABELS = { baixo: 0.7, medio: 1.0, alto: 1.3 };

const STEPS = [];

// -------------------------------------------------------------------------
// 0. Cliente & Projeto
// -------------------------------------------------------------------------
STEPS.push({
  id: 'cliente',
  eyebrow: 'Etapa 1 de 9',
  title: 'Cliente & projeto',
  desc: 'Dados de identificação que vão para o cabeçalho da proposta.',
  render(state) {
    const c = state.cliente;
    return `
      <div class="field-group">
        <div class="field">
          <label class="field__label">Nome do cliente / empresa</label>
          <input type="text" id="f-nome" value="${c.nome || ''}" placeholder="Ex: Olímpio Construções &amp; Serviços">
        </div>
        <div class="row-2">
          <div class="field">
            <label class="field__label">E-mail</label>
            <input type="email" id="f-email" value="${c.email || ''}">
          </div>
          <div class="field">
            <label class="field__label">Telefone</label>
            <input type="tel" id="f-telefone" value="${c.telefone || ''}">
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
        <div class="field">
          <label class="field__label">Endereço do imóvel / empreendimento</label>
          <input type="text" id="f-endereco" value="${c.endereco || ''}" placeholder="Rua, número, bairro, cidade – UF">
        </div>
      </div>
      <div class="field-group">
        <div class="row-2">
          <div class="field">
            <label class="field__label">Nº da proposta</label>
            <input type="text" id="f-numero" value="${state.numeroProposta || ''}" placeholder="Ex: PC051/2026">
          </div>
          <div class="field">
            <label class="field__label">Data da proposta</label>
            <input type="date" id="f-data-proposta" value="${state.dataProposta || ''}">
          </div>
        </div>
        <div class="field">
          <label class="field__label">Teto orçamentário informado pelo cliente (opcional)</label>
          <input type="text" id="f-teto" value="${state.tetoOrcamentario || ''}" placeholder="Ex: R$ 6.000.000,00">
        </div>
      </div>
    `;
  },
  bind(el, state) {
    el.querySelector('#f-nome').oninput = e => state.cliente.nome = e.target.value;
    el.querySelector('#f-email').oninput = e => state.cliente.email = e.target.value;
    el.querySelector('#f-telefone').oninput = e => state.cliente.telefone = e.target.value;
    el.querySelector('#f-doc').oninput = e => state.cliente.documento = e.target.value;
    el.querySelector('#f-endereco').oninput = e => state.cliente.endereco = e.target.value;
    el.querySelector('#f-numero').oninput = e => state.numeroProposta = e.target.value;
    el.querySelector('#f-data-proposta').oninput = e => state.dataProposta = e.target.value;
    el.querySelector('#f-teto').oninput = e => state.tetoOrcamentario = e.target.value;
    el.querySelectorAll('input[name="representacao"]').forEach(r => {
      r.onchange = e => state.cliente.representacao = e.target.value;
    });
  },
  validate(state) {
    if (!state.cliente.nome) return 'Informe o nome do cliente.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 1. Classificação e área
// -------------------------------------------------------------------------
STEPS.push({
  id: 'classificacao',
  eyebrow: 'Etapa 2 de 9',
  title: 'Classificação do serviço',
  desc: 'Define a base de honorários (CUB/tipologia) e o porte do projeto.',
  render(state, data) {
    const servicoOpts = data.servicosOdisse.map(s => `<option value="${s.id}" ${state.servicoId === s.id ? 'selected' : ''}>${s.nome}</option>`).join('');
    const macroOpts = Object.keys(data.tipologias).map(m => `<option value="${m}" ${state.macroCategoria === m ? 'selected' : ''}>${m}</option>`).join('');
    const tipoList = data.tipologias[state.macroCategoria] || [];
    const tipoOpts = tipoList.map(t => `<option value="${t.item}" ${state.tipologiaItem && state.tipologiaItem.item === t.item ? 'selected' : ''}>${t.item} — ${t.descricao}</option>`).join('');
    const modOpts = data.modificadoresIntervencao.map(m => `<option value="${m.modificador}" ${state.modificadorIntervencao === m.modificador ? 'selected' : ''}>${m.nome}</option>`).join('');

    return `
      <div class="field-group">
        <div class="field">
          <label class="field__label">Serviço Odisse</label>
          <select id="f-servico"><option value="">Selecione…</option>${servicoOpts}</select>
          <p class="field__hint">Define os valores padrão de complexidade, escopo e etapas — tudo ajustável depois.</p>
        </div>
      </div>
      <div class="field-group">
        <div class="field">
          <label class="field__label">Macro categoria (tabela CAU)</label>
          <select id="f-macro"><option value="">Selecione…</option>${macroOpts}</select>
        </div>
        <div class="field">
          <label class="field__label">Tipologia específica</label>
          <select id="f-tipo" ${tipoList.length ? '' : 'disabled'}><option value="">${tipoList.length ? 'Selecione…' : 'Escolha a macro categoria primeiro'}</option>${tipoOpts}</select>
        </div>
        <div class="field">
          <label class="field__label">Tipo de intervenção</label>
          <select id="f-intervencao">${modOpts}</select>
        </div>
      </div>
      <div class="field-group">
        <div class="row-2">
          <div class="field">
            <label class="field__label">Área construída estimada (m²)</label>
            <input type="number" min="0" step="1" id="f-area" value="${state.areaConstruida || ''}">
          </div>
          <div class="field">
            <label class="field__label">Área externa projetada, não paisagismo (m²)</label>
            <input type="number" min="0" step="1" id="f-area-ext" value="${state.areaExterna || ''}">
          </div>
        </div>
        <div class="row-2">
          <div class="field">
            <label class="field__label">Contagem de repetições</label>
            <input type="number" min="0" step="1" id="f-repeticoes" value="${state.contagemRepeticoes || 0}">
            <p class="field__hint">Unidades/áreas que se repetem integralmente no mesmo projeto (0 se não houver).</p>
          </div>
        </div>
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    const macroSel = el.querySelector('#f-macro');
    const servicoSel = el.querySelector('#f-servico');

    servicoSel.onchange = e => {
      state.servicoId = e.target.value;
      const servico = data.servicosOdisse.find(s => s.id === state.servicoId);
      if (servico) {
        const icNum = {};
        Object.entries(servico.ic_preset).forEach(([k, v]) => { icNum[k] = IC_LABELS[v]; });
        state.icValores = icNum;
        state.etapasSelecionadas = [...servico.etapas_default];
        state.compreendeSelecionados = [...servico.compreende_default];
        state.naoCompreendeSelecionados = [...servico.nao_compreende_default];
      }
      ctx.updateTicket();
    };

    macroSel.onchange = e => {
      state.macroCategoria = e.target.value;
      state.tipologiaItem = null;
      ctx.rerender();
    };
    el.querySelector('#f-tipo').onchange = e => {
      const list = data.tipologias[state.macroCategoria] || [];
      state.tipologiaItem = list.find(t => t.item === e.target.value) || null;
      ctx.updateTicket();
    };
    el.querySelector('#f-intervencao').onchange = e => {
      state.modificadorIntervencao = parseFloat(e.target.value);
      ctx.updateTicket();
    };
    el.querySelector('#f-area').oninput = e => { state.areaConstruida = parseFloat(e.target.value) || 0; ctx.updateTicket(); };
    el.querySelector('#f-area-ext').oninput = e => { state.areaExterna = parseFloat(e.target.value) || 0; ctx.updateTicket(); };
    el.querySelector('#f-repeticoes').oninput = e => { state.contagemRepeticoes = parseInt(e.target.value) || 0; ctx.updateTicket(); };
  },
  validate(state) {
    if (!state.tipologiaItem) return 'Selecione a tipologia do projeto.';
    if (!state.areaConstruida || state.areaConstruida <= 0) return 'Informe a área construída estimada.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 2. Índice de complexidade
// -------------------------------------------------------------------------
STEPS.push({
  id: 'complexidade',
  eyebrow: 'Etapa 3 de 9',
  title: 'Índice de complexidade',
  desc: 'Padrão pré-carregado a partir do serviço escolhido. Ajuste qualquer critério se o padrão não refletir o projeto.',
  render(state, data) {
    return `
      <div class="field-group">
        ${data.icCriterios.map((crit, i) => {
          const key = ['empenho_porte','qtd_especialistas','qtd_aprovacoes','grau_detalhamento','grau_resp_civil','grau_intervencao_cliente','expectativa_plastica','grau_controle_custo','indefinicao_escopo','indefinicao_prazo'][i];
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
    `;
  },
  bind(el, state, data, ctx) {
    const keys = ['empenho_porte','qtd_especialistas','qtd_aprovacoes','grau_detalhamento','grau_resp_civil','grau_intervencao_cliente','expectativa_plastica','grau_controle_custo','indefinicao_escopo','indefinicao_prazo'];
    keys.forEach((key, i) => {
      el.querySelectorAll(`input[name="ic-${key}"]`).forEach(r => {
        r.onchange = e => {
          state.icValores[key] = IC_LABELS[e.target.value];
          el.querySelector(`#ic-hint-${key}`).textContent = data.icCriterios[i][e.target.value];
          ctx.updateTicket();
        };
      });
    });
  },
  validate() { return true; }
});

// -------------------------------------------------------------------------
// 3. Ajuste de mercado & escopo de contratação
// -------------------------------------------------------------------------
STEPS.push({
  id: 'ajuste',
  eyebrow: 'Etapa 4 de 9',
  title: 'Ajuste de mercado & contratação',
  desc: 'O valor de tabela (CAU) costuma precisar de um ajuste de mercado. Depois, defina se o cliente está contratando o projeto completo ou uma parte dele.',
  render(state, data) {
    const fatorAtual = state.fatorAjuste || 1.25;
    const reducaoOpts = [{ nome: 'Projeto Completo', percentual: 1 }, ...data.reducaoEscopo];
    return `
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
        <div class="field">
          <label class="field__label">Escopo de contratação</label>
          <select id="f-reducao">
            ${reducaoOpts.map(r => `<option value="${r.percentual}" ${state.reducaoEscopoPercentual === r.percentual ? 'selected' : ''}>${r.nome} (${Math.round(r.percentual * 100)}%)</option>`).join('')}
          </select>
          <p class="field__hint">Aplica-se sobre o valor final de honorários, para contratações parciais (ex: só até o Projeto Legal).</p>
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
        }
      };
    });
    el.querySelector('#f-fator-custom').oninput = e => {
      state.fatorAjuste = parseFloat(e.target.value) || 1;
      ctx.updateTicket();
    };
    el.querySelector('#f-reducao').onchange = e => {
      state.reducaoEscopoPercentual = parseFloat(e.target.value);
      ctx.updateTicket();
    };
  },
  validate() { return true; }
});

// -------------------------------------------------------------------------
// 4. Escopo do serviço (checkboxes)
// -------------------------------------------------------------------------
function renderCheckList(items, selectedIds, name) {
  return `<div class="check-list" data-list="${name}">` +
    items.map(item => `
      <label class="check-row">
        <input type="checkbox" data-id="${item.id}" ${selectedIds.includes(item.id) ? 'checked' : ''}>
        <span class="check-row__box">${checkSvg()}</span>
        <span class="check-row__text">${item.texto}</span>
      </label>
    `).join('') +
    `</div>`;
}

STEPS.push({
  id: 'escopo',
  eyebrow: 'Etapa 5 de 9',
  title: 'Escopo do serviço',
  desc: 'Marque o que compreende e o que não compreende esta proposta. A lista vem pré-marcada pelo serviço escolhido — ajuste livremente.',
  render(state, data) {
    return `
      <div class="field-group">
        <div class="card__title" style="margin-bottom:14px">Compreende o serviço</div>
        ${renderCheckList(data.escopoMaster.compreende, state.compreendeSelecionados, 'compreende')}
        <div class="add-item">
          <input type="text" id="f-add-compreende" placeholder="Adicionar item personalizado…">
          <button class="btn btn--ghost" id="btn-add-compreende" type="button">Adicionar</button>
        </div>
      </div>
      <div class="field-group">
        <div class="card__title" style="margin-bottom:14px">Não compreende esta proposta</div>
        ${renderCheckList(data.escopoMaster.nao_compreende, state.naoCompreendeSelecionados, 'nao_compreende')}
        <div class="add-item">
          <input type="text" id="f-add-nao" placeholder="Adicionar item personalizado…">
          <button class="btn btn--ghost" id="btn-add-nao" type="button">Adicionar</button>
        </div>
      </div>
    `;
  },
  bind(el, state, data, ctx) {
    el.querySelectorAll('[data-list="compreende"] input[type=checkbox]').forEach(cb => {
      cb.onchange = e => {
        const id = e.target.dataset.id;
        if (e.target.checked) state.compreendeSelecionados.push(id);
        else state.compreendeSelecionados = state.compreendeSelecionados.filter(x => x !== id);
      };
    });
    el.querySelectorAll('[data-list="nao_compreende"] input[type=checkbox]').forEach(cb => {
      cb.onchange = e => {
        const id = e.target.dataset.id;
        if (e.target.checked) state.naoCompreendeSelecionados.push(id);
        else state.naoCompreendeSelecionados = state.naoCompreendeSelecionados.filter(x => x !== id);
      };
    });
    el.querySelector('#btn-add-compreende').onclick = () => {
      const input = el.querySelector('#f-add-compreende');
      const texto = input.value.trim();
      if (!texto) return;
      const id = 'custom-c-' + Date.now();
      data.escopoMaster.compreende.push({ id, texto });
      state.compreendeSelecionados.push(id);
      ctx.rerender();
    };
    el.querySelector('#btn-add-nao').onclick = () => {
      const input = el.querySelector('#f-add-nao');
      const texto = input.value.trim();
      if (!texto) return;
      const id = 'custom-n-' + Date.now();
      data.escopoMaster.nao_compreende.push({ id, texto });
      state.naoCompreendeSelecionados.push(id);
      ctx.rerender();
    };
  },
  validate() { return true; }
});

// -------------------------------------------------------------------------
// 5. Etapas & cronograma
// -------------------------------------------------------------------------
STEPS.push({
  id: 'etapas',
  eyebrow: 'Etapa 6 de 9',
  title: 'Etapas & cronograma',
  desc: 'Selecione as etapas contratadas. A duração-base de cada uma é multiplicada pelo índice de complexidade — edite manualmente se o resultado não servir.',
  render(state, data) {
    const ic = OdisseCalc.mediaIC(state.icValores);
    return `
      <div class="field-group">
        <div class="check-list">
          ${data.etapas.map(etapa => {
            const selecionada = state.etapasSelecionadas.includes(etapa.id);
            const semanasCalc = state.etapasSemanas[etapa.id] != null ? state.etapasSemanas[etapa.id] : Math.round(etapa.semanas_base * ic * 10) / 10;
            return `
              <label class="check-row check-row--sub">
                <input type="checkbox" data-etapa="${etapa.id}" ${selecionada ? 'checked' : ''}>
                <span class="check-row__box">${checkSvg()}</span>
                <span class="check-row__text" style="flex:1">
                  ${etapa.nome}
                  <span class="timeline__fase">${etapa.fase}</span>
                  ${selecionada ? `<div class="check-row__meta"><label class="small muted">Semanas: </label><input type="number" min="0.5" step="0.5" data-semanas="${etapa.id}" value="${semanasCalc}"></div>` : ''}
                </span>
              </label>
            `;
          }).join('')}
        </div>
      </div>
      <div class="field-group">
        <div class="field">
          <label class="field__label">Data de início do serviço</label>
          <input type="date" id="f-data-inicio" value="${state.dataInicio || ''}">
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
      if (!state.dataInicio || !selecionadas.length) { box.innerHTML = ''; return; }
      const linhas = OdisseCalc.montarCronograma(state.dataInicio, selecionadas);
      box.innerHTML = `<div class="card__title">Cronograma</div><div class="timeline">` +
        linhas.map(l => `
          <div class="timeline__row">
            <div><div class="timeline__name">${l.nome}</div><span class="timeline__fase">${l.fase}</span></div>
            <div class="timeline__weeks small muted">${l.semanas} sem.</div>
            <div class="timeline__dates">${OdisseCalc.fmtData(l.inicio)} – ${OdisseCalc.fmtData(l.fim)}</div>
          </div>
        `).join('') + `</div>`;
    }

    el.querySelectorAll('input[data-etapa]').forEach(cb => {
      cb.onchange = e => {
        const id = e.target.dataset.etapa;
        if (e.target.checked) {
          state.etapasSelecionadas.push(id);
          if (state.etapasSemanas[id] == null) {
            const etapa = data.etapas.find(x => x.id === id);
            const ic = OdisseCalc.mediaIC(state.icValores);
            state.etapasSemanas[id] = Math.round(etapa.semanas_base * ic * 10) / 10;
          }
        } else {
          state.etapasSelecionadas = state.etapasSelecionadas.filter(x => x !== id);
        }
        ctx.rerender();
      };
    });
    el.querySelectorAll('input[data-semanas]').forEach(inp => {
      inp.oninput = e => {
        state.etapasSemanas[e.target.dataset.semanas] = parseFloat(e.target.value) || 0;
        renderCronograma();
      };
    });
    el.querySelector('#f-data-inicio').oninput = e => {
      state.dataInicio = e.target.value;
      renderCronograma();
    };
    renderCronograma();
  },
  validate(state) {
    if (!state.etapasSelecionadas.length) return 'Selecione ao menos uma etapa.';
    if (!state.dataInicio) return 'Informe a data de início.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 6. Condições de pagamento
// -------------------------------------------------------------------------
STEPS.push({
  id: 'pagamento',
  eyebrow: 'Etapa 7 de 9',
  title: 'Condições de pagamento',
  desc: 'Parâmetros usados para gerar as opções de parcelamento no documento final.',
  render(state) {
    return `
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
            <div class="switch-row__title">Incluir acompanhamento mensal de obra</div>
            <div class="switch-row__hint">Visitas mensais de um arquiteto da equipe durante a execução</div>
          </div>
          <label class="switch">
            <input type="checkbox" id="f-acompanhamento" ${state.incluirAcompanhamentoObra ? 'checked' : ''}>
            <span class="switch__track"></span><span class="switch__thumb"></span>
          </label>
        </div>
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
    el.querySelector('#f-desconto').oninput = e => { state.descontoAvista = (parseFloat(e.target.value) || 0) / 100; ctx.updateTicket(); };
    el.querySelector('#f-entrada').oninput = e => { state.pctEntrada = (parseFloat(e.target.value) || 0) / 100; ctx.updateTicket(); };
    el.querySelector('#f-acompanhamento').onchange = e => state.incluirAcompanhamentoObra = e.target.checked;
    el.querySelector('#f-reembolsaveis').onchange = e => state.incluirDespesasReembolsaveis = e.target.checked;
  },
  validate() { return true; }
});

// -------------------------------------------------------------------------
// 7. Entendimento do projeto
// -------------------------------------------------------------------------
STEPS.push({
  id: 'entendimento',
  eyebrow: 'Etapa 8 de 9',
  title: 'Entendimento do projeto',
  desc: 'Texto livre — o resumo da demanda do cliente que abre a proposta.',
  render(state) {
    return `
      <div class="field-group">
        <div class="field">
          <textarea id="f-entendimento" rows="10" placeholder="Ex: O projeto arquitetônico objeto desta proposta trata-se de...">${state.entendimentoProjeto || ''}</textarea>
        </div>
      </div>
    `;
  },
  bind(el, state) {
    el.querySelector('#f-entendimento').oninput = e => state.entendimentoProjeto = e.target.value;
  },
  validate(state) {
    if (!state.entendimentoProjeto || state.entendimentoProjeto.trim().length < 10) return 'Escreva um resumo do entendimento do projeto.';
    return true;
  }
});

// -------------------------------------------------------------------------
// 8. Revisão & download
// -------------------------------------------------------------------------
STEPS.push({
  id: 'revisao',
  eyebrow: 'Etapa 9 de 9',
  title: 'Revisão & geração do PDF',
  desc: 'Confira os valores calculados antes de gerar o documento final.',
  render(state, data) {
    const r = state._calcResult;
    if (!r) return `<p class="muted">Complete as etapas anteriores para ver o resumo do cálculo.</p>`;
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
        <div class="data-row"><span class="data-row__label">Escopo de contratação</span><span class="data-row__value tabular">${Math.round(state.reducaoEscopoPercentual * 100)}%</span></div>
        <div class="data-row"><span class="data-row__label"><strong>Honorário final</strong></span><span class="data-row__value tabular"><strong>${OdisseCalc.fmtMoeda(r.valorFinal)}</strong></span></div>
      </div>
      <button class="btn btn--primary" id="btn-gerar-pdf" type="button" style="width:100%">Gerar PDF da proposta</button>
      <p class="field__hint" style="margin-top:14px">O PDF é gerado inteiramente no seu navegador — nenhum dado é enviado a um servidor.</p>
    `;
  },
  bind(el, state, data) {
    const btn = el.querySelector('#btn-gerar-pdf');
    if (btn) btn.onclick = () => OdissePdf.gerar(state, data);
  },
  validate() { return true; }
});
