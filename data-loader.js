// Carrega todas as tabelas de referência (data/*.json) uma vez, no início.
const OdisseData = (() => {
  const FILES = {
    tipologias: 'data/tipologias.json',
    cub: 'data/cub.json',
    fatorPercentual: 'data/fator-percentual.json',
    redutorRepeticao: 'data/redutor-repeticao.json',
    icCriterios: 'data/ic-criterios.json',
    reducaoEscopo: 'data/reducao-escopo.json',
    jurosParcelamento: 'data/juros-parcelamento.json',
    etapasPagamento: 'data/etapas-pagamento.json',
    etapas: 'data/etapas.json',
    pesosEtapas: 'data/pesos-etapas.json',
    assessoramento: 'data/assessoramento.json',
    servicosOdisse: 'data/servicos-odisse.json',
    despesasReembolsaveis: 'data/despesas-reembolsaveis.json'
  };

  let cache = null;
  // Impressão digital de cada tabela (12 primeiros caracteres do SHA-256 do arquivo):
  // vai nas referências de cada proposta, para saber com que versão das tabelas ela foi calculada.
  const impressoes = {};

  async function sha(texto) {
    if (!(window.crypto && crypto.subtle)) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12);
  }

  async function load() {
    if (cache) return cache;
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, path]) => {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
        const texto = await res.text();
        impressoes[path] = await sha(texto).catch(() => null);
        return [key, JSON.parse(texto)];
      })
    );
    cache = Object.fromEntries(entries);
    return cache;
  }

  return { load, impressoes: () => ({ ...impressoes }) };
})();
