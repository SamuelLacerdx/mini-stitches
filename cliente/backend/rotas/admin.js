// Painel administrativo: estoque, assinaturas e planos (somente leitura ou
// bloqueados), dashboard e pedidos. Dependências por parâmetro, como nos
// outros módulos de rotas: os testes executam o server.js num contexto isolado.
function registrarRotasAdmin({ app, autenticarAdmin, mongoose, Produto, Pedido, Assinatura,
  PLANO_CLUBE, normalizarVideosDoKit, sincronizarVideosDoKitComStatus,
  atualizarLogistica, respostaPedido, FINANCEIROS, LOGISTICOS, ErroEstadoPedido, logger }) {
  app.post("/admin/estoque", autenticarAdmin, async (req, res) => {
    try {
      const body = req.body || {};
      const tipo = String(body.tipo || "kit").toLowerCase();
      const slug = String(body.slug || "")
        .trim()
        .toLowerCase();
      const nome = String(body.nome || "").trim();
      const preco = Number(body.preco);
      const estoque = Number(body.estoque);
      const estoqueSeguranca = Number(body.estoqueSeguranca || 0);
      const imagemUrl = String(body.imagemUrl || "").trim();
      const ativo = body.ativo !== undefined ? Boolean(body.ativo) : true;

      if (!["kit", "material"].includes(tipo)) {
        return res.status(400).json({ erro: "Tipo do produto inválido." });
      }
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res
          .status(400)
          .json({ erro: "Informe um slug válido (ex.: coelhinho-amigurumi)." });
      }
      if (!nome) {
        return res.status(400).json({ erro: "Informe o nome do item." });
      }
      if (!Number.isInteger(preco) || preco < 0) {
        return res
          .status(400)
          .json({ erro: "O preço deve ser um número inteiro em centavos." });
      }
      if (!Number.isInteger(estoque) || estoque < 0) {
        return res.status(400).json({
          erro: "O estoque deve ser um número inteiro maior ou igual a zero.",
        });
      }
      if (!Number.isInteger(estoqueSeguranca) || estoqueSeguranca < 0) {
        return res.status(400).json({
          erro: "O estoque de segurança deve ser um número inteiro >= 0.",
        });
      }

      const item = {
        slug,
        tipo,
        nome,
        preco,
        estoque,
        estoqueSeguranca,
        imagemUrl: imagemUrl || undefined,
        ativo,
      };

      if (tipo === "kit") {
        const nomeChamada = String(body.nomeChamada || nome).trim();
        const nivel = String(body.nivel || "").trim();
        const faixaEtaria = String(body.faixaEtaria || "").trim();
        const tempoEstimado = String(body.tempoEstimado || "").trim();
        const descricao = Array.isArray(body.descricao)
          ? body.descricao.map((desc) => desc.trim()).filter(Boolean)
          : [];
        const caixa = Array.isArray(body.caixa)
          ? body.caixa.map((itemCaixa) => itemCaixa.trim()).filter(Boolean)
          : [];
        const videos = normalizarVideosDoKit(body.videos).map((video) => ({
          ...video,
          ativo: body.ativo !== undefined ? Boolean(body.ativo) : video.ativo,
        }));

        if (videos.length < 2) {
          return res.status(400).json({
            erro: "O kit deve possuir pelo menos 2 vídeos cadastrados.",
          });
        }

        item.kit = {
          nomeChamada,
          nivel,
          faixaEtaria,
          tempoEstimado,
          destaque: Boolean(body.destaque),
          descricao,
          caixa,
          videos,
        };
      }

      if (tipo === "material") {
        item.material = {
          descricao: String(body.materialDescricao || "").trim(),
          categoria: String(body.materialCategoria || "geral").trim(),
        };
      }

      const produtoExistente = await Produto.findOne({ slug });
      if (produtoExistente) {
        await Produto.updateOne({ slug }, { $set: item });
        return res.json({ produto: { ...item, _id: produtoExistente._id } });
      }

      const novoProduto = await Produto.create(item);
      res.status(201).json({ produto: novoProduto });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao salvar o produto." });
    }
  });

  app.patch("/admin/estoque/:id", autenticarAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ erro: "ID inválido." });
      }

      const body = req.body || {};
      const tipo = String(body.tipo || "kit").toLowerCase();
      const slug = String(body.slug || "")
        .trim()
        .toLowerCase();
      const nome = String(body.nome || "").trim();
      const preco = Number(body.preco);
      const estoque = Number(body.estoque);
      const estoqueSeguranca = Number(body.estoqueSeguranca || 0);
      const imagemUrl = String(body.imagemUrl || "").trim();
      const ativo = body.ativo !== undefined ? Boolean(body.ativo) : true;

      if (!["kit", "material"].includes(tipo)) {
        return res.status(400).json({ erro: "Tipo do produto inválido." });
      }
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return res
          .status(400)
          .json({ erro: "Informe um slug válido (ex.: coelhinho-amigurumi)." });
      }
      if (!nome) {
        return res.status(400).json({ erro: "Informe o nome do item." });
      }
      if (!Number.isInteger(preco) || preco < 0) {
        return res
          .status(400)
          .json({ erro: "O preço deve ser um número inteiro em centavos." });
      }
      if (!Number.isInteger(estoque) || estoque < 0) {
        return res.status(400).json({
          erro: "O estoque deve ser um número inteiro maior ou igual a zero.",
        });
      }
      if (!Number.isInteger(estoqueSeguranca) || estoqueSeguranca < 0) {
        return res.status(400).json({
          erro: "O estoque de segurança deve ser um número inteiro >= 0.",
        });
      }

      const produtoExistente = await Produto.findById(id);
      if (!produtoExistente) {
        return res.status(404).json({ erro: "Produto não encontrado." });
      }

      const slugEmUso = await Produto.findOne({ slug, _id: { $ne: id } }).lean();
      if (slugEmUso) {
        return res
          .status(409)
          .json({ erro: "Já existe um produto com este slug." });
      }

      const itemAtualizado = {
        slug,
        tipo,
        nome,
        preco,
        estoque,
        estoqueSeguranca,
        imagemUrl: imagemUrl || undefined,
        ativo,
      };

      if (tipo === "kit") {
        const nomeChamada = String(body.nomeChamada || nome).trim();
        const nivel = String(body.nivel || "").trim();
        const faixaEtaria = String(body.faixaEtaria || "").trim();
        const tempoEstimado = String(body.tempoEstimado || "").trim();
        const descricao = Array.isArray(body.descricao)
          ? body.descricao.map((desc) => desc.trim()).filter(Boolean)
          : [];
        const caixa = Array.isArray(body.caixa)
          ? body.caixa.map((itemCaixa) => itemCaixa.trim()).filter(Boolean)
          : [];
        const videos = sincronizarVideosDoKitComStatus(
          normalizarVideosDoKit(body.videos),
          ativo,
        ).map((video) => ({
          ...video,
          ativo: Boolean(ativo) && video.ativo !== false,
        }));

        if (videos.length < 2) {
          return res.status(400).json({
            erro: "O kit deve possuir pelo menos 2 vídeos cadastrados.",
          });
        }

        itemAtualizado.kit = {
          nomeChamada,
          nivel,
          faixaEtaria,
          tempoEstimado,
          destaque: Boolean(body.destaque),
          descricao,
          caixa,
          videos,
        };
      }

      if (tipo === "material") {
        itemAtualizado.material = {
          descricao: String(body.materialDescricao || "").trim(),
          categoria: String(body.materialCategoria || "geral").trim(),
        };
      }

      await Produto.updateOne({ _id: id }, { $set: itemAtualizado });

      const produtoAtualizado = await Produto.findById(id).lean();
      res.json({ produto: produtoAtualizado });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao atualizar o produto." });
    }
  });

  app.get("/admin/estoque", autenticarAdmin, async (req, res) => {
    try {
      const produtos = await Produto.find().lean();

      res.json({ produtos });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao listar produtos." });
    }
  });

  app.delete("/admin/estoque/:id", autenticarAdmin, async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ erro: "ID inválido." });
      }

      const produto = await Produto.findById(id);
      if (!produto) {
        return res.status(404).json({ erro: "Produto não encontrado." });
      }

      await Produto.deleteOne({ _id: id });

      res.json({ mensagem: "Produto removido com sucesso." });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao excluir o produto." });
    }
  });

  const planoNaoEditavel = (_req, res) => res.status(410).json({
    erro: "O Clube possui somente o plano mensal SUB-02. A contratação deve ser feita pela conta do cliente.",
  });
  app.post("/admin/assinaturas", autenticarAdmin, planoNaoEditavel);

  app.get("/admin/assinaturas", autenticarAdmin, async (req, res) => {
    try {
      const assinaturas = await Assinatura.find()
        .sort({ assinadoEm: -1 })
        .populate("clienteId", "nome email")
        .lean();

      res.json({ assinaturas });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao listar assinaturas." });
    }
  });

  app.delete("/admin/assinaturas/:id", autenticarAdmin, (_req, res) => res.status(410).json({
    erro: "Assinaturas não podem ser excluídas. O cancelamento deve preservar o histórico e interromper a recorrência no provedor.",
  }));

  app.post("/admin/planos", autenticarAdmin, planoNaoEditavel);

  app.get("/admin/planos", autenticarAdmin, (_req, res) => res.json({ planos: [PLANO_CLUBE] }));

  app.delete("/admin/planos/:id", autenticarAdmin, planoNaoEditavel);

  const STATUS_FATURADOS = ["pago", "em_separacao", "enviado", "entregue"];
  const STATUS_PEDIDO_ADMIN = [
    "aguardando_pagamento",
    ...STATUS_FATURADOS,
    "cancelado",
  ];

  function respostaPedidoAdmin(pedido) {
    return {
      _id: pedido._id,
      ...respostaPedido(pedido),
      cliente: pedido.cliente,
      entrega: pedido.entrega,
      historicoStatus: pedido.historicoStatus || [],
      historicoFinanceiro: pedido.historicoFinanceiro || [],
      historicoLogistico: pedido.historicoLogistico || [],
    };
  }

  app.get("/admin/dashboard", autenticarAdmin, async (req, res) => {
    try {
      const [porStatus, assinantesAtivos, ultimosPedidos] = await Promise.all([
        Pedido.aggregate([
          {
            $group: {
              _id: { status: "$status", financeiro: { $ifNull: ["$statusFinanceiro", {
                $cond: [{ $in: ["$status", STATUS_FATURADOS] }, "aprovado", "desconhecido"],
              }] } },
              quantidade: { $sum: 1 },
              total: { $sum: { $subtract: ["$total", { $ifNull: ["$valorReembolsado", 0] }] } },
            },
          },
        ]),
        Assinatura.countDocuments({ canceladoEm: null, statusAdesao: "ativa" }),
        Pedido.find().sort({ criadoEm: -1 }).limit(5).lean(),
      ]);

      const statusPedidos = Object.fromEntries(
        STATUS_PEDIDO_ADMIN.map((status) => [status, 0]),
      );
      let totalPedidos = 0;
      let faturado = 0;
      let pedidosFaturados = 0;

      for (const grupo of porStatus) {
        statusPedidos[grupo._id.status] = (statusPedidos[grupo._id.status] || 0) + grupo.quantidade;
        totalPedidos += grupo.quantidade;
        if (["aprovado", "parcialmente_reembolsado"].includes(grupo._id.financeiro)) {
          faturado += grupo.total;
          pedidosFaturados += grupo.quantidade;
        }
      }

      res.json({
        totalPedidos,
        faturado,
        ticketMedio: pedidosFaturados
          ? Math.round(faturado / pedidosFaturados)
          : 0,
        assinantesAtivos,
        statusPedidos,
        ultimosPedidos: ultimosPedidos.map(respostaPedidoAdmin),
      });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao carregar o painel." });
    }
  });

  app.get("/admin/pedidos", autenticarAdmin, async (req, res) => {
    try {
      const filtro = {};
      const status = String(req.query.status || "");
      if (STATUS_PEDIDO_ADMIN.includes(status)) filtro.status = status;
      if (FINANCEIROS.includes(req.query.statusFinanceiro)) filtro.statusFinanceiro = req.query.statusFinanceiro;

      const pedidos = await Pedido.find(filtro)
        .sort({ criadoEm: -1 })
        .limit(200)
        .lean();
      res.json({ pedidos: pedidos.map(respostaPedidoAdmin) });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao listar pedidos." });
    }
  });

  app.patch("/admin/pedidos/:id/status", autenticarAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      if (["statusFinanceiro", "valorReembolsado", "pagamentoId", "statusProvedor"].some((campo) => Object.hasOwn(req.body || {}, campo))) {
        return res.status(403).json({ erro: "O estado financeiro é controlado pelo provedor de pagamento." });
      }
      const status = String(req.body?.statusLogistico ?? req.body?.status ?? "");
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ erro: "ID inválido." });
      }
      if (!STATUS_PEDIDO_ADMIN.includes(status) && !LOGISTICOS.includes(status)) {
        return res.status(400).json({ erro: "Status inválido." });
      }

      const pedido = await atualizarLogistica({ id, status, rastreio: req.body?.rastreio });
      res.json({ pedido: respostaPedidoAdmin(pedido) });
    } catch (error) {
      if (error instanceof ErroEstadoPedido) return res.status(error.status).json({ erro: error.message });
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao atualizar o pedido." });
    }
  });
}

module.exports = { registrarRotasAdmin };
