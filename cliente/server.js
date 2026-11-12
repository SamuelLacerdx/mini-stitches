require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { validarCPF } = require("./backend/functions/validarCpf");
const { consultarCEP } = require("./backend/functions/validarCep");
const { criarAutenticacao } = require("./backend/functions/autenticacao");
const { criarCarrinhoHelpers } = require("./backend/functions/carrinho");
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
      body?.data?.id ??
      req.query?.["data.id"] ??
      req.query?.id ??
      null;

    const deveProcessarPagamento =
      paymentId &&
      (eventType === "payment" || eventType.includes("payment"));

    if (deveProcessarPagamento && paymentModule) {
      const pagamento = await paymentModule.get({ id: paymentId });
      console.log(
        "[webhook] pagamento atualizado:",
        paymentId,
        pagamento?.status || "status-indisponivel",
      );
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
    const { valorOriginal, email, nome, sobrenome, cpf } = req.body || {};

    if (!valorOriginal || !email || !cpf || !mpClient || !paymentModule) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Configuração do Mercado Pago ausente ou dados incompletos.",
      });
    }

    const valorComDesconto = Number((Number(valorOriginal) * 0.95).toFixed(2));

    const resposta = await paymentModule.create({
      body: {
        transaction_amount: valorComDesconto,
        description: "Compra via PIX (5% de desconto)",
        payment_method_id: "pix",
        payer: {
          email,
          first_name: nome || "Cliente",
          last_name: sobrenome || "",
          identification: { type: "CPF", number: String(cpf).replace(/\D/g, "") },
        },
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
    const { valorTotal, email, cpf, endereco } = req.body || {};
    if (!valorTotal || !email || !cpf || !mpClient || !paymentModule) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Configuração do Mercado Pago ausente ou dados incompletos.",
      });
    }

    const resposta = await paymentModule.create({
      body: {
        transaction_amount: Number(valorTotal),
        description: "Compra via boleto",
        payment_method_id: "bolbradesco",
        payer: {
          email,
          identification: { type: "CPF", number: String(cpf).replace(/\D/g, "") },
          address: {
            zip_code: String(endereco?.cep || "").replace(/\D/g, ""),
            street_name: String(endereco?.rua || ""),
            street_number: String(endereco?.numero || ""),
            neighborhood: String(endereco?.bairro || ""),
            city: String(endereco?.cidade || ""),
            federal_unit: String(endereco?.estado || ""),
          },
        },
      },
    });

    const pdf = resposta.transaction_details?.financial_institution || "";
    return res.status(200).json({
      sucesso: true,
      id_pagamento: resposta.id,
      codigo_de_barras: resposta.barcode || "",
      link_boleto_pdf: resposta.transaction_details?.url || "",
      status: resposta.status,
      pdf,
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

    const resposta = await paymentModule.create({
      body: {
        token,
        payment_method_id,
        transaction_amount: Number(valorTotal),
        installments: Number(parcelas || 1),
        payer: {
          email,
          identification: { type: "CPF", number: String(cpf).replace(/\D/g, "") },
        },
      },
    });

    return res.status(200).json({
      sucesso: true,
      id_pagamento: resposta.id,
      status: resposta.status,
      status_detail: resposta.status_detail,
      parcelas: resposta.installments,
      valor_parcela: Number(valorTotal) / Number(parcelas || 1),
      mensagem: resposta.status === "approved" ? "Pagamento aprovado." : "Pagamento processado.",
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
      body.tituloAssinatura || body.reason || body.title || "Assinatura Mini Stitches";
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
    const assinaturas = await Assinatura.find().lean();

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
