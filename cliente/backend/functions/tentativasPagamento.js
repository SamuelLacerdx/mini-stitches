function criarCobrancaComTentativa({ TentativaPagamento, paymentModule, reservasEstoque, logger = console }) {
  return async function cobrar({ clienteId, metodo, itens, subtotal, frete, desconto, total,
    parcelas = 1, cep, servicoId, body }) {
    let tentativa;
    try {
      tentativa = await TentativaPagamento.create({
        clienteId, metodo, itens, subtotal, frete, desconto, total, parcelas, cep, servicoId,
        estado: "registrada",
      });
    } catch {
      throw new Error("Não foi possível registrar a tentativa. Nenhuma cobrança foi solicitada.");
    }
    const tentativaId = String(tentativa._id);
    // A transação deve terminar antes de qualquer comunicação com o gateway.
    await reservasEstoque.reservar(tentativa._id);

    async function atualizar(dados) {
      try {
        const resultado = await TentativaPagamento.updateOne(
          { _id: tentativa._id }, { $set: dados }, { runValidators: true },
        );
        if (resultado.matchedCount !== 1) throw new Error("Tentativa não localizada.");
      } catch {
        // A tentativa inicial e external_reference permitem conciliação posterior.
        // Não transforma uma cobrança já criada em erro que induza nova cobrança.
        logger.error("[pagamento] tentativa requer conciliacao", { tentativaId });
      }
    }

    let resposta;
    try {
      resposta = await paymentModule.create({
        body: { ...body, external_reference: tentativaId },
      });
      if (!resposta?.id) throw new Error("Resposta sem identificador.");
    } catch {
      // Timeout não comprova que a cobrança deixou de ser criada no provedor.
      await atualizar({ estado: "resultado_desconhecido" });
      const erro = new Error("Não foi possível confirmar a cobrança. Consulte o pagamento antes de tentar novamente.");
      erro.tentativaId = tentativaId;
      throw erro;
    }

    await atualizar({
      estado: "resposta_recebida",
      pagamentoId: String(resposta.id),
      statusProvedor: String(resposta.status || "desconhecido").slice(0, 80),
    });
    if (["rejected", "cancelled"].includes(resposta.status)) {
      try {
        await reservasEstoque.liberar(tentativa._id);
      } catch {
        logger.error("[pagamento] reserva requer conciliacao", { tentativaId });
      }
    }
    return { resposta, tentativaId };
  };
}

module.exports = { criarCobrancaComTentativa };
