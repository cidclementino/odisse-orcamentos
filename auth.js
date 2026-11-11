// ==========================================================================
// Autenticação — a senha é conferida pelo Worker (servidor), não pelo
// navegador. Depois de entrar, ela fica lembrada neste computador
// (localStorage) e vai em cada chamada à API (cabeçalho Authorization).
// Sem a senha certa, o Worker não entrega nem grava nada.
// ==========================================================================

const AUTH_FLAG_KEY = 'odisse-auth-ok';
const AUTH_NAME_KEY = 'odisse-auth-nome';

const AUTH_SENHA_KEY = 'odisse-senha';

function getSenha() {
  try { return localStorage.getItem(AUTH_SENHA_KEY) || ''; } catch (_) { return ''; }
}

// Cabeçalhos para as chamadas ao Worker.
function cabecalhosAuth(extra = {}) {
  return { ...extra, Authorization: `Bearer ${getSenha()}` };
}

// Pergunta ao Worker se a senha está certa. Devolve 'ok', 'senha' (incorreta)
// ou 'rede' (não conseguiu falar com o servidor).
async function conferirSenha(senha) {
  try {
    const res = await fetch(`${CONFIG.workerUrl}/estado`, { headers: { Authorization: `Bearer ${senha}` } });
    if (res.ok) return 'ok';
    if (res.status === 401) return 'senha';
    return 'rede';
  } catch (_) {
    return 'rede';
  }
}

function isAuthenticated() {
  return localStorage.getItem(AUTH_FLAG_KEY) === 'ok' && !!getSenha();
}

function getUserName() {
  return localStorage.getItem(AUTH_NAME_KEY) || '';
}

function setAuthenticated(nome, senha) {
  localStorage.setItem(AUTH_FLAG_KEY, 'ok');
  localStorage.setItem(AUTH_SENHA_KEY, senha);
  localStorage.setItem(AUTH_NAME_KEY, nome || '');

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
  localStorage.removeItem(AUTH_SENHA_KEY);
}

// A API recusou a senha (trocada no servidor, por exemplo): sai e volta ao login.
function senhaRecusada() {
  logout();
  window.location.href = 'login.html';
}

// Redireciona para o login se não estiver autenticado. Chame no topo de
// qualquer página que exija acesso.
function exigirAutenticacao() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
  }
}
