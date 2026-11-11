// ==========================================================================
// Barra do vendas.odisse — uma peça só para todas as páginas.
//
//   <header class="topo" data-pagina="crm"></header>
//   <script src="topo.js"></script>
//
// Segue a barra do Universo (base/v1/barra.js): mesma altura, cor ardósia,
// logo oficial (selo da mão + logotipo ODISSE, lidos da marca) e rótulo da
// ferramenta à esquerda; seções no centro; botão "Universo" à direita.
//
// Organização (nov/2026):
//   - seções de trabalho, na ordem do fluxo: Funil → Contatos → Orçamento → Propostas;
//   - material de consulta (CUB, cálculo, glossário) agrupado em "Referências";
//   - a migração (uso único) não entra no menu: é aberta pelo aviso em Propostas.
//
// Mantém os ids #rail-user e #btn-logout, que as páginas já usam.
// ==========================================================================

(() => {
  const SECOES = [
    { id: 'crm', nome: 'Funil', href: 'crm.html', dica: 'Oportunidades por etapa e próximas ações' },
    { id: 'contatos', nome: 'Contatos', href: 'contatos.html', dica: 'Pessoas e organizações, ligações entre elas e o histórico de cada uma' },
    { id: 'orcamento', nome: 'Orçamento', href: 'index.html', dica: 'Novo orçamento de honorários (CAU/AsBEA)' },
    { id: 'propostas', nome: 'Propostas', href: 'historico.html', dica: 'Propostas numeradas, PDFs guardados e revisões' }
  ];
  const REFERENCIAS = [
    { id: 'cub', nome: 'Tabela do CUB', href: 'cub.html', dica: 'Valores do mês usados como base de honorários' },
    { id: 'calculo', nome: 'Como funciona o cálculo', href: 'precificacao.html', dica: 'Fórmula, modificadores e tipologias' },
    { id: 'glossario', nome: 'Glossário', href: 'glossario.html', dica: 'Fases, etapas e entregáveis' }
  ];
  // páginas fora do menu que pertencem a uma seção
  const PERTENCE = { migrar: 'propostas' };

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const seta = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>';

  const raiz = document.querySelector('header.topo');
  if (!raiz) return;
  const pagina = PERTENCE[raiz.dataset.pagina] || raiz.dataset.pagina || '';
  const naReferencia = REFERENCIAS.some((r) => r.id === pagina);

  raiz.innerHTML = `
    <a class="topo__casa" href="crm.html" title="Vendas · Funil">
      <span class="topo__selo" aria-hidden="true"></span>
      <span class="topo__logotipo" role="img" aria-label="Odisse"></span>
      <span class="topo__sub">Vendas</span>
    </a>
    <nav class="topo__secoes" aria-label="Seções do vendas">
      ${SECOES.map((s) => `<a href="${s.href}" title="${esc(s.dica)}"${s.id === pagina ? ' class="is-current" aria-current="page"' : ''}>${esc(s.nome)}</a>`).join('')}
      <span class="topo__sep" aria-hidden="true"></span>
      <div class="topo__ref">
        <button type="button" class="topo__ref-botao${naReferencia ? ' is-current' : ''}" aria-haspopup="true" aria-expanded="false">Referências ${seta}</button>
      </div>
    </nav>
    <div class="topo__direita">
      <span data-universo-menu></span>
      <span class="topo__conta"><span id="rail-user"></span><a href="login.html" id="btn-logout">Sair</a></span>
    </div>`;

  // O painel de Referências fica fora da faixa de seções (que rola no celular
  // e cortaria um painel posicionado dentro dela).
  const painel = document.createElement('div');
  painel.className = 'topo__painel';
  painel.hidden = true;
  painel.innerHTML = `<div class="topo__painel-cab">Consulta</div>` + REFERENCIAS.map((r) =>
    `<a class="topo__item${r.id === pagina ? ' is-current' : ''}" href="${r.href}"><b>${esc(r.nome)}</b><small>${esc(r.dica)}</small></a>`).join('');
  document.body.appendChild(painel);

  const botao = raiz.querySelector('.topo__ref-botao');
  const posicionar = () => {
    const r = botao.getBoundingClientRect();
    const larg = Math.min(300, window.innerWidth - 24);
    painel.style.width = larg + 'px';
    painel.style.top = (r.bottom + 6) + 'px';
    painel.style.left = Math.max(12, Math.min(r.left, window.innerWidth - larg - 12)) + 'px';
  };
  const fechar = () => { painel.hidden = true; botao.setAttribute('aria-expanded', 'false'); };
  botao.addEventListener('click', (e) => {
    e.stopPropagation();
    const abrir = painel.hidden;
    if (abrir) posicionar();
    painel.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
  });
  document.addEventListener('click', (e) => { if (!painel.contains(e.target)) fechar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(); });
  window.addEventListener('resize', fechar);
  raiz.querySelector('.topo__secoes').addEventListener('scroll', fechar, { passive: true });

  // nome de quem entrou (auth.js carrega depois desta barra)
  const mostrarNome = () => {
    try { document.getElementById('rail-user').textContent = typeof getUserName === 'function' ? getUserName() : ''; } catch (_) { /* sem nome */ }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mostrarNome); else mostrarNome();
  document.getElementById('btn-logout').addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof logout === 'function') logout();
    window.location.href = 'login.html';
  });

  // em telas estreitas a faixa rola: traz a seção ativa para dentro da vista
  const nav = raiz.querySelector('.topo__secoes');
  const ativo = nav.querySelector('.is-current');
  if (ativo) requestAnimationFrame(() => {
    if (ativo.offsetLeft + ativo.offsetWidth > nav.clientWidth) nav.scrollLeft = ativo.offsetLeft - (nav.clientWidth - ativo.offsetWidth) / 2;
  });

  // botão "Universo" (seções e ferramentas do hub), vindo do próprio hub
  const s = document.createElement('script');
  s.src = 'https://universo.odisse.com.br/base/v1/barra.js';
  s.defer = true;
  document.head.appendChild(s);
})();
