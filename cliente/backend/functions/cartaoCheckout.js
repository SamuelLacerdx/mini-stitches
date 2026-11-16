const { validarTokenCartao, ErroSegurancaPagamento } = require('./segurancaPagamento');

function criarCartaoCheckout({ Usuario, customerModule, cardTokenModule, agora = () => Date.now() }) {
  return async function resolver(clienteId, cartaoSalvoId, token) {
    if (typeof cartaoSalvoId !== 'string' || !/^[a-f\d]{24}$/i.test(cartaoSalvoId)) throw new ErroSegurancaPagamento('Selecione um cartão válido.');
    validarTokenCartao(token);
    const usuario = await Usuario.findById(clienteId);
    const cartao = usuario?.cartoes?.find((item) => String(item._id) === cartaoSalvoId);
    if (!usuario?.status || !usuario.provedorCustomerId || !cartao?.status || !cartao.provedorCardId || !customerModule || !cardTokenModule) {
      throw new ErroSegurancaPagamento('Cartão indisponível. Selecione outro ou cadastre-o novamente no perfil.');
    }
    let remoto, dadosToken;
    try {
      remoto = await customerModule.getCard({ customerId: usuario.provedorCustomerId, cardId: cartao.provedorCardId });
      dadosToken = await cardTokenModule.get({ id: token });
    } catch {
      // Estas consultas não criam cobrança: não iniciar recuperação de uma tentativa inexistente.
      throw new ErroSegurancaPagamento('Não foi possível consultar o cartão salvo. Tente novamente.');
    }
    if (!remoto || !dadosToken) throw new ErroSegurancaPagamento('Não foi possível consultar o cartão salvo. Tente novamente.');
    const validade = Date.UTC(remoto.expiration_year, remoto.expiration_month, 1);
    if (String(remoto.id) !== cartao.provedorCardId || String(remoto.customer_id) !== usuario.provedorCustomerId ||
      remoto.payment_method?.payment_type_id !== 'credit_card' || remoto.payment_method.id !== cartao.paymentMethodId ||
      remoto.last_four_digits !== cartao.finalCartao || !Number.isInteger(remoto.expiration_month) || remoto.expiration_month < 1 || remoto.expiration_month > 12 ||
      !Number.isInteger(remoto.expiration_year) || !Number.isFinite(validade) || validade <= agora() ||
      dadosToken.id !== token || String(dadosToken.card_id) !== cartao.provedorCardId || dadosToken.status !== 'active' ||
      ![3, 4].includes(dadosToken.security_code_length) || !Number.isFinite(Date.parse(dadosToken.date_due)) || Date.parse(dadosToken.date_due) <= agora()) {
      throw new ErroSegurancaPagamento('Não foi possível validar o cartão selecionado. Confira o CVV ou escolha outro cartão.');
    }
    return { payment_method_id: cartao.paymentMethodId, payer: { type: 'customer', id: usuario.provedorCustomerId },
      ...(remoto.issuer?.id != null && { issuer_id: String(remoto.issuer.id) }) };
  };
}
module.exports = { criarCartaoCheckout };
