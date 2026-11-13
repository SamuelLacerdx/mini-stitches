/**
 * Diagnostico do fluxo de pagamento → pedido.
 *
 * Uso (dentro de ./cliente):
 *   node scripts/verificarPedido.js listar
 *   node scripts/verificarPedido.js ver <numeroDoPedido>   ex: MS-1005
 *   node scripts/verificarPedido.js sincronizar <pagamentoId>
 *
 * - "listar": imprime os ultimos 10 pedidos com status, pagamentoId e total.
 * - "ver": mostra os detalhes de um pedido e, se tiver pagamentoId,
 *   consulta o Mercado Pago para comparar o status atual.
 * - "sincronizar": consulta o Mercado Pago por um pagamentoId, aplica a
 *   mesma logica do webhook ("approved" -> "pago", cancelado/rejeitado ->
 *   "cancelado") e salva o pedido. Util quando o webhook nao chegou.
 */
require("dotenv").config();

const mongoose = require("mongoose");
const { MercadoPagoConfig, Payment } = require("mercadopago");
const { Pedido } = require("../backend/db/mongodb");

const mpAccessToken = process.env.MP_ACCESS_TOKEN || "";
const mpClient = mpAccessToken
  ? new MercadoPagoConfig({ accessToken: mpAccessToken })
  : null;
const paymentModule = mpClient ? new Payment(mpClient) : null;

async function consultarMP(pagamentoId) {
  if (!paymentModule) return null;
  try {
    return await paymentModule.get({ id: pagamentoId });
  } catch (erro) {
    return { erro: erro?.message || String(erro) };
  }
}

function formatarCentavos(valor) {
  return (Number(valor || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

async function listar() {
  const pedidos = await Pedido.find({})
    .sort({ criadoEm: -1 })
    .limit(10)
    .lean();

  if (!pedidos.length) {
    console.log("Nenhum pedido encontrado.");
    return;
  }

  for (const p of pedidos) {
    console.log(
      `${p.numero}  ${p.status.padEnd(22)}  ${p.pagamento.padEnd(7)}  ${formatarCentavos(p.total).padStart(12)}  pagamentoId=${p.pagamentoId || "(vazio)"}`,
    );
  }
}

async function ver(numero) {
  if (!numero) {
    console.error("Informe o numero do pedido, ex: MS-1005");
    process.exitCode = 1;
    return;
  }

  const pedido = await Pedido.findOne({ numero });
  if (!pedido) {
    console.error(`Pedido ${numero} nao encontrado.`);
    process.exitCode = 1;
    return;
  }

  console.log("Pedido:", pedido.numero);
  console.log("  status no banco :", pedido.status);
  console.log("  pagamento       :", pedido.pagamento);
  console.log("  pagamentoId     :", pedido.pagamentoId || "(vazio)");
  console.log("  total           :", formatarCentavos(pedido.total));
  console.log("  itens           :", pedido.itens.length);

  if (!pedido.pagamentoId) {
    console.log("\nSem pagamentoId: nao da pra consultar o Mercado Pago.");
    return;
  }

  const mp = await consultarMP(pedido.pagamentoId);
  if (!mp) {
    console.log("\nMercado Pago nao configurado (MP_ACCESS_TOKEN ausente).");
    return;
  }
  if (mp.erro) {
    console.log("\nMercado Pago respondeu com erro:", mp.erro);
    return;
  }

  console.log("\nMercado Pago:");
  console.log("  status  :", mp.status);
  console.log(
    "  valor   :",
    (Number(mp.transaction_amount) || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    }),
  );
  console.log("  metodo  :", mp.payment_method_id);

  const esperado =
    mp.status === "approved"
      ? "pago"
      : ["cancelled", "rejected", "refunded", "charged_back"].includes(mp.status)
        ? "cancelado"
        : "aguardando_pagamento";

  console.log("\nStatus esperado no banco:", esperado);
  if (esperado !== pedido.status) {
    console.log(
      "ATENCAO: divergencia. Rode `sincronizar " +
        pedido.pagamentoId +
        "` para aplicar a regra do webhook.",
    );
  } else {
    console.log("OK: status no banco bate com o Mercado Pago.");
  }
}

async function sincronizar(pagamentoId) {
  if (!pagamentoId) {
    console.error("Informe o pagamentoId do Mercado Pago.");
    process.exitCode = 1;
    return;
  }

  const pedido = await Pedido.findOne({ pagamentoId: String(pagamentoId) });
  if (!pedido) {
    console.error(`Nenhum pedido com pagamentoId=${pagamentoId}.`);
    process.exitCode = 1;
    return;
  }

  if (pedido.status !== "aguardando_pagamento") {
    console.log(
      `Pedido ${pedido.numero} ja esta "${pedido.status}". Nada a fazer.`,
    );
    return;
  }

  const mp = await consultarMP(pagamentoId);
  if (!mp || mp.erro) {
    console.error("Falha ao consultar o Mercado Pago:", mp?.erro || "sem resposta");
    process.exitCode = 1;
    return;
  }

  if (mp.status === "approved") {
    pedido.status = "pago";
    await pedido.save();
    console.log(`Pedido ${pedido.numero} marcado como "pago".`);
  } else if (
    ["cancelled", "rejected", "refunded", "charged_back"].includes(mp.status)
  ) {
    pedido.status = "cancelado";
    await pedido.save();
    console.log(`Pedido ${pedido.numero} marcado como "cancelado".`);
  } else {
    console.log(
      `Pagamento ainda esta "${mp.status}" no Mercado Pago. Nada a fazer.`,
    );
  }
}

async function main() {
  const [, , comando, arg] = process.argv;

  if (!comando) {
    console.log(
      "Uso: node scripts/verificarPedido.js <listar|ver|sincronizar> [arg]",
    );
    return;
  }

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI nao definido no .env.");
    process.exitCode = 1;
    return;
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    if (comando === "listar") await listar();
    else if (comando === "ver") await ver(arg);
    else if (comando === "sincronizar") await sincronizar(arg);
    else console.error("Comando desconhecido:", comando);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((erro) => {
  console.error("Erro:", erro?.message || erro);
  process.exitCode = 1;
});
