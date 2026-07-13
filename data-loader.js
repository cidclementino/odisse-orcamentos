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
    servicosOdisse: 'data/servicos-odisse.json'
  };

  let cache = null;

  async function load() {
    if (cache) return cache;
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, path]) => {
        const res = await fetch(path);
        if (!res.ok) throw new Error(`Falha ao carregar ${path}`);
        return [key, await res.json()];
      })
    );
    cache = Object.fromEntries(entries);
    return cache;
  }

  return { load };
})();
