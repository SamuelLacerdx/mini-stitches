const mongoose = require("mongoose");

const enderecoSchema = new mongoose.Schema({
  apelido: { type: String, trim: true },
  rua: { type: String, trim: true },
  numero: { type: String, trim: true },
  bairro: { type: String, trim: true },
  cidade: { type: String, trim: true },
  estado: { type: String, uppercase: true, trim: true },
  cep: { type: String, trim: true },
  complemento: { type: String, trim: true, default: "" },
  principal: { type: Boolean, default: false },
});

const cartaoSchema = new mongoose.Schema({
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
});

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

  enderecos: { type: [enderecoSchema], default: [] },
  cartoes: { type: [cartaoSchema], default: [] },
});

const planoSchema = new mongoose.Schema({
  nome: { type: String, required: true, enum: ["mensal", "trimestral"] },
  valor: { type: Number, enum: [8990, 24000] },
});

const assinaturaSchema = new mongoose.Schema({
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
    index: true,
  },
  plano: { type: planoSchema, required: true },
  assinadoEm: { type: Date, required: true, default: Date.now },
  statusCaixa: {
    type: String,
    enum: ["preparando", "enviada", "entregue"],
    default: "preparando",
  },
  canceladoEm: { type: Date, default: null },
});

const inteiro = {
  validator: Number.isInteger,
  message: "{PATH} deve ser um número inteiro (centavos).",
};

const tutorialSchema = new mongoose.Schema({
  titulo: { type: String, required: true, trim: true },
  duracaoMin: { type: Number, min: 0, validate: inteiro },
  amostra: { type: String, trim: true },
  url: { type: String, required: true, trim: true },
  ordem: { type: Number, required: true, validate: inteiro },
  ativo: { type: Boolean, required: true, default: true },
});

const videoKitSchema = new mongoose.Schema(
  {
    titulo: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    ordem: { type: Number, min: 1, default: 1, validate: inteiro },
    ativo: { type: Boolean, default: true },
  },
  { _id: false },
);

const kitSchema = new mongoose.Schema(
  {
    nomeChamada: { type: String, trim: true },
    nivel: { type: String, trim: true },
    faixaEtaria: { type: String, trim: true },
    tempoEstimado: { type: String, trim: true },
    destaque: { type: Boolean, default: false },
    descricao: { type: [String], default: [] },
    caixa: { type: [String], default: [] },
    videos: { type: [videoKitSchema], default: [] },
    tutoriais: { type: [tutorialSchema], default: [] },
  },
  { _id: false },
);

const materialSchema = new mongoose.Schema(
  {
    descricao: { type: String, trim: true },
    categoria: { type: String, trim: true },
  },
  { _id: false },
);

const produtoSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  },
  tipo: { type: String, required: true, enum: ["kit", "material"] },
  nome: { type: String, required: true, trim: true },

  preco: { type: Number, required: true, min: 0, validate: inteiro },

  estoque: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    validate: inteiro,
  },
  imagemUrl: { type: String, trim: true },
  ativo: { type: Boolean, required: true, default: true },

  // só quando tipo = kit
  kit: {
    type: kitSchema,
    required: function () {
      return this.tipo === "kit";
    },
  },

  // só quando tipo = material
  material: {
    type: materialSchema,
    required: function () {
      return this.tipo === "material";
    },
  },
});

// Garante que o subdocumento do outro tipo não fique salvo
produtoSchema.pre("validate", function () {
  if (this.tipo === "kit") this.material = undefined;
  if (this.tipo === "material") this.kit = undefined;
});

// slug já é indexado pelo unique: true
produtoSchema.index({ tipo: 1, ativo: 1 });
produtoSchema.index(
  { nome: "text", "kit.nomeChamada": "text" },
  { default_language: "portuguese" },
);

/* ------------------------------------------------------------------ */
/* Contador (gera MS-1001, MS-1002… sem repetir, mesmo em paralelo)    */
/* ------------------------------------------------------------------ */

const contadorSchema = new mongoose.Schema({
  _id: { type: String }, // ex.: "pedido"
  seq: { type: Number, default: 0 },
});

const NUMERO_PEDIDO_INICIAL = 1001;

// $inc atômico: dois pedidos simultâneos nunca recebem o mesmo número
async function proximoNumeroPedido() {
  const c = await Contador.findOneAndUpdate(
    { _id: "pedido" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return `MS-${NUMERO_PEDIDO_INICIAL - 1 + c.seq}`;
}

/* ------------------------------------------------------------------ */
/* Pedido                                                              */
/* ------------------------------------------------------------------ */

const STATUS_PEDIDO = [
  "aguardando_pagamento",
  "pago",
  "em_separacao",
  "enviado",
  "entregue",
  "cancelado",
];

// Cópia do produto no momento da compra: mudar o preço depois
// não altera pedidos antigos.
const itemPedidoSchema = new mongoose.Schema({
  produtoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Produto",
    required: true,
  },
  slug: { type: String, required: true, trim: true },
  nome: { type: String, required: true, trim: true },
  quantidade: { type: Number, required: true, min: 1, validate: inteiro },
  precoUnit: { type: Number, required: true, min: 0, validate: inteiro },
});

const historicoStatusSchema = new mongoose.Schema(
  {
    status: { type: String, required: true, enum: STATUS_PEDIDO },
    em: { type: Date, required: true, default: Date.now },
  },
  { _id: false },
);

const pedidoSchema = new mongoose.Schema({
  numero: { type: String, unique: true, trim: true }, // MS-1001

  // null = compra como convidado
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    default: null,
  },
  criadoEm: { type: Date, default: Date.now },

  pagamento: {
    type: String,
    required: true,
    enum: ["pix", "cartao", "boleto"],
  },

  subtotal: { type: Number, required: true, min: 0, validate: inteiro },
  frete: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
    validate: inteiro,
  },
  total: { type: Number, required: true, min: 0, validate: inteiro },

  status: {
    type: String,
    required: true,
    enum: STATUS_PEDIDO,
    default: "aguardando_pagamento",
  },
  rastreio: { type: String, trim: true },

  // cópia dos dados do cliente na hora da compra
  cliente: {
    nome: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },

  entrega: {
    cep: { type: String, required: true, trim: true },
    endereco: { type: String, required: true, trim: true },
  },

  itens: {
    type: [itemPedidoSchema],
    validate: {
      validator: (v) => Array.isArray(v) && v.length > 0,
      message: "O pedido precisa ter ao menos um item.",
    },
  },

  historicoStatus: { type: [historicoStatusSchema], default: [] },
});

pedidoSchema.pre("validate", async function () {
  try {
    if (this.isNew && !this.numero) {
      this.numero = await proximoNumeroPedido();
    }

    const soma = this.itens.reduce((s, i) => s + i.quantidade * i.precoUnit, 0);
    if (this.subtotal !== soma) {
      throw new Error("subtotal não confere com a soma dos itens.");
    }
    if (this.total !== this.subtotal + this.frete) {
      throw new Error("total deve ser subtotal + frete.");
    }
  } catch (err) {
    throw err;
  }
});

// O histórico é registrado só no save (depois de validar), então chamar
// validate() antes de save() não duplica o status inicial.
pedidoSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("status")) {
    const ultimo = this.historicoStatus[this.historicoStatus.length - 1];
    if (!ultimo || ultimo.status !== this.status) {
      this.historicoStatus.push({ status: this.status, em: new Date() });
    }
  }
  next();
});

// numero já é indexado pelo unique: true
pedidoSchema.index({ "cliente.email": 1 });
pedidoSchema.index({ clienteId: 1, criadoEm: -1 });

const trocaSchema = new mongoose.Schema({
  pedidoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Pedido",
    required: true,
  },
  numeroPedido: { type: String, required: true, trim: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  tipo: { type: String, required: true, enum: ["troca", "devolucao"] },
  motivo: { type: String, required: true, trim: true },
  status: {
    type: String,
    required: true,
    enum: ["em_analise", "aprovada", "recusada"],
    default: "em_analise",
  },
  criadoEm: { type: Date, default: Date.now },
});

trocaSchema.index({ pedidoId: 1 });
trocaSchema.index({ email: 1, criadoEm: -1 });

const itemCarrinhoSchema = new mongoose.Schema({
  produtoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Produto",
    required: true,
  },
  slug: { type: String, required: true, trim: true },
  quantidade: { type: Number, required: true, min: 1, validate: inteiro },
});

const carrinhoSchema = new mongoose.Schema({
  // null = visitante anônimo (identificado só pelo sessaoId)
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    default: null,
  },
  sessaoId: { type: String, trim: true },
  atualizadoEm: { type: Date, default: Date.now },
  itens: { type: [itemCarrinhoSchema], default: [] },
});

carrinhoSchema.pre("save", function (next) {
  this.atualizadoEm = new Date();
  next();
});

carrinhoSchema.index({ clienteId: 1 });
carrinhoSchema.index({ sessaoId: 1 });
// TTL: carrinho abandonado expira em 30 dias
carrinhoSchema.index(
  { atualizadoEm: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

const Usuario = mongoose.model("Usuario", usuarioSchema);
const Plano = mongoose.model("Plano", planoSchema);
const Assinatura = mongoose.model("Assinatura", assinaturaSchema);
const Produto = mongoose.model("Produto", produtoSchema);
const Contador = mongoose.model("Contador", contadorSchema);
const Pedido = mongoose.model("Pedido", pedidoSchema);
const Troca = mongoose.model("Troca", trocaSchema);
const Carrinho = mongoose.model("Carrinho", carrinhoSchema);

module.exports = {
  Usuario,
  Plano,
  Assinatura,
  Produto,
  Contador,
  Pedido,
  Troca,
  Carrinho,
};
