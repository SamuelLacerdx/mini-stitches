const { createHmac, timingSafeEqual } = require("crypto");
const { resumirResposta } = require("./tentativasPagamento");

function validarWebhook(req, secret) {
  const id = req.query?.["data.id"];
  const requestId = req.headers?.["x-request-id"];
  const assinatura = req.headers?.["x-signature"];
  if (typeof secret !== "string" || !secret.trim() || typeof id !== "string" ||
    !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || typeof requestId !== "string" ||
    !/^[a-zA-Z0-9_-]{1,200}$/.test(requestId) || typeof assinatura !== "string" || assinatura.length > 512) return null;

  const campos = new Map();
  for (const parte of assinatura.split(",")) {
    const [nome, valor, extra] = parte.trim().split("=");
    if (!nome || !valor || extra !== undefined || campos.has(nome)) return null;
    campos.set(nome, valor);
  }
  const ts = campos.get("ts");
  const v1 = campos.get("v1");
  if (!/^\d{1,20}$/.test(ts || "") || !/^[a-fA-F0-9]{64}$/.test(v1 || "")) return null;
  const paymentId = id.toLowerCase();
  if (req.body?.data?.id !== undefined && String(req.body.data.id).toLowerCase() !== paymentId) return null;
  const manifesto = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const esperado = createHmac("sha256", secret).update(manifesto).digest();
  if (!timingSafeEqual(esperado, Buffer.from(v1, "hex"))) return null;
  return { paymentId, requestId };
}

function dataValida(valor) {
  if (typeof valor !== "string" || !valor.trim()) return null;
  const data = new Date(valor);
  return Number.isFinite(data.getTime()) ? data : null;
}

function criarProcessadorWebhook({ TentativaPagamento, Pedido, NotificacaoPagamento,
  reservasEstoque, executarTransacao, isValidObjectId }) {
  return async function processar({ pagamento, paymentId, requestId, recebidoEm }) {
    if (String(pagamento?.id) !== paymentId) throw new Error("Pagamento consultado não corresponde à notificação.");
    const atualizadoEm = dataValida(pagamento.date_last_updated);
    const aprovadoEm = dataValida(pagamento.date_approved);
    if (!atualizadoEm || (pagamento.status === "approved" && !aprovadoEm)) {
      throw new Error("Pagamento sem datas de conciliação válidas.");
    }
    const chave = `${paymentId}:${atualizadoEm.getTime()}`;
    await NotificacaoPagamento.init();

    async function aplicar(session) {
      const processada = await NotificacaoPagamento.findById(chave, null, { session });
      if (processada) {
        if (processada.statusProvedor !== pagamento.status) throw new Error("Versão de pagamento inconsistente.");
        return "duplicada";
      }
      const referencia = String(pagamento.external_reference || "");
      const tentativa = isValidObjectId(referencia)
        ? await TentativaPagamento.findById(referencia, null, { session })
        : await TentativaPagamento.findOne({ pagamentoId: paymentId }, null, { session });
      const pedido = await Pedido.findOne({ pagamentoId: paymentId }, null, { session });
      if (!tentativa && !pedido) return "sem_vinculo";
      if (tentativa?.pagamentoId && tentativa.pagamentoId !== paymentId) throw new Error("Vínculo de pagamento inconsistente.");
      const valorEsperado = tentativa?.total ?? pedido.total;
      if (pagamento.currency_id !== "BRL" || Math.round(Number(pagamento.transaction_amount) * 100) !== valorEsperado) {
        throw new Error("Valor do pagamento não confere.");
      }
      const bases = [tentativa?.provedorAtualizadoEm, pedido?.pagamentoAtualizadoEm].filter(Boolean);
      const ultimaVersao = Math.max(0, ...bases.map((data) => new Date(data).getTime()));
      if (atualizadoEm.getTime() < ultimaVersao) return "antiga";
      if (atualizadoEm.getTime() === ultimaVersao && tentativa?.statusProvedor && tentativa.statusProvedor !== pagamento.status) {
        throw new Error("Versão de pagamento inconsistente.");
      }

      if (tentativa) {
        await TentativaPagamento.updateOne({ _id: tentativa._id }, { $set: {
          pagamentoId: paymentId, estado: "resposta_recebida", statusProvedor: pagamento.status,
          respostaGateway: resumirResposta(pagamento), provedorAtualizadoEm: atualizadoEm,
          ...(aprovadoEm && { aprovadoEm }), ultimaNotificacaoEm: recebidoEm,
        } }, { session, runValidators: true });
      }
      const cancelamento = ["cancelled", "rejected", "refunded", "charged_back"].includes(pagamento.status);
      const novoStatus = pagamento.status === "approved" ? "pago" : cancelamento ? "cancelado" : null;
      if (pedido) {
        const alteracao = { pagamentoAtualizadoEm: atualizadoEm,
          ...(aprovadoEm && { pagamentoAprovadoEm: aprovadoEm }) };
        const mudanca = pedido.status === "aguardando_pagamento" && novoStatus;
        if (mudanca) {
          alteracao.status = novoStatus;
          if (novoStatus === "cancelado" && !pedido.tentativaId) alteracao.estoqueRestituicaoPendente = true;
        }
        await Pedido.updateOne({ _id: pedido._id }, {
          $set: alteracao,
          ...(mudanca && { $push: { historicoStatus: {
            status: novoStatus, em: novoStatus === "pago" ? aprovadoEm : atualizadoEm,
          } } }),
        }, { session, runValidators: true });
        if (mudanca && novoStatus === "cancelado") {
          await reservasEstoque.liberarPedido({ _id: pedido._id, tentativaId: pedido.tentativaId }, session);
        }
      }
      if (tentativa && !pedido && ["cancelled", "rejected"].includes(pagamento.status)) {
        await reservasEstoque.liberar(tentativa._id, session);
      }
      await NotificacaoPagamento.create([{
        _id: chave, pagamentoId: paymentId, statusProvedor: pagamento.status,
        provedorAtualizadoEm: atualizadoEm, aprovadoEm, recebidoEm, requestId,
      }], { session });
      return "processada";
    }

    try { return await executarTransacao(aplicar); }
    catch (erro) {
      if (erro.code === 11000) {
        const gravada = await NotificacaoPagamento.findById(chave);
        if (gravada?.statusProvedor === pagamento.status) return "duplicada";
      }
      throw erro;
    }
  };
}

module.exports = { validarWebhook, criarProcessadorWebhook };
