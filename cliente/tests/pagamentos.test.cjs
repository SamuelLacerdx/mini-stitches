const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const { runInNewContext } = require('node:vm');
const { randomUUID, createHmac } = require('node:crypto');
const { calcularPixCentavos, calcularFreteAplicavelCentavos } = require('../backend/functions/calculosPagamento');
const { primeiraCompetencia, loteElegivel, vencimentoMensal, validarPostagem } = require('../backend/functions/calendarioClube');
const { criarConciliadorClube, criarConsultaFaturas, registrarRotasClube } = require('../backend/functions/recorrenciaClube');
const { criarCancelamentoClube, registrarRotasCancelamento } = require('../backend/functions/cancelamentoClube');
const { criarAutenticacao } = require('../backend/functions/autenticacao');
const { criarReferenciaCartao } = require('../backend/functions/cartoesPerfil');
const { segredosAplicacao } = require('../backend/functions/segurancaPagamento');

// Executa os handlers reais sem abrir portas, acessar banco ou criar cobranças.
function montarServidor(preco = 4990, cotacao, falhas = {}) {
  const arquivo = resolve(__dirname, '../server.js');
  const requerer = createRequire(arquivo);
  const rotas = new Map();
  const handlersRotas = new Map();
  const cobrancas = [];
  const adesoes = [];
  const autorizacoes = [];
  const tentativas = [];
  const pedidos = [];
  const notificacoes = [];
  const consultas = [];
  const eventos = [];
  const logs = [];
  const consultasConta = [];
  let reservas;
  let atualizarLogistica;
  const estoques = falhas.estoques ?? { 'produto-teste': { estoque: 10, estoqueSeguranca: 0, ativo: true } };
  let transacaoAnterior = Promise.resolve();
  const executarTransacao = (operacao) => {
    const atual = transacaoAnterior.then(async () => {
      const copia = JSON.parse(JSON.stringify({ estoques, tentativas, pedidos, notificacoes }));
      try { return await operacao({ transacaoTeste: true }); }
      catch (erro) {
        for (const chave of Object.keys(estoques)) delete estoques[chave];
        Object.assign(estoques, copia.estoques);
        tentativas.splice(0, tentativas.length, ...copia.tentativas);
        pedidos.splice(0, pedidos.length, ...copia.pedidos);
        notificacoes.splice(0, notificacoes.length, ...copia.notificacoes);
        throw erro;
      }
    });
    transacaoAnterior = atual.catch(() => {});
    return atual;
  };
  const app = { use() {} };
  for (const metodo of ['get', 'post', 'patch', 'put', 'delete']) {
    app[metodo] = (url, ...handlers) => {
      rotas.set(`${metodo} ${url}`, handlers.at(-1));
      handlersRotas.set(`${metodo} ${url}`, handlers);
    };
  }
  const express = Object.assign(() => app, { json() {}, urlencoded() {} });
  const carrinho = { itens: [{ quantidade: 1, produtoId: {
    _id: 'produto-teste', slug: 'kit', nome: 'Kit', ativo: true, preco,
  } }], async populate() {}, async save() {} };
  if (falhas.itens) carrinho.itens = falhas.itens;
  const require = (nome) => {
    if (nome === './backend/functions/cancelamentoClube' && falhas.retomaCancelamento) {
      return { ...requerer(nome), criarCancelamentoClube: () => ({ processarPendentes: falhas.retomaCancelamento }) };
    }
    if (nome === './backend/functions/recorrenciaClube') {
      const modulo = requerer(nome);
      return { ...modulo,
        criarConsultaFaturas: () => ({ buscar: async () => [], obter: async () => { throw new Error('Fatura indisponível'); } }),
        criarConciliadorClube: (opcoes) => falhas.conciliacaoClube || modulo.criarConciliadorClube(opcoes),
      };
    }
    if (nome === './backend/functions/estadosPedido') {
      const modulo = requerer(nome);
      return { ...modulo, criarAtualizadorLogistico(opcoes) {
        atualizarLogistica = modulo.criarAtualizadorLogistico(opcoes);
        return atualizarLogistica;
      } };
    }
    if (nome === './backend/functions/reservasEstoque') {
      const modulo = requerer(nome);
      return { ...modulo, criarReservasEstoque(opcoes) {
        reservas = modulo.criarReservasEstoque(opcoes);
        return reservas;
      } };
    }
    if (nome === 'mongoose') return new Proxy(requerer(nome), {
      get(alvo, chave) {
        if (chave === 'connection') return { transaction: executarTransacao };
        if (chave === 'connect') return async () => {};
        if (chave === 'isValidObjectId') return (id) => /^(tentativa-\d+|pedido-1)$/.test(String(id)) || alvo.isValidObjectId(id);
        return alvo[chave];
      },
    });
    if (nome === './backend/db/mongodb') return {
      ...requerer(nome),
      Usuario: {
        findById(id) { return { select: async () => { consultasConta.push(id); if (falhas.consultaConta) throw new Error('Falha token-sensivel'); return ({ email: 'perfil@example.com', status: !falhas.contaInativa, perfil: falhas.perfilConta || 'cliente',
          enderecos: [{ _id: id === 'outro-cliente' ? 'outro-endereco' : 'endereco-1', cep: '01001000',
            rua: 'Rua Teste', numero: '1', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }] }); } }; },
      },
      Assinatura: {
        async init() {},
        findOne(filtro) {
          const valor = adesoes.find((item) => Object.entries(filtro).every(([campo, esperado]) => item[campo] === esperado)) ?? null;
          return { then(resolve, reject) { return Promise.resolve(valor).then(resolve, reject); }, lean: async () => valor };
        },
        find(filtro) { return { sort() { return this; }, lean: async () => adesoes.filter((item) => item.clienteId === filtro.clienteId) }; },
        async create(dados) {
          if (falhas.registroClube) throw new Error('Falha no banco');
          if (adesoes.some((item) => item.clienteId === dados.clienteId && item.chaveTentativa === dados.chaveTentativa)) {
            throw Object.assign(new Error('Duplicada'), { code: 11000 });
          }
          const adesao = { _id: '507f1f77bcf86cd799439011', ...JSON.parse(JSON.stringify(dados)),
            toObject() { const { toObject: ignorado, ...valor } = this; void ignorado; return valor; } };
          adesoes.push(adesao);
          return adesao;
        },
        async updateOne(filtro, dados) {
          if (falhas.atualizacaoClube) throw new Error('Falha no banco');
          const item = adesoes.find((item) => item._id === filtro._id &&
            (!filtro.statusAdesao?.$in || filtro.statusAdesao.$in.includes(item.statusAdesao)));
          if (item) Object.assign(item, dados.$set);
          return { matchedCount: item ? 1 : 0 };
        },
      },
      NotificacaoPagamento: {
        async init() {},
        async findById(id) { return notificacoes.find((item) => item._id === id) ?? null; },
        async create(dados) {
          if (falhas.notificacao) throw new Error('Falha ao registrar notificação');
          if (notificacoes.some((item) => item._id === dados[0]._id)) {
            throw Object.assign(new Error('Notificação duplicada'), { code: 11000 });
          }
          notificacoes.push(...dados);
        },
      },
      Pedido: {
        async findById(id) { return pedidos.find((pedido) => pedido._id === id) ?? null; },
        async findOneAndUpdate(filtro, dados) {
          const pedido = pedidos.find((item) => item._id === filtro._id);
          if (!pedido) return null;
          Object.assign(pedido, dados.$set);
          for (const [campo, evento] of Object.entries(dados.$push || {})) (pedido[campo] ??= []).push(evento);
          return pedido;
        },
        async findOne(filtro) { return pedidos.find((pedido) => pedido.pagamentoId === filtro.pagamentoId) ?? null; },
        async create(dados) {
          if (falhas.pedido) throw new Error('Falha no registro do pedido');
          const pedido = { _id: 'pedido-1', numero: 'MS-1001', ...dados };
          pedidos.push(pedido);
          return pedido;
        },
        async updateOne(filtro, dados) {
          const pedido = pedidos.find((item) => item._id === filtro._id);
          if (!pedido) return { matchedCount: 0 };
          Object.assign(pedido, dados.$set);
          for (const [campo, evento] of Object.entries(dados.$push || {})) (pedido[campo] ??= []).push(evento);
          return { matchedCount: 1 };
        },
      },
      Produto: {
        async findOneAndUpdate(filtro, atualizacao, { session }) {
          assert.ok(session.transacaoTeste);
          const produto = estoques[String(filtro._id)];
          const quantidade = filtro.$expr.$gte[1];
          if (!produto || !produto.ativo || produto.estoque - (produto.estoqueSeguranca ?? 0) < quantidade) return null;
          produto.estoque += atualizacao.$inc.estoque;
          return produto;
        },
        async updateOne(filtro, atualizacao, { session }) {
          assert.ok(session.transacaoTeste);
          const produto = estoques[String(filtro._id)];
          if (falhas.liberacao) throw new Error('Falha ao repor estoque');
          if (!produto) return { matchedCount: 0 };
          produto.estoque += atualizacao.$inc.estoque;
          return { matchedCount: 1 };
        },
      },
      TentativaPagamento: {
        async init() { if (falhas.indice) throw new Error('Índice indisponível'); },
        async findById(id) { return tentativas.find((item) => item._id === id) ?? null; },
        findOne(filtro) {
          const valor = tentativas.find((item) => Object.entries(filtro).every(([chave, valor]) => item[chave] === valor)) ?? null;
          return { select: async () => valor, then(resolve, reject) { return Promise.resolve(valor).then(resolve, reject); } };
        },
        async create(dados) {
          eventos.push('registro');
          if (falhas.registro) throw new Error('Banco indisponível');
          if (tentativas.some((item) => item.clienteId === dados.clienteId && item.chaveTentativa === dados.chaveTentativa)) {
            throw Object.assign(new Error('Chave duplicada'), { code: 11000 });
          }
          const tentativa = { _id: `tentativa-${tentativas.length + 1}`, estoqueEstado: 'nao_reservado', ...JSON.parse(JSON.stringify(dados)) };
          tentativas.push(tentativa);
          return tentativa;
        },
        async updateOne(filtro, atualizacao) {
          eventos.push('atualizacao');
          if (falhas.atualizacao) throw new Error('Banco indisponível');
          const tentativa = tentativas.find((item) => {
            if (item._id !== filtro._id || (filtro.estado && item.estado !== filtro.estado)) return false;
            if (filtro.provedorAtualizadoEm?.$exists === false && item.provedorAtualizadoEm) return false;
            if (filtro.$or && item.provedorAtualizadoEm &&
              !(new Date(item.provedorAtualizadoEm) < filtro.$or[1].provedorAtualizadoEm.$lt)) return false;
            return true;
          });
          if (tentativa) Object.assign(tentativa, atualizacao.$set);
          return { matchedCount: tentativa ? 1 : 0 };
        },
        async findOneAndUpdate(filtro, atualizacao, { session }) {
          assert.ok(session.transacaoTeste);
          eventos.push(atualizacao.$set.estoqueEstado === 'reservado' ? 'reserva' : 'liberacao');
          const tentativa = tentativas.find((item) => item._id === String(filtro._id) && item.estoqueEstado === filtro.estoqueEstado &&
            (!filtro.statusProvedor || item.statusProvedor === filtro.statusProvedor));
          if (!tentativa) return null;
          Object.assign(tentativa, atualizacao.$set);
          return tentativa;
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
      MercadoPagoConfig: class {}, CardToken: class {}, PaymentRefund: class {}, PreApproval: class {
        async create({ body, requestOptions }) {
          assert.equal(body.external_reference, adesoes[0]._id);
          assert.equal(requestOptions.idempotencyKey, body.external_reference);
          autorizacoes.push(body);
          if (falhas.antesRespostaClube) await falhas.antesRespostaClube(adesoes[0]);
          if (falhas.clube) throw new Error('Timeout token-sensivel');
          return { id: 'acordo-123', status: 'authorized' };
        }
      },
      Payment: class {
        async get() {
          consultas.push('get');
          if (falhas.consulta) throw new Error('Falha no provedor');
          const body = cobrancas.at(-1);
          return { id: 123, status: falhas.status ?? 'approved', external_reference: body.external_reference,
            currency_id: 'BRL', date_last_updated: '2026-11-15T12:00:00.000Z',
            date_approved: '2026-11-15T11:59:00.000Z',
            transaction_amount: body.transaction_amount, payment_method_id: body.payment_method_id,
            payment_type_id: body.payment_method_id === 'bolbradesco' ? 'ticket' : 'credit_card',
            ...falhas.pagamento };
        }
        async create({ body, requestOptions }) {
          eventos.push('gateway');
          assert.equal(requestOptions.idempotencyKey, body.external_reference);
          assert.ok(tentativas.some((item) => item._id === body.external_reference && item.estado === 'registrada'));
          assert.equal(tentativas.find((item) => item._id === body.external_reference).estoqueEstado, 'reservado');
          cobrancas.push(body);
          if (falhas.antesResposta) await falhas.antesResposta();
          if (falhas.gateway) throw new Error('Timeout com token-sensivel');
          return { id: 123, status: falhas.status ?? 'approved', installments: body.installments,
            point_of_interaction: { transaction_data: {} }, ...falhas.respostaGateway };
        }
      },
    };
    return requerer(nome);
  };
  runInNewContext(readFileSync(arquivo, 'utf8'), {
    require, module: { exports: {} },
    process: { env: { MP_ACCESS_TOKEN: 'credencial-ficticia-dos-testes',
      APP_URL: falhas.semAppUrl ? '' : 'https://mini-stitches.example',
      MP_WEBHOOK_SECRET: falhas.semSecret ? '' : 'segredo-webhook-testes' } },
    console: { log(...dados) { logs.push(dados); }, error(...dados) { logs.push(dados); } },
  }, { filename: arquivo });

  return { cobrancas, tentativas, eventos, estoques, pedidos, notificacoes, consultas, adesoes, autorizacoes, logs, consultasConta,
    get reservas() { return reservas; },
    get atualizarLogistica() { return atualizarLogistica; },
    async enviar(metodo, dados = {}) {
    const req = { body: { email: 'teste@example.com', cpf: '00000000000',
      nomeCompleto: 'Cliente Teste', token: 'token-teste', payment_method_id: 'visa',
      freteCentavos: 1500, cep: '01001000', servicoId: 1, ...dados },
      headers: dados.headers || {}, session: falhas.semSessao ? {} : { usuarioId: falhas.clienteId ?? 'cliente-teste' } };
    req.params = dados.parametros ?? { id: 'pedido-1' };
    req.body.cliente ??= { nome: 'Cliente Teste', email: 'teste@example.com' };
    req.body.chaveTentativa ??= randomUUID();
    if (dados.semChave) delete req.body.chaveTentativa;
    req.body.entrega ??= { cep: req.body.cep, endereco: 'Rua Teste, 1' };
    const res = { statusCode: 200, status(valor) { this.statusCode = valor; return this; },
      set() { return this; },
      send(valor) { this.dados = valor; return this; },
      json(valor) { this.dados = valor; return this; } };
    const url = metodo.startsWith('/') ? metodo : `/api/pagamento/${metodo}`;
    if (url === '/api/webhook') {
      const id = String(dados.data?.id ?? '123');
      req.query = dados.query ?? { 'data.id': id, type: 'payment' };
      const ts = String(Math.floor(Date.now() / 1000));
      const requestId = randomUUID();
      const hash = createHmac('sha256', 'segredo-webhook-testes')
        .update(`id:${id.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
      req.headers = dados.headers ?? { 'x-request-id': requestId, 'x-signature': `ts=${ts},v1=${hash}` };
    }
    const caminho = `${dados.httpMethod ?? 'post'} ${url}`;
    if (dados.testarAutenticacao) {
      let autenticado = false;
      await handlersRotas.get(caminho)[0](req, res, () => { autenticado = true; });
      if (!autenticado) return res;
    }
    await rotas.get(caminho)(req, res);
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
    const res = await servidor.enviar(metodo, { total: 1 });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(servidor.eventos, ['registro', 'reserva', 'gateway', 'atualizacao']);
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

test('PAG-06: sem estoque ou abaixo da margem não cria cobrança nem estoque negativo', async () => {
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor(4990, undefined, {
      estoques: { 'produto-teste': { estoque: 2, estoqueSeguranca: 2, ativo: true } },
    });
    assert.equal((await servidor.enviar(metodo)).statusCode, 409);
    assert.equal(servidor.cobrancas.length, 0);
    assert.equal(servidor.estoques['produto-teste'].estoque, 2);
    assert.equal(servidor.tentativas[0].estoqueEstado, 'nao_reservado');
  }
});

test('PAG-06: duas tentativas simultâneas disputando a última unidade só geram uma cobrança', async () => {
  const servidor = montarServidor(4990, undefined, {
    estoques: { 'produto-teste': { estoque: 1, ativo: true } },
  });
  const respostas = await Promise.all([servidor.enviar('pix'), servidor.enviar('pix')]);
  assert.deepEqual(respostas.map((res) => res.statusCode).sort(), [200, 409]);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.estoques['produto-teste'].estoque, 0);
});

test('PAG-06: falha no segundo item desfaz toda a reserva', async () => {
  const servidor = montarServidor(4990, undefined, {
    itens: ['a', 'b'].map((id) => ({ quantidade: 1, produtoId: { _id: id, slug: id, nome: id, preco: 4990, ativo: true } })),
    estoques: { a: { estoque: 1, ativo: true }, b: { estoque: 0, ativo: true } },
  });
  assert.equal((await servidor.enviar('boleto')).statusCode, 409);
  assert.equal(servidor.estoques.a.estoque, 1);
  assert.equal(servidor.estoques.b.estoque, 0);
  assert.equal(servidor.cobrancas.length, 0);
});

test('PAG-06: recusa definitiva libera e repetição da liberação não duplica estoque', async () => {
  const servidor = montarServidor(4990, undefined, { status: 'rejected' });
  await servidor.enviar('cartao');
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
  assert.equal(servidor.tentativas[0].estoqueEstado, 'liberado');
  await Promise.all([servidor.reservas.liberar('tentativa-1'), servidor.reservas.liberar('tentativa-1')]);
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
});

test('PAG-06: timeout ou pagamento pendente conserva reserva até conciliação', async () => {
  for (const opcoes of [{ gateway: true }, { status: 'pending' }, { status: 'approved' }]) {
    const servidor = montarServidor(4990, undefined, opcoes);
    await servidor.enviar('pix');
    assert.equal(servidor.estoques['produto-teste'].estoque, 9);
    assert.equal(servidor.tentativas[0].estoqueEstado, 'reservado');
  }
});

test('PAG-06: falha ao liberar reverte marcador e permite nova tentativa de liberação', async () => {
  const falhas = { status: 'rejected', liberacao: true };
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('cartao');
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  assert.equal(servidor.tentativas[0].estoqueEstado, 'reservado');
  falhas.liberacao = false;
  await servidor.reservas.liberar('tentativa-1');
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
  assert.equal(servidor.tentativas[0].estoqueEstado, 'liberado');
});

test('PAG-06: registrar pedido ou repetir registro não desconta estoque novamente', async () => {
  const servidor = montarServidor();
  await servidor.enviar('boleto');
  assert.equal((await servidor.enviar('/api/pedidos', { pagamentoId: '123' })).statusCode, 201);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  assert.equal(servidor.pedidos[0].tentativaId, servidor.tentativas[0]._id);
  assert.equal((await servidor.enviar('/api/pedidos', { pagamentoId: '123' })).statusCode, 200);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  assert.equal(servidor.pedidos.length, 1);
});

test('PAG-06: falha no pedido após cobrança mantém reserva e permite registrar depois', async () => {
  const falhas = { pedido: true };
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('boleto');
  assert.equal((await servidor.enviar('/api/pedidos', { pagamentoId: '123' })).statusCode, 500);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  falhas.pedido = false;
  assert.equal((await servidor.enviar('/api/pedidos', { pagamentoId: '123' })).statusCode, 201);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-06: webhook de recusa antes do pedido libera uma única vez', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('pix');
  falhas.status = 'rejected';
  for (let i = 0; i < 2; i++) {
    assert.equal((await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } })).statusCode, 200);
  }
  assert.equal(servidor.tentativas[0].estoqueEstado, 'liberado');
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
});

test('PAG-07: mesma chave devolve a mesma cobrança em todos os métodos', async () => {
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor();
    const chaveTentativa = randomUUID();
    const primeira = await servidor.enviar(metodo, { chaveTentativa });
    const repetida = await servidor.enviar(metodo, { chaveTentativa, token: 'retokenizacao' });
    assert.equal(repetida.statusCode, 200);
    assert.deepEqual(repetida.dados, primeira.dados);
    assert.equal(servidor.tentativas.length, 1);
    assert.equal(servidor.cobrancas.length, 1);
    assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  }
});

test('PAG-07: duplo clique simultâneo gera uma tentativa, uma reserva e uma cobrança', async () => {
  const servidor = montarServidor();
  const chaveTentativa = randomUUID();
  const respostas = await Promise.all([
    servidor.enviar('pix', { chaveTentativa }), servidor.enviar('pix', { chaveTentativa }),
  ]);
  assert.ok(respostas.some((resposta) => resposta.statusCode === 200));
  assert.ok(respostas.every((resposta) => [200, 409].includes(resposta.statusCode)));
  assert.equal(servidor.tentativas.length, 1);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  assert.equal((await servidor.enviar('pix', { chaveTentativa })).statusCode, 200);
});

test('PAG-07: repetição após timeout não cobra nem reserva de novo; webhook recupera resposta', async () => {
  const falhas = { gateway: true };
  const servidor = montarServidor(4990, undefined, falhas);
  const chaveTentativa = randomUUID();
  assert.equal((await servidor.enviar('pix', { chaveTentativa })).statusCode, 500);
  falhas.gateway = false;
  const repetida = await servidor.enviar('pix', { chaveTentativa });
  assert.equal(repetida.statusCode, 409);
  assert.equal(repetida.dados.tentativa_id, servidor.tentativas[0]._id);
  await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } });
  assert.equal((await servidor.enviar('pix', { chaveTentativa })).statusCode, 200);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.tentativas.length, 1);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-07: mesma chave com dados diferentes é conflito, sem nova cobrança', async () => {
  const servidor = montarServidor();
  const chaveTentativa = randomUUID();
  await servidor.enviar('pix', { chaveTentativa });
  for (const dados of [{ cep: '01310100' }, { parcelas: '2' }, { email: 'outro@example.com' }]) {
    assert.equal((await servidor.enviar('pix', { chaveTentativa, ...dados })).statusCode, 409);
  }
  assert.equal((await servidor.enviar('boleto', { chaveTentativa })).statusCode, 409);
  assert.equal(servidor.cobrancas.length, 1);
});

test('PAG-07: replay funciona depois que o carrinho foi esvaziado pelo registro do pedido', async () => {
  const servidor = montarServidor();
  const chaveTentativa = randomUUID();
  const primeira = await servidor.enviar('boleto', { chaveTentativa });
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  const repetida = await servidor.enviar('boleto', { chaveTentativa });
  assert.equal(repetida.statusCode, 200);
  assert.deepEqual(repetida.dados, primeira.dados);
  assert.equal(servidor.cobrancas.length, 1);
});

test('PAG-07: chave ausente ou inválida não registra nem cobra; índice é único por cliente', async () => {
  const servidor = montarServidor();
  for (const dados of [{ semChave: true }, { chaveTentativa: 'curta' }, { chaveTentativa: {} }]) {
    assert.equal((await servidor.enviar('pix', dados)).statusCode, 400);
  }
  assert.equal(servidor.tentativas.length, 0);
  assert.equal(servidor.cobrancas.length, 0);
  const { TentativaPagamento } = require('../backend/db/mongodb');
  assert.ok(TentativaPagamento.schema.indexes().some(([campos, opcoes]) =>
    campos.clienteId === 1 && campos.chaveTentativa === 1 && opcoes.unique));
});

test('PAG-07: a mesma chave em outra conta não revela nem reutiliza a tentativa alheia', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  const chaveTentativa = randomUUID();
  const primeira = await servidor.enviar('pix', { chaveTentativa });
  falhas.clienteId = 'outro-cliente';
  const segunda = await servidor.enviar('pix', { chaveTentativa });
  assert.equal(segunda.statusCode, 200);
  assert.notEqual(primeira.dados.tentativa_id, segunda.dados.tentativa_id);
  assert.equal(servidor.tentativas.length, 2);
  assert.equal(servidor.cobrancas.length, 2);
  assert.equal(servidor.estoques['produto-teste'].estoque, 8);
});

test('PAG-07: falha na inicialização do índice impede cobrança', async () => {
  const servidor = montarServidor(4990, undefined, { indice: true });
  assert.equal((await servidor.enviar('pix')).statusCode, 500);
  assert.equal(servidor.tentativas.length, 0);
  assert.equal(servidor.cobrancas.length, 0);
});

test('PAG-08: assinatura ausente, malformada ou incorreta é rejeitada antes da API', async () => {
  const servidor = montarServidor();
  const casos = [{}, { 'x-request-id': 'id-teste', 'x-signature': 'ts=123,v1=ab' },
    { 'x-request-id': 'id-teste', 'x-signature': `ts=123,v1=${'0'.repeat(64)}` },
    { 'x-request-id': 'id-teste', 'x-signature': `ts=123,ts=123,v1=${'0'.repeat(64)}` }];
  for (const headers of casos) {
    assert.equal((await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' }, headers })).statusCode, 401);
  }
  assert.equal(servidor.consultas.length, 0);
  assert.equal(servidor.notificacoes.length, 0);
});

test('PAG-08: ID assinado da URL não pode ser substituído pelo ID do corpo', async () => {
  const servidor = montarServidor();
  const req = { query: { 'data.id': 'ABC123' }, body: { data: { id: 'abc123' } }, headers: {
    'x-request-id': 'id-teste', 'x-signature': `ts=123,v1=${createHmac('sha256', 'segredo')
      .update('id:abc123;request-id:id-teste;ts:123;').digest('hex')}`,
  } };
  const { validarWebhook } = require('../backend/functions/webhookPagamento');
  assert.equal(validarWebhook(req, 'segredo').paymentId, 'abc123');
  req.body.data.id = '999';
  assert.equal(validarWebhook(req, 'segredo'), null);
  assert.equal((await servidor.enviar('/api/webhook', {
    type: 'payment', data: { id: '999' }, query: { 'data.id': '123' },
  })).statusCode, 401);
  assert.equal(servidor.consultas.length, 0);
});

test('PAG-08: secret ausente bloqueia processamento', async () => {
  const servidor = montarServidor(4990, undefined, { semSecret: true });
  assert.equal((await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } })).statusCode, 503);
  assert.equal(servidor.consultas.length, 0);
});

test('PAG-08: corpo não define status; notificações simultâneas não duplicam histórico', async () => {
  const falhas = { status: 'pending' };
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('boleto');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  const evento = { type: 'payment', data: { id: '123' }, status: 'approved' };
  assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 200);
  assert.equal(servidor.pedidos[0].status, 'aguardando_pagamento');
  falhas.status = 'approved';
  falhas.pagamento = { date_last_updated: '2026-11-15T12:01:00.000Z' };
  const respostas = await Promise.all([servidor.enviar('/api/webhook', evento), servidor.enviar('/api/webhook', evento)]);
  assert.ok(respostas.every((resposta) => resposta.statusCode === 200));
  assert.equal(servidor.pedidos[0].status, 'pago');
  assert.equal(servidor.pedidos[0].historicoStatus.length, 1);
  assert.equal(servidor.notificacoes.length, 2);
  assert.equal(new Date(servidor.tentativas[0].aprovadoEm).toISOString(), '2026-11-15T11:59:00.000Z');
  assert.notEqual(new Date(servidor.notificacoes[1].recebidoEm).getTime(), new Date(servidor.tentativas[0].aprovadoEm).getTime());
});

test('PAG-08: versão antiga não regride aprovação nem libera estoque', async () => {
  const falhas = { status: 'pending' };
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('pix');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  const evento = { type: 'payment', data: { id: '123' } };
  falhas.status = 'approved';
  falhas.pagamento = { date_last_updated: '2026-11-15T13:00:00.000Z' };
  assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 200);
  for (const status of ['pending', 'rejected']) {
    falhas.status = status;
    falhas.pagamento = { date_last_updated: '2026-11-15T12:00:00.000Z' };
    assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 200);
    assert.equal(servidor.tentativas[0].statusProvedor, 'approved');
    assert.equal(servidor.pedidos[0].status, 'pago');
    assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  }
  assert.equal(servidor.notificacoes.length, 1);
});

test('PAG-08: falha após liberar estoque desfaz tudo e permite repetir a notificação', async () => {
  const falhas = { status: 'pending', notificacao: true };
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('pix');
  falhas.status = 'rejected';
  const evento = { type: 'payment', data: { id: '123' } };
  assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 503);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  assert.equal(servidor.tentativas[0].estoqueEstado, 'reservado');
  assert.equal(servidor.notificacoes.length, 0);
  falhas.notificacao = false;
  assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 200);
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
  assert.equal(servidor.notificacoes.length, 1);
});

test('PAG-08: falha do provedor, ID, moeda, valor ou datas inválidos não aplicam efeitos', async () => {
  const falhas = { status: 'pending' };
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('pix');
  const evento = { type: 'payment', data: { id: '123' } };
  falhas.consulta = true;
  assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 503);
  falhas.consulta = false;
  for (const pagamento of [{ id: 999 }, { currency_id: 'USD' }, { transaction_amount: 0.01 },
    { date_last_updated: null }, { status: 'approved', date_approved: null }]) {
    falhas.pagamento = pagamento;
    assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 503);
  }
  assert.equal(servidor.notificacoes.length, 0);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-08: resposta atrasada da criação não sobrescreve webhook mais novo', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  falhas.antesResposta = async () => {
    falhas.status = 'rejected';
    await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } });
    falhas.status = 'pending';
  };
  await servidor.enviar('pix');
  assert.equal(servidor.tentativas[0].statusProvedor, 'rejected');
  assert.equal(servidor.tentativas[0].respostaGateway.status, 'rejected');
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
});

test('PAG-08: recusa atrasada da criação não libera estoque após aprovação mais nova', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  falhas.antesResposta = async () => {
    falhas.status = 'approved';
    await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } });
    falhas.status = 'rejected';
  };
  await servidor.enviar('pix');
  assert.equal(servidor.tentativas[0].statusProvedor, 'approved');
  assert.equal(servidor.tentativas[0].estoqueEstado, 'reservado');
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-09: criação e avanço logístico mantêm finanças independentes', async () => {
  const servidor = montarServidor();
  await servidor.enviar('boleto');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'aprovado');
  assert.equal(servidor.pedidos[0].statusLogistico, 'pronto_para_preparo');
  await servidor.atualizarLogistica({ id: 'pedido-1', status: 'em_separacao' });
  await servidor.atualizarLogistica({ id: 'pedido-1', status: 'enviado', rastreio: 'BR123' });
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'aprovado');
  assert.equal(servidor.pedidos[0].statusLogistico, 'enviado');
  assert.equal(servidor.pedidos[0].historicoLogistico.length, 2);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-09: reembolso após envio preserva logística e não repõe estoque', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('boleto');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  await servidor.atualizarLogistica({ id: 'pedido-1', status: 'em_separacao' });
  await servidor.atualizarLogistica({ id: 'pedido-1', status: 'enviado' });
  falhas.status = 'refunded';
  falhas.pagamento = { date_last_updated: '2026-11-15T13:00:00.000Z' };
  const evento = { type: 'payment', data: { id: '123' } };
  assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 200);
  await servidor.enviar('/api/webhook', evento);
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'reembolsado');
  assert.equal(servidor.pedidos[0].valorReembolsado, 6490);
  assert.equal(servidor.pedidos[0].statusLogistico, 'enviado');
  assert.equal(servidor.pedidos[0].status, 'enviado');
  assert.equal(servidor.pedidos[0].historicoFinanceiro.length, 1);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  await servidor.atualizarLogistica({ id: 'pedido-1', status: 'entregue' });
  assert.equal(servidor.pedidos[0].statusLogistico, 'entregue');
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'reembolsado');
});

test('PAG-09: reembolso integral antes do envio cancela logística e repõe uma vez', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('pix');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  falhas.status = 'refunded';
  falhas.pagamento = { date_last_updated: '2026-11-15T13:00:00.000Z' };
  const evento = { type: 'payment', data: { id: '123' } };
  await servidor.enviar('/api/webhook', evento);
  await servidor.enviar('/api/webhook', evento);
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'reembolsado');
  assert.equal(servidor.pedidos[0].statusLogistico, 'cancelado');
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
});

test('PAG-09: reembolso parcial permanece separado e bloqueia envio', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('boleto');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  falhas.pagamento = { status_detail: 'partially_refunded', transaction_amount_refunded: 10, date_last_updated: '2026-11-15T13:00:00.000Z' };
  await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } });
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'parcialmente_reembolsado');
  assert.equal(servidor.pedidos[0].valorReembolsado, 1000);
  assert.equal(servidor.pedidos[0].total, 6490);
  assert.equal(servidor.pedidos[0].statusLogistico, 'pronto_para_preparo');
  await assert.rejects(servidor.atualizarLogistica({ id: 'pedido-1', status: 'em_separacao' }), { status: 403 });
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-09: mediação e chargeback após entrega preservam recebimento e estoque', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('boleto');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  for (const status of ['em_separacao', 'enviado', 'entregue']) await servidor.atualizarLogistica({ id: 'pedido-1', status });
  for (const [status, esperado, hora] of [['in_mediation', 'em_contestacao', '13'], ['charged_back', 'contestado', '14']]) {
    falhas.status = status;
    falhas.pagamento = { date_last_updated: `2026-11-15T${hora}:00:00.000Z` };
    await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } });
    assert.equal(servidor.pedidos[0].statusFinanceiro, esperado);
    assert.equal(servidor.pedidos[0].statusLogistico, 'entregue');
    assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  }
});

test('PAG-09: cancelamento logístico não forja estorno; não permite reabrir ou saltar etapas', async () => {
  const servidor = montarServidor();
  await servidor.enviar('boleto');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  await assert.rejects(servidor.atualizarLogistica({ id: 'pedido-1', status: 'entregue' }), { status: 409 });
  await servidor.atualizarLogistica({ id: 'pedido-1', status: 'cancelado' });
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'aprovado');
  assert.equal(servidor.pedidos[0].valorReembolsado, 0);
  assert.equal(servidor.pedidos[0].statusLogistico, 'cancelado');
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
  await assert.rejects(servidor.atualizarLogistica({ id: 'pedido-1', status: 'em_separacao' }), { status: 409 });
  const resposta = await servidor.enviar('/admin/pedidos/:id/status', {
    httpMethod: 'patch', status: 'cancelado', statusFinanceiro: 'reembolsado',
  });
  assert.equal(resposta.statusCode, 403);
});

test('PAG-09: API e textos distinguem finanças de logística sem expor dados do gateway', async () => {
  const { respostaPedido } = require('../backend/functions/pedidosCliente');
  const { financeiroPedido, situacaoFinanceira } = await import('../src/utils/pedido.mjs');
  const pedido = respostaPedido({ status: 'entregue', statusFinanceiro: 'reembolsado', statusLogistico: 'entregue', valorReembolsado: 1000, pagamentoId: 'interno' });
  assert.equal(pedido.statusLogistico, 'entregue');
  assert.equal(pedido.bloqueadoParaExpedicao, true);
  assert.equal('pagamentoId' in pedido, false);
  assert.equal(financeiroPedido(pedido), 'reembolsado');
  assert.equal(situacaoFinanceira(financeiroPedido(pedido)).titulo, 'Pagamento reembolsado');
  assert.equal(financeiroPedido({ status: 'cancelado' }), 'desconhecido');
});

test('PAG-09: reembolso concorrente com preparação mantém estado coerente e estoque correto', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('boleto');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  falhas.status = 'refunded';
  falhas.pagamento = { date_last_updated: '2026-11-15T13:00:00.000Z' };
  await Promise.allSettled([
    servidor.atualizarLogistica({ id: 'pedido-1', status: 'em_separacao' }),
    servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } }),
  ]);
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'reembolsado');
  assert.equal(servidor.pedidos[0].statusLogistico, 'cancelado');
  assert.equal(servidor.estoques['produto-teste'].estoque, 10);
});

test('PAG-09: falha transacional não deixa reembolso e histórico aplicados pela metade', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  await servidor.enviar('boleto');
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  falhas.status = 'refunded';
  falhas.pagamento = { date_last_updated: '2026-11-15T13:00:00.000Z' };
  falhas.notificacao = true;
  assert.equal((await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } })).statusCode, 503);
  assert.equal(servidor.pedidos[0].statusFinanceiro, 'aprovado');
  assert.equal(servidor.pedidos[0].statusLogistico, 'pronto_para_preparo');
  assert.equal(servidor.pedidos[0].historicoFinanceiro?.length || 0, 0);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

const dadosAdesao = (extras = {}) => ({ plano: 'SUB-02', metodo: 'cartao', tokenCartao: 'token-cartao-teste',
  enderecoId: 'endereco-1', aceiteRecorrencia: true, ...extras });

test('PAG-10: login e conta ativa são obrigatórios antes da autorização', async () => {
  const visitante = montarServidor(4990, undefined, { semSessao: true });
  assert.equal((await visitante.enviar('/api/assinatura/criar', dadosAdesao({ testarAutenticacao: true }))).statusCode, 401);
  assert.equal(visitante.autorizacoes.length, 0);
  const inativo = montarServidor(4990, undefined, { contaInativa: true });
  assert.equal((await inativo.enviar('/api/assinatura/criar', dadosAdesao())).statusCode, 403);
  assert.equal(inativo.autorizacoes.length, 0);
});

test('PAG-10: cobrança mensal é fixada em R$ 94,90, sem frete, preço ou destino controlados pelo cliente', async () => {
  const servidor = montarServidor(4990, async () => { throw new Error('Assinatura não deve cotar frete'); });
  const res = await servidor.enviar('/api/assinatura/criar', dadosAdesao({
    valorMensal: 0.01, amount: 0.01, transaction_amount: 0.01, freteCentavos: 99999,
    tituloAssinatura: 'Plano adulterado', back_url: 'https://destino-invalido.example', payer_email: 'outro@example.com',
    auto_recurring: { frequency: 12, transaction_amount: 1, free_trial: { frequency: 1 } },
  }));
  assert.equal(res.statusCode, 200);
  const cobranca = servidor.autorizacoes[0];
  assert.deepEqual(cobranca.auto_recurring, { frequency: 1, frequency_type: 'months', transaction_amount: 94.9, currency_id: 'BRL' });
  assert.equal(cobranca.payer_email, 'perfil@example.com');
  assert.equal(cobranca.reason, 'SUB-02 - Pequenos Criadores');
  assert.equal(cobranca.back_url, 'https://mini-stitches.example/clube?retorno=assinatura');
  assert.equal(servidor.adesoes[0].frete, 0);
  assert.equal(servidor.adesoes[0].plano.valor, 9490);
  assert.equal(servidor.adesoes[0].entrega.cep, '01001000');
  assert.equal(res.dados.assinatura.statusAdesao, 'aguardando_pagamento');
  assert.equal(servidor.adesoes[0].statusCaixa, 'aguardando_pagamento');
  assert.equal(servidor.adesoes[0].assinadoEm, undefined);
  for (const campo of ['tokenCartao', 'card_token_id', 'numeroCartao', 'cvv']) assert.equal(campo in servidor.adesoes[0], false);
});

test('PAG-10: plano antigo, Pix, falta de aceite, cartão bruto e endereço alheio são rejeitados', async () => {
  const servidor = montarServidor();
  for (const dados of [{ plano: 'trimestral' }, { plano: 'anual' }, { metodo: 'pix' }, { aceiteRecorrencia: false },
    { tokenCartao: '' }, { enderecoId: 'outro-endereco' }, { numeroCartao: '4111111111111111' }, { cvv: '123' }]) {
    assert.equal((await servidor.enviar('/api/assinatura/criar', dadosAdesao(dados))).statusCode, 400);
  }
  assert.equal(servidor.adesoes.length, 0);
  assert.equal(servidor.autorizacoes.length, 0);
  for (const [rota, httpMethod] of [['/admin/assinaturas', 'post'], ['/admin/planos', 'post'], ['/admin/planos/:id', 'delete'], ['/admin/assinaturas/:id', 'delete']]) {
    assert.equal((await servidor.enviar(rota, { httpMethod })).statusCode, 410);
  }
});

test('PAG-10: repetição da contratação reaproveita autorização e não cria outra recorrência', async () => {
  const servidor = montarServidor();
  const chaveTentativa = randomUUID();
  const dados = dadosAdesao({ chaveTentativa });
  const primeira = await servidor.enviar('/api/assinatura/criar', dados);
  const repetida = await servidor.enviar('/api/assinatura/criar', dados);
  assert.deepEqual(repetida.dados, primeira.dados);
  assert.equal(servidor.adesoes.length, 1);
  assert.equal(servidor.autorizacoes.length, 1);
});

test('PAG-10: duas solicitações simultâneas com a mesma chave autorizam uma única recorrência', async () => {
  const servidor = montarServidor();
  const dados = dadosAdesao({ chaveTentativa: randomUUID() });
  const respostas = await Promise.all([
    servidor.enviar('/api/assinatura/criar', dados), servidor.enviar('/api/assinatura/criar', dados),
  ]);
  assert.ok(respostas.some((resposta) => resposta.statusCode === 200));
  assert.ok(respostas.every((resposta) => [200, 409].includes(resposta.statusCode)));
  assert.equal(servidor.adesoes.length, 1);
  assert.equal(servidor.autorizacoes.length, 1);
});

test('PAG-10: falha no registro ou configuração não solicita recorrência; timeout não pode duplicá-la', async () => {
  for (const falhas of [{ registroClube: true }, { semAppUrl: true }]) {
    const servidor = montarServidor(4990, undefined, falhas);
    assert.equal((await servidor.enviar('/api/assinatura/criar', dadosAdesao())).statusCode, 503);
    assert.equal(servidor.autorizacoes.length, 0);
  }
  const falhas = { clube: true };
  const servidor = montarServidor(4990, undefined, falhas);
  const dados = dadosAdesao({ chaveTentativa: randomUUID() });
  assert.equal((await servidor.enviar('/api/assinatura/criar', dados)).statusCode, 503);
  falhas.clube = false;
  assert.equal((await servidor.enviar('/api/assinatura/criar', dados)).statusCode, 409);
  assert.equal(servidor.autorizacoes.length, 1);
  assert.equal(servidor.adesoes[0].statusAdesao, 'resultado_desconhecido');
});

test('PAG-10: contrato só pode ser consultado pelo dono e a oferta pública é única', async () => {
  const falhas = {};
  const servidor = montarServidor(4990, undefined, falhas);
  const oferta = await servidor.enviar('/api/assinatura/plano', { httpMethod: 'get' });
  assert.equal(oferta.dados.plano.codigo, 'SUB-02');
  assert.equal(oferta.dados.plano.valor, 9490);
  const res = await servidor.enviar('/api/assinatura/criar', dadosAdesao());
  const parametros = { id: res.dados.assinatura.id };
  assert.equal((await servidor.enviar('/assinatura/:id', { httpMethod: 'get', parametros })).statusCode, 200);
  falhas.clienteId = 'outro-cliente';
  assert.equal((await servidor.enviar('/assinatura/:id', { httpMethod: 'get', parametros })).statusCode, 404);
});

test('PAG-10: modelo aceita SUB-02 e não permite cadastrar novamente planos antigos', async () => {
  const { Assinatura } = require('../backend/db/mongodb');
  const base = { clienteId: '507f1f77bcf86cd799439012', plano: { codigo: 'SUB-02', nome: 'mensal', valor: 9490 }, frete: 0 };
  const assinatura = new Assinatura(base);
  await assinatura.validate();
  assert.equal(assinatura.assinadoEm, undefined);
  assert.equal(assinatura.statusCaixa, 'aguardando_pagamento');
  for (const plano of [{ nome: 'mensal', valor: 8990 }, { nome: 'trimestral', valor: 24000 }]) {
    await assert.rejects(new Assinatura({ ...base, plano }).validate());
  }
});

function montarRecorrencia(opcoes = {}) {
  const clone = (valor) => JSON.parse(JSON.stringify(valor));
  const colecoes = { Assinatura: [], MensalidadeClube: [], CaixaClube: [], CalendarioClube: [], OperacaoClube: [] };
  const contexto = { falhaCaixa: false, falhaOperacao: Boolean(opcoes.falhaOperacao), faturas: [], pagamentos: {}, colecoes };
  const corresponde = (item, filtro) => Object.entries(filtro).every(([chave, esperado]) => {
    if (chave === '$or') return esperado.some((alternativa) => corresponde(item, alternativa));
    const atual = chave.split('.').reduce((valor, parte) => valor?.[parte], item);
    if (esperado && typeof esperado === 'object' && !(esperado instanceof Date)) {
      if ('$in' in esperado) return esperado.$in.includes(atual);
      if ('$exists' in esperado) return (atual !== undefined) === esperado.$exists;
      if ('$ne' in esperado) return (atual ?? null) !== esperado.$ne;
      if ('$gt' in esperado) return new Date(atual) > new Date(esperado.$gt);
      if ('$lte' in esperado) return new Date(atual) <= new Date(esperado.$lte);
    }
    return atual === esperado;
  });
  const modelos = {};
  for (const [nome, lista] of Object.entries(colecoes)) {
    const atualizar = (filtro, dados, opcoes = {}) => {
      if (nome === 'CaixaClube' && contexto.falhaCaixa) throw new Error('Falha de persistência');
      if (nome === 'OperacaoClube' && contexto.falhaOperacao) throw new Error('Falha ao salvar operação');
      let item = lista.find((valor) => corresponde(valor, filtro));
      if (!item && opcoes.upsert) { item = { _id: `${nome}-${lista.length + 1}`, ...filtro, ...clone(dados.$setOnInsert || {}) }; lista.push(item); }
      if (!item) return null;
      Object.assign(item, clone(dados.$set || {}));
      for (const [chave, valor] of Object.entries(dados.$inc || {})) item[chave] = (item[chave] || 0) + valor;
      for (const [chave, valor] of Object.entries(dados.$push || {})) (item[chave] ||= []).push(clone(valor));
      return clone(item);
    };
    modelos[nome] = {
      async init() {},
      async findById(id) { return clone(lista.find((item) => item._id === id) || null); },
      async findOne(filtro) { return clone(lista.find((item) => corresponde(item, filtro)) || null); },
      find(filtro) { return { sort() { return this; }, limit() { return this; }, session() { return this; }, async lean() { return clone(lista.filter((item) => corresponde(item, filtro))); } }; },
      async updateOne(filtro, dados, opcoes) { const item = atualizar(filtro, dados, opcoes); return { matchedCount: item ? 1 : 0 }; },
      async findOneAndUpdate(filtro, dados, opcoes) { return atualizar(filtro, dados, opcoes); },
      async updateMany(filtro, dados, opcoes) {
        for (const item of lista.filter((item) => corresponde(item, filtro))) atualizar({ _id: item._id }, dados, opcoes);
      },
    };
  }
  let fila = Promise.resolve();
  const executarTransacao = (operacao) => {
    const proxima = fila.then(async () => {
      const copia = clone(colecoes);
      try { return await operacao({ teste: true }); }
      catch (erro) {
        for (const [nome, lista] of Object.entries(colecoes)) lista.splice(0, lista.length, ...copia[nome]);
        throw erro;
      }
    });
    fila = proxima.catch(() => {});
    return proxima;
  };
  colecoes.Assinatura.push({ _id: '507f1f77bcf86cd799439011', clienteId: 'cliente-a', preapprovalId: 'acordo-123',
    plano: { codigo: 'SUB-02', valor: 9490 }, entrega: { cep: '01001000' }, statusAdesao: 'aguardando_pagamento' });
  const acordo = { id: 'acordo-123', external_reference: '507f1f77bcf86cd799439011', status: 'authorized',
    auto_recurring: { frequency: 1, frequency_type: 'months', currency_id: 'BRL', transaction_amount: 94.9 } };
  const chamadasCancelamento = [];
  const chamadasReembolso = [];
  const reembolsos = new Map();
  let hora = new Date('2026-11-10T16:00:00Z');
  const preApprovalModule = { search: async () => ({ paging: { total: opcoes.buscaAmbigua ? 2 : 1 },
    results: opcoes.buscaAmbigua ? [clone(acordo), { ...clone(acordo), id: 'outro-acordo' }] : [clone(acordo)] }), get: async () => {
    if (opcoes.falhaConsultaAcordo) throw new Error('Timeout de consulta');
    return clone(acordo);
  }, update: async (pedido) => {
    chamadasCancelamento.push(clone(pedido));
    if (opcoes.falhaCancelar) throw new Error('Timeout de cancelamento');
    acordo.status = 'cancelled';
    if (opcoes.timeoutAposCancelar) throw new Error('Resposta perdida');
    return clone(acordo);
  } };
  const paymentModule = { get: async ({ id }) => clone(contexto.pagamentos[id]), update: async (pedido) => {
    chamadasCancelamento.push(clone(pedido));
    if (opcoes.aprovarDuranteCancelamento) {
      Object.assign(contexto.pagamentos[pedido.id], { status: 'approved', date_approved: '2026-11-10T16:01:00Z',
        date_last_updated: '2027-03-01T12:00:01Z' });
      throw new Error('Pagamento já aprovado');
    }
    contexto.pagamentos[pedido.id].status = 'cancelled';
  } };
  const refundModule = { get: async ({ refund_id }) => clone([...reembolsos.values()].find((item) => String(item.id) === refund_id)),
    create: async (pedido) => {
      chamadasReembolso.push(clone(pedido));
      const chave = pedido.requestOptions.idempotencyKey;
      if (opcoes.falhaReembolso) throw new Error('Timeout token-sensivel');
      if (!reembolsos.has(chave)) {
        const resposta = { id: reembolsos.size + 1, payment_id: pedido.payment_id, amount: pedido.body.amount,
          status: opcoes.reembolsoPendente ? 'in_process' : 'approved' };
        reembolsos.set(chave, resposta);
        if (!opcoes.reembolsoPendente) Object.assign(contexto.pagamentos[pedido.payment_id], {
          status: 'refunded', transaction_amount_refunded: 94.9, date_last_updated: '2027-03-02T12:00:00Z' });
      }
      if (opcoes.timeoutAposReembolso) throw new Error('Resposta perdida');
      return clone(reembolsos.get(chave));
    } };
  const cancelamento = criarCancelamentoClube({ ...modelos, executarTransacao, preApprovalModule, paymentModule,
    refundModule, agora: () => new Date(hora), logger: { error() {} } });
  const conciliador = criarConciliadorClube({ ...modelos, executarTransacao,
    preApprovalModule, cancelamento: opcoes.cancelamento ? cancelamento : undefined,
    consultaFaturas: { obter: async (id) => clone(contexto.faturas.find((item) => String(item.id) === id)),
      buscar: async (filtro) => clone(filtro.payment_id ? contexto.faturas.filter((item) => String(item.payment?.id) === filtro.payment_id) : contexto.faturas) },
    paymentModule,
  });
  const processar = (evento) => conciliador({ recebidoEm: new Date(hora), ...evento });
  const app = {};
  const rotas = new Map();
  for (const metodo of ['get', 'put', 'patch', 'post']) app[metodo] = (url, ...handlers) => rotas.set(`${metodo} ${url}`, handlers);
  const { autenticar, autenticarAdmin } = require('../backend/functions/autenticacao').criarAutenticacao({ jwtSecret: 'teste' });
  registrarRotasClube({ app, autenticar, autenticarAdmin, ...modelos, executarTransacao });
  registrarRotasCancelamento({ app, autenticar, autenticarAdmin, ...modelos, cancelamento, processarRecorrencia: processar, cronSecret: 'segredo-cron-testes' });
  return { ...contexto, acordo, modelos, processar, cancelamento, chamadasCancelamento, chamadasReembolso, reembolsos,
    definirHora(valor) { hora = new Date(valor); },
    falharOperacao(valor) { contexto.falhaOperacao = valor; },
    falharCaixa(valor) { contexto.falhaCaixa = valor; },
    adicionar(id, aprovadoEm, vencimento = aprovadoEm, status = 'approved') {
      contexto.faturas.push({ id, preapproval_id: 'acordo-123', currency_id: 'BRL', transaction_amount: 94.9,
        debit_date: vencimento, last_modified: '2027-03-01T12:00:00Z', payment: { id: `pag-${id}` } });
      contexto.pagamentos[`pag-${id}`] = { id: `pag-${id}`, currency_id: 'BRL', transaction_amount: 94.9,
        payment_type_id: 'credit_card', date_approved: aprovadoEm, date_last_updated: '2027-03-01T12:00:00Z', status };
    },
    async enviar(metodo, url, body = {}, { clienteId = 'cliente-a', perfil = 'admin', params = {}, headers = {} } = {}) {
      const req = { headers, session: { usuarioId: clienteId, perfil }, params, body };
      const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, set() { return this; }, json(dados) { this.dados = dados; return this; } };
      const [auth, handler] = rotas.get(`${metodo} ${url}`);
      if (!handler) { await auth(req, res); return res; }
      let autorizado = false;
      auth(req, res, () => { autorizado = true; });
      if (autorizado) await handler(req, res);
      return res;
    },
  };
}

test('PAG-11: corte inclusivo às 12h de Brasília, milissegundo seguinte e mudança de ano', () => {
  for (const [instante, mes] of [
    ['2026-11-10T14:59:59.999Z', '2026-11'], ['2026-11-10T15:00:00.000Z', '2026-11'],
    ['2026-11-10T15:00:00.001Z', '2026-12'], ['2026-12-31T23:59:59-03:00', '2027-01'],
    ['2026-12-01T01:00:00Z', '2026-12'],
  ]) assert.equal(primeiraCompetencia(instante), mes);
  assert.throws(() => primeiraCompetencia('inválida'));
  assert.throws(() => validarPostagem('2027-02', '2027-02-30'));
  assert.throws(() => validarPostagem('2026-11', '2026-11-09'));
});

test('PAG-11: dia 31 volta após fevereiro, inclusive bissexto; atraso altera lote e preserva competência', () => {
  assert.equal(vencimentoMensal('2027-01-31T12:00:00-03:00', 1), '2027-02-28');
  assert.equal(vencimentoMensal('2027-01-31T12:00:00-03:00', 2), '2027-03-31');
  assert.equal(vencimentoMensal('2028-01-31T12:00:00-03:00', 1), '2028-02-29');
  assert.equal(loteElegivel('2026-12', '2026-12-10T12:00:00-03:00'), '2026-12');
  assert.equal(loteElegivel('2026-12', '2026-12-10T12:00:01-03:00'), '2027-01');
  assert.equal(loteElegivel('2026-12', '2027-02-05T12:00:00-03:00'), '2027-02');
});

test('PAG-11: primeira aprovação ativa; renovação avança caixa sem reaplicar corte de adesão', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('1', '2026-11-15T12:00:00-03:00');
  sistema.adicionar('2', '2026-12-15T12:00:00-03:00');
  await sistema.processar({ tipo: 'subscription_authorized_payment', id: '2' });
  assert.equal(sistema.colecoes.Assinatura[0].statusAdesao, 'ativa');
  assert.equal(sistema.colecoes.Assinatura[0].assinadoEm, '2026-11-15T15:00:00.000Z');
  assert.deepEqual(sistema.colecoes.CaixaClube.map((item) => [item.competencia, item.lote]), [['2026-12', '2026-12'], ['2027-01', '2027-01']]);
  assert.deepEqual(sistema.colecoes.MensalidadeClube.map((item) => item.vencimentoContratual), ['2026-11-15', '2026-12-15']);
});

test('PAG-11: aprovação tardia da renovação adia postagem e não gera nova caixa no replay', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
  sistema.adicionar('2', '2026-12-11T12:00:00-03:00', '2026-12-05T12:00:00-03:00');
  await sistema.processar({ tipo: 'payment', id: 'pag-2' });
  assert.equal(sistema.colecoes.CaixaClube[1].competencia, '2026-12');
  assert.equal(sistema.colecoes.CaixaClube[1].lote, '2027-01');
  sistema.colecoes.CaixaClube[1].statusPreparacao = 'preparando';
  sistema.colecoes.CaixaClube[1].postagemPrevista = '2027-01-11';
  await Promise.all(Array.from({ length: 4 }, () => sistema.processar({ tipo: 'subscription_authorized_payment', id: '2' })));
  assert.equal(sistema.colecoes.CaixaClube.length, 2);
  assert.equal(sistema.colecoes.MensalidadeClube.length, 2);
  assert.equal(sistema.colecoes.CaixaClube[1].statusPreparacao, 'preparando');
  assert.equal(sistema.colecoes.CaixaClube[1].postagemPrevista, '2027-01-11');
});

test('PAG-11: faturas fora de ordem no provedor mantêm a primeira caixa e os meses corretos', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('2', '2026-12-05T12:00:00-03:00');
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
  await sistema.processar({ tipo: 'subscription_authorized_payment', id: '2' });
  await sistema.processar({ tipo: 'subscription_authorized_payment', id: '1' });
  assert.deepEqual(sistema.colecoes.CaixaClube.map((item) => item.competencia), ['2026-11', '2026-12']);
});

test('PAG-11: autorização, pendência e recusa não ativam nem liberam postagem', async () => {
  const sistema = montarRecorrencia();
  await sistema.processar({ tipo: 'subscription_preapproval', id: 'acordo-123' });
  for (const status of ['pending', 'rejected']) {
    sistema.adicionar(status, null, '2026-11-05T12:00:00-03:00', status);
  }
  await sistema.processar({ tipo: 'subscription_preapproval', id: 'acordo-123' });
  assert.equal(sistema.colecoes.Assinatura[0].statusAdesao, 'aguardando_pagamento');
  assert.equal(sistema.colecoes.CaixaClube.length, 0);
  assert.equal(sistema.colecoes.MensalidadeClube.length, 2);
});

test('PAG-11: reembolso e contestação bloqueiam expedição; versão antiga não desfaz bloqueio', async () => {
  for (const status of ['refunded', 'charged_back', 'in_mediation']) {
    const sistema = montarRecorrencia();
    sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
    await sistema.processar({ tipo: 'payment', id: 'pag-1' });
    Object.assign(sistema.pagamentos['pag-1'], { status, date_last_updated: '2027-03-02T12:00:00Z' });
    await sistema.processar({ tipo: 'payment', id: 'pag-1' });
    assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, true);
    Object.assign(sistema.pagamentos['pag-1'], { status: 'approved', date_last_updated: '2027-03-01T12:00:00Z' });
    await sistema.processar({ tipo: 'payment', id: 'pag-1' });
    assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, true);
  }
});

test('PAG-11: falha na gravação reverte mensalidade, ativação e caixa e permite nova notificação', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
  sistema.falharCaixa(true);
  await assert.rejects(sistema.processar({ tipo: 'payment', id: 'pag-1' }));
  assert.equal(sistema.colecoes.MensalidadeClube.length, 0);
  assert.equal(sistema.colecoes.Assinatura[0].statusAdesao, 'aguardando_pagamento');
  sistema.falharCaixa(false);
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.colecoes.CaixaClube.length, 1);
});

test('PAG-11: valor, moeda, cartão e vínculo são conferidos na API, antes de persistir', async () => {
  for (const adulteracao of [{ transaction_amount: 0.01 }, { currency_id: 'USD' },
    { payment_type_id: 'account_money' }, { id: 'outro-pagamento' }, { date_approved: 'inválida' }]) {
    const sistema = montarRecorrencia();
    sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
    Object.assign(sistema.pagamentos['pag-1'], adulteracao);
    await assert.rejects(sistema.processar({ tipo: 'payment', id: 'pag-1' }));
    assert.equal(sistema.colecoes.CaixaClube.length, 0);
  }
  const sistema = montarRecorrencia();
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
  sistema.faturas[0].preapproval_id = 'outra-assinatura';
  await assert.rejects(sistema.processar({ tipo: 'subscription_preapproval', id: 'acordo-123' }));
});

test('PAG-11: calendário operacional ajusta dia sem alterar competência e exige administrador', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.colecoes.CaixaClube[0].postagemPrevista, undefined);
  const body = { postagemPrevista: '2026-11-11', operacaoConfirmada: true };
  const params = { mes: '2026-11' };
  assert.equal((await sistema.enviar('put', '/admin/clube/calendario/:mes', body, { params, perfil: 'cliente' })).statusCode, 403);
  assert.equal((await sistema.enviar('put', '/admin/clube/calendario/:mes', body, { params, clienteId: null })).statusCode, 401);
  assert.equal((await sistema.enviar('put', '/admin/clube/calendario/:mes', { ...body, operacaoConfirmada: false }, { params })).statusCode, 400);
  assert.equal((await sistema.enviar('put', '/admin/clube/calendario/:mes', body, { params })).statusCode, 200);
  assert.equal(sistema.colecoes.CaixaClube[0].postagemPrevista, '2026-11-11');
  assert.equal(sistema.colecoes.CaixaClube[0].competencia, '2026-11');
  const propria = await sistema.enviar('get', '/api/clube/caixas', {}, { perfil: 'cliente' });
  assert.equal(propria.dados.caixas.length, 1);
  assert.equal(propria.dados.caixas[0].pagamentoId, undefined);
  assert.equal((await sistema.enviar('get', '/api/clube/caixas', {}, { clienteId: 'outro-cliente', perfil: 'cliente' })).dados.caixas.length, 0);
});

test('PAG-11: caixa paga antes do cancelamento continua devida; posterior fica bloqueada', async () => {
  const sistema = montarRecorrencia();
  Object.assign(sistema.colecoes.Assinatura[0], { canceladoEm: '2026-12-01T12:00:00-03:00', statusAdesao: 'cancelada' });
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
  sistema.adicionar('2', '2026-12-05T12:00:00-03:00');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.colecoes.Assinatura[0].statusAdesao, 'cancelada');
  const expedir = await sistema.enviar('get', '/admin/clube/caixas');
  assert.equal(expedir.dados.caixas.length, 1);
  assert.equal(expedir.dados.caixas[0].competencia, '2026-11');
  assert.equal(sistema.colecoes.CaixaClube[1].bloqueadaParaReembolso, true);
});

test('PAG-11: expedição exige pagamento, calendário e rastreio; ocorrência preservada no replay', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  const params = { id: sistema.colecoes.CaixaClube[0]._id };
  assert.equal((await sistema.enviar('patch', '/admin/clube/caixas/:id', { statusPreparacao: 'preparando' }, { params })).statusCode, 200);
  assert.equal((await sistema.enviar('patch', '/admin/clube/caixas/:id', { statusPreparacao: 'enviada', rastreio: 'BR123456789' }, { params })).statusCode, 409);
  const ocorrencia = { motivo: 'Unidade sem operação.', novaPrevisao: '2026-11-11', clienteInformado: true };
  assert.equal((await sistema.enviar('post', '/admin/clube/caixas/:id/ocorrencias', ocorrencia, { params })).statusCode, 200);
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.colecoes.CaixaClube[0].postagemPrevista, '2026-11-11');
  assert.equal(sistema.colecoes.CaixaClube[0].ocorrencias.length, 1);
  sistema.colecoes.CaixaClube[0].bloqueada = true;
  assert.equal((await sistema.enviar('patch', '/admin/clube/caixas/:id', { statusPreparacao: 'enviada', rastreio: 'BR123456789' }, { params })).statusCode, 409);
  sistema.colecoes.CaixaClube[0].bloqueada = false;
  assert.equal((await sistema.enviar('patch', '/admin/clube/caixas/:id', { statusPreparacao: 'enviada', rastreio: 'BR123456789' }, { params })).statusCode, 200);
  assert.equal(sistema.colecoes.CaixaClube[0].rastreio, 'BR123456789');
});

test('PAG-11: REST de faturas percorre páginas e falha com histórico truncado', async () => {
  const urls = [];
  const consulta = criarConsultaFaturas({ accessToken: 'teste', fetchImpl: async (url, opcoes) => {
    urls.push(String(url));
    assert.equal(opcoes.headers.Authorization, 'Bearer teste');
    return { ok: true, json: async () => ({ paging: { total: 2 }, results: [{ id: urls.length }] }) };
  } });
  assert.equal((await consulta.buscar({ preapproval_id: 'acordo-123' })).length, 2);
  assert.match(urls[1], /offset=1/);
  const incompleta = criarConsultaFaturas({ accessToken: 'teste', fetchImpl: async () => ({ ok: true,
    json: async () => ({ paging: { total: 1 }, results: [] }) }) });
  await assert.rejects(incompleta.buscar({ preapproval_id: 'acordo-123' }));
  await assert.rejects(consulta.obter('../injetado'));
});

test('PAG-11: tópicos recorrentes passam pelo HMAC; assinatura inválida não consulta provedor', async () => {
  const chamadas = [];
  const servidor = montarServidor(4990, undefined, { conciliacaoClube: async (evento) => chamadas.push(evento) });
  for (const type of ['subscription_preapproval', 'subscription_authorized_payment']) {
    assert.equal((await servidor.enviar('/api/webhook', { type, data: { id: 'fatura-1' } })).statusCode, 200);
    assert.equal(chamadas.at(-1).tipo, type);
    assert.equal((await servidor.enviar('/api/webhook', { type, data: { id: 'fatura-1' }, headers: {} })).statusCode, 401);
  }
  assert.equal(chamadas.length, 2);
});

test('PAG-11: nova tentativa de fatura recusada pode aprovar uma única caixa com histórico preservado', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('1', null, '2026-11-05T12:00:00-03:00', 'rejected');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  sistema.faturas[0].payment.id = 'pag-2';
  sistema.pagamentos['pag-2'] = { ...sistema.pagamentos['pag-1'], id: 'pag-2', status: 'approved',
    date_approved: '2026-11-06T12:00:00-03:00', date_last_updated: '2027-03-02T12:00:00Z' };
  await sistema.processar({ tipo: 'payment', id: 'pag-2' });
  await sistema.processar({ tipo: 'payment', id: 'pag-2' });
  assert.equal(sistema.colecoes.MensalidadeClube.length, 1);
  assert.equal(sistema.colecoes.CaixaClube.length, 1);
  assert.equal(sistema.colecoes.MensalidadeClube[0].pagamentoId, 'pag-2');
  assert.equal(sistema.colecoes.MensalidadeClube[0].tentativasAnteriores[0].pagamentoId, 'pag-1');
});

test('PAG-11: vencimento divergente do dia original fica identificado para conciliação administrativa', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('1', '2027-01-31T12:00:00-03:00');
  sistema.adicionar('2', '2027-02-28T12:00:00-03:00');
  sistema.adicionar('3', '2027-03-28T12:00:00-03:00');
  await sistema.processar({ tipo: 'payment', id: 'pag-3' });
  assert.equal(sistema.colecoes.Assinatura[0].diaCobrancaOriginal, 31);
  assert.equal(sistema.colecoes.MensalidadeClube[1].cobrancaDivergente, false);
  assert.equal(sistema.colecoes.MensalidadeClube[2].vencimentoContratual, '2027-03-31');
  assert.equal(sistema.colecoes.MensalidadeClube[2].cobrancaDivergente, true);
  const resposta = await sistema.enviar('get', '/admin/clube/mensalidades');
  assert.equal(resposta.dados.mensalidades.length, 3);
  assert.equal((await sistema.enviar('get', '/admin/clube/mensalidades', {}, { perfil: 'cliente' })).statusCode, 403);
});

test('PAG-11: índices únicos protegem mensalidade, pagamento e caixa; esquema não aceita fração de centavo', async () => {
  const { MensalidadeClube, CaixaClube } = require('../backend/db/mongodb');
  for (const modelo of [MensalidadeClube, CaixaClube]) {
    assert.ok(modelo.schema.indexes().some(([campos, opcoes]) => campos.pagamentoId && opcoes.unique));
    assert.ok(modelo.schema.indexes().some(([campos, opcoes]) => campos.assinaturaId && campos.competencia && opcoes.unique));
  }
  const base = { _id: 'fatura-1', assinaturaId: '507f1f77bcf86cd799439011', clienteId: '507f1f77bcf86cd799439012',
    preapprovalId: 'acordo-123', valor: 9490, statusFinanceiro: 'aguardando_pagamento',
    recebidoEm: new Date(), provedorAtualizadoEm: new Date(), vencimentoProvedor: new Date() };
  await new MensalidadeClube(base).validate();
  await assert.rejects(new MensalidadeClube({ ...base, valor: 9490.5 }).validate());
});

test('PAG-11: mesma versão com status conflitante falha sem liberar caixa bloqueada', async () => {
  const sistema = montarRecorrencia();
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00', undefined, 'refunded');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  sistema.pagamentos['pag-1'].status = 'approved';
  await assert.rejects(sistema.processar({ tipo: 'payment', id: 'pag-1' }));
  assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, true);
});

test('PAG-11: pagamento conhecido sem fatura visível solicita reenvio; desconhecido é ignorado', async () => {
  const sistema = montarRecorrencia();
  await assert.rejects(sistema.processar({ tipo: 'payment', id: 'pag-1', referencia: '507f1f77bcf86cd799439011' }));
  assert.equal(await sistema.processar({ tipo: 'payment', id: 'outro' }), 'sem_vinculo');
  assert.equal(sistema.colecoes.CaixaClube.length, 0);
});

test('PAG-11: resposta e timeout da adesão não regridem ativação já conciliada', async () => {
  for (const falha of [false, true]) {
    const servidor = montarServidor(4990, undefined, { clube: falha,
      antesRespostaClube: async (adesao) => { adesao.statusAdesao = 'ativa'; adesao.assinadoEm = '2026-11-05T12:00:00-03:00'; } });
    await servidor.enviar('/api/assinatura/criar', dadosAdesao());
    assert.equal(servidor.adesoes[0].statusAdesao, 'ativa');
    assert.equal(servidor.adesoes[0].assinadoEm, '2026-11-05T12:00:00-03:00');
  }
});

const assinaturaTesteId = '507f1f77bcf86cd799439011';

test('PAG-12: cancelamento exige dono autenticado e ignora data e pagamento enviados pelo navegador', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  const params = { id: assinaturaTesteId };
  const rota = '/api/assinaturas/:id/cancelar';
  assert.equal((await sistema.enviar('post', rota, {}, { params, clienteId: null })).statusCode, 401);
  assert.equal((await sistema.enviar('post', rota, {}, { params, clienteId: 'outra-conta' })).statusCode, 404);
  assert.equal(sistema.chamadasCancelamento.length, 0);
  const res = await sistema.enviar('post', rota, { canceladoEm: '2020-01-01', pagamentoId: 'alheio', valor: 0.01 }, { params });
  assert.equal(res.statusCode, 200);
  assert.equal(res.dados.assinatura.canceladoEm, '2026-11-10T16:00:00.000Z');
  assert.equal(res.dados.assinatura.cancelamentoEstado, 'confirmado');
  assert.equal(sistema.chamadasCancelamento[0].body.status, 'cancelled');
});

test('PAG-12: falha no registro não cancela no gateway e desfaz a alteração local', async () => {
  const sistema = montarRecorrencia({ cancelamento: true, falhaOperacao: true });
  await assert.rejects(sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId));
  assert.equal(sistema.colecoes.Assinatura[0].canceladoEm, undefined);
  assert.equal(sistema.chamadasCancelamento.length, 0);
  assert.equal(sistema.colecoes.OperacaoClube.length, 0);
});

test('PAG-12: caixas já aprovadas e em preparação continuam devidas sem estorno automático', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  sistema.adicionar('1', '2026-11-05T12:00:00-03:00');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  sistema.colecoes.CaixaClube[0].statusPreparacao = 'preparando';
  sistema.colecoes.CaixaClube[0].postagemPrevista = '2026-11-11';
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  await sistema.processar({ tipo: 'subscription_authorized_payment', id: '1' });
  assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, false);
  assert.equal(sistema.colecoes.CaixaClube[0].statusPreparacao, 'preparando');
  assert.equal(sistema.colecoes.CaixaClube[0].postagemPrevista, '2026-11-11');
  assert.equal((await sistema.enviar('get', '/admin/clube/caixas')).dados.caixas.length, 1);
  assert.equal(sistema.chamadasReembolso.length, 0);
});

test('PAG-12: aprovação anterior com webhook atrasado preserva inclusive primeira caixa futura', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  sistema.definirHora('2026-11-16T12:00:00Z');
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-15T12:00:00-03:00');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.colecoes.Assinatura[0].statusAdesao, 'cancelada');
  assert.equal(sistema.colecoes.CaixaClube[0].competencia, '2026-12');
  assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, false);
  assert.equal(sistema.chamadasReembolso.length, 0);
});

test('PAG-12: aprovação posterior solicita reembolso integral, bloqueia envio e preserva um vínculo', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-10T16:01:00Z');
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.chamadasReembolso.length, 1);
  assert.equal(sistema.chamadasReembolso[0].body.amount, 94.9);
  assert.equal(sistema.colecoes.CaixaClube[0].bloqueadaParaReembolso, true);
  assert.equal(sistema.colecoes.CaixaClube[0].reembolsoEstado, 'solicitado');
  assert.equal((await sistema.enviar('get', '/admin/clube/caixas')).dados.caixas.length, 0);
  await Promise.all(Array.from({ length: 3 }, () => sistema.processar({ tipo: 'payment', id: 'pag-1' })));
  sistema.definirHora('2026-11-10T16:04:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.chamadasReembolso.length, 1);
  assert.equal(sistema.reembolsos.size, 1);
  assert.equal(sistema.colecoes.CaixaClube.length, 1);
  assert.equal(sistema.colecoes.CaixaClube[0].reembolsoEstado, 'concluido');
  assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, true);
});

test('PAG-12: concorrência no cancelamento mantém instante original e uma operação por assinatura', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  await Promise.all(Array.from({ length: 4 }, () => sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId)));
  const data = sistema.colecoes.Assinatura[0].canceladoEm;
  sistema.definirHora('2026-11-11T12:00:00Z');
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  assert.equal(sistema.colecoes.Assinatura[0].canceladoEm, data);
  assert.equal(sistema.colecoes.OperacaoClube.length, 1);
  assert.equal(sistema.chamadasCancelamento.length, 1);
});

test('PAG-12: timeout do provedor mantém cancelamento pendente e permite retomada com mesma chave', async () => {
  const opcoes = { cancelamento: true, falhaCancelar: true };
  const sistema = montarRecorrencia(opcoes);
  const primeiro = await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  assert.equal(primeiro.cancelamentoEstado, 'pendente');
  assert.equal(sistema.colecoes.OperacaoClube[0].estado, 'pendente');
  const chave = sistema.chamadasCancelamento[0].requestOptions.idempotencyKey;
  opcoes.falhaCancelar = false;
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.colecoes.Assinatura[0].cancelamentoEstado, 'confirmado');
  assert.equal(sistema.chamadasCancelamento[1].requestOptions.idempotencyKey, chave);
});

test('PAG-12: resposta perdida após cancelamento é conciliada sem outro PUT', async () => {
  const sistema = montarRecorrencia({ cancelamento: true, timeoutAposCancelar: true });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.colecoes.Assinatura[0].cancelamentoEstado, 'confirmado');
  assert.equal(sistema.chamadasCancelamento.length, 1);
});

test('PAG-12: cancelamento de pagamento pendente é solicitado ao provedor', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  sistema.adicionar('1', null, '2026-11-10T15:00:00Z', 'pending');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  assert.equal(sistema.pagamentos['pag-1'].status, 'cancelled');
  assert.equal(sistema.colecoes.CaixaClube.length, 0);
  assert.equal(sistema.chamadasCancelamento.filter((item) => item.id === 'pag-1').length, 1);
});

test('PAG-12: aprovação durante cancelamento de pendência gera reembolso, sem enviar caixa', async () => {
  const sistema = montarRecorrencia({ cancelamento: true, aprovarDuranteCancelamento: true });
  sistema.adicionar('1', null, '2026-11-10T15:00:00Z', 'pending');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.chamadasReembolso.length, 1);
  assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, true);
});

test('PAG-12: timeout após reembolso não duplica devolução e preserva chave e valor da requisição', async () => {
  const sistema = montarRecorrencia({ cancelamento: true, timeoutAposReembolso: true });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-10T16:01:00Z');
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  const operacao = sistema.colecoes.OperacaoClube.find((item) => item.tipo === 'reembolsar_pagamento');
  assert.equal(operacao.estado, 'pendente');
  assert.equal(operacao.valorSolicitado, 9490);
  sistema.definirHora('2026-11-10T16:04:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(operacao.estado, 'concluida');
  assert.equal(sistema.reembolsos.size, 1);
  assert.equal(sistema.chamadasReembolso.length, 1);
});

test('PAG-12: falha antes do reembolso retoma o mesmo POST e alerta no prazo interno conservador', async () => {
  const opcoes = { cancelamento: true, falhaReembolso: true };
  const sistema = montarRecorrencia(opcoes);
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-10T16:01:00Z');
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  const operacao = sistema.colecoes.OperacaoClube.find((item) => item.tipo === 'reembolsar_pagamento');
  assert.equal(operacao.limiteSolicitacaoEm, '2026-11-12T16:02:00.000Z');
  assert.equal(operacao.solicitadoEm, undefined);
  opcoes.falhaReembolso = false;
  sistema.definirHora('2026-11-10T16:04:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.chamadasReembolso.length, 2);
  assert.deepEqual(sistema.chamadasReembolso[0], sistema.chamadasReembolso[1]);
  assert.equal(sistema.reembolsos.size, 1);
});

test('PAG-12: reembolso ainda processando permanece bloqueado e é consultado sem novo POST', async () => {
  const sistema = montarRecorrencia({ cancelamento: true, reembolsoPendente: true });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-10T16:01:00Z');
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  sistema.definirHora('2026-11-10T16:04:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.chamadasReembolso.length, 1);
  assert.equal(sistema.colecoes.CaixaClube[0].reembolsoEstado, 'solicitado');
  assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, true);
  assert.equal(sistema.colecoes.OperacaoClube.find((item) => item.tipo === 'reembolsar_pagamento').estado, 'aguardando_provedor');
});

test('PAG-12: valor já devolvido parcialmente é descontado para completar restituição integral', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-10T16:01:00Z');
  sistema.pagamentos['pag-1'].transaction_amount_refunded = 10;
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.chamadasReembolso[0].body.amount, 84.9);
});

test('PAG-12: criação com resposta desconhecida pode ser encontrada e cancelada pela referência exata', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  delete sistema.colecoes.Assinatura[0].preapprovalId;
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  assert.equal(sistema.colecoes.Assinatura[0].preapprovalId, 'acordo-123');
  assert.equal(sistema.colecoes.Assinatura[0].cancelamentoEstado, 'confirmado');
  const ambiguo = montarRecorrencia({ cancelamento: true, buscaAmbigua: true });
  delete ambiguo.colecoes.Assinatura[0].preapprovalId;
  await ambiguo.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  assert.equal(ambiguo.chamadasCancelamento.length, 0);
  assert.equal(ambiguo.colecoes.Assinatura[0].cancelamentoEstado, 'pendente');
});

test('PAG-12: cron exige segredo e administração exige perfil, sem expor operações a outro cliente', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  const rota = '/api/clube/operacoes/processar';
  assert.equal((await sistema.enviar('get', rota)).statusCode, 401);
  assert.equal((await sistema.enviar('get', rota, {}, { headers: { authorization: 'Bearer inválido' } })).statusCode, 401);
  assert.equal((await sistema.enviar('get', rota, {}, { headers: { authorization: 'Bearer segredo-cron-testes' } })).statusCode, 200);
  assert.equal((await sistema.enviar('get', '/admin/clube/operacoes', {}, { perfil: 'cliente' })).statusCode, 403);
  assert.equal((await sistema.enviar('post', '/admin/clube/operacoes/processar', {}, { perfil: 'cliente' })).statusCode, 403);
});

test('PAG-12: esquema exige chave idempotente e impede reembolso acima da mensalidade', async () => {
  const { OperacaoClube } = require('../backend/db/mongodb');
  const base = { _id: 'reembolsar_pagamento:1', tipo: 'reembolsar_pagamento', assinaturaId: assinaturaTesteId,
    clienteId: '507f1f77bcf86cd799439012', chaveIdempotencia: randomUUID(), estado: 'pendente', identificadoEm: new Date() };
  await new OperacaoClube(base).validate();
  await assert.rejects(new OperacaoClube({ ...base, chaveIdempotencia: undefined }).validate());
  await assert.rejects(new OperacaoClube({ ...base, valorSolicitado: 9491 }).validate());
});

test('PAG-12: cancelamento durante autorização guarda ID remoto para retomada sem reabrir adesão', async () => {
  const retomadas = [];
  const servidor = montarServidor(4990, undefined, {
    retomaCancelamento: async (dados) => retomadas.push(dados),
    antesRespostaClube: async (adesao) => {
      adesao.statusAdesao = 'cancelada'; adesao.canceladoEm = '2026-11-10T16:00:00Z'; adesao.cancelamentoEstado = 'pendente';
    },
  });
  const resposta = await servidor.enviar('/api/assinatura/criar', dadosAdesao());
  assert.equal(servidor.adesoes[0].preapprovalId, 'acordo-123');
  assert.equal(servidor.adesoes[0].statusAdesao, 'cancelada');
  assert.equal(resposta.dados.assinatura.statusAdesao, 'cancelada');
  assert.equal(retomadas.length, 1);
  assert.equal(retomadas[0].assinaturaId, servidor.adesoes[0]._id);
});

test('PAG-13: pagamento e assinatura exigem autenticação antes de qualquer efeito', async () => {
  for (const rota of ['/api/pagamento/pix', '/api/pagamento/boleto', '/api/pagamento/cartao', '/api/assinatura/criar', '/perfil/cartoes']) {
    const servidor = montarServidor(4990, undefined, { semSessao: true });
    const res = await servidor.enviar(rota, { testarAutenticacao: true });
    assert.equal(res.statusCode, 401);
    assert.equal(servidor.cobrancas.length + servidor.autorizacoes.length + servidor.consultasConta.length, 0);
  }
});

test('PAG-13: conta desativada bloqueia inclusive replay de pagamento e assinatura já registrada', async () => {
  const opcoes = {};
  const servidor = montarServidor(4990, undefined, opcoes);
  const dados = { chaveTentativa: randomUUID(), testarAutenticacao: true };
  assert.equal((await servidor.enviar('cartao', dados)).statusCode, 200);
  const adesao = dadosAdesao({ testarAutenticacao: true });
  assert.equal((await servidor.enviar('/api/assinatura/criar', adesao)).statusCode, 200);
  opcoes.contaInativa = true;
  assert.equal((await servidor.enviar('cartao', dados)).statusCode, 403);
  assert.equal((await servidor.enviar('/api/assinatura/criar', adesao)).statusCode, 403);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.autorizacoes.length, 1);
});

test('PAG-13: falha ao consultar conta impede cobrança sem expor erro do banco', async () => {
  const servidor = montarServidor(4990, undefined, { consultaConta: true });
  const res = await servidor.enviar('cartao', { testarAutenticacao: true });
  assert.equal(res.statusCode, 503);
  assert.equal(servidor.cobrancas.length, 0);
  assert.equal(JSON.stringify(res.dados).includes('token-sensivel'), false);
});

test('PAG-13: JWT com papel antigo não preserva administração e algoritmos/payload inválidos são recusados', async () => {
  const jwt = require('jsonwebtoken');
  const secret = 'segredo-exclusivo-dos-testes-de-autorizacao';
  const conta = { status: true, perfil: 'cliente' };
  const auth = criarAutenticacao({ jwtSecret: secret, consultarConta: async () => conta });
  async function verificar(token, admin = true) {
    const req = { headers: { cookie: `token=${token}` }, session: {} };
    const res = { statusCode: 200, set() { return this; }, status(valor) { this.statusCode = valor; return this; }, json() {} };
    let liberado = false;
    await (admin ? auth.autenticarAdmin : auth.autenticar)(req, res, () => { liberado = true; });
    return { ...res, liberado };
  }
  const token = jwt.sign({ usuarioId: 'cliente-a', perfil: 'admin' }, secret);
  assert.equal((await verificar(token)).statusCode, 403);
  conta.perfil = 'admin';
  assert.equal((await verificar(token)).liberado, true);
  for (const invalido of [jwt.sign({ usuarioId: 'cliente-a' }, secret, { algorithm: 'HS384' }),
    jwt.sign({ usuarioId: { $ne: null } }, secret), jwt.sign({ perfil: 'admin' }, secret),
    jwt.sign({ usuarioId: 'cliente-a' }, secret, { expiresIn: -1 }), token + 'adulterado']) {
    assert.equal((await verificar(invalido, false)).statusCode, 401);
  }
});

test('PAG-13: PAN/CVV em campos diretos, variantes e estruturas aninhadas são rejeitados sem persistência', async () => {
  for (const dados of [{ numeroCartao: '4111111111111111' }, { card_number: '4111111111111111' },
    { cvv: '123' }, { CVV: '' }, { payload: { security_code: '123' } },
    { cards: [{ card: { number: '4111111111111111' } }] }, { numero: '4111 1111 1111 1111' }]) {
    for (const metodo of ['pix', 'boleto', 'cartao']) {
      const servidor = montarServidor();
      const res = await servidor.enviar(metodo, dados);
      assert.equal(res.statusCode, 400);
      assert.equal(servidor.cobrancas.length + servidor.tentativas.length, 0);
      assert.equal(JSON.stringify([servidor.logs, res.dados]).includes('4111111111111111'), false);
    }
    const servidor = montarServidor();
    assert.equal((await servidor.enviar('/api/assinatura/criar', dadosAdesao(dados))).statusCode, 400);
    assert.equal(servidor.adesoes.length, 0);
  }
});

test('PAG-13: token não pode ser objeto, número completo nem texto arbitrário; Pix não passa como cartão', async () => {
  for (const token of [{ id: 'token-teste' }, ['token-teste'], true, 123, '', 'x', '4111111111111111', 'token com espaços']) {
    const servidor = montarServidor();
    assert.equal((await servidor.enviar('cartao', { token })).statusCode, 400);
    assert.equal(servidor.cobrancas.length, 0);
    assert.equal((await servidor.enviar('/api/assinatura/criar', dadosAdesao({ tokenCartao: token }))).statusCode, 400);
  }
  const servidor = montarServidor();
  assert.equal((await servidor.enviar('cartao', { payment_method_id: 'pix' })).statusCode, 400);
});

test('PAG-13: replay também rejeita dados brutos em vez de devolvê-los ou aceitá-los silenciosamente', async () => {
  const servidor = montarServidor();
  const chaveTentativa = randomUUID();
  assert.equal((await servidor.enviar('cartao', { chaveTentativa })).statusCode, 200);
  assert.equal((await servidor.enviar('cartao', { chaveTentativa, dados: { cvv: '123' } })).statusCode, 400);
  assert.equal(servidor.cobrancas.length, 1);
});

test('PAG-13: resposta do provedor é reduzida antes de salvar e de responder ao checkout', async () => {
  const sensivel = { token: 'token-proibido-no-banco', card_number: '4111111111111111', cvv: '789',
    payer: { identification: { number: 'documento-do-titular' } }, access_token: 'credencial-proibida' };
  const servidor = montarServidor(4990, undefined, { respostaGateway: sensivel });
  const res = await servidor.enviar('cartao');
  const registros = JSON.stringify([servidor.tentativas, servidor.pedidos, servidor.logs, res.dados]);
  for (const valor of ['token-proibido-no-banco', '4111111111111111', 'documento-do-titular', 'credencial-proibida']) {
    assert.equal(registros.includes(valor), false);
  }
});

test('PAG-13: falha do gateway retorna mensagem fixa e não imprime corpo, token ou erro completo', async () => {
  const servidor = montarServidor(4990, undefined, { gateway: true });
  const res = await servidor.enviar('cartao');
  assert.equal(res.statusCode, 500);
  assert.equal(res.dados.mensagem, 'Não foi possível confirmar o pagamento. Consulte a tentativa antes de repetir.');
  assert.equal(JSON.stringify([servidor.logs, servidor.tentativas, res.dados]).includes('token-sensivel'), false);
});

function montarReferenciaCartao(alteracoes = {}) {
  const token = 'token-de-validacao-perfil';
  const usuario = { status: true, cartoes: [], async save() { this.salvo = true; } };
  const consultas = [];
  const dados = { id: token, status: 'active', luhn_validation: true, security_code_length: 3,
    last_four_digits: '1111', first_six_digits: '411111', expiration_month: 12,
    expiration_year: new Date().getUTCFullYear() + 2, date_due: new Date(Date.now() + 86400000).toISOString(),
    card_number: '4111111111111111', security_code: '123', cardholder: { name: 'Nome privado', identification: { number: 'documento-privado' } },
    ...alteracoes };
  const salvar = criarReferenciaCartao({ Usuario: { findById: async (id) => { consultas.push(id); return usuario; } },
    cardTokenModule: { get: async ({ id }) => { assert.equal(id, token); return dados; } } });
  return { token, usuario, consultas, salvar };
}

test('PAG-13: perfil salva apenas referência mascarada consultada no provedor, sem token/BIN/documento/CVV', async () => {
  const caso = montarReferenciaCartao();
  const cartoes = await caso.salvar('cliente-a', { tokenCartao: caso.token, clienteId: 'outra-conta', finalCartao: '9999' });
  assert.deepEqual(caso.consultas, ['cliente-a']);
  assert.equal(cartoes[0].finalCartao, '1111');
  assert.equal(cartoes[0].bandeira, 'visa');
  assert.equal(caso.usuario.salvo, true);
  const conteudo = JSON.stringify([caso.usuario.cartoes, cartoes]);
  for (const segredo of [caso.token, '4111111111111111', 'documento-privado', 'Nome privado', 'security_code', 'first_six_digits']) {
    assert.equal(conteudo.includes(segredo), false);
  }
});

test('PAG-13: perfil rejeita contrato antigo e token expirado, usado ou sem validação do provedor', async () => {
  const caso = montarReferenciaCartao();
  await assert.rejects(caso.salvar('cliente-a', { numero: '4111111111111111', cvv: '123' }));
  assert.equal(caso.consultas.length, 0);
  for (const alteracoes of [{ status: 'used' }, { id: 'outro-token' }, { date_due: '2020-01-01' },
    { luhn_validation: false }, { security_code_length: 0 }, { last_four_digits: '4111111111111111' }]) {
    const invalido = montarReferenciaCartao(alteracoes);
    await assert.rejects(invalido.salvar('cliente-a', { tokenCartao: invalido.token }));
    assert.equal(invalido.usuario.salvo, undefined);
  }
});

test('PAG-13: frontend do perfil envia PAN/CVV ao SDK e somente token à API da loja', async () => {
  const fonte = readFileSync(resolve(__dirname, '../src/Pages/Perfil.jsx'), 'utf8');
  const handler = fonte.slice(fonte.indexOf('  async function salvarCartao(e)'), fonte.indexOf('  async function excluirCartao'));
  const chamadas = [];
  const formularios = [];
  let dadosSdk;
  const runtime = { cartaoForm: { titular: 'Nome Teste', numero: '4111111111111111', validade: '12/30', cvv: '123', cpfTitular: '00000000000' },
    envioCartaoRef: { current: false }, setSalvandoCartao() {}, setCartaoForm: (dados) => formularios.push(dados),
    setCartoes() {}, setMostrarFormularioCartao() {}, alert() {},
    window: { MercadoPago: class { async createCardToken(dados) { dadosSdk = dados; return { id: 'token-gerado-pelo-sdk' }; } } },
    fetch: async (url, opcoes) => {
      chamadas.push({ url, opcoes });
      return { ok: true, json: async () => url === '/api/config' ? { publicKey: 'publica' } : { cartoes: [] } };
    },
  };
  await runInNewContext(handler + '\nsalvarCartao({ preventDefault() {} });', runtime);
  assert.equal(dadosSdk.cardNumber, '4111111111111111');
  assert.equal(dadosSdk.securityCode, '123');
  assert.deepEqual(JSON.parse(chamadas[1].opcoes.body), { tokenCartao: 'token-gerado-pelo-sdk' });
  assert.equal(formularios.at(-1).numero, '');
  assert.equal(formularios.at(-1).cvv, '');
});

test('PAG-13: produção recusa segredos ausentes/padrão/fracos e erro não contém seus valores', () => {
  for (const env of [{}, { SESSION_SECRET: 'mini-stitches-secret', JWT_SECRET: 'mini-stitches-secret' },
    { SESSION_SECRET: 'curta', JWT_SECRET: 'curta' }, { SESSION_SECRET: 'a'.repeat(64) }]) {
    assert.throws(() => segredosAplicacao({ NODE_ENV: 'production', ...env }), /Configure SESSION_SECRET/);
  }
  const seguro = { NODE_ENV: 'production', SESSION_SECRET: randomUUID(), JWT_SECRET: randomUUID() };
  assert.equal(segredosAplicacao(seguro).jwtSecret, seguro.JWT_SECRET);
});

test('PAG-13: esquema de cartão descarta PAN, CVV e token de gateway não utilizado', () => {
  const { Usuario } = require('../backend/db/mongodb');
  const usuario = new Usuario({ cartoes: [{ finalCartao: '1111', numero: '4111111111111111', cvv: '123', tokenGateway: 'token-nao-persistir' }] });
  const salvo = JSON.stringify(usuario.toObject());
  assert.equal(salvo.includes('4111111111111111'), false);
  assert.equal(salvo.includes('token-nao-persistir'), false);
  assert.equal(salvo.includes('cvv'), false);
});
