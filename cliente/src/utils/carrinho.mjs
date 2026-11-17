export function criarControleCarrinho(fetchImpl = fetch) {
  let estado = { itens: [], resumo: null, carregando: true, salvando: false, erro: '' };
  const ouvintes = new Set();
  let versao = 0, leitura, gravando = false, atualizarDepois = false;
  const publicar = (dados) => { estado = { ...estado, ...dados }; ouvintes.forEach((ouvinte) => ouvinte()); };
  const validar = async (resposta) => {
    const dados = await resposta.json();
    if (!resposta.ok) throw Object.assign(new Error(dados.erro || 'Não foi possível atualizar o carrinho.'), { status: resposta.status });
    if (!Array.isArray(dados.itens) || !dados.resumo || typeof dados.resumo.podeContinuar !== 'boolean') throw new Error('Resposta do carrinho indisponível. Tente novamente.');
    return { itens: dados.itens, resumo: dados.resumo };
  };
  async function carregar() {
    if (gravando) { atualizarDepois = true; return; }
    const atual = ++versao;
    leitura?.abort();
    leitura = new AbortController();
    publicar({ carregando: true, erro: '' });
    try {
      const dados = await validar(await fetchImpl('/api/carrinho', { credentials: 'include', cache: 'no-store', signal: leitura.signal }));
      if (atual === versao) publicar({ ...dados, carregando: false });
    } catch (erro) {
      if (atual === versao) publicar({ carregando: false, erro: erro.name === 'AbortError' ? '' : erro.message,
        ...([401, 403].includes(erro.status) && { itens: [], resumo: null }) });
    }
  }
  async function alterar(produtoId, metodo, quantidade) {
    if (gravando) return false;
    gravando = true;
    ++versao; leitura?.abort();
    publicar({ salvando: true, carregando: false, erro: '' });
    try {
      const dados = await validar(await fetchImpl(`/api/carrinho/${encodeURIComponent(produtoId)}`, {
        method: metodo, credentials: 'include', headers: metodo === 'PATCH' ? { 'Content-Type': 'application/json' } : {},
        ...(metodo === 'PATCH' && { body: JSON.stringify({ quantidade }) }),
      }));
      publicar(dados);
      return true;
    } catch (erro) {
      publicar({ erro: erro.message, ...([401, 403].includes(erro.status) && { itens: [], resumo: null }) });
      return false;
    } finally {
      gravando = false; publicar({ salvando: false });
      if (atualizarDepois) { atualizarDepois = false; carregar(); }
    }
  }
  return { carregar, alterar, ler: () => estado,
    assinar: (ouvinte) => { ouvintes.add(ouvinte); return () => ouvintes.delete(ouvinte); },
    cancelarLeitura: () => { ++versao; leitura?.abort(); } };
}

export function formatarParcelasCarrinho(valores = []) {
  const moeda = (valor) => (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (!valores.length) return 'Calculado no checkout';
  if (valores.length === 1) return `1x de ${moeda(valores[0])}`;
  if (valores.every((valor) => valor === valores[0])) return `${valores.length}x de ${moeda(valores[0])}`;
  const grupos = [];
  for (const valor of valores) {
    const ultimo = grupos.at(-1);
    if (ultimo?.valor === valor) ultimo.quantidade++;
    else grupos.push({ valor, quantidade: 1 });
  }
  return `${valores.length}x: ${grupos.map(({ valor, quantidade }) => quantidade > 1 ? `${quantidade} de ${moeda(valor)}` : moeda(valor)).join(' + ')}`;
}
