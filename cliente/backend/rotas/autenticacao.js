// Cadastro, login, saída da conta e redefinição de senha. Dependências por
// parâmetro, como nos outros módulos de rotas: os testes executam o server.js
// num contexto isolado.
function registrarRotasAutenticacao({ app, Usuario, bcrypt, jwt, jwtSecret, crypto, nodemailer,
  validarCPF, dataValida, sohTextos, logger }) {
  app.post("/api/cadastro", async (req, res) => {
    try {
      const { nome, cpf, telefone, nascimento, email, senha } = req.body || {};

      if (!sohTextos(nome, cpf, telefone, nascimento, email, senha)) {
        return res.status(400).send("Preencha todos os campos.");
      }

      if (senha.length < 8) {
        return res.status(400).send("A senha deve ter ao menos 8 caracteres.");
      }

      if (!dataValida(nascimento)) {
        return res.status(400).send("Data de nascimento inválida.");
      }
      const dataNascimento = new Date(nascimento);

      if (!validarCPF(cpf)) {
        return res.status(400).send("CPF inválido.");
      }

      const cpfLimpo = cpf.replace(/\D/g, "");
      const emailNormalizado = email.trim().toLowerCase();
      const senhaHash = await bcrypt.hash(senha, 10);

      await Usuario.create({
        nome: nome.trim(),
        cpf: cpfLimpo,
        telefone: telefone.trim(),
        nascimento: dataNascimento,
        email: emailNormalizado,
        senhaHash,
      });
      const destino = String(req.body?.redirect || "");
      const destinoSeguro = /^\/(?![/\\])/.test(destino);
      res.redirect(
        destinoSeguro
          ? `/login?redirect=${encodeURIComponent(destino)}`
          : "/login",
      );
    } catch (err) {
      if (err.code === 11000) {
        const campoDuplicado = Object.keys(err.keyPattern || {})[0];
        const mensagem =
          campoDuplicado === "cpf"
            ? "Este CPF já está cadastrado."
            : "Este e-mail já está cadastrado.";
        return res.status(409).send(mensagem);
      }

      logger.error('api.falha');
      res.status(500).send("Erro interno do servidor.");
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, senha } = req.body || {};

      if (!sohTextos(email, senha)) {
        return res.status(400).json({ erro: "Informe e-mail e senha." });
      }

      const usuario = await Usuario.findOne({
        email: email.trim().toLowerCase(),
      }).select("+senhaHash");

      // Mesma mensagem nos dois casos: não revela quais e-mails têm conta.
      if (!usuario || usuario.status !== true || !(await bcrypt.compare(senha, usuario.senhaHash))) {
        return res.status(401).json({ erro: "E-mail ou senha incorretos." });
      }

      req.session.usuarioId = usuario._id;
      req.session.perfil = usuario.perfil;

      const token = jwt.sign(
        { usuarioId: String(usuario._id), perfil: usuario.perfil },
        jwtSecret,
        { expiresIn: "2h" },
      );
      res.cookie("token", token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 2 * 60 * 60 * 1000,
      });

      return res.json({
        destino: usuario.perfil === "admin" ? "/admin" : "/perfil",
      });
    } catch {
      logger.error('api.falha');
      res.status(500).json({ erro: "Erro interno do servidor." });
    }
  });

  // ── Redefinição de senha ────────────────────────────────────────────

  const mailer = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS },
  });

  function sha256(texto) {
    return crypto.createHash("sha256").update(texto).digest("hex");
  }

  app.post("/api/esqueci-senha", async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase();
      if (!email) {
        return res.status(400).json({ mensagem: "Informe o e-mail." });
      }

      const usuario = await Usuario.findOne({ email });
      if (usuario) {
        const token = crypto.randomBytes(32).toString("hex");
        usuario.resetToken = sha256(token);
        usuario.resetExpira = new Date(Date.now() + 60 * 60 * 1000);
        await usuario.save();

        const link = `${(process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "")}/nova-senha?token=${token}`;
        await mailer.sendMail({
          from: `"Mini Stitches" <${process.env.GMAIL_USER}>`,
          to: email,
          subject: "Redefinir sua senha",
          html: `
            <p>Olá!</p>
            <p>Recebemos uma solicitação para redefinir sua senha.</p>
            <p><a href="${link}">Clique aqui para criar uma nova senha</a></p>
            <p>Este link vale por <strong>1 hora</strong>.</p>
            <p>Se não foi você, ignore este e-mail.</p>
          `,
        });
      }

      res.json({ mensagem: "Se o e-mail estiver cadastrado, enviamos um link." });
    } catch {
      logger.error('conta.recuperacao_falhou');
      res.status(500).json({ mensagem: "Erro ao processar a solicitação." });
    }
  });

  app.post("/api/nova-senha", async (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();
      const senha = String(req.body?.senha || "");

      if (!token || !senha) {
        return res.status(400).json({ mensagem: "Dados incompletos." });
      }

      if (senha.length < 8) {
        return res.status(400).json({ mensagem: "A senha deve ter ao menos 8 caracteres." });
      }

      const usuario = await Usuario.findOne({
        resetToken: sha256(token),
        resetExpira: { $gt: new Date() },
      });

      if (!usuario) {
        return res.status(400).json({ mensagem: "Link inválido ou expirado." });
      }

      usuario.senhaHash = await bcrypt.hash(senha, 10);
      usuario.resetToken = undefined;
      usuario.resetExpira = undefined;
      await usuario.save();

      res.json({ mensagem: "Senha alterada com sucesso!" });
    } catch {
      logger.error('conta.redefinicao_falhou');
      res.status(500).json({ mensagem: "Erro ao redefinir a senha." });
    }
  });

  app.post("/sair", (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    req.session.destroy((error) => {
      if (error) {
        logger.error('api.falha');
        return res
          .status(500)
          .json({ erro: "Não foi possível encerrar a sessão." });
      }

      res.json({ mensagem: "Sessão encerrada." });
    });
  });

  app.get("/sair", (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
}

module.exports = { registrarRotasAutenticacao };
