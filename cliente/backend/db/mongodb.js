const mongoose = require("mongoose");
const { FINANCEIROS, LOGISTICOS } = require("../functions/estadosPedido");
const { PLANO_CLUBE } = require("../functions/assinaturaClube");

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

  resetToken: { type: String },
  resetExpira: { type: Date },

  enderecos: { type: [enderecoSchema], default: [] },
  cartoes: { type: [cartaoSchema], default: [] },
});

const planoSchema = new mongoose.Schema({
  codigo: { type: String },
  titulo: { type: String },
  nome: { type: String, required: true, enum: ["mensal", "trimestral"] },
  valor: { type: Number, enum: [PLANO_CLUBE.valor, 8990, 24000] },
});

const assinaturaSchema = new mongoose.Schema({
  chaveTentativa: { type: String, maxlength: 80 },
  solicitadoEm: { type: Date, default: Date.now },
  aceiteEm: { type: Date },
  preapprovalId: { type: String },
  statusProvedor: { type: String },
  versaoConciliacao: { type: Number, default: 0 },
  primeiraFaturaId: String,
  primeiraCompetencia: String,
  diaCobrancaOriginal: { type: Number, min: 1, max: 31 },
  statusAdesao: { type: String, enum: ["iniciando", "resultado_desconhecido", "aguardando_pagamento", "ativa", "cancelada"] },
  frete: { type: Number, min: 0, default: 0 },
  enderecoOrigemId: { type: mongoose.Schema.Types.ObjectId },
  entrega: { rua: String, numero: String, complemento: String, bairro: String, cidade: String, estado: String, cep: String },
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Usuario",
    required: true,
    index: true,
  },
  plano: { type: planoSchema, required: true },
  assinadoEm: { type: Date },
  statusCaixa: {
    type: String,
    enum: ["aguardando_pagamento", "preparando", "enviada", "entregue"],
    default: "aguardando_pagamento",
  },
  canceladoEm: { type: Date, default: null },
  cancelamentoEstado: { type: String, enum: ['pendente', 'confirmado'] },
  cancelamentoConfirmadoEm: Date,
});

assinaturaSchema.index({ clienteId: 1, chaveTentativa: 1 }, { unique: true,
  partialFilterExpression: { chaveTentativa: { $type: "string" } } });
assinaturaSchema.index({ preapprovalId: 1 }, { unique: true, sparse: true });
assinaturaSchema.pre("validate", function () {
  if (this.isNew && (this.plano?.codigo !== PLANO_CLUBE.codigo || this.plano?.nome !== PLANO_CLUBE.tipo ||
    this.plano?.valor !== PLANO_CLUBE.valor || this.frete !== PLANO_CLUBE.frete)) {
    throw new Error("Novas assinaturas devem usar o plano mensal SUB-02 de 9490 centavos com entrega incluída.");
  }
});

const inteiro = {
  validator: Number.isInteger,
  message: "{PATH} deve ser um número inteiro (centavos).",
};

const mensalidadeClubeSchema = new mongoose.Schema({
  _id: { type: String },
  assinaturaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assinatura', required: true, index: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  preapprovalId: { type: String, required: true },
  pagamentoId: String,
  tentativasAnteriores: [{ pagamentoId: String, statusFinanceiro: { type: String, enum: FINANCEIROS }, provedorAtualizadoEm: Date }],
  valor: { type: Number, required: true, enum: [PLANO_CLUBE.valor], validate: inteiro },
  statusFinanceiro: { type: String, required: true, enum: FINANCEIROS },
  valorReembolsado: { type: Number, min: 0, validate: inteiro },
  aprovadoEm: Date,
  recebidoEm: { type: Date, required: true },
  provedorAtualizadoEm: { type: Date, required: true },
  vencimentoProvedor: { type: Date, required: true },
  vencimentoContratual: String,
  cobrancaDivergente: { type: Boolean, default: false },
  competencia: { type: String, match: /^20\d{2}-(0[1-9]|1[0-2])$/ },
  sequencia: { type: Number, min: 0, validate: inteiro },
});
mensalidadeClubeSchema.index({ pagamentoId: 1 }, { unique: true, sparse: true });
mensalidadeClubeSchema.index({ assinaturaId: 1, competencia: 1 }, { unique: true,
  partialFilterExpression: { competencia: { $type: 'string' } } });

const calendarioClubeSchema = new mongoose.Schema({
  _id: { type: String, match: /^20\d{2}-(0[1-9]|1[0-2])$/ },
  postagemPrevista: { type: String, required: true },
  confirmadoPor: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  confirmadoEm: { type: Date, required: true },
});

const caixaClubeSchema = new mongoose.Schema({
  assinaturaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assinatura', required: true, index: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  mensalidadeId: { type: String, required: true, unique: true },
  pagamentoId: { type: String, required: true, unique: true },
  competencia: { type: String, required: true, match: /^20\d{2}-(0[1-9]|1[0-2])$/ },
  lote: { type: String, required: true, match: /^20\d{2}-(0[1-9]|1[0-2])$/ },
  aprovadoEm: { type: Date, required: true },
  statusFinanceiro: { type: String, required: true, enum: FINANCEIROS },
  valorReembolsado: { type: Number, min: 0, validate: inteiro },
  bloqueada: { type: Boolean, required: true, default: true },
  bloqueadaParaReembolso: { type: Boolean, default: false },
  reembolsoEstado: { type: String, enum: ['solicitado', 'concluido'] },
  reembolsoSolicitadoEm: Date,
  entrega: { rua: String, numero: String, complemento: String, bairro: String, cidade: String, estado: String, cep: String },
  postagemPrevista: String,
  statusPreparacao: { type: String, enum: ['aguardando', 'preparando', 'enviada', 'entregue'], default: 'aguardando' },
  rastreio: String,
  ocorrencias: [{ motivo: String, novaPrevisao: String, registradoEm: Date, clienteInformadoEm: Date }],
});
caixaClubeSchema.index({ assinaturaId: 1, competencia: 1 }, { unique: true });

const operacaoClubeSchema = new mongoose.Schema({
  _id: { type: String },
  tipo: { type: String, enum: ['cancelar_assinatura', 'cancelar_pagamento', 'reembolsar_pagamento'], required: true },
  assinaturaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assinatura', required: true, index: true },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  pagamentoId: String,
  chaveIdempotencia: { type: String, required: true },
  estado: { type: String, enum: ['pendente', 'processando', 'aguardando_provedor', 'concluida'], required: true },
  identificadoEm: { type: Date, required: true },
  limiteSolicitacaoEm: Date,
  proximaExecucaoEm: Date,
  lockToken: String,
  lockAte: Date,
  tentativas: { type: Number, default: 0, min: 0, validate: inteiro },
  valorSolicitado: { type: Number, min: 1, max: PLANO_CLUBE.valor, validate: inteiro },
  solicitadoEm: Date,
  reembolsoId: String,
  finalizadoEm: Date,
});
operacaoClubeSchema.index({ estado: 1, proximaExecucaoEm: 1 });

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
  estoqueSeguranca: {
    type: Number,
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

// Registro anterior à chamada externa. Não armazena payload do gateway,
// token de cartão, CPF, número de cartão ou CVV.
const tentativaPagamentoSchema = new mongoose.Schema({
  cotacaoId: { type: String },
  enderecoConfirmado: { type: String, maxlength: 1000 },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: "Usuario", required: true, index: true },
  metodo: { type: String, enum: ["pix", "boleto", "cartao"], required: true },
  chaveTentativa: { type: String, maxlength: 80 },
  hashRequisicao: { type: String },
  itens: {
    type: [itemPedidoSchema],
    required: true,
    validate: { validator: (itens) => itens.length > 0, message: "A tentativa precisa ter itens." },
  },
  subtotal: { type: Number, required: true, min: 0, validate: inteiro },
  frete: { type: Number, required: true, min: 0, validate: inteiro },
  desconto: { type: Number, required: true, min: 0, validate: inteiro },
  total: { type: Number, required: true, min: 1, validate: inteiro },
  parcelas: { type: Number, required: true, min: 1, max: 6, validate: inteiro },
  cep: { type: String, required: true, match: /^\d{8}$/ },
  servicoId: { type: Number, min: 0, validate: inteiro },
  estado: {
    type: String,
    enum: ["registrada", "resposta_recebida", "resultado_desconhecido", "nao_cobrada"],
    default: "registrada",
    required: true,
  },
  pagamentoId: { type: String },
  statusProvedor: { type: String, maxlength: 80 },
  statusFinanceiro: { type: String, enum: FINANCEIROS },
  valorReembolsado: { type: Number, min: 0, default: 0, validate: inteiro },
  provedorAtualizadoEm: { type: Date },
  aprovadoEm: { type: Date },
  ultimaNotificacaoEm: { type: Date },
  respostaGateway: { type: mongoose.Schema.Types.Mixed, select: false },
  estoqueEstado: {
    type: String, enum: ["nao_reservado", "reservado", "liberado"], default: "nao_reservado",
  },
}, { timestamps: { createdAt: "criadoEm", updatedAt: "atualizadoEm" } });

tentativaPagamentoSchema.index({ clienteId: 1, chaveTentativa: 1 }, {
  unique: true,
  partialFilterExpression: { chaveTentativa: { $type: "string" } },
});
tentativaPagamentoSchema.index({ cotacaoId: 1 }, { unique: true,
  partialFilterExpression: { cotacaoId: { $type: 'string' } } });

tentativaPagamentoSchema.pre("validate", function () {
  const subtotal = this.itens.reduce((soma, item) => soma + item.precoUnit * item.quantidade, 0);
  if (!Number.isSafeInteger(subtotal) || this.subtotal !== subtotal ||
    !Number.isSafeInteger(this.total) || this.total !== this.subtotal + this.frete - this.desconto) {
    throw new Error("Os valores da tentativa não conferem com os itens.");
  }
});

const pedidoSchema = new mongoose.Schema({
  statusFinanceiro: { type: String, enum: FINANCEIROS },
  statusLogistico: { type: String, enum: LOGISTICOS },
  valorReembolsado: { type: Number, min: 0, default: 0, validate: inteiro },
  historicoFinanceiro: [{
    status: { type: String, enum: FINANCEIROS, required: true },
    valorReembolsado: { type: Number, min: 0, default: 0, validate: inteiro },
    em: { type: Date, required: true },
  }],
  historicoLogistico: [{
    status: { type: String, enum: LOGISTICOS, required: true },
    em: { type: Date, required: true },
  }],
  pagamentoAtualizadoEm: { type: Date },
  pagamentoAprovadoEm: { type: Date },
  tentativaId: { type: mongoose.Schema.Types.ObjectId, ref: "TentativaPagamento" },
  estoqueRestituido: { type: Boolean, default: false },
  estoqueRestituicaoPendente: { type: Boolean, default: false },
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
  // ex.: 5% do Pix. total = subtotal + frete - desconto
  desconto: { type: Number, min: 0, default: 0, validate: inteiro },
  total: { type: Number, required: true, min: 0, validate: inteiro },

  // id do pagamento no Mercado Pago: liga o webhook ao pedido
  pagamentoId: { type: String, trim: true },

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
  if (this.isNew && !this.numero) {
    this.numero = await proximoNumeroPedido();
  }

  const soma = this.itens.reduce((s, i) => s + i.quantidade * i.precoUnit, 0);
  if (this.subtotal !== soma) {
    throw new Error("subtotal não confere com a soma dos itens.");
  }
  if (this.total !== this.subtotal + this.frete - (this.desconto || 0)) {
    throw new Error("total deve ser subtotal + frete - desconto.");
  }
});

// O histórico é registrado só no save (depois de validar), então chamar
// validate() antes de save() não duplica o status inicial.
// Mongoose 9 não passa mais `next` para hooks "pre": basta retornar.
pedidoSchema.pre("save", function () {
  if (this.statusFinanceiro && (this.isNew || this.isModified("statusFinanceiro") || this.isModified("valorReembolsado"))) {
    this.historicoFinanceiro.push({ status: this.statusFinanceiro, valorReembolsado: this.valorReembolsado,
      em: (this.statusFinanceiro === "aprovado" && this.pagamentoAprovadoEm) || this.pagamentoAtualizadoEm || new Date() });
  }
  if (this.statusLogistico && (this.isNew || this.isModified("statusLogistico"))) {
    this.historicoLogistico.push({ status: this.statusLogistico, em: new Date() });
  }
  if (this.isNew || this.isModified("status")) {
    const ultimo = this.historicoStatus[this.historicoStatus.length - 1];
    if (!ultimo || ultimo.status !== this.status) {
      this.historicoStatus.push({ status: this.status, em: new Date() });
    }
  }
});

// numero já é indexado pelo unique: true
pedidoSchema.index({ "cliente.email": 1 });
pedidoSchema.index({ clienteId: 1, criadoEm: -1 });
// sparse: pedidos antigos sem pagamentoId não entram no índice único
pedidoSchema.index({ pagamentoId: 1 }, { unique: true, sparse: true });

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

carrinhoSchema.pre("save", function () {
  this.atualizadoEm = new Date();
});

carrinhoSchema.index({ clienteId: 1 });
carrinhoSchema.index({ sessaoId: 1 });
// TTL: carrinho abandonado expira em 30 dias
carrinhoSchema.index(
  { atualizadoEm: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

const Usuario = mongoose.model("Usuario", usuarioSchema);
const notificacaoPagamentoSchema = new mongoose.Schema({
  _id: { type: String },
  pagamentoId: { type: String, required: true, index: true },
  statusProvedor: { type: String, required: true },
  statusFinanceiro: { type: String, enum: FINANCEIROS },
  valorReembolsado: { type: Number, min: 0, validate: inteiro },
  provedorAtualizadoEm: { type: Date, required: true },
  aprovadoEm: { type: Date },
  recebidoEm: { type: Date, required: true },
  requestId: { type: String, required: true },
});
const NotificacaoPagamento = mongoose.model("NotificacaoPagamento", notificacaoPagamentoSchema);
const Plano = mongoose.model("Plano", planoSchema);
const Assinatura = mongoose.model("Assinatura", assinaturaSchema);
const MensalidadeClube = mongoose.model('MensalidadeClube', mensalidadeClubeSchema);
const CaixaClube = mongoose.model('CaixaClube', caixaClubeSchema);
const CalendarioClube = mongoose.model('CalendarioClube', calendarioClubeSchema);
const OperacaoClube = mongoose.model('OperacaoClube', operacaoClubeSchema);
const Produto = mongoose.model("Produto", produtoSchema);
const Contador = mongoose.model("Contador", contadorSchema);
const Pedido = mongoose.model("Pedido", pedidoSchema);
const TentativaPagamento = mongoose.model("TentativaPagamento", tentativaPagamentoSchema);
const Troca = mongoose.model("Troca", trocaSchema);
const Carrinho = mongoose.model("Carrinho", carrinhoSchema);

module.exports = {
  Usuario,
  Plano,
  Assinatura,
  MensalidadeClube,
  CaixaClube,
  CalendarioClube,
  OperacaoClube,
  Produto,
  Contador,
  Pedido,
  TentativaPagamento,
  NotificacaoPagamento,
  Troca,
  Carrinho,
};
