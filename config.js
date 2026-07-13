// ==========================================================================
// Configuração compartilhada entre login.html e o app (index.html)
// ==========================================================================
const CONFIG = {
  // Hash SHA-256 da senha de acesso. Senha de fábrica: "odisse2026" — troque
  // assim que possível (veja README.md → "Trocar a senha de acesso").
  passwordHash: 'b861c55695a5130cdd716d983135490ff669c5649e67c96d79f172b89ed64747',

  // URL do Worker do Cloudflare que guarda a numeração e o histórico de
  // propostas (ver worker/README.md para colocar no ar). Deixe vazio
  // ('') para usar um contador local, sem histórico compartilhado.
  workerUrl: 'https://odisse-orcamentos-api.reservaprojectbasework.workers.dev'
};
