require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const console = require("console");
const { validarCPF } = require("./backend/functions/validarCpf");
const { consultarCEP } = require("./backend/functions/validarCep");
const { Usuario, Plano, Assinatura } = require("./backend/db/mongodb");
const jwt = require("jsonwebtoken");
const app = express();

const session = require("express-session");

const sessionSecret = process.env.SESSION_SECRET || "mini-stitches-secret";

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 2 * 60 * 60 * 1000 }, // 2h
  }),
);

function autenticar(req, res, next) {
  if (!req.session.usuarioId) {
    return res.status(401).json({ erro: "Faça login para continuar." });
  }
  next();
}

app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/api/cep/:cep", async (req, res) => {
  const cep = req.params.cep.replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep)) {
    return res.status(400).json({ erro: "Informe um CEP válido." });
  }

  try {
    const endereco = await consultarCEP(cep);
    if (!endereco) {
      return res.status(404).json({ erro: "CEP não encontrado." });
    }

    res.json({ endereco });
  } catch (error) {
    console.error(error);
    res
      .status(502)
      .json({ erro: "Não foi possível consultar o CEP. Tente novamente." });
  }
});

app.post("/cadastro", async (req, res) => {
  try {
    const { nome, cpf, telefone, nascimento, email, senha } = req.body || {};

    if (senha.length < 8) {
      return res.status(400).send("A senha deve ter ao menos 8 caracteres.");
    }

    const dataNascimento = new Date(nascimento);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(nascimento) ||
      Number.isNaN(dataNascimento.getTime()) ||
      dataNascimento.toISOString().slice(0, 10) !== nascimento
    ) {
      return res.status(400).send("Data de nascimento inválida.");
    }

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
    res.redirect("/Perfil");
  } catch (err) {
    if (err.code === 11000) {
      const campoDuplicado = Object.keys(err.keyPattern || {})[0];
      const mensagem =
        campoDuplicado === "cpf"
          ? "Este CPF já está cadastrado."
          : "Este e-mail já está cadastrado.";
      return res.status(409).send(mensagem);
    }

    console.error(err);
    res.status(500).send("Erro interno do servidor.");
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    const usuario = await Usuario.findOne({
      email: email.trim().toLowerCase(),
    }).select("+senhaHash");

    if (!usuario) {
      return res.status(401).json({ erro: "Usuário não encontrado." });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaCorreta) {
      return res.status(401).json({ erro: "Senha incorreta." });
    }

    req.session.usuarioId = usuario._id;
    req.session.perfil = usuario.perfil;

    if (usuario.perfil === "admin") {
      return res.redirect("/Admin");
    }

    return res.redirect("/Perfil");
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro interno do servidor." });
  }
});

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
        nascimento: usuario.nascimento
          ? usuario.nascimento.toISOString().slice(0, 10)
          : "",
        enderecos: usuario.enderecos,
        cartao: usuario.cartao || {},
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao carregar perfil." });
  }
});

app.patch("/perfil/atualizar", autenticar, async (req, res) => {
  try {
    const { telefone, email, nascimento } = req.body;
    const atualizacoes = {};

    atualizacoes.email = email.trim().toLowerCase();
    atualizacoes.telefone = telefone.trim();

    const dataNascimento = new Date(nascimento);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(nascimento) ||
      Number.isNaN(dataNascimento.getTime()) ||
      dataNascimento.toISOString().slice(0, 10) !== nascimento
    ) {
      return res.status(400).send("Data de nascimento inválida.");
    }

    atualizacoes.nascimento = dataNascimento;

    if (Object.keys(atualizacoes).length === 0) {
      return res.status(400).send("Nenhum dado para atualizar.");
    }

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

    console.error(err);
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
      return res.status(400).json({ erro: "Informe se o endereço é principal." });
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
  } catch (error) {
    console.error(error);
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
    } catch (error) {
      console.error(error);
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao excluir o endereço." });
  }
});

async function iniciar() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB conectado!");

    await Usuario.init();

    app.listen(4000, () => {
      console.log("Abra http://localhost:4000");
    });
  } catch (erro) {
    console.error("Erro na conexão:", erro.message);
  }
}

iniciar();
