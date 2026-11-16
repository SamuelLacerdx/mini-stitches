const { createHash, randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const { calcularPixCentavos, calcularValorBaseCentavos, calcularParcelasCentavos } = require('./calculosPagamento');

class ErroResumoCheckout extends Error {
  constructor(message = 'O resumo mudou ou expirou. Atualize os valores antes de pagar.', status = 409) {
    super(message); this.status = status;
  }
}

function valoresPagamento(calculo, frete, metodo, parcelas) {
  const base = calcularValorBaseCentavos(calculo.subtotal, frete);
  const pix = calcularPixCentavos(calculo.subtotal, frete);
  return { subtotal: calculo.subtotal, desconto: metodo === 'pix' ? pix.desconto : 0,
    frete, total: metodo === 'pix' ? pix.total : base,
    valoresParcelas: metodo === 'cartao' ? calcularParcelasCentavos(base, parcelas) : [] };
}

function identificarResumo({ clienteId, calculo, cep, servicoId, frete, metodo, parcelas, pedidoNumero = '', entrega }) {
  const itens = calculo.itensPedido.map(({ produtoId, quantidade, precoUnit, slug, nome }) =>
    [String(produtoId), quantidade, precoUnit, slug, nome]).sort((a, b) => a[0].localeCompare(b[0]));
  return createHash('sha256').update(JSON.stringify([String(clienteId), pedidoNumero, itens, cep, entrega?.endereco || '',
    servicoId, metodo, parcelas, valoresPagamento(calculo, frete, metodo, parcelas)])).digest('hex');
}

function criarResumoCheckout({ secret, agora = () => new Date() }) {
  function emitir({ clienteId, calculo, cep, servicoId, frete, metodo, parcelas = 1, opcoesFrete = [], pedidoNumero = '', entrega }) {
    if (!['pix', 'boleto', 'cartao'].includes(metodo)) throw new ErroResumoCheckout('Forma de pagamento inválida.', 400);
    const itens = calculo.itensPedido.map((item) => ({ ...item, produtoId: String(item.produtoId),
      total: item.quantidade * item.precoUnit }));
    const resumo = { itens, quantidadeItens: itens.reduce((soma, item) => soma + item.quantidade, 0),
      metodo, subtotal: calculo.subtotal, opcoesFrete, frete: null, total: null, desconto: null,
      valoresParcelas: [], opcoesParcelas: [], cotacao: null };
    if (!cep) return resumo;
    const base = calcularValorBaseCentavos(calculo.subtotal, frete);
    for (let quantidade = 1; quantidade <= 6; quantidade++) {
      if (quantidade === 1 || Math.floor(base / quantidade) >= 4000) {
        resumo.opcoesParcelas.push({ quantidade, valores: calcularParcelasCentavos(base, quantidade) });
      }
    }
    const escolhidas = metodo === 'cartao' && resumo.opcoesParcelas.some((opcao) => opcao.quantidade === parcelas) ? parcelas : 1;
    const contexto = { clienteId, calculo, cep, servicoId, frete, metodo, parcelas: escolhidas, pedidoNumero, entrega };
    const iat = Math.floor(agora().getTime() / 1000);
    const cotacao = jwt.sign({ versao: 1, hash: identificarResumo(contexto), iat }, secret,
      { algorithm: 'HS256', expiresIn: 300, audience: 'checkout', jwtid: randomUUID() });
    return { ...resumo, ...valoresPagamento(calculo, frete, metodo, escolhidas), cep, servicoId,
      parcelas: escolhidas, cotacao, validoAte: new Date((iat + 300) * 1000).toISOString() };
  }

  function validar({ cotacao, ...contexto }) {
    if (typeof cotacao !== 'string' || cotacao.length > 2048) throw new ErroResumoCheckout('Consulte o resumo oficial antes de pagar.', 400);
    let dados;
    try { dados = jwt.verify(cotacao, secret, { algorithms: ['HS256'], audience: 'checkout', clockTimestamp: Math.floor(agora().getTime() / 1000) }); }
    catch { throw new ErroResumoCheckout(); }
    if (dados.versao !== 1 || typeof dados.jti !== 'string' || dados.hash !== identificarResumo(contexto)) throw new ErroResumoCheckout();
    return dados.jti;
  }
  return { emitir, validar };
}

module.exports = { criarResumoCheckout, ErroResumoCheckout };
