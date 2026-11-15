function respostaPedido(pedido) {
  return {
    numero: pedido.numero,
    criadoEm: pedido.criadoEm,
    status: pedido.status,
    pagamento: pedido.pagamento,
    subtotal: pedido.subtotal,
    frete: pedido.frete,
    desconto: pedido.desconto || 0,
    total: pedido.total,
    rastreio: pedido.rastreio || "",
    itens: (pedido.itens || []).map((item) => ({
      nome: item.nome,
      slug: item.slug,
      quantidade: item.quantidade,
      precoUnit: item.precoUnit,
    })),
  };
}

// A resposta pública usa uma lista explícita de campos, sem IDs internos ou
// identificadores do gateway. A autorização sempre faz parte da consulta.
function registrarRotasPedidosCliente(app, { Pedido, autenticar, isValidObjectId }) {
  app.use('/api/pedidos', (_req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });

  function filtroDoCliente(req) {
    const id = String(req.params.id || '').trim();
    if (!id || id.length > 128) return null;
    const alternativas = [{ numero: id }, { pagamentoId: id }];
    if (isValidObjectId(id)) alternativas.push({ _id: id });
    return { clienteId: req.session.usuarioId, $or: alternativas };
  }

  app.get('/api/pedidos', autenticar, async (req, res) => {
    try {
      const pedidos = await Pedido.find({ clienteId: req.session.usuarioId })
        .select('numero criadoEm status pagamento subtotal frete desconto total rastreio itens.nome itens.slug itens.quantidade itens.precoUnit')
        .sort({ criadoEm: -1 }).limit(50).lean();
      res.json({ pedidos: pedidos.map(respostaPedido) });
    } catch (erro) {
      console.error('[pedidos] erro ao listar:', erro.message);
      res.status(500).json({ erro: 'Não foi possível carregar os pedidos.' });
    }
  });

  app.get('/api/pedidos/:id/status', autenticar, async (req, res) => {
    try {
      const filtro = filtroDoCliente(req);
      const pedido = filtro && await Pedido.findOne(filtro).select('status -_id').lean();
      if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });
      return res.json({ status: pedido.status });
    } catch (erro) {
      console.error('[pedidos] erro ao consultar status:', erro.message);
      return res.status(500).json({ erro: 'Não foi possível carregar o status do pedido.' });
    }
  });

  app.get('/api/pedidos/:id', autenticar, async (req, res) => {
    try {
      const filtro = filtroDoCliente(req);
      const pedido = filtro && await Pedido.findOne(filtro)
        .select('numero criadoEm status pagamento subtotal frete desconto total rastreio itens.nome itens.slug itens.quantidade itens.precoUnit cliente.nome entrega historicoStatus')
        .lean();
      if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });
      return res.json({
        pedido: {
          ...respostaPedido(pedido),
          cliente: { nome: pedido.cliente?.nome || '' },
          entrega: { cep: pedido.entrega?.cep || '', endereco: pedido.entrega?.endereco || '' },
          historicoStatus: (pedido.historicoStatus || []).map(({ status, em }) => ({ status, em })),
        },
      });
    } catch (erro) {
      console.error('[pedidos] erro ao consultar pedido:', erro.message);
      return res.status(500).json({ erro: 'Não foi possível carregar o pedido.' });
    }
  });
}

module.exports = { registrarRotasPedidosCliente, respostaPedido };
