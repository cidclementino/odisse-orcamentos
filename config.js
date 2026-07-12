// ==========================================================================
// Configuração compartilhada entre login.html e o app (index.html)
// ==========================================================================
const CONFIG = {
  // Hash SHA-256 da senha de acesso. Senha de fábrica: "odisse2026" — troque
  // assim que possível (veja README.md → "Trocar a senha de acesso").
  passwordHash: 'b861c55695a5130cdd716d983135490ff669c5649e67c96d79f172b89ed64747',

  // Repositório onde o "banco de propostas" (numeração + histórico) fica
  // versionado. Usado só se um token do GitHub estiver configurado no
  // login — sem token, a numeração cai para um contador local (ver
  // github-store.js).
  github: {
    owner: 'cidclementino',
    repo: 'odisse-orcamentos',
    branch: 'main'
  }
};
