const PLANO_CLUBE = Object.freeze({ codigo: "SUB-02", nome: "Pequenos Criadores", tipo: "mensal",
  valor: 9490, frete: 0, criancas: 1, moeda: "BRL" });
const { validarCorpoSeguro, validarTokenCartao } = require('./segurancaPagamento');
const { loggerOperacional } = require('./logOperacional');

class ErroAssinatura extends Error {
  constructor(message, status = 400, assinaturaId) {
    super(message); this.status = status; this.assinaturaId = assinaturaId;
  }
}

function assinaturaPublica(assinatura) {
  return { id: String(assinatura._id), plano: assinatura.plano,
    frete: assinatura.frete ?? 0, statusAdesao: assinatura.statusAdesao || "legada_a_conferir",
    solicitadoEm: assinatura.solicitadoEm, assinadoEm: assinatura.assinadoEm,
    primeiraCompetencia: assinatura.primeiraCompetencia, diaCobrancaOriginal: assinatura.diaCobrancaOriginal,
    canceladoEm: assinatura.canceladoEm, cancelamentoEstado: assinatura.cancelamentoEstado,
    cancelamentoConfirmadoEm: assinatura.cancelamentoConfirmadoEm };
}

function urlRetorno(env) {
  const base = env.APP_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "");
  let url;
  try { url = new URL(base); } catch { throw new ErroAssinatura("Configure APP_URL para contratar o Clube.", 503); }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new ErroAssinatura("A URL pública do Clube precisa usar HTTPS.", 503);
  }
  return new URL("/clube?retorno=assinatura", url.origin).href;
}

function criarContratacaoClube({ Assinatura, Usuario, preApprovalModule, env, logger = loggerOperacional, aposAutorizacao }) {
  return async function contratar(clienteId, body) {
    if (!clienteId) throw new ErroAssinatura("Entre na sua conta para contratar o Clube.", 401);
    validarCorpoSeguro(body);
    if (!preApprovalModule) throw new ErroAssinatura("Contratação do Clube indisponível.", 503);
    if (body.plano !== PLANO_CLUBE.codigo || (body.metodo !== undefined && body.metodo !== "cartao")) {
      throw new ErroAssinatura("O Clube oferece somente o plano mensal SUB-02 no cartão.");
    }
    if (typeof body.chaveTentativa !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.chaveTentativa)) {
      throw new ErroAssinatura("Informe uma chave válida para a contratação.");
    }
    if (body.aceiteRecorrencia !== true) throw new ErroAssinatura("Confirme a cobrança mensal recorrente.");
    const backUrl = urlRetorno(env);
    await Assinatura.init();
    const filtro = { clienteId, chaveTentativa: body.chaveTentativa };
    async function recuperar(assinatura) {
      if (!assinatura) throw new ErroAssinatura("Contratação em conciliação. Consulte o atendimento.", 503);
      if (String(assinatura.enderecoOrigemId) !== String(body.enderecoId)) {
        throw new ErroAssinatura("A chave já identifica uma contratação com outro endereço.", 409);
      }
      if (["iniciando", "resultado_desconhecido"].includes(assinatura.statusAdesao)) {
        throw new ErroAssinatura("A contratação aguarda conciliação. Não solicite outra assinatura.", 409, String(assinatura._id));
      }
      return assinaturaPublica(assinatura);
    }
    const existente = await Assinatura.findOne(filtro);
    if (existente) return recuperar(existente);
    validarTokenCartao(body.tokenCartao);
    const usuario = await Usuario.findById(clienteId).select("email status enderecos");
    if (!usuario || !usuario.status) throw new ErroAssinatura("Conta indisponível para contratar.", 403);
    if (typeof usuario.email !== "string" || !usuario.email.includes("@")) throw new ErroAssinatura("Confira o e-mail da sua conta.");
    const endereco = usuario.enderecos.find((item) => String(item._id) === body.enderecoId);
    const estados = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
    if (!endereco || !estados.includes(endereco.estado) || !/^\d{8}$/.test(String(endereco.cep || "").replace(/\D/g, "")) ||
      ![endereco.rua, endereco.numero, endereco.bairro, endereco.cidade, endereco.estado].every((valor) => typeof valor === "string" && valor.trim())) {
      throw new ErroAssinatura("Selecione um endereço completo da sua conta.");
    }
    const entrega = { cep: endereco.cep.replace(/\D/g, ""), rua: endereco.rua, numero: endereco.numero,
      complemento: endereco.complemento || "", bairro: endereco.bairro, cidade: endereco.cidade, estado: endereco.estado };
    let assinatura;
    try {
      assinatura = await Assinatura.create({ ...filtro,
        plano: { codigo: PLANO_CLUBE.codigo, nome: "mensal", titulo: PLANO_CLUBE.nome, valor: PLANO_CLUBE.valor },
        frete: 0, entrega, enderecoOrigemId: body.enderecoId,
        statusAdesao: "iniciando", statusCaixa: "aguardando_pagamento", aceiteEm: new Date(),
      });
    } catch (erro) {
      if (erro.code === 11000) return recuperar(await Assinatura.findOne(filtro));
      throw new ErroAssinatura("Não foi possível registrar a contratação. Nenhuma assinatura foi solicitada.", 503);
    }
    const id = String(assinatura._id);
    let resposta;
    try {
      resposta = await preApprovalModule.create({
        body: { reason: `${PLANO_CLUBE.codigo} - ${PLANO_CLUBE.nome}`,
          auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: PLANO_CLUBE.valor / 100, currency_id: "BRL" },
          payer_email: usuario.email, card_token_id: body.tokenCartao, status: "authorized",
          back_url: backUrl, external_reference: id,
        }, requestOptions: { idempotencyKey: id },
      });
      if (!resposta?.id) throw new Error("Resposta inconclusiva");
    } catch {
      try { await Assinatura.updateOne({ _id: assinatura._id,
        statusAdesao: { $in: ['iniciando', 'resultado_desconhecido'] } }, { $set: { statusAdesao: "resultado_desconhecido" } }); }
      catch { logger.error('clube.contratacao_pendente', { assinaturaId: id }); }
      throw new ErroAssinatura("Não foi possível confirmar a contratação. Consulte o atendimento antes de repetir.", 503, id);
    }
    // Autorizar a recorrência não comprova aprovação da primeira mensalidade.
    const dados = { preapprovalId: String(resposta.id), statusProvedor: resposta.status,
      statusAdesao: resposta.status === "cancelled" ? "cancelada" : "aguardando_pagamento" };
    try {
      // Se o cliente cancelar durante a autorização, ainda precisamos guardar
      // o ID remoto para interrompê-la, sem reabrir a assinatura cancelada.
      await Assinatura.updateOne({ _id: assinatura._id }, { $set: {
        preapprovalId: dados.preapprovalId, statusProvedor: dados.statusProvedor,
      } }, { runValidators: true });
      await Assinatura.updateOne({ _id: assinatura._id,
        statusAdesao: { $in: ['iniciando', 'resultado_desconhecido', 'aguardando_pagamento'] } }, { $set: dados }, { runValidators: true });
      const atual = await Assinatura.findOne({ _id: assinatura._id });
      if (atual?.canceladoEm) {
        if (aposAutorizacao) await aposAutorizacao(id);
        return assinaturaPublica(atual);
      }
    }
    catch { logger.error('clube.autorizacao_pendente', { assinaturaId: id }); }
    return assinaturaPublica({ ...assinatura.toObject(), ...dados });
  };
}

module.exports = { PLANO_CLUBE, ErroAssinatura, assinaturaPublica, criarContratacaoClube };
