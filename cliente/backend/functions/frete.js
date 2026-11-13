class ErroFrete extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.name = "ErroFrete";
    this.status = status;
  }
}

function normalizarCEP(cep) {
  const cepLimpo = String(cep ?? "").replace(/\D/g, "");
  return /^\d{8}$/.test(cepLimpo) ? cepLimpo : null;
}

function lerNumeroEnv(chave) {
  const valor = Number(process.env[chave]);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

function obterConfig() {
  const token = String(process.env.MELHOR_ENVIO_TOKEN || "").trim();
  const contato = String(process.env.MELHOR_ENVIO_CONTATO || "").trim();
  const cepOrigem = normalizarCEP(process.env.CEP_ORIGEM);
  const sandbox =
    String(process.env.MELHOR_ENVIO_SANDBOX || "").trim() === "true";

  const pesoKg = lerNumeroEnv("FRETE_PESO_KG");
  const alturaCm = lerNumeroEnv("FRETE_ALTURA_CM");
  const larguraCm = lerNumeroEnv("FRETE_LARGURA_CM");
  const comprimentoCm = lerNumeroEnv("FRETE_COMPRIMENTO_CM");

  if (
    !token ||
    !contato ||
    !cepOrigem ||
    !pesoKg ||
    !alturaCm ||
    !larguraCm ||
    !comprimentoCm
  ) {
    throw new ErroFrete(503, "Cálculo de frete indisponível no momento.");
  }

  return {
    token,
    contato,
    cepOrigem,
    baseUrl: sandbox
      ? "https://sandbox.melhorenvio.com.br"
      : "https://melhorenvio.com.br",
    pesoKg,
    alturaCm: Math.ceil(alturaCm),
    larguraCm: Math.ceil(larguraCm),
    comprimentoCm: Math.ceil(comprimentoCm),
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

// O Melhor Envio devolve o prazo como número (`delivery_time`) e a faixa como
// objeto `{ min, max }` (`delivery_range`); as versões `custom_*` já incluem os
// dias extras configurados na conta e têm prioridade.
function lerPrazo(servico) {
  const prazoUnico = valorParaPrazo(
    servico.custom_delivery_time ?? servico.delivery_time,
  );
  const faixa = servico.custom_delivery_range ?? servico.delivery_range;

  if (faixa && typeof faixa === "object") {
    const min = valorParaPrazo(faixa.min ?? faixa[0]) ?? prazoUnico;
    const max = valorParaPrazo(faixa.max ?? faixa[1]) ?? prazoUnico ?? min;
    return { prazoMin: min, prazoMax: max };
  }

  return {
    prazoMin: prazoUnico,
    prazoMax: valorParaPrazo(faixa) ?? prazoUnico,
  };
}

function normalizarOpcao(servico) {
  if (!servico || servico.error) {
    return null;
  }

  const preco = valorParaCentavos(servico.custom_price ?? servico.price);
  const { prazoMin, prazoMax } = lerPrazo(servico);

  if (preco === null || prazoMin === null) {
    return null;
  }

  // Na API real `company` é um objeto `{ name, picture }`.
  const empresa = servico.company;

  return {
    servicoId: Number(servico.id ?? servico.service_id ?? servico.code ?? 0),
    servico: String(servico.name || servico.service || "Serviço"),
    transportadora: String(empresa?.name || empresa || "Transportadora"),
    logo: String(empresa?.picture || ""),
    preco,
    prazoMin,
    prazoMax: Math.max(prazoMax ?? prazoMin, prazoMin),
  };
}

// Cotações iguais (mesmo CEP e mesmos itens) são reaproveitadas por alguns
// minutos para não chamar a API externa a cada clique.
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRADAS = 200;
const cacheCotacoes = new Map();

function lerCache(chave) {
  const entrada = cacheCotacoes.get(chave);
  if (!entrada) return null;
  if (entrada.expiraEm <= Date.now()) {
    cacheCotacoes.delete(chave);
    return null;
  }
  return entrada.opcoes;
}

function salvarCache(chave, opcoes) {
  if (cacheCotacoes.size >= CACHE_MAX_ENTRADAS) {
    cacheCotacoes.delete(cacheCotacoes.keys().next().value);
  }
  cacheCotacoes.set(chave, { opcoes, expiraEm: Date.now() + CACHE_TTL_MS });
}

function limparCacheFrete() {
  cacheCotacoes.clear();
}

async function chamarMelhorEnvio(config, payload) {
  try {
    return await fetch(`${config.baseUrl}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
        "User-Agent": `MiniStitches (${config.contato})`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (erro) {
    console.error("[frete] falha ao contatar o Melhor Envio:", erro?.message);
    if (erro?.name === "TimeoutError" || erro?.name === "AbortError") {
      throw new ErroFrete(
        504,
        "O cálculo do frete demorou demais. Tente novamente.",
      );
    }
    throw new ErroFrete(502, "Não foi possível calcular o frete neste momento.");
  }
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
    .filter((item) => item?.produtoId?._id)
    .map((item) => {
      const quantidade = Math.floor(Number(item.quantidade));
      const precoCentavos = Number(item.produtoId.preco);

      return {
        id: String(item.produtoId._id),
        width: config.larguraCm,
        height: config.alturaCm,
        length: config.comprimentoCm,
        weight: Number(config.pesoKg.toFixed(3)),
        // Valor declarado de UMA unidade: o Melhor Envio multiplica pela
        // quantidade ao calcular o seguro.
        insurance_value: Number((precoCentavos / 100).toFixed(2)),
        quantity: quantidade,
      };
    })
    .filter(
      (item) =>
        Number.isInteger(item.quantity) &&
        item.quantity > 0 &&
        Number.isFinite(item.insurance_value) &&
        item.insurance_value >= 0,
    );

  if (itensParaEnvio.length === 0) {
    throw new ErroFrete(400, "Seu carrinho está vazio.");
  }

  const payload = {
    from: { postal_code: config.cepOrigem },
    to: { postal_code: cep },
    products: itensParaEnvio,
    options: { receipt: false, own_hand: false },
  };

  const servicosPermitidos = String(process.env.FRETE_SERVICOS || "").trim();
  if (servicosPermitidos) {
    payload.services = servicosPermitidos;
  }

  const chaveCache = JSON.stringify([config.baseUrl, payload]);
  const emCache = lerCache(chaveCache);
  if (emCache) {
    return emCache;
  }

  const resposta = await chamarMelhorEnvio(config, payload);

  const texto = await resposta.text();
  let corpo = null;
  try {
    corpo = JSON.parse(texto);
  } catch {
    // Resposta não-JSON (ex.: página de erro do proxy) é tratada abaixo.
  }

  if (!resposta.ok) {
    console.error("[frete] resposta inesperada do Melhor Envio:", {
      status: resposta.status,
      body: corpo || texto.slice(0, 500),
    });

    if (resposta.status === 422) {
      throw new ErroFrete(
        400,
        "Não foi possível calcular o frete para este CEP.",
      );
    }
    if ([401, 403].includes(resposta.status)) {
      console.error(
        "[frete] token recusado: confira MELHOR_ENVIO_TOKEN e MELHOR_ENVIO_SANDBOX.",
      );
    }
    throw new ErroFrete(502, "Não foi possível calcular o frete neste momento.");
  }

  const servicos = Array.isArray(corpo) ? corpo : [];
  const opcoes = servicos
    .map(normalizarOpcao)
    .filter(Boolean)
    .sort((a, b) => a.preco - b.preco || a.prazoMin - b.prazoMin);

  if (opcoes.length === 0) {
    throw new ErroFrete(404, "Nenhuma transportadora atende ao CEP informado.");
  }

  salvarCache(chaveCache, opcoes);
  return opcoes;
}

module.exports = {
  ErroFrete,
  cotarFrete,
  limparCacheFrete,
  normalizarCEP,
};
