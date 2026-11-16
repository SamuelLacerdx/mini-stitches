const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const { runInNewContext } = require('node:vm');
const { calcularPixCentavos, calcularFreteAplicavelCentavos } = require('../backend/functions/calculosPagamento');

// Executa os handlers reais sem abrir portas, acessar banco ou criar cobranças.
function montarServidor(preco = 4990, cotacao, falhas = {}) {
  const arquivo = resolve(__dirname, '../server.js');
  const requerer = createRequire(arquivo);
  const rotas = new Map();
  const cobrancas = [];
  const tentativas = [];
  const eventos = [];
  const app = { use() {} };
  for (const metodo of ['get', 'post', 'patch', 'put', 'delete']) {
    app[metodo] = (url, ...handlers) => rotas.set(`${metodo} ${url}`, handlers.at(-1));
  }
  const express = Object.assign(() => app, { json() {}, urlencoded() {} });
  const carrinho = { itens: [{ quantidade: 1, produtoId: {
    _id: 'produto-teste', slug: 'kit', nome: 'Kit', ativo: true, preco,
  } }], async populate() {} };
  const require = (nome) => {
    if (nome === './backend/db/mongodb') return {
      ...requerer(nome),
      TentativaPagamento: {
        async create(dados) {
          eventos.push('registro');
          if (falhas.registro) throw new Error('Banco indisponível');
          const tentativa = { _id: `tentativa-${tentativas.length + 1}`, ...JSON.parse(JSON.stringify(dados)) };
          tentativas.push(tentativa);
          return tentativa;
        },
        async updateOne(filtro, atualizacao) {
          eventos.push('atualizacao');
          if (falhas.atualizacao) throw new Error('Banco indisponível');
          const tentativa = tentativas.find((item) => item._id === filtro._id);
          if (tentativa) Object.assign(tentativa, atualizacao.$set);
          return { matchedCount: tentativa ? 1 : 0 };
        },
      },
    };
    if (nome === 'dotenv') return { config() {} };
    if (nome === 'nodemailer') return { createTransport: () => ({}) };
    if (nome === './backend/functions/frete') return {
      ...requerer(nome),
      cotarFrete: cotacao ?? (async () => [{ servicoId: 1, preco: 1500, prazoMin: 3, prazoMax: 5 }]),
    };
    if (nome === 'express') return express;
    if (nome === './backend/functions/carrinho') return {
      criarCarrinhoHelpers: () => ({ obterCarrinho: async () => carrinho }),
    };
    if (nome === 'mercadopago') return {
      MercadoPagoConfig: class {}, PreApproval: class {},
      Payment: class {
        async create({ body }) {
          eventos.push('gateway');
          assert.ok(tentativas.some((item) => item._id === body.external_reference && item.estado === 'registrada'));
          cobrancas.push(body);
          if (falhas.gateway) throw new Error('Timeout com token-sensivel');
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

  return { cobrancas, tentativas, eventos, async enviar(metodo, dados = {}) {
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
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    for (const dados of [{ freteCentavos: 0 }, { freteCentavos: 1 }, { freteCentavos: 9999 },
      { servicoId: 99 }, { servicoId: null }, { servicoId: true }, { cep: 'invalido' }]) {
      const servidor = montarServidor();
      assert.equal((await servidor.enviar(metodo, dados)).statusCode, 400);
      assert.equal(servidor.cobrancas.length, 0);
    }
  }
});

test('cotação usa o CEP, preço e quantidade do carrinho do servidor', async () => {
  let consulta;
  const servidor = montarServidor(4990, async (dados) => {
    consulta = dados;
    return [{ servicoId: 1, preco: 1500 }];
  });
  assert.equal((await servidor.enviar('boleto', { cep: '01310-100', preco: 1 })).statusCode, 200);
  assert.equal(consulta.cepDestino, '01310100');
  assert.equal(consulta.itens[0].produtoId.preco, 4990);
  assert.equal(consulta.itens[0].quantidade, 1);
  assert.equal(servidor.cobrancas[0].transaction_amount, 64.9);
});

test('falha da cotação impede cobrança e frete grátis dispensa cotação externa', async () => {
  const { ErroFrete } = require('../backend/functions/frete');
  const indisponivel = async () => { throw new ErroFrete(503, 'Frete indisponível.'); };
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor(4990, indisponivel);
    assert.equal((await servidor.enviar(metodo)).statusCode, 503);
    assert.equal(servidor.cobrancas.length, 0);
    const gratuito = montarServidor(41000, indisponivel);
    assert.equal((await gratuito.enviar(metodo)).statusCode, 200);
  }
});

test('PAG-05: Pix, boleto e cartão persistem tentativa antes da cobrança com snapshot oficial', async () => {
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor();
    const res = await servidor.enviar(metodo, { total: 1, numeroCartao: '4111111111111111', cvv: '123' });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(servidor.eventos, ['registro', 'gateway', 'atualizacao']);
    const tentativa = servidor.tentativas[0];
    assert.equal(tentativa.clienteId, 'cliente-teste');
    assert.equal(tentativa.metodo, metodo);
    assert.equal(tentativa.itens[0].precoUnit, 4990);
    assert.equal(tentativa.frete, 1500);
    assert.equal(tentativa.total, metodo === 'pix' ? 6241 : 6490);
    assert.equal(tentativa.estado, 'resposta_recebida');
    assert.equal(tentativa.pagamentoId, '123');
    assert.equal(res.dados.tentativa_id, tentativa._id);
    assert.equal(servidor.cobrancas[0].external_reference, tentativa._id);
    for (const proibido of ['token', 'cpf', 'numeroCartao', 'cvv', 'body', 'payer']) {
      assert.equal(proibido in tentativa, false);
    }
  }
});

test('PAG-05: falha ao registrar impede qualquer chamada ao gateway', async () => {
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor(4990, undefined, { registro: true });
    const res = await servidor.enviar(metodo);
    assert.equal(res.statusCode, 500);
    assert.equal(servidor.cobrancas.length, 0);
    assert.equal(servidor.tentativas.length, 0);
  }
});

test('PAG-05: timeout preserva tentativa para conciliação sem registrar falsa recusa', async () => {
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor(4990, undefined, { gateway: true });
    const res = await servidor.enviar(metodo);
    assert.equal(res.statusCode, 500);
    assert.equal(servidor.tentativas[0].estado, 'resultado_desconhecido');
    assert.equal(res.dados.tentativa_id, servidor.tentativas[0]._id);
    assert.equal(JSON.stringify(res.dados).includes('token-sensivel'), false);
    assert.equal(servidor.cobrancas.length, 1);
  }
});

test('PAG-05: falha ao atualizar após cobrança conserva a resposta e a referência inicial', async () => {
  const servidor = montarServidor(4990, undefined, { atualizacao: true });
  const res = await servidor.enviar('pix');
  assert.equal(res.statusCode, 200);
  assert.equal(res.dados.id_pagamento, 123);
  assert.equal(servidor.tentativas[0].estado, 'registrada');
  assert.equal(servidor.cobrancas[0].external_reference, servidor.tentativas[0]._id);
});

test('PAG-05: esquema valida valores, itens e cliente sem depender do banco', async () => {
  const { TentativaPagamento } = require('../backend/db/mongodb');
  const dados = { clienteId: '507f1f77bcf86cd799439011', metodo: 'boleto',
    itens: [{ produtoId: '507f1f77bcf86cd799439012', nome: 'Kit', slug: 'kit', quantidade: 1, precoUnit: 4990 }],
    subtotal: 4990, frete: 1500, desconto: 0, total: 6490, parcelas: 1, cep: '01001000' };
  await new TentativaPagamento(dados).validate();
  for (const alteracao of [{ clienteId: undefined }, { total: 1 }, { itens: [] }, { parcelas: 7 }, { cep: 'invalido' }]) {
    await assert.rejects(new TentativaPagamento({ ...dados, ...alteracao }).validate());
  }
});
