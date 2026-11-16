class ErroCalculoPagamento extends Error {
  constructor(message) {
    super(message);
    this.name = "ErroCalculoPagamento";
  }
}

const LIMITE_FRETE_GRATIS_CENTAVOS = 39990;

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

function calcularFreteAplicavelCentavos(subtotalCentavos, freteCotadoCentavos) {
  if (!Number.isSafeInteger(subtotalCentavos) || subtotalCentavos < 0) {
    throw new ErroCalculoPagamento("O subtotal do frete é inválido.");
  }
  if (!Number.isSafeInteger(freteCotadoCentavos) || freteCotadoCentavos < 0) {
    throw new ErroCalculoPagamento("O frete cotado é inválido.");
  }
  return subtotalCentavos > LIMITE_FRETE_GRATIS_CENTAVOS
    ? 0
    : freteCotadoCentavos;
}

function calcularParcelasCentavos(totalCentavos, quantidade) {
  if (!Number.isSafeInteger(totalCentavos) || totalCentavos <= 0) {
    throw new ErroCalculoPagamento("O total do cartão deve ser positivo e inteiro em centavos.");
  }
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 6) {
    throw new ErroCalculoPagamento("Escolha de 1 a 6 parcelas.");
  }
  const base = Math.floor(totalCentavos / quantidade);
  if (quantidade > 1 && base < 4000) {
    throw new ErroCalculoPagamento("Cada parcela deve ter pelo menos R$ 40,00.");
  }
  const resto = totalCentavos % quantidade;
  return Array.from({ length: quantidade }, (_, indice) => base + (indice < resto ? 1 : 0));
}

module.exports = {
  calcularParcelasCentavos,
  ErroCalculoPagamento,
  calcularSubtotalCentavos,
  criarItensPedido,
  calcularValorBaseCentavos,
  calcularPixCentavos,
  calcularFreteAplicavelCentavos,
  LIMITE_FRETE_GRATIS_CENTAVOS,
};
