require("dotenv").config();

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const app = express();

app.use(express.static(path.join(__dirname, "public")));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Tabela Cliente
const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  cpf: { type: String, required: true, unique: true },
  numero: { type: String, required: true, trim: true },
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
    bandeira: {type: String, enum: ["visa", "master", "elo", "amex", "hipercard", "diners"]},
    cvv: Number,
    tokenGateway: { type: String, required: true, select: false },
    status: { type: Boolean, required: true, default: true },
    criadoEm: { type: Date, default: Date.now },
  },
});

// Planos (Ajustar para admin modificar valores)
const planoSchema = new mongoose.Schema({
  nome: {type: String, required: true, enum: ["mensal", "trimestral" ]},
  valor: { type: Number, enum:[ 8990, 24000 ]},
})

// Assinatura
const assinaturaSchema = new mongoose.Schema({
  plano: { type: planoSchema, required: true},
  assinadoEm: {  type: Date, required: true, default: Date.now},
  statusCaixa: { type: String, enum: ["preparando", "enviada", "entregue"], default: "preparando"},
  canceladoEm: {  type: Date, default: null },
})

const Usuario = mongoose.model("Usuario", usuarioSchema);
const Plano = mongoose.model("Plano", planoSchema);
const Assinatura = mongoose.model("Assinatura", assinaturaSchema);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

async function iniciar() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB conectado!");

    await Usuario.init();
    await Plano.init();
    await Assinatura.init();

    app.listen(4000, () => {
      console.log("Abra http://localhost:4000");
    });
  } catch (erro) {
    console.error("Erro na conexão:", erro.message);
  }
}

iniciar();
