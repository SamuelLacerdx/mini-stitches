const { validarCorpoSeguro, validarTokenCartao, ErroSegurancaPagamento } = require('./segurancaPagamento');

function cartoesPublicos(cartoes = []) {
  return cartoes.map(({ _id, titular, finalCartao, validade, bandeira, status, provedorCardId, paymentMethodId }) => ({
    _id, titular, finalCartao, validade, bandeira, status,
    reutilizavel: Boolean(status && provedorCardId && paymentMethodId),
    ...(status && provedorCardId && paymentMethodId && { provedorCardId, paymentMethodId }),
  }));
}

function criarReferenciaCartao({ Usuario, cardTokenModule, customerModule }) {
  return async function salvar(clienteId, body) {
    validarCorpoSeguro(body);
    // O antigo contrato enviava o número completo como "numero".
    if (Object.hasOwn(body, 'numero')) throw new ErroSegurancaPagamento();
    const token = validarTokenCartao(body.tokenCartao);
    if (!cardTokenModule || !customerModule) throw new Error('Serviço indisponível');
    const dados = await cardTokenModule.get({ id: token });
    if (dados.id !== token || dados.status !== 'active' || dados.luhn_validation !== true ||
      ![3, 4].includes(dados.security_code_length) || !/^\d{4}$/.test(dados.last_four_digits || '') ||
      !Number.isInteger(dados.expiration_month) || dados.expiration_month < 1 || dados.expiration_month > 12 ||
      !Number.isInteger(dados.expiration_year) || dados.expiration_year < new Date().getUTCFullYear() ||
      Date.UTC(dados.expiration_year, dados.expiration_month, 1) <= Date.now() ||
      !Number.isFinite(Date.parse(dados.date_due)) || Date.parse(dados.date_due) <= Date.now()) {
      throw new ErroSegurancaPagamento('Não foi possível validar a referência do cartão.');
    }
    let usuario = await Usuario.findById(clienteId);
    if (!usuario || usuario.status !== true) throw new ErroSegurancaPagamento('Conta indisponível.');
    const bin = String(dados.first_six_digits || '');
    const bandeira = /^4/.test(bin) ? 'visa' : /^(5[1-5]|2[2-7])/.test(bin) ? 'master'
      : /^3[47]/.test(bin) ? 'amex' : /^606282|^3841/.test(bin) ? 'hipercard'
        : /^36|^38|^30[0-5]/.test(bin) ? 'diners' : 'elo';
    const referencia = { titular: 'Cartão tokenizado', finalCartao: dados.last_four_digits,
      validade: `${String(dados.expiration_month).padStart(2, '0')}/${String(dados.expiration_year).slice(-2)}`,
      bandeira, status: true, criadoEm: new Date() };
    if (!usuario.provedorCustomerId) {
      const cliente = await customerModule.create({ body: { email: usuario.email },
        requestOptions: { idempotencyKey: `perfil-${clienteId}` } });
      if (!cliente?.id) throw new Error('Não foi possível vincular o cliente.');
      usuario = await Usuario.findOneAndUpdate({ _id: clienteId, $or: [
        { provedorCustomerId: { $exists: false } }, { provedorCustomerId: null },
      ] }, { $set: { provedorCustomerId: String(cliente.id) } }, { new: true }) || await Usuario.findById(clienteId);
      if (!usuario?.status || !usuario.provedorCustomerId) throw new Error('Não foi possível confirmar o vínculo do cliente.');
    }
    const cartao = await customerModule.createCard({ customerId: usuario.provedorCustomerId, body: { token } });
    if (!cartao?.id || String(cartao.customer_id) !== usuario.provedorCustomerId ||
      cartao.last_four_digits !== referencia.finalCartao || cartao.expiration_month !== dados.expiration_month ||
      cartao.expiration_year !== dados.expiration_year || cartao.payment_method?.payment_type_id !== 'credit_card' ||
      !['visa', 'master', 'elo', 'amex', 'hipercard', 'diners'].includes(cartao.payment_method.id)) {
      throw new ErroSegurancaPagamento('Não foi possível validar o cartão salvo.');
    }
    Object.assign(referencia, { provedorCardId: String(cartao.id), paymentMethodId: cartao.payment_method.id,
      bandeira: cartao.payment_method.id });
    const existente = usuario.cartoes.find((item) => item.provedorCardId === referencia.provedorCardId ||
      (!item.provedorCardId && item.finalCartao === referencia.finalCartao && item.bandeira === referencia.bandeira && item.validade === referencia.validade));
    if (existente) {
      Object.assign(existente, referencia);
      await usuario.save();
    } else {
      usuario.cartoes.push(referencia);
      await usuario.save();
    }
    // Nenhum token, BIN, documento do titular, PAN ou CVV é salvo.
    return cartoesPublicos(usuario.cartoes);
  };
}

module.exports = { criarReferenciaCartao, cartoesPublicos };
