class ErroCalculoPagamento extends Error {
  constructor(message) {
    super(message);
    this.name = "ErroCalculoPagamento";
  }
}

function calcularSubtotalCentavos(itens) {
  if (!Array.isArray(itens) || itens.length === 0) {
    throw new ErroCalculoPagamento("Seu carrinho está vazio.");
  }

  return itens.reduce((subtotal, item) => {
    const produto = item?.produtoId;
    const quantidade = Number(item?.quantidade);
    const preco = Number(produto?.preco);
    if (!produto || produto.ativo === false || !Number.isSafeInteger(quantidade) || quantidade < 1 || !Number.isSafeInteger(preco) || preco < 0) {
      throw new ErroCalculoPagamento("Há um produto inválido no carrinho.");
    }
    const valorItem = quantidade * preco;
    const novoSubtotal = subtotal + valorItem;
    if (!Number.isSafeInteger(valorItem) || !Number.isSafeInteger(novoSubtotal)) {
      throw new ErroCalculoPagamento("O valor do carrinho é inválido.");
    }
    return novoSubtotal;
  }, 0);
}

function criarItensPedido(itens) {
  const subtotal = calcularSubtotalCentavos(itens);
  const itensPedido = itens.map((item) => ({
    produtoId: item.produtoId._id,
    slug: item.produtoId.slug,
    nome: item.produtoId.nome,
    quantidade: Number(item.quantidade),
    precoUnit: Number(item.produtoId.preco),
  }));
  return { itensPedido, subtotal };
}

function calcularValorBaseCentavos(subtotalCentavos, freteCentavos) {
  if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos < 0) {
    throw new ErroCalculoPagamento("O subtotal do carrinho é inválido.");
  }
  if (!Number.isSafeInteger(freteCentavos) || freteCentavos < 0) {
    throw new ErroCalculoPagamento("O frete do pedido é inválido.");
  }
  const total = subtotalCentavos + freteCentavos;
  if (!Number.isSafeInteger(total)) {
    throw new ErroCalculoPagamento("O valor do pedido é inválido.");
  }
  return total;
}

function calcularPixCentavos(subtotalCentavos, freteCentavos) {
  const subtotal = Number(subtotalCentavos);
  const frete = Number(freteCentavos);
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || !Number.isSafeInteger(frete) || frete < 0) {
    throw new ErroCalculoPagamento("Os valores do Pix são inválidos.");
  }
  const produtosLiquidos = Math.round(subtotal * 0.95);
  const desconto = subtotal - produtosLiquidos;
  const total = produtosLiquidos + frete;
  if (![produtosLiquidos, desconto, total].every(Number.isSafeInteger)) {
    throw new ErroCalculoPagamento("O valor do Pix é inválido.");
  }
  return { produtosLiquidos, desconto, total };
}

module.exports = {
  ErroCalculoPagamento,
  calcularSubtotalCentavos,
  criarItensPedido,
  calcularValorBaseCentavos,
  calcularPixCentavos,
};
