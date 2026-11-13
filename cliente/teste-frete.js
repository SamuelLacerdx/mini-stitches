const assert = require("node:assert/strict");
const { cotarFrete, ErroFrete } = require("./backend/functions/frete");

function montarFetchSucesso({ status = 200, payload = [] } = {}) {
  return async function fetchMock(url, options) {
    assert.equal(url.includes("/api/v2/me/shipment/calculate"), true);
    assert.equal(options.method, "POST");
    assert.equal(options.headers.Accept, "application/json");
    assert.equal(options.headers["Content-Type"], "application/json");
    assert.match(options.headers.Authorization, /^Bearer /);
    assert.match(options.headers["User-Agent"], /^MiniStitches \(/);

    const body = JSON.parse(options.body);
    assert.equal(body.from.postal_code, "01000000");
    assert.equal(body.to.postal_code, "01018020");
    assert.equal(body.products[0].width, 20);
    assert.equal(body.products[0].height, 8);
    assert.equal(body.products[0].length, 25);
    assert.equal(body.products[0].weight, 0.5);
    assert.equal(body.products[0].quantity, 2);
    assert.equal(body.products[0].insurance_value, 179.8);

    return {
      ok: status >= 200 && status < 300,
      status,
      async text() {
        return JSON.stringify(payload);
      },
    };
  };
}

(async () => {
  global.fetch = montarFetchSucesso({
    payload: [
      {
        id: 1,
        name: "PAC",
        company: "Correios",
        price: 42.5,
        custom_price: 42.5,
        delivery_time: 6,
        custom_delivery_time: 6,
        delivery_range: 7,
        custom_delivery_range: 7,
      },
      {
        id: 2,
        name: "SEDEX",
        company: "Correios",
        price: 50.1,
        custom_price: 50.1,
        delivery_time: 3,
        custom_delivery_time: 3,
        delivery_range: 4,
        custom_delivery_range: 4,
      },
      { error: "servico indisponivel" },
    ],
  });

  process.env.MELHOR_ENVIO_TOKEN = "token-teste";
  process.env.MELHOR_ENVIO_CONTATO = "teste@mini-stitches.com.br";
  process.env.CEP_ORIGEM = "01000-000";
  process.env.MELHOR_ENVIO_SANDBOX = "true";
  process.env.FRETE_SERVICOS = "1,2,17";
  process.env.FRETE_PESO_KG = "0.5";
  process.env.FRETE_ALTURA_CM = "8";
  process.env.FRETE_LARGURA_CM = "20";
  process.env.FRETE_COMPRIMENTO_CM = "25";

  const opcoes = await cotarFrete({
    cepDestino: "01018-020",
    itens: [
      {
        quantidade: 2,
        produtoId: { _id: "64a4f2ae9d66b89f7301a4d1", preco: 8990 },
      },
    ],
  });

  assert.equal(opcoes[0].servico, "PAC");
  assert.equal(opcoes[0].preco, 4250);
  assert.equal(opcoes[1].prazoMin, 3);
  assert.equal(opcoes.length, 2);

  global.fetch = async () => ({
    ok: false,
    status: 422,
    async text() {
      return JSON.stringify({ erro: "CEP inválido" });
    },
  });

  await assert.rejects(
    () =>
      cotarFrete({
        cepDestino: "12345678",
        itens: [{ quantidade: 1, produtoId: { _id: "abc", preco: 5000 } }],
      }),
    (erro) => erro instanceof ErroFrete && erro.status === 400,
  );

  global.fetch = async () => ({
    ok: false,
    status: 401,
    async text() {
      return JSON.stringify({ erro: "unauthorized" });
    },
  });

  await assert.rejects(
    () =>
      cotarFrete({
        cepDestino: "01018020",
        itens: [{ quantidade: 1, produtoId: { _id: "abc", preco: 5000 } }],
      }),
    (erro) => erro instanceof ErroFrete && erro.status === 502,
  );

  global.fetch = async () => ({
    ok: true,
    status: 200,
    async text() {
      return JSON.stringify([]);
    },
  });

  await assert.rejects(
    () =>
      cotarFrete({
        cepDestino: "01018020",
        itens: [{ quantidade: 1, produtoId: { _id: "abc", preco: 5000 } }],
      }),
    (erro) => erro instanceof ErroFrete && erro.status === 404,
  );

  console.log("teste-frete.js OK");
})();
