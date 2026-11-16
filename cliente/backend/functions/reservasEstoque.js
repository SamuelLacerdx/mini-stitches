class ErroReservaEstoque extends Error {
  constructor(message) {
    super(message);
    this.name = "ErroReservaEstoque";
  }
}

function criarReservasEstoque({ Produto, TentativaPagamento, Pedido, executarTransacao }) {
  async function reservar(tentativaId) {
    await executarTransacao(async (session) => {
      const tentativa = await TentativaPagamento.findOneAndUpdate(
        { _id: tentativaId, estoqueEstado: "nao_reservado" },
        { $set: { estoqueEstado: "reservado" } }, { session, new: true },
      );
      if (!tentativa) throw new ErroReservaEstoque("A tentativa não está disponível para reserva.");
      for (const item of tentativa.itens) {
        const produto = await Produto.findOneAndUpdate({
          _id: item.produtoId,
          ativo: true,
          $expr: { $gte: [
            { $subtract: ["$estoque", { $ifNull: ["$estoqueSeguranca", 0] }] },
            item.quantidade,
          ] },
        }, { $inc: { estoque: -item.quantidade } }, { session, new: true });
        if (!produto) throw new ErroReservaEstoque(`Estoque insuficiente para "${item.nome}".`);
      }
    });
  }

  async function repor(itens, session) {
    for (const item of itens) {
      const resultado = await Produto.updateOne(
        { _id: item.produtoId }, { $inc: { estoque: item.quantidade } }, { session },
      );
      if (resultado.matchedCount !== 1) throw new Error("Produto da reserva não localizado.");
    }
  }

  async function liberar(tentativaId) {
    await executarTransacao(async (session) => {
      const tentativa = await TentativaPagamento.findOneAndUpdate(
        { _id: tentativaId, estoqueEstado: "reservado" },
        { $set: { estoqueEstado: "liberado" } }, { session, new: true },
      );
      if (tentativa) await repor(tentativa.itens, session);
    });
  }

  async function liberarPedido(pedido) {
    if (pedido.tentativaId) return liberar(pedido.tentativaId);
    // Pedidos anteriores à PAG-06 também precisam de proteção contra reposição dupla.
    await executarTransacao(async (session) => {
      const anterior = await Pedido.findOneAndUpdate(
        { _id: pedido._id, estoqueRestituicaoPendente: true, estoqueRestituido: { $ne: true } },
        { $set: { estoqueRestituido: true, estoqueRestituicaoPendente: false } }, { session, new: true },
      );
      if (anterior) await repor(anterior.itens, session);
    });
  }

  return { reservar, liberar, liberarPedido };
}

module.exports = { criarReservasEstoque, ErroReservaEstoque };
