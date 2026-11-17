// Perfil, endereços e cartões salvos. Dependências por parâmetro, como nos
// outros módulos de rotas: os testes executam o server.js num contexto isolado.
function registrarRotasPerfil({ app, autenticar, Usuario, mongoose, cartoesPublicos,
  salvarReferenciaCartao, ErroSegurancaPagamento, dataValida, sohTextos, logger }) {
  app.get("/api/perfil", autenticar, async (req, res) => {
    try {
      const usuario = await Usuario.findById(req.session.usuarioId);

      if (!usuario) {
        return res.status(404).json({ erro: "Usuário não encontrado." });
      }

      const enderecoAntigo = usuario.endereco?.toObject?.() || usuario.endereco;
      if (
        usuario.enderecos.length === 0 &&
        enderecoAntigo &&
        Object.values(enderecoAntigo).some(
          (valor) => typeof valor === "string" && valor.trim(),
        )
      ) {
        usuario.enderecos.push({ ...enderecoAntigo, principal: true });
        usuario.set("endereco", undefined);
        await usuario.save();
      }

      res.json({
        usuario: {
          _id: usuario._id,
          nome: usuario.nome || "",
          email: usuario.email || "",
          telefone: usuario.telefone || "",
          cpf: usuario.cpf || "",
          perfil: usuario.perfil || "cliente",
          nascimento: usuario.nascimento
            ? usuario.nascimento.toISOString().slice(0, 10)
            : "",
          enderecos: usuario.enderecos,
          cartoes: cartoesPublicos(usuario.cartoes),
        },
      });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao carregar perfil." });
    }
  });

  app.patch("/perfil/atualizar", autenticar, async (req, res) => {
    try {
      const { telefone, email, nascimento } = req.body || {};

      if (!sohTextos(telefone, email, nascimento)) {
        return res.status(400).send("Preencha todos os campos.");
      }
      if (!dataValida(nascimento)) {
        return res.status(400).send("Data de nascimento inválida.");
      }

      const atualizacoes = {
        email: email.trim().toLowerCase(),
        telefone: telefone.trim(),
        nascimento: new Date(nascimento),
      };

      const usuario = await Usuario.findByIdAndUpdate(
        req.session.usuarioId,
        { $set: atualizacoes },
        { new: true, runValidators: true },
      ).lean();

      if (!usuario) {
        return res.status(404).send("Usuário não encontrado.");
      }

      res.json({
        usuario: {
          _id: usuario._id,
          nome: usuario.nome || "",
          email: usuario.email || "",
          telefone: usuario.telefone || "",
          cpf: usuario.cpf || "",
          nascimento: usuario.nascimento
            ? usuario.nascimento.toISOString().slice(0, 10)
            : "",
        },
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).send("Este e-mail já está cadastrado.");
      }

      logger.error('api.falha');
      res.status(500).send("Erro interno do servidor.");
    }
  });

  app.post("/perfil/enderecos", autenticar, async (req, res) => {
    try {
      const body = req.body || {};
      const campos = [
        "apelido",
        "rua",
        "numero",
        "bairro",
        "cidade",
        "estado",
        "cep",
        "complemento",
      ];
      const endereco = Object.fromEntries(
        campos.map((campo) => [
          campo,
          typeof body[campo] === "string" ? body[campo].trim() : "",
        ]),
      );

      if (
        campos
          .filter((campo) => campo !== "complemento")
          .some((campo) => !endereco[campo])
      ) {
        return res.status(400).json({ erro: "Preencha os campos obrigatórios." });
      }

      endereco.estado = endereco.estado.toUpperCase();
      endereco.cep = endereco.cep.replace(/\D/g, "");
      if (
        !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(
          endereco.estado,
        )
      ) {
        return res.status(400).json({ erro: "Informe uma UF válida." });
      }
      if (!/^\d{8}$/.test(endereco.cep)) {
        return res.status(400).json({ erro: "Informe um CEP válido." });
      }
      if (typeof body.principal !== "boolean") {
        return res
          .status(400)
          .json({ erro: "Informe se o endereço é principal." });
      }

      const usuario = await Usuario.findById(req.session.usuarioId);
      if (!usuario) {
        return res.status(404).json({ erro: "Usuário não encontrado." });
      }

      const tornarPrincipal =
        body.principal || !usuario.enderecos.some((item) => item.principal);
      if (tornarPrincipal) {
        usuario.enderecos.forEach((item) => {
          item.principal = false;
        });
      }
      usuario.enderecos.push({ ...endereco, principal: tornarPrincipal });
      await usuario.save();

      res.status(201).json({ enderecos: usuario.enderecos });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao salvar o endereço." });
    }
  });

  app.patch(
    "/perfil/enderecos/:enderecoId/principal",
    autenticar,
    async (req, res) => {
      try {
        if (!mongoose.isValidObjectId(req.params.enderecoId)) {
          return res.status(400).json({ erro: "Endereço inválido." });
        }

        const usuario = await Usuario.findById(req.session.usuarioId);
        if (!usuario) {
          return res.status(404).json({ erro: "Usuário não encontrado." });
        }

        const enderecoSelecionado = usuario.enderecos.id(req.params.enderecoId);
        if (!enderecoSelecionado) {
          return res.status(404).json({ erro: "Endereço não encontrado." });
        }

        usuario.enderecos.forEach((endereco) => {
          endereco.principal = endereco._id.equals(enderecoSelecionado._id);
        });
        await usuario.save();

        res.json({ enderecos: usuario.enderecos });
      } catch {
        logger.error('api.falha');
        res.status(500).json({ erro: "Erro ao definir o endereço principal." });
      }
    },
  );

  app.delete("/perfil/enderecos/:enderecoId", autenticar, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.enderecoId)) {
        return res.status(400).json({ erro: "Endereço inválido." });
      }

      const usuario = await Usuario.findById(req.session.usuarioId);
      if (!usuario) {
        return res.status(404).json({ erro: "Usuário não encontrado." });
      }

      const endereco = usuario.enderecos.id(req.params.enderecoId);
      if (!endereco) {
        return res.status(404).json({ erro: "Endereço não encontrado." });
      }

      const eraPrincipal = endereco.principal;
      endereco.deleteOne();
      if (eraPrincipal && usuario.enderecos.length > 0) {
        usuario.enderecos[0].principal = true;
      }
      await usuario.save();

      res.json({ enderecos: usuario.enderecos });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao excluir o endereço." });
    }
  });

  // ── Cartões ──────────────────────────────────────────────────────────

  app.post("/perfil/cartoes", autenticar, async (req, res) => {
    try {
      res.status(201).json({ cartoes: await salvarReferenciaCartao(req.session.usuarioId, req.body || {}) });
    } catch (erro) {
      if (erro instanceof ErroSegurancaPagamento) return res.status(400).json({ erro: erro.message });
      logger.error('cartao.referencia_falhou');
      res.status(503).json({ erro: 'Não foi possível validar o cartão. Tente novamente.' });
    }
  });

  app.delete("/perfil/cartoes/:cartaoId", autenticar, async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.cartaoId)) {
        return res.status(400).json({ erro: "Cartão inválido." });
      }

      const usuario = await Usuario.findById(req.session.usuarioId);
      if (!usuario) {
        return res.status(404).json({ erro: "Usuário não encontrado." });
      }

      const cartao = usuario.cartoes.id(req.params.cartaoId);
      if (!cartao) {
        return res.status(404).json({ erro: "Cartão não encontrado." });
      }

      cartao.deleteOne();
      await usuario.save();

      res.json({
        cartoes: usuario.cartoes.map((c) => ({
          _id: c._id,
          titular: c.titular,
          finalCartao: c.finalCartao,
          validade: c.validade,
          bandeira: c.bandeira,
          status: c.status,
        })),
      });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro ao excluir o cartão." });
    }
  });
}

module.exports = { registrarRotasPerfil };
