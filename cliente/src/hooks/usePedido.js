import { useEffect, useState } from 'react';

export function usePedido(id, { somentePagamento = false } = {}) {
  const [resultado, setResultado] = useState(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    let consultando = false;
    let encerrado = false;
    let falhas = 0;
    let timer;
    let controller;

    const carregar = async () => {
      if (!ativo || consultando || encerrado || document.hidden) return;
      consultando = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let intervalo = 30000;

      try {
        const res = await fetch(`/api/pedidos/${encodeURIComponent(id)}${somentePagamento ? '/status' : ''}`, {
          credentials: 'include', cache: 'no-store', signal: controller.signal,
        });
        if (!res.ok) {
          const erro = new Error(res.status === 401 ? 'Entre na sua conta para consultar este pedido.'
            : res.status === 404 ? 'Pedido não encontrado na sua conta.'
              : 'Não foi possível atualizar o pedido. Tente novamente.');
          erro.status = res.status;
          throw erro;
        }
        const dados = await res.json();
        const pedido = somentePagamento ? dados : dados.pedido;
        if (!pedido || typeof pedido.status !== 'string' || (!somentePagamento && !Array.isArray(pedido.itens))) {
          throw new Error('Os dados do pedido estão indisponíveis. Tente novamente.');
        }
        if (!ativo) return;
        falhas = 0;
        encerrado = ['entregue', 'cancelado'].includes(pedido.status)
          || (somentePagamento && ['pago', 'em_separacao', 'enviado'].includes(pedido.status));
        intervalo = pedido.status === 'aguardando_pagamento' ? 4000 : 60000;
        setResultado({ id, pedido, erro: null });
      } catch (erro) {
        if (!ativo) return;
        falhas += 1;
        encerrado = [401, 403, 404].includes(erro.status);
        intervalo = Math.min(30000 * 2 ** Math.min(falhas - 1, 3), 120000);
        setResultado((anterior) => ({
          id,
          pedido: encerrado ? null : anterior?.id === id ? anterior.pedido : null,
          statusErro: erro.status,
          erro: erro.name === 'AbortError' ? 'A consulta demorou mais que o esperado. Tente novamente.' : erro.message,
        }));
      } finally {
        clearTimeout(timeout);
        consultando = false;
        if (ativo && !encerrado && !document.hidden) timer = setTimeout(carregar, intervalo);
      }
    };

    const aoMudarVisibilidade = () => {
      clearTimeout(timer);
      if (!document.hidden) carregar();
    };
    if (id) {
      carregar();
      document.addEventListener('visibilitychange', aoMudarVisibilidade);
    }
    return () => {
      ativo = false;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [id, tentativa, somentePagamento]);

  return { resultado: resultado?.id === id ? resultado : null, tentarNovamente: () => setTentativa((valor) => valor + 1) };
}

