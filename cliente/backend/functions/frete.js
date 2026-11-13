class ErroFrete extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = "ErroFrete";
    this.status = status;
  }
}

const PADRAO = {
  pesoKg: 0.5,
  alturaCm: 8,
  larguraCm: 20,
  comprimentoCm: 25,
};

function normalizarCEP(cep) {
  const cepLimpo = String(cep ?? "").replace(/\D/g, "");
  return /^\d{8}$/.test(cepLimpo) ? cepLimpo : null;
}

function lerNumeroEnv(chave, padrao) {
  const valor = Number(process.env[chave]);
  return Number.isFinite(valor) && valor > 0 ? valor : padrao;
}

function obterConfig() {
  const token = String(process.env.MELHOR_ENVIO_TOKEN || "").trim();
  const contato = String(process.env.MELHOR_ENVIO_CONTATO || "").trim();
  const cepOrigem = normalizarCEP(process.env.CEP_ORIGEM);
  const sandbox =
    String(process.env.MELHOR_ENVIO_SANDBOX || "").trim() === "true";

  if (!token || !contato || !cepOrigem) {
    throw new ErroFrete(503, "Cálculo de frete indisponível no momento.");
  }

  return {
    token,
    contato,
    cepOrigem,
    baseUrl: sandbox
      ? "https://sandbox.melhorenvio.com.br"
      : "https://melhorenvio.com.br",
    pesoKg: lerNumeroEnv("FRETE_PESO_KG", PADRAO.pesoKg),
    alturaCm: Math.ceil(lerNumeroEnv("FRETE_ALTURA_CM", PADRAO.alturaCm)),
    larguraCm: Math.ceil(lerNumeroEnv("FRETE_LARGURA_CM", PADRAO.larguraCm)),
    comprimentoCm: Math.ceil(
      lerNumeroEnv("FRETE_COMPRIMENTO_CM", PADRAO.comprimentoCm),
    ),
  };
}

function valorParaCentavos(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return null;
  }
  return Math.max(0, Math.round(numero * 100));
}

function valorParaPrazo(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) {
    return null;
  }
  return Math.max(0, Math.ceil(numero));
}

function lerRangePrazo(servico) {
  const entrega = servico?.custom_delivery_range ?? servico?.delivery_range;
  if (Array.isArray(entrega)) {
    return {
      min: Number(
        entrega[0] ??
          entrega[1] ??
          servico?.custom_delivery_time ??
          servico?.delivery_time,
      ),
      max: Number(
        entrega[1] ??
          entrega[0] ??
          servico?.custom_delivery_time ??
          servico?.delivery_time,
      ),
    };
  }

  if (entrega && typeof entrega === "object") {
    return {
      min: Number(
        entrega.min ??
          entrega.from ??
          servico?.custom_delivery_time ??
          servico?.delivery_time,
      ),
      max: Number(
        entrega.max ??
          entrega.to ??
          servico?.custom_delivery_time ??
          servico?.delivery_time,
      ),
    };
  }

  return {
    min: Number(servico?.custom_delivery_time ?? servico?.delivery_time),
    max: Number(servico?.custom_delivery_range ?? servico?.delivery_range),
  };
}

function normalizarOpcao(servico) {
  if (!servico || servico.error) {
    return null;
  }

  const preco = valorParaCentavos(
    servico.custom_price ?? servico.price ?? servico?.amount ?? 0,
  );
  const range = lerRangePrazo(servico);
  const prazoMin = valorParaPrazo(
    range.min ?? servico.custom_delivery_time ?? servico.delivery_time,
  );
  const prazoMax = valorParaPrazo(
    range.max ?? servico.custom_delivery_range ?? servico.delivery_range,
  );

  if (preco === null || prazoMin === null) {
    return null;
  }

  return {
    servicoId: Number(servico.id ?? servico.service_id ?? servico.code ?? 0),
    servico: String(servico.name || servico.service || "Serviço"),
    transportadora: String(
      servico.company ||
        servico.company_name ||
        servico.transportadora ||
        "Transportadora",
    ),
    logo: String(servico.logo || servico.company_logo || ""),
    preco,
    prazoMin,
    prazoMax: prazoMax ?? prazoMin,
  };
}

async function cotarFrete({ cepDestino, itens }) {
  const cep = normalizarCEP(cepDestino);
  if (!cep) {
    throw new ErroFrete(400, "CEP inválido.");
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    throw new ErroFrete(400, "Seu carrinho está vazio.");
  }

  const config = obterConfig();
  const itensParaEnvio = itens
    .filter((item) => item && item.produtoId && item.produtoId._id)
    .map((item) => {
      const quantidade = Number(item.quantidade || 0);
      const precoOriginal = Number(item.produtoId.preco || 0);
      const valorSeguro = Number(
        ((precoOriginal * Math.max(quantidade, 0)) / 100).toFixed(2),
      );

      return {
        id: String(item.produtoId._id),
        width: config.larguraCm,
        height: config.alturaCm,
        length: config.comprimentoCm,
        weight: Number(config.pesoKg.toFixed(3)),
        insurance_value: valorSeguro,
        quantity: Math.max(1, Math.floor(quantidade)),
      };
    })
    .filter((item) => Number.isFinite(item.insurance_value));

  if (itensParaEnvio.length === 0) {
    throw new ErroFrete(400, "Seu carrinho está vazio.");
  }

  const payload = {
    from: { postal_code: config.cepOrigem },
    to: { postal_code: cep },
    products: itensParaEnvio,
    options: { receipt: false, own_hand: false },
  };

  if (process.env.FRETE_SERVICOS) {
    payload.services = String(process.env.FRETE_SERVICOS).trim();
  }

  const resposta = await fetch(
    `${config.baseUrl}/api/v2/me/shipment/calculate`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
        "User-Agent": `MiniStitches (${config.contato})`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    },
  );

  const texto = await resposta.text();
  let corpo;
  try {
    corpo = JSON.parse(texto);
  } catch (erro) {
    corpo = null;
  }

  if (!resposta.ok) {
    console.error("[frete] resposta inesperada do Melhor Envio:", {
      status: resposta.status,
      body: corpo || texto,
    });

    if (resposta.status === 422) {
      throw new ErroFrete(
        400,
        "Não foi possível calcular o frete para este CEP.",
      );
    }
    if ([401, 403].includes(resposta.status)) {
      throw new ErroFrete(
        502,
        "Não foi possível calcular o frete neste momento.",
      );
    }
    throw new ErroFrete(
      502,
      "Não foi possível calcular o frete neste momento.",
    );
  }

  const servicos = Array.isArray(corpo) ? corpo : [];
  const opcoes = servicos
    .map(normalizarOpcao)
    .filter(Boolean)
    .sort((a, b) => a.preco - b.preco || a.prazoMin - b.prazoMin);

  if (opcoes.length === 0) {
    throw new ErroFrete(404, "Nenhuma transportadora atende ao CEP informado.");
  }

  return opcoes;
}

module.exports = {
  ErroFrete,
  cotarFrete,
  normalizarCEP,
};
