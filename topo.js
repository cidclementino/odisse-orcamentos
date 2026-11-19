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
//   - seções de trabalho, na ordem do fluxo: Funil → Contatos → Propostas (orçamento e histórico na mesma página);
//   - "Referências" é uma página só (honorarios.html), com abas: serviços, fases e etapas, base de
//     honorários, tabelas do CAU, tabela do CUB e a fórmula;
//   - a migração (uso único) não entra no menu: é aberta pelo aviso em Propostas.
//
// Mantém os ids #rail-user e #btn-logout, que as páginas já usam.
// ==========================================================================

(() => {
  const SECOES = [
    { id: 'crm', nome: 'Funil', href: 'crm.html', dica: 'Oportunidades por etapa e próximas ações' },
    { id: 'contatos', nome: 'Contatos', href: 'contatos.html', dica: 'Pessoas e organizações, ligações entre elas e o histórico de cada uma' },
    { id: 'propostas', nome: 'Propostas', href: 'index.html', dica: 'Nova proposta (orçamento de honorários) e o histórico: PDFs guardados e revisões' }
  ];
  const REFERENCIAS = { id: 'referencias', nome: 'Referências', href: 'honorarios.html', dica: 'Preço dos serviços, fases e etapas, base de honorários, tabelas do CAU e do CUB, e a fórmula' };
  // páginas fora do menu que pertencem a uma seção
  const PERTENCE = { migrar: 'propostas' };

  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const raiz = document.querySelector('header.topo');
  if (!raiz) return;
  const pagina = PERTENCE[raiz.dataset.pagina] || raiz.dataset.pagina || '';

  raiz.innerHTML = `
    <a class="topo__casa" href="crm.html" title="Vendas · Funil">
      <span class="topo__selo" aria-hidden="true"></span>
      <span class="topo__logotipo" role="img" aria-label="Odisse"></span>
      <span class="topo__sub">Vendas</span>
    </a>
    <nav class="topo__secoes" aria-label="Seções do vendas">
      ${SECOES.map((s) => `<a href="${s.href}" title="${esc(s.dica)}"${s.id === pagina ? ' class="is-current" aria-current="page"' : ''}>${esc(s.nome)}</a>`).join('')}
      <span class="topo__sep" aria-hidden="true"></span>
      <a href="${REFERENCIAS.href}" title="${esc(REFERENCIAS.dica)}"${REFERENCIAS.id === pagina ? ' class="is-current" aria-current="page"' : ''}>${esc(REFERENCIAS.nome)}</a>
    </nav>
    <div class="topo__direita">
      <span data-universo-menu></span>
      <span class="topo__conta"><span id="rail-user"></span><a href="login.html" id="btn-logout">Sair</a></span>
    </div>`;

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
