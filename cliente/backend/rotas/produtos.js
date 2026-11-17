// Rotas públicas de catálogo. Recebe as dependências do server.js em vez de
// importar: é o padrão dos outros módulos de rotas e mantém os handlers
// visíveis para os testes, que executam o server.js num contexto isolado.
function registrarRotasProdutos({ app, Produto, estoqueDisponivel, logger }) {
  const CACHE_PUBLICO = "public, s-maxage=60, stale-while-revalidate=600";

  function respostaProdutoPublico(produto) {
    const resposta = { ...produto, estoqueDisponivel: estoqueDisponivel(produto) };
    delete resposta.estoqueSeguranca;
    return resposta;
  }

  app.get("/api/produtos", async (req, res) => {
    try {
      const { tipo } = req.query;
      const filtro = { ativo: true };

      if (tipo && ["kit", "material"].includes(String(tipo).toLowerCase())) {
        filtro.tipo = String(tipo).toLowerCase();
      }

      const produtos = await Produto.find(filtro).sort({ nome: 1 }).lean();
      const resultado = produtos.map(respostaProdutoPublico);
      res.set("Cache-Control", CACHE_PUBLICO).json({ produtos: resultado });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao listar produtos." });
    }
  });

  app.get("/api/produto/:slug", async (req, res) => {
    try {
      const { slug } = req.params;

      const produtoRaw = await Produto.findOne({ slug, ativo: true }).lean();
      if (!produtoRaw) {
        return res.status(404).json({ erro: "Produto não encontrado." });
      }

      const produto = respostaProdutoPublico(produtoRaw);
      res.set("Cache-Control", CACHE_PUBLICO).json({ produto });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao buscar produto." });
    }
  });

  // Serve a foto do produto como binário cacheável, para o carrinho não precisar
  // devolver os ~150 KB de base64 de cada item em toda leitura.
  app.get("/api/produto/:slug/imagem", async (req, res) => {
    try {
      const produto = await Produto.findOne({ slug: req.params.slug, ativo: true }, "imagemUrl").lean();
      const endereco = String(produto?.imagemUrl || "").trim();
      if (!endereco) {
        return res.status(404).json({ erro: "Imagem não encontrada." });
      }

      const dataUrl = /^data:([\w.+-]+\/[\w.+-]+);base64,(.+)$/s.exec(endereco);
      if (!dataUrl) {
        // Produto cadastrado com link externo: devolve o próprio link.
        if (/^https?:\/\//i.test(endereco)) return res.redirect(302, endereco);
        return res.status(404).json({ erro: "Imagem não encontrada." });
      }

      res
        .set("Content-Type", dataUrl[1])
        .set("Cache-Control", "public, max-age=86400, s-maxage=86400")
        .send(Buffer.from(dataUrl[2], "base64"));
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao buscar imagem." });
    }
  });

  app.get("/produto/:slug", async (req, res) => {
    try {
      const { slug } = req.params;

      const produto = await Produto.findOne({ slug }).lean();
      if (!produto) {
        return res.status(404).json({ erro: "Produto não encontrado." });
      }

      res.json({ produto });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao buscar produto." });
    }
  });
}

module.exports = { registrarRotasProdutos };
