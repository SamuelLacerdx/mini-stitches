const { respostaPedido } = require('./pedidosCliente');
const { financeiroDoProvedor, estadosPedido } = require('./estadosPedido');
const { validarCorpoSeguro, ErroSegurancaPagamento } = require('./segurancaPagamento');

function criarRecuperacaoPagamento({ TentativaPagamento, Pedido, formatarTentativa }) {
  async function localizar(clienteId, chave, numero) {
    let pedido;
    let tentativa;
    if (numero) {
      if (typeof numero !== 'string' || numero.length > 128) return null;
      pedido = await Pedido.findOne({ numero, clienteId });
      if (!pedido) return null;
      if (pedido.tentativaId) tentativa = await TentativaPagamento.findOne({ _id: pedido.tentativaId, clienteId }).select('+respostaGateway');
      else if (pedido.pagamentoId) tentativa = await TentativaPagamento.findOne({ pagamentoId: pedido.pagamentoId, clienteId }).select('+respostaGateway');
    } else {
      if (typeof chave !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(chave)) return null;
      tentativa = await TentativaPagamento.findOne({ clienteId, chaveTentativa: chave }).select('+respostaGateway');
      if (!tentativa) return null;
      pedido = await Pedido.findOne({ tentativaId: tentativa._id, clienteId });
      if (!pedido && tentativa.pagamentoId) pedido = await Pedido.findOne({ pagamentoId: tentativa.pagamentoId, clienteId });
    }
    return { pedido, tentativa };
  }

  function publicar({ pedido, tentativa }) {
    const dados = tentativa?.respostaGateway
      ? formatarTentativa({ resposta: tentativa.respostaGateway, tentativaId: String(tentativa._id), tentativa }) : null;
    const financeiro = pedido ? estadosPedido(pedido) : tentativa?.statusFinanceiro
      ? { statusFinanceiro: tentativa.statusFinanceiro, valorReembolsado: tentativa.valorReembolsado || 0 }
      : dados ? financeiroDoProvedor(tentativa.respostaGateway, tentativa.total)
        : { statusFinanceiro: 'desconhecido', valorReembolsado: 0 };
    const estado = tentativa?.estado || 'legada';
    const contato = tentativa?.clienteContato;
    return { estado, ...financeiro,
      situacao: !dados && !pedido ? estado === 'nao_cobrada' ? 'nao_cobrada' : 'conciliacao_pendente' : 'localizada',
      metodo: tentativa?.metodo || pedido?.pagamento,
      resumo: dados?.resumo || (tentativa ? { subtotal: tentativa.subtotal, frete: tentativa.frete,
        desconto: tentativa.desconto, total: tentativa.total } : pedido ? {
        subtotal: pedido.subtotal, frete: pedido.frete, desconto: pedido.desconto, total: pedido.total } : null),
      pedido: pedido ? respostaPedido(pedido) : null,
      dados: dados ? { ...dados, ...financeiro } : null,
      podeRegistrarPedido: Boolean(!pedido && tentativa?.pagamentoId && dados && tentativa.estoqueEstado === 'reservado' &&
        ['aprovado', 'aguardando_pagamento'].includes(financeiro.statusFinanceiro) &&
        contato?.nome && contato?.email && tentativa.enderecoConfirmado && tentativa.cep),
    };
  }
  return { localizar, publicar };
}

function registrarRotasRecuperacao({ app, autenticar, recuperacao, registrarPedido }) {
  async function consultar(req, res) {
    res.set('Cache-Control', 'private, no-store');
    try {
      const encontrada = await recuperacao.localizar(req.session.usuarioId, req.params.chave, req.params.numero);
      if (!encontrada) return res.status(404).json({ erro: 'Pagamento não encontrado na sua conta.' });
      return res.json({ tentativa: recuperacao.publicar(encontrada) });
    } catch { return res.status(503).json({ erro: 'Não foi possível recuperar o pagamento. Tente novamente.' }); }
  }
  app.get('/api/pagamentos/tentativas/:chave', autenticar, consultar);
  app.get('/api/pedidos/:numero/pagamento', autenticar, consultar);
  app.post('/api/pagamentos/tentativas/:chave/pedido', autenticar, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      validarCorpoSeguro(req.body || {});
      const encontrada = await recuperacao.localizar(req.session.usuarioId, req.params.chave);
      if (!encontrada) return res.status(404).json({ erro: 'Pagamento não encontrado na sua conta.' });
      if (encontrada.pedido) return res.json({ pedido: respostaPedido(encontrada.pedido) });
      if (!recuperacao.publicar(encontrada).podeRegistrarPedido) {
        return res.status(409).json({ erro: 'Pagamento em conciliação ou dados de entrega indisponíveis. Nenhuma nova cobrança foi solicitada.' });
      }
      const tentativa = encontrada.tentativa;
      req.body = { pagamentoId: tentativa.pagamentoId, freteCentavos: tentativa.frete,
        ...(tentativa.pedidoOrigemNumero && { pedidoNumero: tentativa.pedidoOrigemNumero }),
        cliente: { nome: tentativa.clienteContato.nome, email: tentativa.clienteContato.email },
        entrega: { cep: tentativa.cep, endereco: tentativa.enderecoConfirmado } };
      return registrarPedido(req, res);
    } catch (erro) {
      if (erro instanceof ErroSegurancaPagamento) return res.status(400).json({ erro: erro.message });
      return res.status(503).json({ erro: 'Não foi possível concluir o pedido. O pagamento continua disponível para consulta.' });
    }
  });
}

module.exports = { criarRecuperacaoPagamento, registrarRotasRecuperacao };
