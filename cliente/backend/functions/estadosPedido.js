const FINANCEIROS = ["aguardando_pagamento", "aprovado", "recusado", "cancelado", "reembolsado", "parcialmente_reembolsado", "em_contestacao", "contestado", "desconhecido"];
const LOGISTICOS = ["aguardando_liberacao", "pronto_para_preparo", "em_separacao", "enviado", "entregue", "cancelado"];

function estadosPedido(pedido) {
  const statusFinanceiro = pedido.statusFinanceiro
    ? FINANCEIROS.includes(pedido.statusFinanceiro) ? pedido.statusFinanceiro : "desconhecido"
    : ["pago", "em_separacao", "enviado", "entregue"].includes(pedido.status) ? "aprovado"
      : pedido.status === "aguardando_pagamento" ? "aguardando_pagamento" : "desconhecido";
  const statusLogistico = LOGISTICOS.includes(pedido.statusLogistico) ? pedido.statusLogistico
    : pedido.status === "pago" ? "pronto_para_preparo" : LOGISTICOS.includes(pedido.status) ? pedido.status : "aguardando_liberacao";
  return { statusFinanceiro, statusLogistico, valorReembolsado: pedido.valorReembolsado || 0,
    bloqueadoParaExpedicao: statusFinanceiro !== "aprovado" || statusLogistico === "cancelado" };
}

function financeiroDoProvedor(pagamento, total) {
  let valorReembolsado = Math.round(Number(pagamento.transaction_amount_refunded ?? 0) * 100);
  if (!Number.isSafeInteger(valorReembolsado) || valorReembolsado < 0 || valorReembolsado > total) {
    throw new Error("Valor de reembolso inválido.");
  }
  const mapa = { pending: "aguardando_pagamento", in_process: "aguardando_pagamento", authorized: "aguardando_pagamento",
    approved: "aprovado", rejected: "recusado", cancelled: "cancelado", refunded: "reembolsado",
    in_mediation: "em_contestacao", charged_back: "contestado" };
  let statusFinanceiro = Object.hasOwn(mapa, pagamento.status) ? mapa[pagamento.status] : null;
  if (!statusFinanceiro) throw new Error("Status financeiro desconhecido no provedor.");
  if (statusFinanceiro === "reembolsado") valorReembolsado = total;
  if (pagamento.status_detail === "partially_refunded" && valorReembolsado === 0) {
    throw new Error("Reembolso parcial sem valor confirmado.");
  }
  if (statusFinanceiro === "aprovado" && valorReembolsado > 0) {
    statusFinanceiro = valorReembolsado === total ? "reembolsado" : "parcialmente_reembolsado";
  }
  return { statusFinanceiro, valorReembolsado };
}

function projetarStatus(statusFinanceiro, statusLogistico) {
  if (statusLogistico === "pronto_para_preparo") return "pago";
  if (statusLogistico !== "aguardando_liberacao") return statusLogistico;
  return ["recusado", "cancelado", "reembolsado"].includes(statusFinanceiro) ? "cancelado" : "aguardando_pagamento";
}

class ErroEstadoPedido extends Error {
  constructor(message, status = 409) { super(message); this.status = status; }
}

function criarAtualizadorLogistico({ Pedido, reservasEstoque, executarTransacao }) {
  return async function atualizar({ id, status, rastreio }) {
    let atualizado;
    await executarTransacao(async (session) => {
      const pedido = await Pedido.findById(id, null, { session });
      if (!pedido) throw new ErroEstadoPedido("Pedido não encontrado.", 404);
      const estados = estadosPedido(pedido);
      const alvo = status === "pago" ? "pronto_para_preparo" : status === "aguardando_pagamento" ? "aguardando_liberacao" : status;
      const mudanca = alvo !== estados.statusLogistico;
      const permitidos = { pronto_para_preparo: ["em_separacao", "cancelado"], em_separacao: ["enviado", "cancelado"], enviado: ["entregue"] };
      if (mudanca && !permitidos[estados.statusLogistico]?.includes(alvo)) {
        throw new ErroEstadoPedido("Transição logística não permitida.");
      }
      if (mudanca && ["em_separacao", "enviado"].includes(alvo) && estados.statusFinanceiro !== "aprovado") {
        throw new ErroEstadoPedido("Pagamento com pendência financeira. A expedição está bloqueada.", 403);
      }
      const agora = new Date();
      const dados = { statusLogistico: alvo, statusFinanceiro: estados.statusFinanceiro,
        status: projetarStatus(estados.statusFinanceiro, alvo),
        ...(rastreio !== undefined && { rastreio: String(rastreio).trim() }) };
      if (mudanca && alvo === "cancelado" && !pedido.tentativaId) dados.estoqueRestituicaoPendente = true;
      atualizado = await Pedido.findOneAndUpdate({ _id: id }, {
        $set: dados,
        ...(mudanca && { $push: {
          historicoLogistico: { status: alvo, em: agora }, historicoStatus: { status: dados.status, em: agora },
        } }),
      }, { session, new: true, runValidators: true });
      if (mudanca && alvo === "cancelado") await reservasEstoque.liberarPedido(pedido, session);
    });
    return atualizado;
  };
}

module.exports = { FINANCEIROS, LOGISTICOS, estadosPedido, financeiroDoProvedor, projetarStatus, ErroEstadoPedido, criarAtualizadorLogistico };
