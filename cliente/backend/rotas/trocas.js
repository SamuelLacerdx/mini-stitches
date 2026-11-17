/* ------------------------------------------------------------------ */
/* Trocas e devoluções                                                 */
/* ------------------------------------------------------------------ */
// Dependências por parâmetro, como nos outros módulos de rotas: os testes
// executam o server.js num contexto isolado.
function registrarRotasTrocas({ app, mongoose, Troca, Pedido, Usuario, autenticar, autenticarAdmin, logger }) {
  const PRAZO_DEVOLUCAO_DIAS = 7;
  const STATUS_TROCA = ["em_analise", "aprovada", "recusada"];

  function dataEntrega(pedido) {
    const registros = (pedido.historicoStatus || []).filter(
      (h) => h.status === "entregue",
    );
    return registros.length ? registros[registros.length - 1].em : null;
  }

  // Não precisa de conta: o número do pedido + e-mail da compra identificam o
  // cliente. A mesma mensagem é usada para pedido inexistente e e-mail errado,
  // para não revelar quais números de pedido existem.
  app.post("/api/trocas", async (req, res) => {
    try {
      const body = req.body || {};
      const numeroPedido = String(body.numeroPedido || "")
        .trim()
        .toUpperCase();
      const email = String(body.email || "")
        .trim()
        .toLowerCase();
      const tipo = String(body.tipo || "");
      const motivo = String(body.motivo || "").trim();

      if (!["troca", "devolucao"].includes(tipo)) {
        return res.status(400).json({ erro: "Tipo de solicitação inválido." });
      }
      if (!numeroPedido || !email) {
        return res
          .status(400)
          .json({ erro: "Informe o número do pedido e o e-mail da compra." });
      }
      if (motivo.length < 10 || motivo.length > 1000) {
        return res
          .status(400)
          .json({ erro: "Descreva o motivo (entre 10 e 1000 caracteres)." });
      }

      const pedido = await Pedido.findOne({
        numero: numeroPedido,
        "cliente.email": email,
      }).lean();
      if (!pedido) {
        return res.status(404).json({
          erro: "Não encontramos um pedido com esse número e e-mail.",
        });
      }

      if (pedido.status !== "entregue") {
        return res.status(400).json({
          erro: "Trocas e devoluções só podem ser solicitadas após a entrega do pedido.",
        });
      }

      if (tipo === "devolucao") {
        const entregueEm = dataEntrega(pedido);
        const limite = entregueEm
          ? new Date(entregueEm).getTime() +
            PRAZO_DEVOLUCAO_DIAS * 24 * 60 * 60 * 1000
          : 0;
        if (!entregueEm || Date.now() > limite) {
          return res.status(400).json({
            erro: `O prazo de ${PRAZO_DEVOLUCAO_DIAS} dias para devolução já terminou. Em caso de defeito, solicite uma troca.`,
          });
        }
      }

      const emAberto = await Troca.exists({
        pedidoId: pedido._id,
        status: "em_analise",
      });
      if (emAberto) {
        return res.status(409).json({
          erro: "Já existe uma solicitação em análise para este pedido.",
        });
      }

      const troca = await Troca.create({
        pedidoId: pedido._id,
        numeroPedido: pedido.numero,
        email,
        tipo,
        motivo,
      });

      res.status(201).json({
        troca: {
          tipo: troca.tipo,
          numeroPedido: troca.numeroPedido,
          status: troca.status,
          criadoEm: troca.criadoEm,
        },
      });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Não foi possível registrar a solicitação." });
    }
  });

  function respostaTroca(troca) {
    return {
      _id: troca._id,
      numeroPedido: troca.numeroPedido,
      tipo: troca.tipo,
      motivo: troca.motivo,
      status: troca.status,
      criadoEm: troca.criadoEm,
    };
  }

  // Trocas do usuário logado: dos pedidos feitos na conta e também das compras
  // feitas como convidado com o mesmo e-mail da conta.
  app.get("/api/trocas", autenticar, async (req, res) => {
    try {
      const usuario = await Usuario.findById(req.session.usuarioId)
        .select("email")
        .lean();
      const pedidosIds = await Pedido.find({
        clienteId: req.session.usuarioId,
      }).distinct("_id");

      const condicoes = [{ pedidoId: { $in: pedidosIds } }];
      if (usuario?.email) {
        condicoes.push({ email: String(usuario.email).toLowerCase() });
      }

      const trocas = await Troca.find({ $or: condicoes })
        .sort({ criadoEm: -1 })
        .limit(50)
        .lean();
      res.json({ trocas: trocas.map(respostaTroca) });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Não foi possível carregar suas trocas." });
    }
  });

  // Consulta sem conta: número do pedido + e-mail da compra (POST para o e-mail
  // não ficar em URL/log de acesso).
  app.post("/api/trocas/consultar", async (req, res) => {
    try {
      const numeroPedido = String(req.body?.numeroPedido || "")
        .trim()
        .toUpperCase();
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      if (!numeroPedido || !email) {
        return res
          .status(400)
          .json({ erro: "Informe o número do pedido e o e-mail da compra." });
      }

      const trocas = await Troca.find({ numeroPedido, email })
        .sort({ criadoEm: -1 })
        .lean();
      res.json({ trocas: trocas.map(respostaTroca) });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Não foi possível consultar as solicitações." });
    }
  });

  app.get("/admin/trocas", autenticarAdmin, async (req, res) => {
    try {
      const filtro = {};
      const status = String(req.query.status || "");
      if (STATUS_TROCA.includes(status)) filtro.status = status;

      const trocas = await Troca.find(filtro)
        .sort({ criadoEm: -1 })
        .limit(200)
        .populate("pedidoId", "cliente total status itens")
        .lean();

      res.json({
        trocas: trocas.map(({ pedidoId: pedido, ...troca }) => ({
          ...troca,
          pedido: pedido
            ? {
                _id: pedido._id,
                cliente: pedido.cliente,
                total: pedido.total,
                status: pedido.status,
                itens: (pedido.itens || []).map((item) => ({
                  nome: item.nome,
                  quantidade: item.quantidade,
                })),
              }
            : null,
        })),
      });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao listar trocas." });
    }
  });

  app.patch("/admin/trocas/:id", autenticarAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const status = String(req.body?.status || "");
      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({ erro: "ID inválido." });
      }
      if (!STATUS_TROCA.includes(status)) {
        return res.status(400).json({ erro: "Status inválido." });
      }

      const troca = await Troca.findByIdAndUpdate(
        id,
        { $set: { status } },
        { new: true, runValidators: true },
      ).lean();
      if (!troca) {
        return res.status(404).json({ erro: "Solicitação não encontrada." });
      }
      res.json({ troca });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao atualizar a solicitação." });
    }
  });
}

module.exports = { registrarRotasTrocas };
