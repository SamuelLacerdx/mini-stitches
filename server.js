require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const console = require("console");
const { validarCPF } = require("./backend/functions/validarCpf");
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

// Tabela Cliente
const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  cpf: { type: String, required: true, unique: true },
  telefone: { type: String, required: true, trim: true },
  nascimento: { type: Date, required: true },
  email: { type: String, required: true, unique: true },
  senhaHash: { type: String, required: true, select: false },
  perfil: { type: String, enum: ["cliente", "admin"], default: "cliente" },
  status: { type: Boolean, required: true, default: true },
  criadoEm: { type: Date, default: Date.now },

  endereco: {
    rua: String,
    numero: String,
    cidade: String,
    estado: String,
    cep: String,
    complemento: String,
  },

  cartao: {
    titular: String,
    finalCartao: { type: String, minLength: 4, maxLength: 4 },
    validade: String,
    bandeira: {
      type: String,
      enum: ["visa", "master", "elo", "amex", "hipercard", "diners"],
    },
    tokenGateway: { type: String, select: false },
    status: { type: Boolean },
    criadoEm: { type: Date },
  },
});

// Planos (Ajustar para admin modificar valores)
const planoSchema = new mongoose.Schema({
  nome: { type: String, required: true, enum: ["mensal", "trimestral"] },
  valor: { type: Number, enum: [8990, 24000] },
});

// Assinatura
const assinaturaSchema = new mongoose.Schema({
  plano: { type: planoSchema, required: true },
  assinadoEm: { type: Date, required: true, default: Date.now },
  statusCaixa: {
    type: String,
    enum: ["preparando", "enviada", "entregue"],
    default: "preparando",
  },
  canceladoEm: { type: Date, default: null },
});

const Usuario = mongoose.model("Usuario", usuarioSchema);
const Plano = mongoose.model("Plano", planoSchema);
const Assinatura = mongoose.model("Assinatura", assinaturaSchema);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/cadastrar", async (req, res) => {
  try {
    const { nome, cpf, telefone, nascimento, email, senha } = req.body;

    if (!senha || senha.length < 8) {
      return res
        .status(400)
        .json({ erro: "A senha deve ter ao menos 8 caracteres." });
    }

    if (!validarCPF(cpf)) {
      return res.status(400).json({ erro: "CPF inválido." });
    }

    const cpfLimpo = cpf.replace(/\D/g, "");
    const emailNormalizado = email.trim().toLowerCase();
    const senhaHash = await bcrypt.hash(senha, 10);

    await Usuario.create({
      nome,
      cpf: cpfLimpo,
      telefone,
      nascimento,
      email: emailNormalizado,
      senhaHash,
    });
    res.status(201).json({ mensagem: "Cadastro realizado com sucesso." });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ erro: "Este e-mail já está cadastrado." });
    }

    console.error(err);
    res.status(500).json({ erro: "Erro interno do servidor." });
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
      return res.json({
        mensagem: "Login de admin realizado com sucesso.",
      });
    }

    res.redirect("/perfil-pagina");
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: "Erro interno do servidor." });
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
