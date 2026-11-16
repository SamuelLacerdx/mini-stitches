export function notificarAlteracaoCarrinho() {
  window.dispatchEvent(new Event('carrinho-atualizado'));
  try { localStorage.setItem('mini-stitches:carrinho-revisao', crypto.randomUUID()); }
  catch { /* A validação no servidor continua obrigatória sem storage. */ }
}

export function criarConsultaResumo(fetchImpl = fetch) {
  let versao = 0;
  let abortar;
  return {
    cancelar() { versao += 1; abortar?.abort(); },
    async consultar(body) {
      const atual = ++versao;
      abortar?.abort();
      abortar = new AbortController();
      try {
        const resposta = await fetchImpl('/api/checkout/resumo', { method: 'POST', credentials: 'include', cache: 'no-store',
          headers: { 'Content-Type': 'application/json' }, signal: abortar.signal, body: JSON.stringify(body) });
        const dados = await resposta.json();
        if (atual !== versao) return null;
        if (!resposta.ok) throw new Error(dados.erro || 'Não foi possível atualizar o resumo.');
        return dados.resumo;
      } catch (erro) {
        if (atual !== versao) return null;
        throw erro;
      }
    },
  };
}
