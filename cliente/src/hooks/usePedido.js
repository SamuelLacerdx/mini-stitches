import { useAcompanhamento } from './useAcompanhamento';

const pedidoCompleto = (dados) => dados.pedido && typeof dados.pedido.status === 'string' && Array.isArray(dados.pedido.itens) ? dados.pedido : null;
const statusPedido = (dados) => typeof dados.status === 'string' ? dados : null;

export function usePedido(id, { somentePagamento = false } = {}) {
  const url = id ? `/api/pedidos/${encodeURIComponent(id)}${somentePagamento ? '/status' : ''}` : null;
  const { resultado, tentarNovamente } = useAcompanhamento(url, somentePagamento ? statusPedido : pedidoCompleto);
  return { resultado: resultado ? { ...resultado, id, pedido: resultado.dados } : null, tentarNovamente };
}

