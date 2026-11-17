// Rotas do carrinho. Dependências por parâmetro, como nos outros módulos de
// rotas: os testes executam o server.js num contexto isolado.
function registrarRotasCarrinho({ app, mongoose, Produto, obterCarrinho, respostaCarrinho, estoqueDisponivel, logger }) {
  app.get("/api/carrinho", async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const carrinho = await obterCarrinho(req);
      res.json(await respostaCarrinho(carrinho));
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Não foi possível carregar o carrinho." });
    }
  });

  app.post("/api/carrinho", async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const slug = String(req.body?.slug || "").trim();
      const quantidade = Number(req.body?.quantidade ?? 1);

      if (!slug || !Number.isSafeInteger(quantidade) || quantidade < 1) {
        return res.status(400).json({ erro: "Produto ou quantidade inválida." });
      }

      const produto = await Produto.findOne({ slug, ativo: true }).lean();
      if (!produto) {
        return res.status(404).json({ erro: "Produto não encontrado." });
      }

      const carrinho = await obterCarrinho(req);
      const item = carrinho.itens.find(
        (itemCarrinho) => String(itemCarrinho.produtoId) === String(produto._id),
      );

      const qtdTotal = (item ? item.quantidade : 0) + quantidade;
      const disponivel = estoqueDisponivel(produto);
      if (qtdTotal > disponivel) {
        return res.status(409).json({
          erro: disponivel <= 0
            ? "Produto esgotado."
            : `Estoque insuficiente. Disponível: ${disponivel}.`,
        });
      }

      if (item) {
        item.quantidade += quantidade;
      } else {
        carrinho.itens.push({
          produtoId: produto._id,
          slug: produto.slug,
          quantidade,
        });
      }

      await carrinho.save();
      res.status(200).json(await respostaCarrinho(carrinho));
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Não foi possível adicionar ao carrinho." });
    }
  });

  app.patch("/api/carrinho/:produtoId", async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const { produtoId } = req.params;
      const quantidade = Number(req.body?.quantidade);
      if (
        !mongoose.isValidObjectId(produtoId) ||
        !Number.isSafeInteger(quantidade) ||
        quantidade < 1
      ) {
        return res.status(400).json({ erro: "Produto ou quantidade inválida." });
      }

      const carrinho = await obterCarrinho(req);
      const item = carrinho.itens.find(
        (itemCarrinho) => String(itemCarrinho.produtoId) === produtoId,
      );
      if (!item) {
        return res.status(404).json({ erro: "Item não encontrado no carrinho." });
      }

      const produto = await Produto.findById(produtoId).lean();
      if (produto) {
        const disponivel = estoqueDisponivel(produto);
        if (quantidade > disponivel) {
          return res.status(409).json({
            erro: disponivel <= 0
              ? "Produto esgotado."
              : `Estoque insuficiente. Disponível: ${disponivel}.`,
          });
        }
      }

      item.quantidade = quantidade;
      await carrinho.save();
      res.json(await respostaCarrinho(carrinho));
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Não foi possível atualizar o carrinho." });
    }
  });

  app.delete("/api/carrinho/:produtoId", async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const { produtoId } = req.params;
      if (!mongoose.isValidObjectId(produtoId)) {
        return res.status(400).json({ erro: "Produto inválido." });
      }

      const carrinho = await obterCarrinho(req);
      carrinho.itens = carrinho.itens.filter(
        (item) => String(item.produtoId) !== produtoId,
      );
      await carrinho.save();
      res.json(await respostaCarrinho(carrinho));
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Não foi possível remover o item." });
    }
  });
}

module.exports = { registrarRotasCarrinho };
