// ==========================================================================
// Numeração automática de propostas, com histórico versionado no próprio
// repositório (pasta propostas/), via API de Contents do GitHub.
//
// Precisa de um token (fine-grained, escopo "Contents: Read and write"
// só neste repositório) configurado uma vez no login. Sem token, cai
// para um contador local — funciona, mas não é compartilhado entre
// pessoas/dispositivos (ver README.md → "Numeração automática").
// ==========================================================================

const OdisseGithubStore = (() => {
  function apiBase() {
    const { owner, repo } = CONFIG.github;
    return `https://api.github.com/repos/${owner}/${repo}/contents`;
  }

  function headers(token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  async function lerArquivo(path, token) {
    const res = await fetch(`${apiBase()}/${path}?ref=${CONFIG.github.branch}`, { headers: headers(token) });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GitHub API: ${res.status} ao ler ${path}`);
    const json = await res.json();
    const conteudo = decodeURIComponent(escape(atob(json.content.replace(/\n/g, ''))));
    return { sha: json.sha, conteudo: JSON.parse(conteudo) };
  }

  async function escreverArquivo(path, objeto, sha, mensagem, token) {
    const conteudoBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(objeto, null, 2))));
    const body = { message: mensagem, content: conteudoBase64, branch: CONFIG.github.branch };
    if (sha) body.sha = sha;
    const res = await fetch(`${apiBase()}/${path}`, {
      method: 'PUT',
      headers: { ...headers(token), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const texto = await res.text();
      throw new Error(`GitHub API: ${res.status} ao gravar ${path} — ${texto}`);
    }
    return res.json();
  }

  // Gera o próximo número de proposta. Usa o GitHub (contador versionado)
  // se houver token configurado; senão cai para um contador local.
  async function proximoNumero() {
    const ano = new Date().getFullYear();
    const token = getGithubToken();

    if (token) {
      try {
        const atual = await lerArquivo('propostas/contador.json', token);
        const ultimo = atual ? (atual.conteudo.ultimo || 0) : 0;
        const novo = ultimo + 1;
        await escreverArquivo(
          'propostas/contador.json',
          { ultimo: novo, atualizado_em: new Date().toISOString() },
          atual ? atual.sha : null,
          `chore: proposta nº ${novo}`,
          token
        );
        return { numero: novo, numeroFormatado: `PC${String(novo).padStart(3, '0')}/${ano}`, fonte: 'github' };
      } catch (e) {
        console.error('Falha ao numerar via GitHub, caindo para contador local:', e);
        return numeroLocal(ano, `Falha ao conectar ao GitHub (${e.message}) — número gerado localmente.`);
      }
    }
    return numeroLocal(ano, 'Sem token do GitHub configurado — número gerado localmente (não compartilhado com a equipe).');
  }

  function numeroLocal(ano, aviso) {
    const chave = 'odisse-contador-local';
    const ultimo = parseInt(localStorage.getItem(chave) || '0');
    const novo = ultimo + 1;
    localStorage.setItem(chave, String(novo));
    return { numero: novo, numeroFormatado: `PC${String(novo).padStart(3, '0')}/${ano}`, fonte: 'local', aviso };
  }

  // Salva uma cópia completa da proposta (snapshot do estado) em
  // propostas/{numero}.json — só funciona com token do GitHub configurado.
  async function salvarRegistro(numeroFormatado, snapshot) {
    const token = getGithubToken();
    if (!token) return { ok: false, motivo: 'sem-token' };
    try {
      const nomeArquivo = numeroFormatado.replace(/[^\w]+/g, '-') + '.json';
      await escreverArquivo(`propostas/${nomeArquivo}`, snapshot, null, `chore: registro da proposta ${numeroFormatado}`, token);
      return { ok: true };
    } catch (e) {
      console.error('Falha ao salvar registro da proposta:', e);
      return { ok: false, motivo: e.message };
    }
  }

  return { proximoNumero, salvarRegistro };
})();
