export function origemRecuperacao(search, storage) {
  const parametros = new URLSearchParams(search);
  if (parametros.get('pedido')) return { pedido: parametros.get('pedido') };
  if (parametros.get('tentativa')) return { chave: parametros.get('tentativa') };
  try {
    const chave = storage.getItem('mini-stitches:tentativa-pagamento');
    return chave ? { chave } : null;
  } catch { return null; }
}

export function urlRecuperacao({ chave, pedido }) {
  return pedido ? `/api/pedidos/${encodeURIComponent(pedido)}/pagamento`
    : `/api/pagamentos/tentativas/${encodeURIComponent(chave)}`;
}

export function urlBoletoSegura(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function permiteNovaCompra(tentativa) {
  return tentativa?.situacao === 'nao_cobrada' || (tentativa?.situacao !== 'conciliacao_pendente' &&
    (Boolean(tentativa?.pedido) || ['recusado', 'cancelado', 'reembolsado'].includes(tentativa?.statusFinanceiro)));
}
