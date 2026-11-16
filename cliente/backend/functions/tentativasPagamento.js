const { createHash } = require("crypto");
const { loggerOperacional } = require('./logOperacional');
const { financeiroDoProvedor } = require("./estadosPedido");
const { validarCorpoSeguro, validarTokenCartao } = require('./segurancaPagamento');

class ErroIdempotencia extends Error {
  constructor(message, status = 409, tentativaId) {
    super(message);
    this.status = status;
    this.tentativaId = tentativaId;
  }
}

function identificarRequisicao(req, metodo) {
  const body = req.body || {};
  validarCorpoSeguro(body);
  if (metodo === 'cartao' && body.token !== undefined) validarTokenCartao(body.token);
  if (typeof body.chaveTentativa !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.chaveTentativa)) {
    throw new ErroIdempotencia("Informe uma chave válida para a tentativa de pagamento.", 400);
  }
  // Token de cartão pode mudar na retokenização. Nunca guardamos token ou CVV.
  const dados = [metodo, body.email, body.cpf, body.nomeCompleto ?? `${body.nome || ""} ${body.sobrenome || ""}`.trim(),
    body.cep, body.freteCentavos, body.servicoId, String(body.parcelas ?? 1),
    metodo === "cartao" ? body.payment_method_id : null,
    body.endereco?.rua, body.endereco?.numero, body.endereco?.bairro, body.endereco?.cidade, body.endereco?.estado];
  if (body.pedidoNumero) dados.push(body.pedidoNumero);
  if (body.entrega?.endereco) dados.push(body.entrega.endereco);
  if (body.cliente) dados.push([body.cliente.nome, body.cliente.email]);
  if (body.cartaoSalvoId) dados.push(['cartaoSalvoId', body.cartaoSalvoId]);
  return { chaveTentativa: body.chaveTentativa,
    hashRequisicao: createHash("sha256").update(JSON.stringify(dados)).digest("hex") };
}

function resumirResposta(resposta) {
  return {
    id: resposta.id, status: resposta.status, status_detail: resposta.status_detail,
    installments: resposta.installments,
    transaction_amount_refunded: resposta.transaction_amount_refunded,
    barcode: { content: resposta.barcode?.content || "" },
    transaction_details: { external_resource_url: resposta.transaction_details?.external_resource_url || "" },
    point_of_interaction: { transaction_data: {
      qr_code: resposta.point_of_interaction?.transaction_data?.qr_code || "",
      qr_code_base64: resposta.point_of_interaction?.transaction_data?.qr_code_base64 || "",
    } },
  };
}

function criarCobrancaComTentativa({ TentativaPagamento, paymentModule, reservasEstoque, logger = loggerOperacional }) {
  async function reutilizar(tentativa, hashRequisicao) {
    const tentativaId = String(tentativa._id);
    if (tentativa.hashRequisicao !== hashRequisicao) {
      throw new ErroIdempotencia("Esta chave já identifica uma tentativa com outros dados.", 409, tentativaId);
    }
    if (tentativa.respostaGateway) {
      return { resposta: tentativa.respostaGateway, tentativaId, tentativa };
    }
    throw new ErroIdempotencia("Tentativa em processamento ou aguardando conciliação. Nenhuma nova cobrança foi solicitada.", 409, tentativaId);
  }

  async function buscar({ clienteId, chaveTentativa, hashRequisicao }) {
    await TentativaPagamento.init();
    const tentativa = await TentativaPagamento.findOne({ clienteId, chaveTentativa }).select("+respostaGateway");
    return tentativa ? reutilizar(tentativa, hashRequisicao) : null;
  }

  async function cobrar({ clienteId, metodo, itens, subtotal, frete, desconto, total,
    parcelas = 1, cep, servicoId, body, chaveTentativa, hashRequisicao, cotacaoId, enderecoConfirmado, clienteContato, pedidoOrigemNumero }) {
    const existente = await buscar({ clienteId, chaveTentativa, hashRequisicao });
    if (existente) return existente;
    let tentativa;
    try {
      tentativa = await TentativaPagamento.create({
        clienteId, metodo, itens, subtotal, frete, desconto, total, parcelas, cep, servicoId,
        estado: "registrada",
        chaveTentativa, hashRequisicao, ...(cotacaoId && { cotacaoId }), enderecoConfirmado, clienteContato, pedidoOrigemNumero,
      });
    } catch (erro) {
      if (erro.code === 11000) {
        const repetida = await buscar({ clienteId, chaveTentativa, hashRequisicao });
        if (repetida) return repetida;
        if (cotacaoId) {
          const vinculada = await TentativaPagamento.findOne({ clienteId, cotacaoId });
          if (vinculada) throw new ErroIdempotencia('Este resumo já foi utilizado. Consulte a tentativa original antes de pagar novamente.', 409, String(vinculada._id));
        }
      }
      throw new Error("Não foi possível registrar a tentativa. Nenhuma cobrança foi solicitada.");
    }
    const tentativaId = String(tentativa._id);
    // A transação deve terminar antes de qualquer comunicação com o gateway.
    try {
      await reservasEstoque.reservar(tentativa._id);
    } catch (erro) {
      await TentativaPagamento.updateOne({ _id: tentativa._id }, { $set: { estado: "nao_cobrada" } });
      throw erro;
    }

    async function atualizar(dados) {
      try {
        const filtro = { _id: tentativa._id };
        if (dados.estado === "resultado_desconhecido") filtro.estado = "registrada";
        if (dados.provedorAtualizadoEm) {
          filtro.$or = [
            { provedorAtualizadoEm: { $exists: false } },
            { provedorAtualizadoEm: { $lt: dados.provedorAtualizadoEm } },
          ];
        } else if (dados.estado === "resposta_recebida") {
          filtro.provedorAtualizadoEm = { $exists: false };
        }
        const resultado = await TentativaPagamento.updateOne(
          filtro, { $set: dados }, { runValidators: true },
        );
        return resultado.matchedCount === 1; // Um webhook já pode ter gravado uma versão mais recente.
      } catch {
        // A tentativa inicial e external_reference permitem conciliação posterior.
        // Não transforma uma cobrança já criada em erro que induza nova cobrança.
        logger.error('pagamento.persistencia_pendente', { tentativaId });
        return false;
      }
    }

    let resposta;
    try {
      resposta = await paymentModule.create({
        body: { ...body, external_reference: tentativaId },
        requestOptions: { idempotencyKey: tentativaId },
      });
      if (!resposta?.id) throw new Error("Resposta sem identificador.");
    } catch {
      // Timeout não comprova que a cobrança deixou de ser criada no provedor.
      await atualizar({ estado: "resultado_desconhecido" });
      logger.error('pagamento.resultado_desconhecido', { tentativaId });
      const erro = new Error("Não foi possível confirmar a cobrança. Consulte o pagamento antes de tentar novamente.");
      erro.tentativaId = tentativaId;
      throw erro;
    }

    const respostaGravada = await atualizar({
      ...financeiroDoProvedor(resposta, total),
      estado: "resposta_recebida",
      pagamentoId: String(resposta.id),
      statusProvedor: String(resposta.status || "desconhecido").slice(0, 80),
      respostaGateway: resumirResposta(resposta),
      ...(Number.isFinite(Date.parse(resposta.date_last_updated)) && {
        provedorAtualizadoEm: new Date(resposta.date_last_updated),
      }),
      ...(Number.isFinite(Date.parse(resposta.date_approved)) && { aprovadoEm: new Date(resposta.date_approved) }),
    });
    if (respostaGravada && ["rejected", "cancelled"].includes(resposta.status)) {
      try {
        await reservasEstoque.liberar(tentativa._id, undefined, { statusProvedor: resposta.status });
      } catch {
        logger.error('pagamento.reserva_pendente', { tentativaId });
      }
    }
    return { resposta, tentativaId, tentativa };
  }
  cobrar.buscar = buscar;
  return cobrar;
}

module.exports = { criarCobrancaComTentativa, identificarRequisicao, ErroIdempotencia, resumirResposta };
