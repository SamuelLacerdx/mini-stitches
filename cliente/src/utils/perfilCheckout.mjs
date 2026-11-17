export function dadosEnderecoCheckout(endereco = {}) {
  const texto = (campo) => typeof endereco[campo] === 'string' ? endereco[campo] : '';
  return { endereco: texto('rua'), numero: texto('numero'), complemento: texto('complemento'),
    bairro: texto('bairro'), cidade: texto('cidade'), estado: texto('estado'), cep: texto('cep').replace(/\D/g, '') };
}

export function cartaoDisponivelCheckout(cartao, agora = Date.now()) {
  const partes = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(cartao?.validade || '');
  return Boolean(cartao?.status && cartao.reutilizavel && cartao.provedorCardId && cartao.paymentMethodId && partes &&
    Date.UTC(2000 + Number(partes[2]), Number(partes[1]), 1) > agora);
}
