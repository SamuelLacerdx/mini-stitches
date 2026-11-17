const { calcularSubtotalCentavos, calcularPixCentavos, calcularParcelasCentavos, LIMITE_FRETE_GRATIS_CENTAVOS } = require('./calculosPagamento');

function resumirCarrinho(itens) {
  if (!itens.length) return { subtotal: 0, produtosPix: 0, descontoPix: 0, quantidadeItens: 0,
    parcelas: [], freteGratis: false, podeContinuar: false, erro: '' };
  try {
    const subtotal = calcularSubtotalCentavos(itens.map((item) => ({ quantidade: item.quantidade,
      produtoId: { preco: item.preco, ativo: item.ativo } })));
    const quantidadeItens = itens.reduce((soma, item) => soma + item.quantidade, 0);
    if (!Number.isSafeInteger(quantidadeItens)) throw new Error();
    const pix = calcularPixCentavos(subtotal, 0);
    const quantidadeParcelas = Math.max(1, Math.min(6, Math.floor(subtotal / 4000)));
    const parcelas = subtotal > 0 ? calcularParcelasCentavos(subtotal, quantidadeParcelas) : [];
    const semEstoque = itens.some((item) => !Number.isSafeInteger(item.estoqueDisponivel) || item.quantidade > item.estoqueDisponivel);
    return { subtotal, produtosPix: pix.produtosLiquidos, descontoPix: pix.desconto, quantidadeItens, parcelas,
      freteGratis: subtotal > LIMITE_FRETE_GRATIS_CENTAVOS, podeContinuar: subtotal > 0 && !semEstoque,
      erro: semEstoque ? 'Ajuste as quantidades dos produtos sem estoque disponível.' : '' };
  } catch {
    return { subtotal: null, produtosPix: null, descontoPix: null, quantidadeItens: null, parcelas: [],
      freteGratis: false, podeContinuar: false, erro: 'Remova ou ajuste os produtos indisponíveis para continuar.' };
  }
}
module.exports = { resumirCarrinho };
