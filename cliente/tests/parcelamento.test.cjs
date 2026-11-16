const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcularParcelasCentavos, ErroCalculoPagamento } = require('../backend/functions/calculosPagamento');

test('permite 1x abaixo de R$ 40 e bloqueia parcelamento abaixo do mínimo', () => {
  assert.deepEqual(calcularParcelasCentavos(3999, 1), [3999]);
  for (let parcelas = 2; parcelas <= 6; parcelas++) {
    assert.throws(() => calcularParcelasCentavos(parcelas * 4000 - 1, parcelas), ErroCalculoPagamento);
    assert.deepEqual(calcularParcelasCentavos(parcelas * 4000, parcelas), Array(parcelas).fill(4000));
  }
});

test('distribui restos nas primeiras parcelas e mantém o total incluindo frete', () => {
  assert.deepEqual(calcularParcelasCentavos(12001, 3), [4001, 4000, 4000]);
  assert.deepEqual(calcularParcelasCentavos(12002, 3), [4001, 4001, 4000]);
  for (let quantidade = 1; quantidade <= 6; quantidade++) {
    const total = 30000 + 2501;
    const valores = calcularParcelasCentavos(total, quantidade);
    assert.equal(valores.reduce((soma, valor) => soma + valor, 0), total);
    assert.ok(valores.every(Number.isInteger));
    assert.ok(Math.max(...valores) - Math.min(...valores) <= 1);
  }
});

test('rejeita quantidades adulteradas e totais inválidos', () => {
  for (const quantidade of [0, -1, 7, 2.5, null, true, NaN, Infinity]) {
    assert.throws(() => calcularParcelasCentavos(30000, quantidade), ErroCalculoPagamento);
  }
  for (const total of [0, -1, 100.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calcularParcelasCentavos(total, 1), ErroCalculoPagamento);
  }
});
