const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const { runInNewContext } = require('node:vm');
const { calcularPixCentavos, calcularFreteAplicavelCentavos } = require('../backend/functions/calculosPagamento');

// Executa os handlers reais sem abrir portas, acessar banco ou criar cobranças.
function montarServidor(preco = 4990) {
  const arquivo = resolve(__dirname, '../server.js');
  const requerer = createRequire(arquivo);
  const rotas = new Map();
  const cobrancas = [];
  const app = { use() {} };
  for (const metodo of ['get', 'post', 'patch', 'put', 'delete']) {
    app[metodo] = (url, ...handlers) => rotas.set(`${metodo} ${url}`, handlers.at(-1));
  }
  const express = Object.assign(() => app, { json() {}, urlencoded() {} });
  const carrinho = { itens: [{ quantidade: 1, produtoId: {
    _id: 'produto-teste', slug: 'kit', nome: 'Kit', ativo: true, preco,
  } }], async populate() {} };
  const require = (nome) => {
    if (nome === 'dotenv') return { config() {} };
    if (nome === 'nodemailer') return { createTransport: () => ({}) };
    if (nome === './backend/functions/frete') return {
      ...requerer(nome),
      cotarFrete: async () => [{ servicoId: 1, preco: 1500, prazoMin: 3, prazoMax: 5 }],
    };
    if (nome === 'express') return express;
    if (nome === './backend/functions/carrinho') return {
      criarCarrinhoHelpers: () => ({ obterCarrinho: async () => carrinho }),
    };
    if (nome === 'mercadopago') return {
      MercadoPagoConfig: class {}, PreApproval: class {},
      Payment: class {
        async create({ body }) {
          cobrancas.push(body);
          return { id: 123, status: 'approved', installments: body.installments,
            point_of_interaction: { transaction_data: {} } };
        }
      },
    };
    return requerer(nome);
  };
  runInNewContext(readFileSync(arquivo, 'utf8'), {
    require, module: { exports: {} },
    process: { env: { MP_ACCESS_TOKEN: 'credencial-ficticia-dos-testes' } },
    console: { log() {}, error() {} },
  }, { filename: arquivo });

  return { cobrancas, async enviar(metodo, dados = {}) {
    const req = { body: { email: 'teste@example.com', cpf: '00000000000',
      nomeCompleto: 'Cliente Teste', token: 'token-teste', payment_method_id: 'visa',
      freteCentavos: 1500, cep: '01001000', servicoId: 1, ...dados },
      session: { usuarioId: 'cliente-teste' } };
    const res = { statusCode: 200, status(valor) { this.statusCode = valor; return this; },
      json(valor) { this.dados = valor; return this; } };
    await rotas.get(`post /api/pagamento/${metodo}`)(req, res);
    return res;
  } };
}

test('RN03/RN04: exemplos do documento, meio centavo e cálculo único por subtotal', () => {
  assert.deepEqual(calcularPixCentavos(4990, 1500), { produtosLiquidos: 4741, desconto: 249, total: 6241 });
  assert.equal(calcularPixCentavos(30000, 2500).total, 31000);
  assert.equal(calcularPixCentavos(41000, 0).total, 38950);
  assert.equal(calcularPixCentavos(10, 0).produtosLiquidos, 10);
  assert.equal(calcularPixCentavos(20, 0).produtosLiquidos, 19);
  for (let subtotal = 1; subtotal <= 50000; subtotal++) {
    const esperado = Number((BigInt(subtotal) * 95n + 50n) / 100n);
    assert.equal(calcularPixCentavos(subtotal, 0).produtosLiquidos, esperado, `subtotal ${subtotal}`);
  }
});

test('RN02: limite é anterior ao Pix e exclui o frete', () => {
  for (const subtotal of [39989, 39990, 39991, 41000]) {
    const frete = calcularFreteAplicavelCentavos(subtotal, 2500);
    assert.equal(frete, subtotal > 39990 ? 0 : 2500);
    assert.equal(calcularPixCentavos(subtotal, frete).total, Math.round(subtotal * 0.95) + frete);
  }
});

test('handlers ignoram preços e totais adulterados antes de criar Pix, boleto e cartão', async () => {
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor();
    const res = await servidor.enviar(metodo, { valorOriginal: 0.01, valorTotal: 0.01,
      subtotal: 1, total: 1, preco: 1, itens: [{ preco: 1, quantidade: 100 }] });
    assert.equal(res.statusCode, 200);
    assert.equal(servidor.cobrancas.length, 1);
    assert.equal(servidor.cobrancas[0].transaction_amount, metodo === 'pix' ? 62.41 : 64.9);
  }
});

test('handler bloqueia parcelas adulteradas sem chamar o gateway', async () => {
  for (const parcelas of [0, 7, 2.5, '2.5', '', null, true, {}, [], 'NaN', 2]) {
    const servidor = montarServidor();
    const res = await servidor.enviar('cartao', { parcelas });
    assert.equal(res.statusCode, 400, `parcelas ${JSON.stringify(parcelas)}`);
    assert.equal(servidor.cobrancas.length, 0);
  }
  const servidor = montarServidor(10501);
  assert.equal((await servidor.enviar('cartao', { parcelas: '3' })).statusCode, 200);
  assert.equal(servidor.cobrancas[0].installments, 3);
});

test('handlers mantêm frete grátis antes do Pix e bloqueiam valores de frete inválidos', async () => {
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor(41000);
    assert.equal((await servidor.enviar(metodo)).statusCode, 200);
    assert.equal(servidor.cobrancas[0].transaction_amount, metodo === 'pix' ? 389.5 : 410);
    for (const freteCentavos of [-1, 1.5, 'invalido']) {
      const invalido = montarServidor();
      assert.equal((await invalido.enviar(metodo, { freteCentavos })).statusCode, 400);
      assert.equal(invalido.cobrancas.length, 0);
    }
  }
});

test('UC03: adulterar frete pago não deve diminuir a cobrança', async () => {
  const servidor = montarServidor();
  const res = await servidor.enviar('boleto', { freteCentavos: 0 });
  assert.ok(res.statusCode === 400 || (servidor.cobrancas[0]?.transaction_amount === 64.9),
    'Servidor aceitou frete zero sem validar a cotação do carrinho/CEP.');
});
