function criarCarrinhoHelpers({ Carrinho, clienteIdDoCarrinho }) {
  async function obterCarrinho(req) {
    const clienteId = clienteIdDoCarrinho(req);

    if (!clienteId) {
      let carrinho = await Carrinho.findOne({
        sessaoId: req.sessionID,
        clienteId: null,
      });

      if (!carrinho) {
        carrinho = await Carrinho.create({
          sessaoId: req.sessionID,
          itens: [],
        });
      }

      return carrinho;
    }

    let carrinho = await Carrinho.findOne({ clienteId });
    const carrinhoVisitante = await Carrinho.findOne({
      sessaoId: req.sessionID,
      clienteId: null,
    });

    if (carrinhoVisitante) {
      if (!carrinho) {
        carrinho = carrinhoVisitante;
        carrinho.clienteId = clienteId;
        carrinho.sessaoId = undefined;
        await carrinho.save();
      } else {
        for (const itemVisitante of carrinhoVisitante.itens) {
          const itemCliente = carrinho.itens.find(
            (item) => String(item.produtoId) === String(itemVisitante.produtoId),
          );
          if (itemCliente) {
            itemCliente.quantidade += itemVisitante.quantidade;
          } else {
            carrinho.itens.push(itemVisitante.toObject());
          }
        }

        await carrinho.save();
        await carrinhoVisitante.deleteOne();
      }
    }

    if (!carrinho) {
      carrinho = await Carrinho.create({ clienteId, itens: [] });
    }

    return carrinho;
  }

  async function respostaCarrinho(carrinho) {
    await carrinho.populate(
      "itens.produtoId",
      "slug nome tipo preco imagemUrl kit.nivel kit.faixaEtaria material.categoria ativo",
    );

    const itens = carrinho.itens
      .filter((item) => item.produtoId)
      .map((item) => ({
        produtoId: String(item.produtoId._id),
        slug: item.slug,
        nome: item.produtoId.nome,
        tipo:
          item.produtoId.tipo === "kit"
            ? item.produtoId.kit?.faixaEtaria || item.produtoId.kit?.nivel || "Kit"
            : item.produtoId.material?.categoria || "Material avulso",
        preco: item.produtoId.preco,
        imagemUrl: item.produtoId.imagemUrl || "",
        quantidade: item.quantidade,
        ativo: item.produtoId.ativo,
      }));

    return { itens };
  }

  return { obterCarrinho, respostaCarrinho };
}

module.exports = { criarCarrinhoHelpers };
