import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { situacaoPedido, historicoPedido, formatarData, formatarDinheiro } from '../src/utils/pedido.mjs';

const require = createRequire(import.meta.url);
const express = require('express');
const jwt = require('jsonwebtoken');
const { criarAutenticacao } = require('../backend/functions/autenticacao');
const { registrarRotasPedidosCliente } = require('../backend/functions/pedidosCliente');

const secret = 'segredo-exclusivo-dos-testes';
const fixture = {
  _id: '507f1f77bcf86cd799439011', numero: 'MS-1001', pagamentoId: '123456', clienteId: 'cliente-a',
  criadoEm: '2026-11-14T12:00:00.000Z', status: 'enviado', pagamento: 'pix',
  subtotal: 10000, frete: 1000, desconto: 550, total: 10450, rastreio: 'BR123456789',
  cliente: { nome: 'Cliente', email: 'privado@example.com' },
  entrega: { cep: '01001000', endereco: 'Rua de teste, 1', interno: 'privado' },
  itens: [{ produtoId: 'interno', nome: 'Kit', slug: 'kit', quantidade: 2, precoUnit: 5000 }],
  historicoStatus: [{ status: 'pago', em: '2026-11-14T12:00:00.000Z', interno: 'privado' }],
  campoInternoFuturo: 'nunca deve sair na resposta',
};

const consultas = [];
const query = (valor) => ({
  select() { return this; }, sort() { return this; }, limit() { return this; },
  async lean() { return valor; },
});
const Pedido = {
  findOne(filtro) {
    consultas.push(filtro);
    const encontrado = filtro.clienteId === fixture.clienteId
      && filtro.$or.some((alternativa) => Object.entries(alternativa).some(([chave, valor]) => fixture[chave] === valor));
    return query(encontrado ? fixture : null);
  },
  find(filtro) { return query(filtro.clienteId === fixture.clienteId ? [fixture] : []); },
};
let server;
let base;
before(async () => {
  const app = express();
  app.use((req, _res, next) => { req.session = {}; next(); });
  registrarRotasPedidosCliente(app, {
    Pedido, autenticar: criarAutenticacao({ jwtSecret: secret }).autenticar,
    isValidObjectId: (id) => /^[a-f\d]{24}$/i.test(id),
  });
  server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

function consultar(caminho, cliente = 'cliente-a') {
  const token = jwt.sign({ usuarioId: cliente, perfil: 'cliente' }, secret);
  return fetch(base + caminho, { headers: { Cookie: `token=${token}` } });
}

test('lista, detalhes e status exigem login e não permitem cache', async () => {
  for (const caminho of ['/api/pedidos', '/api/pedidos/MS-1001', '/api/pedidos/MS-1001/status']) {
    const res = await fetch(base + caminho);
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('cache-control'), 'private, no-store');
  }
});

test('outro cliente não acessa o pedido por número, pagamento ou ObjectId', async () => {
  for (const id of [fixture.numero, fixture.pagamentoId, fixture._id, 'inexistente']) {
    for (const sufixo of ['', '/status']) {
      const res = await consultar(`/api/pedidos/${id}${sufixo}`, 'cliente-b');
      assert.equal(res.status, 404);
      assert.deepEqual(await res.json(), { erro: 'Pedido não encontrado.' });
    }
  }
  const lista = await consultar('/api/pedidos', 'cliente-b');
  assert.deepEqual(await lista.json(), { pedidos: [] });
});

test('token adulterado não consulta o banco nem revela o pedido', async () => {
  const antes = consultas.length;
  const token = jwt.sign({ usuarioId: fixture.clienteId }, 'assinatura-errada');
  const res = await fetch(`${base}/api/pedidos/MS-1001`, { headers: { Cookie: `token=${token}` } });
  assert.equal(res.status, 401);
  assert.equal(consultas.length, antes);
  assert.equal('pedido' in await res.json(), false);
});

test('proprietário recebe dados úteis sem campos internos ou do gateway', async () => {
  for (const id of [fixture.numero, fixture.pagamentoId, fixture._id]) {
    const res = await consultar(`/api/pedidos/${id}`);
    assert.equal(res.status, 200);
    const { pedido } = await res.json();
    assert.equal(pedido.numero, fixture.numero);
    assert.equal(pedido.rastreio, fixture.rastreio);
    assert.equal(pedido.total, fixture.total);
    assert.deepEqual(pedido.cliente, { nome: 'Cliente' });
    assert.deepEqual(pedido.entrega, { cep: '01001000', endereco: 'Rua de teste, 1' });
    assert.deepEqual(pedido.historicoStatus, [{ status: 'pago', em: fixture.historicoStatus[0].em }]);
    for (const campo of ['_id', 'clienteId', 'pagamentoId', 'campoInternoFuturo']) assert.equal(campo in pedido, false);
    assert.equal('produtoId' in pedido.itens[0], false);
  }
  const status = await consultar('/api/pedidos/MS-1001/status');
  assert.deepEqual(await status.json(), { status: 'enviado' });
});

test('identificadores excessivos são rejeitados antes da consulta ao banco', async () => {
  const antes = consultas.length;
  const res = await consultar(`/api/pedidos/${'a'.repeat(129)}`);
  assert.equal(res.status, 404);
  assert.equal(consultas.length, antes);
});

test('status pendente, cancelado e desconhecido nunca aparecem como aprovados', () => {
  for (const status of ['aguardando_pagamento', 'cancelado', 'inexistente', '__proto__', 'constructor', undefined]) {
    assert.equal(situacaoPedido(status).etapa, 0);
    assert.notEqual(situacaoPedido(status).titulo, 'Pagamento aprovado');
  }
  assert.equal(situacaoPedido('em_separacao').etapa, 2);
  assert.equal(situacaoPedido('entregue').etapa, 4);
});

test('histórico mantém eventos após entrega, ordena sem mutar e ignora datas inválidas', () => {
  const eventos = [
    { status: 'pago', em: '2026-11-13T10:00:00Z' },
    { status: 'entregue', em: '2026-11-14T10:00:00Z' },
    { status: 'enviado', em: 'inválida' }, null,
  ];
  const ordenado = historicoPedido(eventos);
  assert.equal(ordenado.length, 2);
  assert.equal(ordenado[0].status, 'entregue');
  assert.equal(eventos[0].status, 'pago');
  assert.deepEqual(historicoPedido(undefined), []);
});

test('valores usam centavos e datas respeitam Brasília', () => {
  assert.match(formatarDinheiro(10450), /104,50/);
  assert.equal(formatarData('2026-11-14T01:00:00Z'), '13/11/2026');
  assert.equal(formatarData('data inválida'), '');
  assert.equal(formatarData(null), '');
});
