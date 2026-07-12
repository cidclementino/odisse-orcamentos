// ==========================================================================
// Autenticação — mantém a pessoa logada entre visitas (localStorage), em vez
// de pedir a senha a cada página. Isto continua sendo um portão simples do
// lado do cliente, não um controle de acesso real (ver aviso no README) —
// mas resolve o incômodo de digitar a senha toda hora.
// ==========================================================================

const AUTH_FLAG_KEY = 'odisse-auth-ok';
const AUTH_NAME_KEY = 'odisse-auth-nome';
const AUTH_TOKEN_KEY = 'odisse-github-token';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function isAuthenticated() {
  return localStorage.getItem(AUTH_FLAG_KEY) === 'ok';
}

function getUserName() {
  return localStorage.getItem(AUTH_NAME_KEY) || '';
}

function getGithubToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

function setAuthenticated(nome, githubToken) {
  localStorage.setItem(AUTH_FLAG_KEY, 'ok');
  localStorage.setItem(AUTH_NAME_KEY, nome || '');
  if (githubToken) localStorage.setItem(AUTH_TOKEN_KEY, githubToken);

  // Registro local de acesso (apenas neste navegador — ver README sobre
  // como ligar isso a um registro compartilhado de verdade, se necessário).
  try {
    const log = JSON.parse(localStorage.getItem('odisse-acessos') || '[]');
    log.push({ nome: nome || '', quando: new Date().toISOString() });
    localStorage.setItem('odisse-acessos', JSON.stringify(log.slice(-50)));
  } catch (_) { /* localStorage indisponível — segue sem registrar */ }
}

function logout() {
  localStorage.removeItem(AUTH_FLAG_KEY);
  localStorage.removeItem(AUTH_NAME_KEY);
  // o token do GitHub fica guardado propositalmente — não precisa reconfigurar
  // a cada login, só ao trocar de token em si (ver login.html).
}

// Redireciona para o login se não estiver autenticado. Chame no topo de
// qualquer página que exija acesso.
function exigirAutenticacao() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
  }
}
