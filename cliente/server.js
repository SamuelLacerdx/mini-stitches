require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { validarCPF } = require("./backend/functions/validarCpf");
const { consultarCEP } = require("./backend/functions/validarCep");
const { criarAutenticacao } = require("./backend/functions/autenticacao");
const { criarCarrinhoHelpers } = require("./backend/functions/carrinho");
const {
  cotarFrete,
  ErroFrete,
  normalizarCEP,
} = require("./backend/functions/frete");
const {
  normalizarVideosDoKit,
  sincronizarVideosDoKitComStatus,
} = require("./backend/functions/videosKit");
const {
  Usuario,
  Plano,
  Assinatura,
  Produto,
  Carrinho,
  Pedido,
} = require("./backend/db/mongodb");
const jwt = require("jsonwebtoken");
const { MercadoPagoConfig, Payment, PreApproval } = require("mercadopago");
const app = express();
const isDirectRun = require.main === module;

const session = require("express-session");

const sessionSecret = process.env.SESSION_SECRET || "mini-stitches-secret";
const jwtSecret = process.env.JWT_SECRET || sessionSecret;
const mpPublicKey = process.env.MP_PUBLIC_KEY || "";
const mpAccessToken = process.env.MP_ACCESS_TOKEN || "";
const mpClient = mpAccessToken
  ? new MercadoPagoConfig({ accessToken: mpAccessToken })
  : null;
const paymentModule = mpClient ? new Payment(mpClient) : null;
const preApprovalModule = mpClient ? new PreApproval(mpClient) : null;

// URL publica do /api/webhook para o Mercado Pago avisar o status de PIX e
// boleto. APP_URL vence; VERCEL_URL e preenchido automaticamente em cada
// deploy da Vercel.
function obterNotificationUrl() {
  const base = String(process.env.APP_URL || "").trim();
  if (base) return `${base.replace(/\/$/, "")}/api/webhook`;
  const vercel = String(process.env.VERCEL_URL || "").trim();
  if (vercel) return `https://${vercel}/api/webhook`;
  return null;
}

console.log("[mp] notification_url:", obterNotificationUrl() || "(nao definida)");
const { autenticar, autenticarAdmin, clienteIdDoCarrinho } = criarAutenticacao({
  jwtSecret,
});
const { obterCarrinho, respostaCarrinho } = criarCarrinhoHelpers({
  Carrinho,
  clienteIdDoCarrinho,
});

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 2 * 60 * 60 * 1000,
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "10mb" }));

app.post("/api/webhook", async (req, res) => {
  try {
    const body = req.body || {};
    const eventType = String(body?.type || body?.action || "");
    const paymentId =
      body?.data?.id ?? req.query?.["data.id"] ?? req.query?.id ?? null;

    console.log("[webhook] recebido:", { eventType, paymentId });

    const deveProcessarPagamento =
      paymentId && (eventType === "payment" || eventType.includes("payment"));

    if (deveProcessarPagamento && paymentModule) {
      const pagamento = await paymentModule.get({ id: paymentId });
      console.log(
        "[webhook] pagamento atualizado:",
        paymentId,
        pagamento?.status || "status-indisponivel",
      );

      // O webhook é registrado antes do middleware que conecta ao banco.
      await conectarBanco();
      const pedido = await Pedido.findOne({ pagamentoId: String(paymentId) });
      if (pedido && pedido.status === "aguardando_pagamento") {
        if (pagamento?.status === "approved") {
          pedido.status = "pago";
          await pedido.save();
        } else if (
          ["cancelled", "rejected", "refunded", "charged_back"].includes(
            pagamento?.status,
          )
        ) {
          pedido.status = "cancelado";
          await pedido.save();
        }
      }
    }

    return res.status(200).send("OK");
  } catch (erro) {
    console.error("[webhook] erro:", erro.message || erro);
    return res.status(200).send("OK");
  }
});

// Na Vercel a função pode ser congelada entre uma requisição e outra. Se a
// conexão com o Mongo for iniciada "solta", ela fica pela metade e a instância
// passa a falhar toda consulta. Por isso a requisição aguarda a conexão, e uma
// falha libera a próxima requisição para tentar de novo.
let conexaoBanco = null;
function conectarBanco() {
  conexaoBanco ??= mongoose.connect(process.env.MONGO_URI).catch((erro) => {
    conexaoBanco = null;
    throw erro;
  });
  return conexaoBanco;
}

app.use(async (req, res, next) => {
  try {
    await conectarBanco();
    next();
  } catch (erro) {
    console.error("Erro na conexão:", erro.message);
    res.status(503).json({ erro: "Serviço indisponível. Tente novamente." });
  }
});

const CACHE_PUBLICO = "public, s-maxage=60, stale-while-revalidate=600";

function dataValida(texto) {
  const data = new Date(texto);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(texto) &&
    !Number.isNaN(data.getTime()) &&
    data.toISOString().slice(0, 10) === texto
  );
}

const sohTextos = (...valores) =>
  valores.every((valor) => typeof valor === "string");

app.get("/api/config", (_req, res) => {
  res.json({ publicKey: mpPublicKey });
});

app.post("/api/pagamento/pix", async (req, res) => {
  try {
    const { valorOriginal, email, nome, sobrenome, cpf, nomeCompleto } = req.body || {};

    if (!mpClient || !paymentModule) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Erro de configuração: MP_ACCESS_TOKEN ausente no servidor.",
      });
    }

    const nomeCompletoInformado = String(
      nomeCompleto || `${nome || ""} ${sobrenome || ""}`.trim() || "",
    ).trim();

    const camposFaltantes = [];
    if (!valorOriginal) camposFaltantes.push("valorOriginal");
    if (!email) camposFaltantes.push("email");
    if (!cpf) camposFaltantes.push("cpf");
    if (!nomeCompletoInformado) camposFaltantes.push("nomeCompleto");

    if (camposFaltantes.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Dados incompletos para PIX: ${camposFaltantes.join(", ")}.`,
      });
    }

    const valorComDesconto = Number((Number(valorOriginal) * 0.95).toFixed(2));

    const notificationUrl = obterNotificationUrl();
    const resposta = await paymentModule.create({
      body: {
        transaction_amount: valorComDesconto,
        description: "Compra via PIX (5% de desconto)",
        payment_method_id: "pix",
        payer: {
          email,
          first_name: nomeCompletoInformado.split(/\s+/).filter(Boolean)[0] || "Cliente",
          last_name:
            nomeCompletoInformado.split(/\s+/).filter(Boolean).slice(1).join(" ") || "Cliente",
          identification: {
            type: "CPF",
            number: String(cpf).replace(/\D/g, ""),
          },
        },
        ...(notificationUrl && { notification_url: notificationUrl }),
      },
    });

    return res.status(200).json({
      sucesso: true,
      id_pagamento: resposta.id,
      valor_original: valorOriginal,
      valor_com_desconto: valorComDesconto,
      qr_code_pix: resposta.point_of_interaction.transaction_data.qr_code,
      qr_code_base64:
        resposta.point_of_interaction.transaction_data.qr_code_base64,
    });
  } catch (erro) {
    console.error("Erro na geração do PIX:", erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: erro.message || "Erro ao processar o Pix.",
    });
  }
});

app.post("/api/pagamento/boleto", async (req, res) => {
  try {
    const { valorTotal, email, cpf, endereco, nomeCompleto, nome, sobrenome } = req.body || {};

    if (!mpClient || !paymentModule) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Erro de configuração: MP_ACCESS_TOKEN ausente no servidor.",
      });
    }

    const nomeCompletoInformado = String(
      nomeCompleto || `${nome || ""} ${sobrenome || ""}`.trim() || "",
    ).trim();

    const camposFaltantes = [];
    if (!valorTotal) camposFaltantes.push("valorTotal");
    if (!email) camposFaltantes.push("email");
    if (!cpf) camposFaltantes.push("cpf");
    if (!nomeCompletoInformado) camposFaltantes.push("nomeCompleto");

    if (camposFaltantes.length) {
      return res.status(400).json({
        sucesso: false,
        mensagem: `Dados incompletos para boleto: ${camposFaltantes.join(", ")}.`,
      });
    }

    const partesNome = nomeCompletoInformado.split(/\s+/).filter(Boolean);
    const primeiroNome = partesNome[0] || "Cliente";
    const ultimoNome = partesNome.slice(1).join(" ") || "Cliente";

    const enderecoLimpo = {
      cep: String(endereco?.cep || "").replace(/\D/g, "") || "00000000",
      rua: String(endereco?.rua || "").trim() || "Rua do Cliente",
      numero: String(endereco?.numero ?? "").trim() || "S/N",
      bairro: String(endereco?.bairro || "").trim() || "Centro",
      cidade: String(endereco?.cidade || "").trim() || "Cidade",
      estado: String(endereco?.estado || "").trim().toUpperCase() || "SP",
    };

    const notificationUrl = obterNotificationUrl();
    const resposta = await paymentModule.create({
      body: {
        transaction_amount: Number(valorTotal),
        description: "Compra via boleto",
        payment_method_id: "bolbradesco",
        payer: {
          email,
          first_name: primeiroNome,
          last_name: ultimoNome,
          identification: {
            type: "CPF",
            number: String(cpf).replace(/\D/g, ""),
          },
          address: {
            zip_code: enderecoLimpo.cep,
            street_name: enderecoLimpo.rua,
            street_number: enderecoLimpo.numero,
            neighborhood: enderecoLimpo.bairro,
            city: enderecoLimpo.cidade,
            federal_unit: enderecoLimpo.estado,
          },
        },
        ...(notificationUrl && { notification_url: notificationUrl }),
      },
    });

    return res.status(200).json({
      sucesso: true,
      id_pagamento: resposta.id,
      codigo_de_barras: resposta.barcode?.content || "",
      link_boleto_pdf: resposta.transaction_details?.external_resource_url || "",
      status: resposta.status,
    });
  } catch (erro) {
    console.error("Erro na geração do boleto:", erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: erro.message || "Erro ao processar o boleto.",
    });
  }
});

app.post("/api/pagamento/cartao", async (req, res) => {
  try {
    const { token, payment_method_id, valorTotal, parcelas, email, cpf } =
      req.body || {};

    if (!token || !payment_method_id || !valorTotal || !email || !cpf) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Dados do cartão incompletos.",
      });
    }

    if (!mpClient || !paymentModule) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Configuração do Mercado Pago ausente.",
      });
    }

    const notificationUrl = obterNotificationUrl();
    const resposta = await paymentModule.create({
      body: {
        token,
        payment_method_id,
        transaction_amount: Number(valorTotal),
        installments: Number(parcelas || 1),
        payer: {
          email,
          identification: {
            type: "CPF",
            number: String(cpf).replace(/\D/g, ""),
          },
        },
        ...(notificationUrl && { notification_url: notificationUrl }),
      },
    });

    return res.status(200).json({
      sucesso: true,
      id_pagamento: resposta.id,
      status: resposta.status,
      status_detail: resposta.status_detail,
      parcelas: resposta.installments,
      valor_parcela: Number(valorTotal) / Number(parcelas || 1),
      mensagem:
        resposta.status === "approved"
          ? "Pagamento aprovado."
          : "Pagamento processado.",
    });
  } catch (erro) {
    console.error("Erro no pagamento com cartão:", erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: erro.message || "Erro ao processar o cartão.",
    });
  }
});

app.post("/api/assinatura/criar", async (req, res) => {
  try {
    const body = req.body || {};
    const email = body.email || body.payer_email || "";
    const tokenCartao = body.tokenCartao || body.card_token_id || "";
    const valorMensal = Number(
      body.valorMensal ?? body.amount ?? body.transaction_amount ?? 69.9,
    );
    const tituloAssinatura =
      body.tituloAssinatura ||
      body.reason ||
      body.title ||
      "Assinatura Mini Stitches";
    const backUrl =
      body.back_url ||
      body.backUrl ||
      process.env.MP_BACK_URL ||
      "https://example.com/assinatura";

    if (!email || !tokenCartao || !mpClient || !preApprovalModule) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Dados da assinatura incompletos.",
      });
    }

    const valorFinal = Number.isFinite(valorMensal) ? valorMensal : 69.9;

    const resposta = await preApprovalModule.create({
      body: {
        reason: tituloAssinatura,
        auto_recurring: {
          frequency: 1,
          frequency_type: "months",
          transaction_amount: valorFinal,
          currency_id: "BRL",
        },
        payer_email: email,
        back_url: backUrl,
        card_token_id: tokenCartao,
      },
    });

    return res.status(200).json({
      sucesso: true,
      id_assinatura: resposta.id,
      status: resposta.status,
      init_point: resposta.init_point,
    });
  } catch (erro) {
    console.error("Erro na criação da assinatura:", erro);
    return res.status(500).json({
      sucesso: false,
      mensagem: erro.message || "Erro ao criar a assinatura.",
    });
  }
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
    res.redirect("/login");
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
    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
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
        perfil: usuario.perfil || "cliente",
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

    const item = {
      slug,
      tipo,
      nome,
      preco,
      estoque,
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
  } catch (error) {
    console.error(error);
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao atualizar o produto." });
  }
});

app.get("/admin/estoque", autenticarAdmin, async (req, res) => {
  try {
    const produtos = await Produto.find().lean();

    res.json({ produtos });
  } catch (error) {
    console.error(error);
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao excluir o produto." });
  }
});

app.get("/api/produtos", async (req, res) => {
  try {
    const { tipo } = req.query;
    const filtro = { ativo: true };

    if (tipo && ["kit", "material"].includes(String(tipo).toLowerCase())) {
      filtro.tipo = String(tipo).toLowerCase();
    }

    const produtos = await Produto.find(filtro).sort({ nome: 1 }).lean();
    res.set("Cache-Control", CACHE_PUBLICO).json({ produtos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar produtos." });
  }
});

app.get("/api/produto/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    const produto = await Produto.findOne({ slug, ativo: true }).lean();
    if (!produto) {
      return res.status(404).json({ erro: "Produto não encontrado." });
    }

    res.set("Cache-Control", CACHE_PUBLICO).json({ produto });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar produto." });
  }
});

app.post("/admin/assinaturas", autenticarAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const nome = String(body.nome || "").trim();
    const preco = Number(body.preco);
    const duracao = Number(body.duracao);
    const tipo = String(body.tipo || "mensal").toLowerCase();
    const ativo = body.ativo !== undefined ? Boolean(body.ativo) : true;

    if (!nome) {
      return res.status(400).json({ erro: "Informe o nome da assinatura." });
    }
    if (!Number.isInteger(preco) || preco < 0) {
      return res
        .status(400)
        .json({ erro: "O preço deve ser um número inteiro em centavos." });
    }
    if (!Number.isInteger(duracao) || duracao <= 0) {
      return res
        .status(400)
        .json({ erro: "A duração deve ser um número inteiro positivo." });
    }
    if (!["diaria", "semanal", "mensal", "anual"].includes(tipo)) {
      return res.status(400).json({ erro: "Tipo de assinatura inválido." });
    }

    const assinaturaExistente = await Assinatura.findOne({ nome });
    if (assinaturaExistente) {
      await Assinatura.updateOne(
        { nome },
        { $set: { preco, duracao, tipo, ativo } },
      );
      return res.json({
        assinatura: {
          ...assinaturaExistente.toObject(),
          preco,
          duracao,
          tipo,
          ativo,
        },
      });
    }

    const novaAssinatura = await Assinatura.create({
      nome,
      preco,
      duracao,
      tipo,
      ativo,
    });
    res.status(201).json({ assinatura: novaAssinatura });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao salvar a assinatura." });
  }
});

app.get("/admin/assinaturas", autenticarAdmin, async (req, res) => {
  try {
    const assinaturas = await Assinatura.find()
      .sort({ assinadoEm: -1 })
      .populate("clienteId", "nome email")
      .lean();

    res.json({ assinaturas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar assinaturas." });
  }
});

app.delete("/admin/assinaturas/:id", autenticarAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ erro: "ID inválido." });
    }

    const assinatura = await Assinatura.findById(id);
    if (!assinatura) {
      return res.status(404).json({ erro: "Assinatura não encontrada." });
    }

    await Assinatura.deleteOne({ _id: id });

    res.json({ mensagem: "Assinatura excluída com sucesso." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao excluir assinatura." });
  }
});

app.post("/admin/planos", autenticarAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const nome = String(body.nome || "").trim();
    const valor = Number(body.valor);
    const tipo = String(body.tipo || "mensal").toLowerCase();
    const ativo = body.ativo !== undefined ? Boolean(body.ativo) : true;

    if (!nome) {
      return res.status(400).json({ erro: "Informe o nome do plano." });
    }
    if (!Number.isInteger(valor) || valor < 0) {
      return res
        .status(400)
        .json({ erro: "O valor deve ser um número inteiro em centavos." });
    }
    if (!["diaria", "semanal", "mensal", "anual"].includes(tipo)) {
      return res.status(400).json({ erro: "Tipo de plano inválido." });
    }

    const planoExistente = await Plano.findOne({ nome });
    if (planoExistente) {
      await Plano.updateOne({ nome }, { $set: { valor, tipo, ativo } });
      return res.json({
        plano: { ...planoExistente.toObject(), valor, tipo, ativo },
      });
    }

    const novoPlano = await Plano.create({ nome, valor, tipo, ativo });
    res.status(201).json({ plano: novoPlano });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao salvar o plano." });
  }
});

app.get("/admin/planos", autenticarAdmin, async (req, res) => {
  try {
    const planos = await Plano.find().lean();

    res.json({ planos });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar planos." });
  }
});

app.delete("/admin/planos/:id", autenticarAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ erro: "ID inválido." });
    }

    const plano = await Plano.findById(id);
    if (!plano) {
      return res.status(404).json({ erro: "Plano não encontrado." });
    }

    await Plano.deleteOne({ _id: id });

    res.json({ mensagem: "Plano excluído com sucesso." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao excluir plano." });
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar produto." });
  }
});

app.get("/assinatura/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const assinatura = await Assinatura.findById(id).lean();
    if (!assinatura) {
      return res.status(404).json({ erro: "Assinatura não encontrada." });
    }

    res.json({ assinatura });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar assinatura." });
  }
});

app.get("/api/carrinho", async (req, res) => {
  try {
    const carrinho = await obterCarrinho(req);
    res.json(await respostaCarrinho(carrinho));
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Não foi possível carregar o carrinho." });
  }
});

app.post("/api/frete", async (req, res) => {
  try {
    const cep = normalizarCEP(req.body?.cep);
    if (!cep) {
      return res.status(400).json({ erro: "CEP inválido." });
    }

    const pedidoNumero = String(req.body?.pedidoNumero || "").trim();
    let itensValidos;

    if (pedidoNumero) {
      const clienteId = req.session?.usuarioId;
      if (!clienteId) {
        return res.status(401).json({ erro: "Autenticação necessária." });
      }
      const pedido = await Pedido.findOne({
        numero: pedidoNumero,
        clienteId,
      }).populate("itens.produtoId", "nome preco ativo slug");
      if (!pedido) {
        return res.status(404).json({ erro: "Pedido não encontrado." });
      }
      itensValidos = (pedido.itens || []).filter((item) => {
        if (!item || !item.produtoId) return false;
        return item.produtoId.ativo !== false;
      });
    } else {
      const carrinho = await obterCarrinho(req);
      await carrinho.populate("itens.produtoId", "nome preco ativo slug");
      itensValidos = (carrinho.itens || []).filter((item) => {
        if (!item || !item.produtoId) return false;
        return item.produtoId.ativo !== false;
      });
    }

    if (!itensValidos.length) {
      return res.status(400).json({ erro: "Seu carrinho está vazio." });
    }

    const opcoes = await cotarFrete({
      cepDestino: cep,
      itens: itensValidos,
    });

    return res.json({
      cep,
      opcoes: opcoes.map((opcao) => ({
        servicoId: opcao.servicoId,
        servico: opcao.servico,
        transportadora: opcao.transportadora,
        logo: opcao.logo,
        preco: opcao.preco,
        prazoMin: opcao.prazoMin,
        prazoMax: opcao.prazoMax,
      })),
    });
  } catch (error) {
    console.error("[api/frete] erro:", error?.message || error);

    if (error instanceof ErroFrete) {
      return res.status(error.status).json({ erro: error.message });
    }

    return res.status(500).json({ erro: "Não foi possível calcular o frete." });
  }
});

function respostaPedido(pedido) {
  return {
    numero: pedido.numero,
    criadoEm: pedido.criadoEm,
    status: pedido.status,
    pagamento: pedido.pagamento,
    subtotal: pedido.subtotal,
    frete: pedido.frete,
    desconto: pedido.desconto || 0,
    total: pedido.total,
    rastreio: pedido.rastreio || "",
    itens: (pedido.itens || []).map((item) => ({
      nome: item.nome,
      slug: item.slug,
      quantidade: item.quantidade,
      precoUnit: item.precoUnit,
    })),
  };
}

// Registra o pedido depois que o pagamento foi criado no Mercado Pago.
// Itens e preços vêm do carrinho no servidor; status, forma de pagamento e
// valor pago vêm do próprio Mercado Pago, nunca do navegador.
app.post("/api/pedidos", async (req, res) => {
  try {
    const { pagamentoId, freteCentavos, cliente, entrega } = req.body || {};
    const idPagamento = String(pagamentoId || "").trim();
    const frete = Number(freteCentavos);
    const nome = String(cliente?.nome || "").trim();
    const email = String(cliente?.email || "")
      .trim()
      .toLowerCase();
    const cep = normalizarCEP(entrega?.cep);
    const endereco = String(entrega?.endereco || "").trim();
    const pedidoNumero = String(req.body?.pedidoNumero || "").trim();

    if (
      !/^\d+$/.test(idPagamento) ||
      !Number.isSafeInteger(frete) ||
      frete < 0 ||
      !nome ||
      !email.includes("@") ||
      !cep ||
      !endereco
    ) {
      return res.status(400).json({ erro: "Dados do pedido incompletos." });
    }

    if (!paymentModule) {
      return res.status(503).json({ erro: "Pagamentos indisponíveis." });
    }

    // Repetir a chamada (duplo clique, nova tentativa) devolve o mesmo pedido.
    const existente = await Pedido.findOne({ pagamentoId: idPagamento });
    if (existente) {
      return res.json({ pedido: respostaPedido(existente) });
    }

    // Finalização de pedido pendente: reusa os itens do pedido existente em
    // vez do carrinho (que já foi esvaziado na primeira tentativa).
    let pedidoPendente = null;
    let itens;
    if (pedidoNumero) {
      const clienteSessao = req.session?.usuarioId;
      if (!clienteSessao) {
        return res.status(401).json({ erro: "Autenticação necessária." });
      }
      pedidoPendente = await Pedido.findOne({
        numero: pedidoNumero,
        clienteId: clienteSessao,
      });
      if (!pedidoPendente) {
        return res.status(404).json({ erro: "Pedido não encontrado." });
      }
      if (pedidoPendente.status !== "aguardando_pagamento") {
        return res.status(400).json({ erro: "Pedido já foi pago." });
      }
      itens = pedidoPendente.itens.map((item) => ({
        produtoId: item.produtoId,
        slug: item.slug,
        nome: item.nome,
        quantidade: item.quantidade,
        precoUnit: item.precoUnit,
      }));
    } else {
      const carrinho = await obterCarrinho(req);
      await carrinho.populate("itens.produtoId", "nome preco ativo slug");
      itens = carrinho.itens
        .filter((item) => item.produtoId && item.produtoId.ativo !== false)
        .map((item) => ({
          produtoId: item.produtoId._id,
          slug: item.produtoId.slug,
          nome: item.produtoId.nome,
          quantidade: item.quantidade,
          precoUnit: item.produtoId.preco,
        }));
    }

    if (!itens.length) {
      return res.status(400).json({ erro: "Seu carrinho está vazio." });
    }

    let pagamentoMP;
    try {
      pagamentoMP = await paymentModule.get({ id: idPagamento });
    } catch (erro) {
      console.error("[api/pedidos] pagamento não encontrado:", erro?.message);
      return res.status(400).json({ erro: "Pagamento não encontrado." });
    }

    const statusPorPagamento = {
      approved: "pago",
      pending: "aguardando_pagamento",
      in_process: "aguardando_pagamento",
      authorized: "aguardando_pagamento",
    };
    const status = statusPorPagamento[pagamentoMP?.status];
    if (!status) {
      return res.status(400).json({ erro: "Pagamento não aprovado." });
    }

    const pagamento =
      pagamentoMP.payment_method_id === "pix"
        ? "pix"
        : pagamentoMP.payment_type_id === "ticket"
          ? "boleto"
          : "cartao";

    const subtotal = itens.reduce(
      (soma, item) => soma + item.quantidade * item.precoUnit,
      0,
    );
    const valorCheio = subtotal + frete;
    const valorPago = Math.round(Number(pagamentoMP.transaction_amount) * 100);
    const valorEsperado =
      pagamento === "pix" ? Math.round(valorCheio * 0.95) : valorCheio;

    // Tolerância de 1 centavo para arredondamentos do desconto.
    if (
      !Number.isFinite(valorPago) ||
      Math.abs(valorPago - valorEsperado) > 1
    ) {
      console.error("[api/pedidos] valor pago não confere:", {
        idPagamento,
        valorPago,
        valorEsperado,
      });
      return res
        .status(400)
        .json({ erro: "O valor pago não confere com o pedido." });
    }

    const total = pagamento === "pix" ? valorPago : valorCheio;
    const clienteId = clienteIdDoCarrinho(req);

    let pedido;
    if (pedidoPendente) {
      pedidoPendente.pagamento = pagamento;
      pedidoPendente.pagamentoId = idPagamento;
      pedidoPendente.subtotal = subtotal;
      pedidoPendente.frete = frete;
      pedidoPendente.desconto = valorCheio - total;
      pedidoPendente.total = total;
      pedidoPendente.status = status;
      pedidoPendente.cliente = { nome, email };
      pedidoPendente.entrega = { cep, endereco };
      try {
        pedido = await pedidoPendente.save();
      } catch (erro) {
        if (erro?.code !== 11000) throw erro;
        pedido = await Pedido.findOne({ pagamentoId: idPagamento });
        if (!pedido) throw erro;
        return res.json({ pedido: respostaPedido(pedido) });
      }
      return res.json({ pedido: respostaPedido(pedido) });
    }

    try {
      pedido = await Pedido.create({
        clienteId: clienteId || null,
        pagamento,
        pagamentoId: idPagamento,
        subtotal,
        frete,
        desconto: valorCheio - total,
        total,
        status,
        cliente: { nome, email },
        entrega: { cep, endereco },
        itens,
      });
    } catch (erro) {
      if (erro?.code !== 11000) throw erro;
      pedido = await Pedido.findOne({ pagamentoId: idPagamento });
      if (!pedido) throw erro;
      return res.json({ pedido: respostaPedido(pedido) });
    }

    const carrinho = await obterCarrinho(req);
    carrinho.itens = [];
    await carrinho.save();

    return res.status(201).json({ pedido: respostaPedido(pedido) });
  } catch (error) {
    console.error("[api/pedidos] erro:", error?.message || error);
    return res
      .status(500)
      .json({ erro: "Não foi possível registrar o pedido." });
  }
});

app.get("/api/pedidos", autenticar, async (req, res) => {
  try {
    const pedidos = await Pedido.find({ clienteId: req.session.usuarioId })
      .sort({ criadoEm: -1 })
      .limit(50)
      .lean();
    res.json({ pedidos: pedidos.map(respostaPedido) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Não foi possível carregar os pedidos." });
  }
});

// Pedidos que contam como faturamento: o pagamento já foi aprovado.
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
  };
}

app.get("/admin/dashboard", autenticarAdmin, async (req, res) => {
  try {
    const [porStatus, assinantesAtivos, ultimosPedidos] = await Promise.all([
      Pedido.aggregate([
        {
          $group: {
            _id: "$status",
            quantidade: { $sum: 1 },
            total: { $sum: "$total" },
          },
        },
      ]),
      Assinatura.countDocuments({ canceladoEm: null }),
      Pedido.find().sort({ criadoEm: -1 }).limit(5).lean(),
    ]);

    const statusPedidos = Object.fromEntries(
      STATUS_PEDIDO_ADMIN.map((status) => [status, 0]),
    );
    let totalPedidos = 0;
    let faturado = 0;
    let pedidosFaturados = 0;

    for (const grupo of porStatus) {
      statusPedidos[grupo._id] = grupo.quantidade;
      totalPedidos += grupo.quantidade;
      if (STATUS_FATURADOS.includes(grupo._id)) {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao carregar o painel." });
  }
});

app.get("/admin/pedidos", autenticarAdmin, async (req, res) => {
  try {
    const filtro = {};
    const status = String(req.query.status || "");
    if (STATUS_PEDIDO_ADMIN.includes(status)) filtro.status = status;

    const pedidos = await Pedido.find(filtro)
      .sort({ criadoEm: -1 })
      .limit(200)
      .lean();
    res.json({ pedidos: pedidos.map(respostaPedidoAdmin) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao listar pedidos." });
  }
});

app.patch("/admin/pedidos/:id/status", autenticarAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const status = String(req.body?.status || "");
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ erro: "ID inválido." });
    }
    if (!STATUS_PEDIDO_ADMIN.includes(status)) {
      return res.status(400).json({ erro: "Status inválido." });
    }

    const pedido = await Pedido.findById(id);
    if (!pedido) {
      return res.status(404).json({ erro: "Pedido não encontrado." });
    }

    pedido.status = status;
    if (req.body?.rastreio !== undefined) {
      pedido.rastreio = String(req.body.rastreio || "").trim();
    }
    await pedido.save();
    res.json({ pedido: respostaPedidoAdmin(pedido.toObject()) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao atualizar o pedido." });
  }
});

app.post("/api/carrinho", async (req, res) => {
  try {
    const slug = String(req.body?.slug || "").trim();
    const quantidade = Number(req.body?.quantidade ?? 1);

    if (!slug || !Number.isSafeInteger(quantidade) || quantidade < 1) {
      return res.status(400).json({ erro: "Produto ou quantidade inválida." });
    }

    const produto = await Produto.findOne({ slug, ativo: true }).lean();
    if (!produto) {
      return res.status(404).json({ erro: "Produto não encontrado." });
    }

    const carrinho = await obterCarrinho(req);
    const item = carrinho.itens.find(
      (itemCarrinho) => String(itemCarrinho.produtoId) === String(produto._id),
    );

    if (item) {
      item.quantidade += quantidade;
    } else {
      carrinho.itens.push({
        produtoId: produto._id,
        slug: produto.slug,
        quantidade,
      });
    }

    await carrinho.save();
    res.status(200).json(await respostaCarrinho(carrinho));
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Não foi possível adicionar ao carrinho." });
  }
});

app.patch("/api/carrinho/:produtoId", async (req, res) => {
  try {
    const { produtoId } = req.params;
    const quantidade = Number(req.body?.quantidade);
    if (
      !mongoose.isValidObjectId(produtoId) ||
      !Number.isSafeInteger(quantidade) ||
      quantidade < 1
    ) {
      return res.status(400).json({ erro: "Produto ou quantidade inválida." });
    }

    const carrinho = await obterCarrinho(req);
    const item = carrinho.itens.find(
      (itemCarrinho) => String(itemCarrinho.produtoId) === produtoId,
    );
    if (!item) {
      return res.status(404).json({ erro: "Item não encontrado no carrinho." });
    }

    item.quantidade = quantidade;
    await carrinho.save();
    res.json(await respostaCarrinho(carrinho));
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Não foi possível atualizar o carrinho." });
  }
});

app.delete("/api/carrinho/:produtoId", async (req, res) => {
  try {
    const { produtoId } = req.params;
    if (!mongoose.isValidObjectId(produtoId)) {
      return res.status(400).json({ erro: "Produto inválido." });
    }

    const carrinho = await obterCarrinho(req);
    carrinho.itens = carrinho.itens.filter(
      (item) => String(item.produtoId) !== produtoId,
    );
    await carrinho.save();
    res.json(await respostaCarrinho(carrinho));
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Não foi possível remover o item." });
  }
});

app.get("/plano/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const plano = await Plano.findById(id).lean();
    if (!plano) {
      return res.status(404).json({ erro: "Plano não encontrado." });
    }

    res.json({ plano });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: "Erro ao buscar plano." });
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
      console.error(error);
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

app.use((req, res) => {
  res.status(404).send("Página não encontrada.");
});

app.use((error, req, res, next) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({
      erro: "O arquivo enviado é muito grande. Reduza a imagem e tente novamente.",
    });
  }

  next(error);
});

// Local (node server.js): conecta antes de abrir a porta. Na Vercel quem
// conecta é o middleware acima, dentro de cada requisição.
async function iniciar() {
  try {
    await conectarBanco();

    console.log("MongoDB conectado!");

    await Usuario.init();

    app.listen(4000, () => {
      console.log("Abra http://localhost:4000");
    });
  } catch (erro) {
    console.error("Erro na conexão:", erro.message);
  }
}

if (isDirectRun) {
  iniciar();
}

module.exports = app;