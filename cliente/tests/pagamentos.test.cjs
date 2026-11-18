const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const { runInNewContext } = require('node:vm');
const { randomUUID, createHmac } = require('node:crypto');
const { calcularPixCentavos, calcularFreteAplicavelCentavos, calcularSubtotalCentavos, criarItensPedido,
  calcularValorBaseCentavos, calcularParcelasCentavos, ErroCalculoPagamento } = require('../backend/functions/calculosPagamento');
const { primeiraCompetencia, loteElegivel, vencimentoMensal, validarPostagem } = require('../backend/functions/calendarioClube');
const { criarConciliadorClube, criarConsultaFaturas, registrarRotasClube } = require('../backend/functions/recorrenciaClube');
const { criarCancelamentoClube, registrarRotasCancelamento } = require('../backend/functions/cancelamentoClube');
const { criarAutenticacao } = require('../backend/functions/autenticacao');
const { criarReferenciaCartao } = require('../backend/functions/cartoesPerfil');
const { segredosAplicacao } = require('../backend/functions/segurancaPagamento');
const { criarConsultaConciliacao, registrarConciliacaoAdmin } = require('../backend/functions/conciliacaoAdmin');
const { criarLoggerOperacional, referenciaOperacional } = require('../backend/functions/logOperacional');
const { resumirCarrinho } = require('../backend/functions/resumoCarrinho');

const itemGaveta = (preco = 12990, quantidade = 1) => ({ produtoId: 'produto-gaveta', preco, quantidade, ativo: true, estoqueDisponivel: 20 });
const respostaGaveta = (itens = [itemGaveta()]) => ({ itens, resumo: resumirCarrinho(itens) });

test('RF03: resumo do carrinho calcula Pix uma única vez e distribui centavos das parcelas', () => {
  const resumo = resumirCarrinho([itemGaveta(), itemGaveta(2490), itemGaveta(2490)]);
  assert.equal(resumo.subtotal, 17970);
  assert.equal(resumo.produtosPix, 17072);
  assert.equal(resumo.descontoPix, 898);
  assert.deepEqual(resumo.parcelas, [4493, 4493, 4492, 4492]);
  assert.equal(resumo.quantidadeItens, 3);
  assert.equal(resumo.podeContinuar, true);
});

test('RF03: resumo respeita limite de frete, 1x a 6x e mínimo de R$ 40', () => {
  for (const [subtotal, quantidadeParcelas] of [[3999, 1], [7999, 1], [8000, 2], [12001, 3], [39990, 6], [39991, 6]]) {
    const resumo = resumirCarrinho([itemGaveta(subtotal)]);
    assert.equal(resumo.parcelas.length, quantidadeParcelas);
    assert.equal(resumo.freteGratis, subtotal > 39990);
    assert.equal(resumo.parcelas.reduce((soma, valor) => soma + valor, 0), subtotal);
    assert.ok(quantidadeParcelas === 1 || resumo.parcelas.every((valor) => valor >= 4000));
  }
});

test('RF03: carrinho vazio, cadastro inválido, inativo e estoque insuficiente bloqueiam checkout', () => {
  assert.equal(resumirCarrinho([]).podeContinuar, false);
  for (const item of [{ ...itemGaveta(), ativo: false }, itemGaveta('1000'), itemGaveta(1000, 0),
    itemGaveta(1000, 21), { ...itemGaveta(), estoqueDisponivel: undefined }]) {
    assert.equal(resumirCarrinho([item]).podeContinuar, false);
  }
});

test('RF03: resposta do carrinho usa preços populados e sinaliza produto removido', async () => {
  const { criarCarrinhoHelpers } = require('../backend/functions/carrinho');
  const carrinho = { itens: [{ produtoId: { _id: 'produto', nome: 'Kit', preco: 4990, ativo: true, estoque: 4, estoqueSeguranca: 1 },
    quantidade: 2, slug: 'kit' }], async populate() {} };
  const helpers = criarCarrinhoHelpers({});
  let dados = await helpers.respostaCarrinho(carrinho);
  assert.equal(dados.resumo.subtotal, 9980);
  assert.equal(dados.itens[0].estoqueDisponivel, 3);
  assert.equal(dados.itens[0].imagemUrl, '/api/produto/kit/imagem');
  carrinho.itens.push({ produtoId: null, quantidade: 1 });
  dados = await helpers.respostaCarrinho(carrinho);
  assert.equal(dados.resumo.podeContinuar, false);
  assert.match(dados.resumo.erro, /removidos/);
});

test('RF03: rótulo de parcelas mantém a soma exata quando há mais de um centavo restante', async () => {
  const { formatarParcelasCarrinho } = await import('../src/utils/carrinho.mjs');
  const texto = formatarParcelasCarrinho([4493, 4493, 4492, 4492]).replace(/\u00a0/g, ' ');
  assert.equal(texto, '4x: 2 de R$ 44,93 + 2 de R$ 44,92');
  assert.match(formatarParcelasCarrinho([4000, 4000]), /^2x de/);
});

test('RF03: resposta atrasada de leitura não desfaz atualização do carrinho', async () => {
  const { criarControleCarrinho } = await import('../src/utils/carrinho.mjs');
  let concluirLeitura;
  const controle = criarControleCarrinho(async (_url, opcoes) => opcoes.method
    ? { ok: true, json: async () => respostaGaveta([itemGaveta(12990, 2)]) }
    : new Promise((resolve) => { concluirLeitura = resolve; }));
  const leitura = controle.carregar();
  await controle.alterar('produto', 'PATCH', 2);
  concluirLeitura({ ok: true, json: async () => respostaGaveta([itemGaveta(12990, 1)]) });
  await leitura;
  assert.equal(controle.ler().itens[0].quantidade, 2);
  assert.equal(controle.ler().resumo.subtotal, 25980);
});

test('RF03: bloqueio síncrono impede duas mutações por duplo clique', async () => {
  const { criarControleCarrinho } = await import('../src/utils/carrinho.mjs');
  let concluir, chamadas = 0;
  const controle = criarControleCarrinho(async () => { chamadas++; return new Promise((resolve) => { concluir = resolve; }); });
  const primeira = controle.alterar('produto', 'PATCH', 2);
  assert.equal(await controle.alterar('produto', 'PATCH', 3), false);
  assert.equal(chamadas, 1);
  concluir({ ok: true, json: async () => respostaGaveta([itemGaveta(12990, 2)]) });
  assert.equal(await primeira, true);
  assert.equal(controle.ler().salvando, false);
});

test('RF03: atualização externa durante a gravação aguarda a mutação terminar', async () => {
  const { criarControleCarrinho } = await import('../src/utils/carrinho.mjs');
  let concluir, leituras = 0;
  const controle = criarControleCarrinho(async (_url, opcoes) => {
    if (opcoes.method) return new Promise((resolve) => { concluir = resolve; });
    leituras++; return { ok: true, json: async () => respostaGaveta([itemGaveta(12990, 3)]) };
  });
  const gravacao = controle.alterar('produto', 'PATCH', 2);
  await controle.carregar();
  assert.equal(leituras, 0);
  concluir({ ok: true, json: async () => respostaGaveta([itemGaveta(12990, 2)]) });
  await gravacao;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(leituras, 1);
  assert.equal(controle.ler().itens[0].quantidade, 3);
});

test('RF03: conflito mantém itens anteriores e autenticação negada remove dados da memória', async () => {
  const { criarControleCarrinho } = await import('../src/utils/carrinho.mjs');
  let status = 200;
  const controle = criarControleCarrinho(async () => ({ ok: status === 200, status,
    json: async () => status === 200 ? respostaGaveta() : { erro: 'Não disponível.' } }));
  await controle.carregar();
  status = 409;
  assert.equal(await controle.alterar('produto', 'PATCH', 21), false);
  assert.equal(controle.ler().itens.length, 1);
  assert.equal(controle.ler().erro, 'Não disponível.');
  status = 403;
  await controle.carregar();
  assert.equal(controle.ler().itens.length, 0);
  assert.equal(controle.ler().resumo, null);
});

test('RF03: cancelar leitura e desinscrever evita publicar dados tardios', async () => {
  const { criarControleCarrinho } = await import('../src/utils/carrinho.mjs');
  let concluir, alteracoes = 0;
  const controle = criarControleCarrinho(async () => new Promise((resolve) => { concluir = resolve; }));
  const cancelar = controle.assinar(() => alteracoes++);
  const pendente = controle.carregar();
  cancelar(); controle.cancelarLeitura();
  concluir({ ok: true, json: async () => respostaGaveta() });
  await pendente;
  assert.equal(alteracoes, 1);
  assert.equal(controle.ler().itens.length, 0);
});

function carteiraCheckoutTeste() {
  const cartao = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', status: true, provedorCardId: 'card-remoto-1',
    paymentMethodId: 'visa', bandeira: 'visa', finalCartao: '1111', validade: '12/30', reutilizavel: true };
  return { cartoes: [cartao], provedorCustomerId: 'customer-proprio',
    cartaoRemoto: { id: cartao.provedorCardId, customer_id: 'customer-proprio', last_four_digits: '1111',
      expiration_month: 12, expiration_year: 2030, payment_method: { id: 'visa', payment_type_id: 'credit_card' } },
    tokenSalvo: { id: 'token-teste', card_id: cartao.provedorCardId, status: 'active', security_code_length: 3,
      date_due: new Date(Date.now() + 60000).toISOString() } };
}

test('checkout com cartão salvo valida dono, token e provedor antes de criar a cobrança', async () => {
  const carteira = carteiraCheckoutTeste();
  const servidor = montarServidor(4990, undefined, carteira);
  const body = { cartaoSalvoId: carteira.cartoes[0]._id, chaveTentativa: randomUUID() };
  assert.equal((await servidor.enviar('cartao', body)).statusCode, 200);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.cobrancas[0].payer.type, 'customer');
  assert.equal(servidor.cobrancas[0].payer.id, 'customer-proprio');
  assert.equal(servidor.cobrancas[0].transaction_amount, 64.9);
  carteira.cartoes.splice(0);
  assert.equal((await servidor.enviar('cartao', body)).statusCode, 200);
  assert.equal(servidor.cobrancas.length, 1);
});

test('checkout recusa cartão alheio, removido, inativo, legado, expirado e token incompatível sem reservar estoque', async () => {
  const mudancas = [
    (c) => { c.cartoes = []; }, (c) => { c.cartoes[0].status = false; },
    (c) => { delete c.cartoes[0].provedorCardId; }, (c) => { c.cartaoRemoto.customer_id = 'outro-cliente'; },
    (c) => { c.cartaoRemoto.id = 'outro-cartao'; }, (c) => { c.cartaoRemoto.expiration_year = 2020; },
    (c) => { c.tokenSalvo.card_id = 'outro-cartao'; }, (c) => { c.tokenSalvo.status = 'used'; },
    (c) => { c.tokenSalvo.date_due = '2020-01-01'; }, (c) => { c.tokenSalvo.security_code_length = 0; },
    (c) => { c.cartaoRemoto = null; }, (c) => { c.tokenSalvo = null; },
  ];
  for (const mudar of mudancas) {
    const carteira = carteiraCheckoutTeste();
    mudar(carteira);
    const servidor = montarServidor(4990, undefined, carteira);
    const resposta = await servidor.enviar('cartao', { cartaoSalvoId: 'aaaaaaaaaaaaaaaaaaaaaaaa' });
    assert.equal(resposta.statusCode, 400);
    assert.equal(servidor.cobrancas.length, 0);
    assert.equal(servidor.tentativas.length, 0);
    assert.equal(servidor.estoques['produto-teste'].estoque, 10);
  }
});

test('trocar cartão salvo na repetição ou adulterar a bandeira é rejeitado', async () => {
  const carteira = carteiraCheckoutTeste();
  const servidor = montarServidor(4990, undefined, carteira);
  const chaveTentativa = randomUUID();
  assert.equal((await servidor.enviar('cartao', { cartaoSalvoId: carteira.cartoes[0]._id, chaveTentativa })).statusCode, 200);
  assert.equal((await servidor.enviar('cartao', { cartaoSalvoId: 'bbbbbbbbbbbbbbbbbbbbbbbb', chaveTentativa })).statusCode, 409);
  const adulterado = montarServidor(4990, undefined, carteiraCheckoutTeste());
  assert.equal((await adulterado.enviar('cartao', { cartaoSalvoId: 'aaaaaaaaaaaaaaaaaaaaaaaa', payment_method_id: 'master' })).statusCode, 400);
  assert.equal(adulterado.cobrancas.length, 0);
});

test('perfil vincula cartão ao cliente do provedor e promove referência antiga sem salvar token/PAN/CVV', async () => {
  const usuario = { status: true, email: 'conta@example.com', cartoes: [
    { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', finalCartao: '1111', bandeira: 'visa', validade: '12/30' }], async save() {} };
  const chamadas = [];
  const salvar = criarReferenciaCartao({ Usuario: { findById: async () => usuario,
    async findOneAndUpdate(_filtro, dados) { Object.assign(usuario, dados.$set); return usuario; } },
    cardTokenModule: { get: async () => ({ id: 'token-perfil-teste', status: 'active', luhn_validation: true, security_code_length: 3,
      last_four_digits: '1111', first_six_digits: '411111', expiration_month: 12, expiration_year: 2030,
      date_due: new Date(Date.now() + 60000).toISOString() }) },
    customerModule: {
      async create(dados) { chamadas.push(dados); return { id: 'customer-proprio' }; },
      async createCard(dados) { chamadas.push(dados); return carteiraCheckoutTeste().cartaoRemoto; },
    } });
  const resposta = await salvar('cliente-proprio', { tokenCartao: 'token-perfil-teste', customerId: 'alheio' });
  assert.equal(usuario.cartoes.length, 1);
  assert.equal(usuario.provedorCustomerId, 'customer-proprio');
  assert.equal(resposta[0].reutilizavel, true);
  assert.equal(resposta[0].provedorCardId, 'card-remoto-1');
  assert.equal(chamadas[1].customerId, 'customer-proprio');
  assert.equal(chamadas[0].body.email, usuario.email);
  const persistido = JSON.stringify(usuario);
  assert.equal(persistido.includes('token-perfil-teste'), false);
  assert.equal(persistido.includes('411111'), false);
  assert.equal(JSON.stringify(resposta).includes('customer-proprio'), false);
});

test('perfil preserva vínculo canônico criado por outra solicitação e rejeita cartão remoto de outro cliente', async () => {
  for (const alheio of [false, true]) {
    const usuario = { status: true, email: 'conta@example.com', cartoes: [], async save() {} };
    let clienteUsado;
    const salvar = criarReferenciaCartao({ Usuario: { findById: async () => usuario,
      async findOneAndUpdate() { usuario.provedorCustomerId = 'customer-canonico'; return null; } },
      cardTokenModule: { get: async () => ({ id: 'token-perfil-teste', status: 'active', luhn_validation: true, security_code_length: 3,
        last_four_digits: '1111', first_six_digits: '411111', expiration_month: 12, expiration_year: 2030,
        date_due: new Date(Date.now() + 60000).toISOString() }) },
      customerModule: { async create() { return { id: 'customer-criado-agora' }; },
        async createCard({ customerId }) { clienteUsado = customerId; return { ...carteiraCheckoutTeste().cartaoRemoto,
          customer_id: alheio ? 'outro-cliente' : customerId }; } } });
    if (alheio) {
      await assert.rejects(salvar('cliente-proprio', { tokenCartao: 'token-perfil-teste' }));
      assert.equal(usuario.cartoes.length, 0);
    } else {
      await salvar('cliente-proprio', { tokenCartao: 'token-perfil-teste' });
      assert.equal(usuario.cartoes.length, 1);
    }
    assert.equal(clienteUsado, 'customer-canonico');
    assert.equal(usuario.provedorCustomerId, 'customer-canonico');
  }
});

test('troca de endereço salvo preenche e limpa todos os campos, recalcula frete e invalida cotação', async () => {
  const { dadosEnderecoCheckout } = await import('../src/utils/perfilCheckout.mjs');
  const fonte = readFileSync(resolve(__dirname, '../src/Pages/Checkout.jsx'), 'utf8');
  const handler = fonte.slice(fonte.indexOf('  const escolherEndereco ='), fonte.indexOf('  const escolherCartao ='));
  let formulario = { endereco: 'Rua antiga', complemento: 'Apto antigo' }, cep, selecionado;
  let fretes = 0, resumos = 0;
  const cepAtualRef = { current: '' };
  const runtime = { enderecosSalvos: [{ _id: 'casa', rua: 'Rua nova', numero: '2', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP', cep: '01310-100' }],
    dadosEnderecoCheckout, setEnderecoSalvoId: (id) => { selecionado = id; },
    setFormData: (atualizar) => { formulario = atualizar(formulario); }, setCep: (valor) => { cep = valor; },
    formatarCep: (valor) => valor, cepAtualRef, limparFrete: () => { fretes++; }, atualizarResumo: () => { resumos++; } };
  runInNewContext(handler + '\nescolherEndereco("casa");', runtime);
  assert.equal(formulario.endereco, 'Rua nova');
  assert.equal(formulario.complemento, '');
  assert.equal(cep, '01310100');
  assert.equal(cepAtualRef.current, cep);
  assert.equal(selecionado, 'casa');
  runInNewContext('escolherEndereco("");', runtime);
  assert.equal(formulario.endereco, '');
  assert.equal(cep, '');
  assert.equal(fretes, 2);
  assert.equal(resumos, 2);
});

test('checkout distingue cartão reutilizável, legado e vencido, inclusive limite do mês', async () => {
  const { cartaoDisponivelCheckout } = await import('../src/utils/perfilCheckout.mjs');
  const cartao = carteiraCheckoutTeste().cartoes[0];
  assert.equal(cartaoDisponivelCheckout(cartao, Date.UTC(2030, 11, 31)), true);
  assert.equal(cartaoDisponivelCheckout(cartao, Date.UTC(2031, 0, 1)), false);
  assert.equal(cartaoDisponivelCheckout({ ...cartao, reutilizavel: false }), false);
  assert.equal(cartaoDisponivelCheckout({ ...cartao, status: false }), false);
});

test('trocar cartão limpa dados sensíveis em memória e exige nova conferência do resumo', () => {
  const fonte = readFileSync(resolve(__dirname, '../src/Pages/Checkout.jsx'), 'utf8');
  const handler = fonte.slice(fonte.indexOf('  const escolherCartao ='), fonte.indexOf('  const salvarEnderecoPrincipal ='));
  let formulario = { numeroCartao: '4111111111111111', cvv: '123', parcelas: '2' }, selecionado, atualizacoes = 0;
  runInNewContext(handler + '\nescolherCartao("cartao-1");', { setCartaoSalvoId: (id) => { selecionado = id; },
    setFormData: (atualizar) => { formulario = atualizar(formulario); }, atualizarResumo: () => { atualizacoes++; } });
  assert.equal(formulario.numeroCartao, '');
  assert.equal(formulario.cvv, '');
  assert.equal(formulario.parcelas, '2');
  assert.equal(selecionado, 'cartao-1');
  assert.equal(atualizacoes, 1);
});

test('handler do checkout tokeniza cartão salvo somente com ID e CVV e envia apenas token à loja', async () => {
  const { cartaoDisponivelCheckout } = await import('../src/utils/perfilCheckout.mjs');
  const cartao = carteiraCheckoutTeste().cartoes[0];
  let tokenizado, enviado;
  const formulario = { nome: 'Cliente', email: 'teste@example.com', cpf: '00000000000', validade: '', numeroCartao: '', cpfTitular: '', cvv: '123' };
  await executarCheckoutTeste({ cartaoSalvoId: cartao._id, cartaoSalvo: cartao, cartaoDisponivelCheckout,
    resumo: { cotacao: 'resumo', validoAte: new Date(Date.now() + 60000).toISOString() }, cartItems: [{}], subtotal: 4990,
    freteSelecionado: {}, freteSelecionadoId: 1, valorFrete: 1500, parcelasSelecionadas: '1', cep: '01001000',
    pagamento: 'cartao', formData: formulario, entregaResumo: {}, pedidoPendente: null,
    envioPagamentoRef: { current: false }, chavePagamentoRef: { current: null }, sessionStorage: { getItem: () => null, setItem() {} },
    crypto: { randomUUID }, setLoading() {}, setResultado() {}, setFormData() {}, atualizarResumo() {}, toast: assert.fail,
    detectarBandeiraCartao: () => 'visa', mpInstance: { async createCardToken(dados) { tokenizado = dados; return { id: 'token-teste' }; } },
    fetch: async (_url, opcoes) => { enviado = JSON.parse(opcoes.body); return {}; },
    lerRespostaPagamento: async () => ({ sucesso: true }), concluirPagamento: async () => {} });
  assert.deepEqual(JSON.parse(JSON.stringify(tokenizado)), { cardId: 'card-remoto-1', securityCode: '123' });
  assert.equal(enviado.cartaoSalvoId, cartao._id);
  assert.equal(enviado.token, 'token-teste');
  assert.equal(Object.hasOwn(enviado, 'cvv'), false);
  assert.equal(Object.hasOwn(enviado, 'securityCode'), false);
  assert.equal(Object.hasOwn(enviado, 'numeroCartao'), false);
});

test('PAG-18: logs JSON têm esquema estável e descartam dados pessoais, cartão e credenciais', () => {
  const linhas = [];
  const saida = Object.fromEntries(['log', 'warn', 'error'].map((nivel) => [nivel, (linha) => linhas.push(linha)]));
  const logger = criarLoggerOperacional({ saida, agora: () => new Date('2026-11-16T15:00:00Z') });
  for (const nivel of ['info', 'warn', 'error']) logger[nivel]('webhook.pendente', {
    pagamentoId: '123', token: 'token-proibido', cpf: 'cpf-proibido', email: 'privado@example.com',
    cvv: '123', card_number: '4111111111111111', req: { headers: { authorization: 'Bearer secreto' } },
    erro: new Error('token-sensivel'), respostaGateway: { token: 'segredo' },
  });
  assert.equal(linhas.length, 3);
  for (const [indice, linha] of linhas.entries()) {
    const registro = JSON.parse(linha);
    assert.deepEqual(Object.keys(registro), ['versao', 'em', 'nivel', 'evento', 'pagamentoRef']);
    assert.equal(registro.versao, 1);
    assert.equal(registro.em, '2026-11-16T15:00:00.000Z');
    assert.equal(registro.nivel, ['info', 'warn', 'error'][indice]);
    assert.equal(registro.pagamentoRef, referenciaOperacional('pagamentoId', '123'));
    for (const proibido of ['token-proibido', 'cpf-proibido', 'privado@example.com', '4111111111111111', 'secreto', 'token-sensivel']) assert.equal(linha.includes(proibido), false);
  }
});

test('PAG-18: referências são estáveis por tipo e não expõem identificadores brutos', () => {
  const ref = referenciaOperacional('tentativaId', 'identificador-interno');
  assert.match(ref, /^[a-f\d]{64}$/);
  assert.equal(ref, referenciaOperacional('tentativaId', 'identificador-interno'));
  assert.notEqual(ref, referenciaOperacional('pagamentoId', 'identificador-interno'));
  assert.equal(referenciaOperacional('token', 'segredo'), undefined);
  assert.equal(referenciaOperacional('pagamentoId', 'x'.repeat(257)), undefined);
  assert.equal(referenciaOperacional('pagamentoId', {}), undefined);
});

test('PAG-18: mensagens livres e injeção de linhas não entram no evento', () => {
  const linhas = [];
  const logger = criarLoggerOperacional({ saida: { error: (linha) => linhas.push(linha) } });
  logger.error('segredo\n{"evento":"falso"}', { pagamentoId: '123' });
  logger.error(new Error('token-sensivel'));
  assert.equal(linhas.length, 2);
  for (const linha of linhas) {
    assert.equal(JSON.parse(linha).evento, 'registro.descartado');
    assert.equal(linha.includes('\n'), false);
    assert.equal(linha.includes('segredo'), false);
    assert.equal(linha.includes('token-sensivel'), false);
    assert.equal(JSON.parse(linha).pagamentoRef, undefined);
  }
});

test('PAG-18: objetos cíclicos, getters e campos extras não são serializados', () => {
  const linhas = [];
  let acessos = 0;
  const contexto = { resultado: 'duplicada', httpStatus: 503, configurada: false };
  contexto.circular = contexto;
  Object.defineProperty(contexto, 'pagamentoId', { get() { acessos++; throw new Error('segredo'); } });
  criarLoggerOperacional({ saida: { log: (linha) => linhas.push(linha) } }).info('webhook.conciliado', contexto);
  assert.equal(acessos, 0);
  assert.equal(JSON.parse(linhas[0]).resultado, 'duplicada');
  assert.equal(JSON.parse(linhas[0]).httpStatus, 503);
  assert.equal(JSON.parse(linhas[0]).configurada, false);
  assert.equal(JSON.parse(linhas[0]).pagamentoRef, undefined);
});

test('PAG-18: enumerações e tipos inválidos são descartados', () => {
  const linhas = [];
  const logger = criarLoggerOperacional({ saida: { log: (linha) => linhas.push(linha) } });
  for (const httpStatus of [-1, 600, '503', null]) logger.info('webhook.conciliado', { httpStatus, resultado: 'token-sensivel', configurada: 'segredo' });
  for (const linha of linhas) {
    assert.deepEqual(Object.keys(JSON.parse(linha)), ['versao', 'em', 'nivel', 'evento']);
  }
});

test('PAG-18: timeout real do handler registra referência sem repetir cobrança ou expor erro', async () => {
  const servidor = montarServidor(4990, undefined, { gateway: true });
  const res = await servidor.enviar('pix');
  assert.equal(res.statusCode, 500);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.tentativas[0].estado, 'resultado_desconhecido');
  const eventos = servidor.logs.map(([linha]) => JSON.parse(linha));
  const timeout = eventos.find((r) => r.evento === 'pagamento.resultado_desconhecido');
  assert.equal(timeout.tentativaRef, referenciaOperacional('tentativaId', String(servidor.tentativas[0]._id)));
  assert.equal(JSON.stringify(eventos).includes('token-sensivel'), false);
});

test('PAG-18: falha no destino de logs não altera o pagamento nem cria outra tentativa', async () => {
  const servidor = montarServidor(4990, undefined, { gateway: true, logIndisponivel: true });
  const res = await servidor.enviar('pix');
  assert.equal(res.statusCode, 500);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.tentativas.length, 1);
  assert.equal(servidor.tentativas[0].estado, 'resultado_desconhecido');
});

test('PAG-18: webhook válido, duplicado e inválido produzem eventos sem imprimir assinatura', async () => {
  const servidor = montarServidor();
  await servidor.enviar('pix');
  const evento = { type: 'payment', data: { id: '123' } };
  await servidor.enviar('/api/webhook', evento);
  await servidor.enviar('/api/webhook', evento);
  assert.equal((await servidor.enviar('/api/webhook', { ...evento, headers: { 'x-signature': 'assinatura-secreta', 'x-request-id': 'privado' } })).statusCode, 401);
  const eventos = servidor.logs.map(([linha]) => JSON.parse(linha));
  assert.ok(eventos.some((e) => e.evento === 'webhook.conciliado' && e.resultado === 'processada'));
  assert.ok(eventos.some((e) => e.evento === 'webhook.conciliado' && e.resultado === 'duplicada'));
  assert.ok(eventos.some((e) => e.evento === 'webhook.invalido' && !e.pagamentoRef));
  assert.equal(JSON.stringify(eventos).includes('assinatura-secreta'), false);
});

function painelConciliacao(alteracoes = {}) {
  const clienteId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const assinaturaId = 'bbbbbbbbbbbbbbbbbbbbbbbb';
  const aprovadoEm = new Date('2026-11-05T15:00:00Z');
  const recebidoEm = new Date('2026-11-07T16:00:00Z');
  const dados = {
    tentativas: [{ _id: 'cccccccccccccccccccccccc', clienteId, pagamentoId: '100', total: 9490,
      statusFinanceiro: 'aprovado', aprovadoEm, ultimaNotificacaoEm: recebidoEm, estado: 'resposta_recebida' }],
    pedidos: [{ _id: 'dddddddddddddddddddddddd', numero: 'MS-1001', clienteId, tentativaId: 'cccccccccccccccccccccccc',
      pagamentoId: '100', total: 9490, statusFinanceiro: 'aprovado', statusLogistico: 'entregue', pagamentoAprovadoEm: aprovadoEm }],
    assinaturas: [{ _id: assinaturaId, clienteId, preapprovalId: 'acordo-1', statusAdesao: 'cancelada', canceladoEm: new Date('2026-11-06T15:00:00Z') }],
    mensalidades: [{ _id: 'fatura-1', assinaturaId, clienteId, preapprovalId: 'acordo-1', pagamentoId: '200', valor: 9490,
      statusFinanceiro: 'aprovado', aprovadoEm, recebidoEm, competencia: '2026-11' }],
    caixas: [{ _id: 'eeeeeeeeeeeeeeeeeeeeeeee', assinaturaId, clienteId, mensalidadeId: 'fatura-1', pagamentoId: '200',
      competencia: '2026-11', lote: '2026-11', statusFinanceiro: 'aprovado', statusPreparacao: 'preparando', bloqueada: false }],
    usuarios: [{ _id: clienteId, nome: 'Cliente de Teste' }],
    operacoes: [], ...alteracoes,
  };
  const consultas = [];
  const corresponde = (registro, filtro) => Object.entries(filtro).every(([campo, valor]) => campo === '$or'
    ? valor.some((item) => corresponde(registro, item)) : valor?.$in
      ? valor.$in.includes(String(registro[campo])) : valor && '$exists' in Object(valor)
        ? Object.hasOwn(registro, campo) === valor.$exists : registro[campo] === valor);
  const modelos = Object.fromEntries(Object.entries(dados).map(([nome, registros]) => [nome, {
    find(filtro) {
      consultas.push({ nome, filtro });
      let campos, inicio = 0, limite = Infinity;
      return { select(valor) { campos = valor.split(' '); return this; }, sort() { return this; },
        skip(valor) { inicio = valor; return this; }, limit(valor) { limite = valor; return this; },
        async lean() { return registros.filter((r) => corresponde(r, filtro)).slice(inicio, inicio + limite)
          .map((registro) => Object.fromEntries(campos.filter((c) => c in registro).map((c) => [c, registro[c]]))); } };
    },
  }]));
  return { dados, consultas, consultar: criarConsultaConciliacao(modelos, () => new Date('2026-11-16T15:00:00Z')) };
}

test('PAG-17: conciliação vincula tentativa e pedido sem confundir entrega com aprovação', async () => {
  const painel = painelConciliacao();
  const anterior = JSON.stringify(painel.dados);
  const { itens } = await painel.consultar();
  assert.equal(itens.length, 1);
  assert.equal(itens[0].pedidoNumero, 'MS-1001');
  assert.equal(itens[0].statusLogistico, 'entregue');
  assert.equal(itens[0].statusFinanceiro, 'aprovado');
  assert.notEqual(itens[0].aprovadoEm, itens[0].notificacaoRecebidaEm);
  assert.deepEqual(itens[0].problemas, []);
  assert.equal(JSON.stringify(painel.dados), anterior);
});

test('PAG-17: conciliação resolve nomes em lote e preserva fallback de cliente ausente', async () => {
  const painel = painelConciliacao();
  painel.dados.tentativas.push({ ...painel.dados.tentativas[0], _id: 'ffffffffffffffffffffffff', clienteId: '999999999999999999999999' });
  painel.dados.pedidos = [];
  const { itens } = await painel.consultar();
  assert.equal(itens[0].clienteNome, 'Cliente de Teste');
  assert.equal(itens[1].clienteNome, null);
  const consultasUsuarios = painel.consultas.filter(({ nome }) => nome === 'usuarios');
  assert.equal(consultasUsuarios.length, 1);
  assert.deepEqual(consultasUsuarios[0].filtro._id.$in.sort(), ['999999999999999999999999', 'aaaaaaaaaaaaaaaaaaaaaaaa'].sort());
});

test('PAG-17: reembolso parcial após entrega mantém total original e saldo exato', async () => {
  const painel = painelConciliacao();
  for (const fonte of ['tentativas', 'pedidos']) Object.assign(painel.dados[fonte][0], { statusFinanceiro: 'parcialmente_reembolsado', valorReembolsado: 101 });
  const { itens: [item] } = await painel.consultar({ origem: 'pedidos' });
  assert.equal(item.total, 9490);
  assert.equal(item.valorReembolsado, 101);
  assert.equal(item.saldo, 9389);
  assert.equal(item.statusLogistico, 'entregue');
  assert.deepEqual(item.problemas, []);
});

test('PAG-17: inconsistências financeiras, de cliente e duplicidade ficam visíveis', async () => {
  const painel = painelConciliacao();
  Object.assign(painel.dados.pedidos[0], { clienteId: 'outra-conta', total: 1, statusFinanceiro: 'reembolsado' });
  painel.dados.pedidos.push({ ...painel.dados.pedidos[0], _id: 'outro-pedido' });
  const { itens: [item] } = await painel.consultar();
  assert.ok(item.problemas.some((p) => p.includes('Cliente diverge')));
  assert.ok(item.problemas.some((p) => p.includes('Total diverge')));
  assert.ok(item.problemas.some((p) => p.includes('financeira diverge')));
  assert.ok(item.problemas.some((p) => p.includes('Mais de um')));
});

test('PAG-17: tentativa desconhecida sem pedido não é apresentada como aprovada', async () => {
  const painel = painelConciliacao({ pedidos: [] });
  delete painel.dados.tentativas[0].statusFinanceiro;
  painel.dados.tentativas[0].estado = 'resultado_desconhecido';
  const { itens: [item] } = await painel.consultar();
  assert.equal(item.statusFinanceiro, 'desconhecido');
  assert.ok(item.problemas.some((p) => p.includes('sem pedido')));
  assert.ok(item.problemas.some((p) => p.includes('ainda não confirmado')));
});

test('PAG-17/RN01: aprovação anterior ao cancelamento mantém expedição apesar do webhook posterior', async () => {
  const painel = painelConciliacao();
  const { itens: [item] } = await painel.consultar({ origem: 'mensalidades' });
  assert.equal(item.adesao, 'cancelada');
  assert.ok(item.notificacaoRecebidaEm > item.canceladoEm);
  assert.equal(item.expedicaoPermitida, true);
  assert.deepEqual(item.problemas, []);
});

test('PAG-17/RN01: aprovação posterior bloqueia nova postagem e mostra prazo de reembolso', async () => {
  const painel = painelConciliacao();
  painel.dados.mensalidades[0].aprovadoEm = new Date('2026-11-07T15:00:00Z');
  painel.dados.caixas[0].bloqueadaParaReembolso = true;
  painel.dados.operacoes.push({ _id: 'reembolso-200', assinaturaId: painel.dados.assinaturas[0]._id, pagamentoId: '200',
    tipo: 'reembolsar_pagamento', estado: 'pendente', limiteSolicitacaoEm: new Date('2026-11-10T15:00:00Z'),
    valorSolicitado: 9490, lockToken: 'segredo', chaveIdempotencia: 'segredo' });
  const { itens: [item] } = await painel.consultar({ origem: 'mensalidades' });
  assert.equal(item.expedicaoPermitida, false);
  assert.ok(item.problemas.some((p) => p.includes('posterior')));
  assert.equal(item.operacoes[0].solicitacaoAtrasada, true);
  assert.equal(item.operacoes[0].valorSolicitado, 9490);
  assert.equal(JSON.stringify(item).includes('segredo'), false);
  painel.dados.operacoes[0].solicitadoEm = new Date('2026-11-09T15:00:00Z');
  assert.equal((await painel.consultar({ origem: 'mensalidades' })).itens[0].operacoes[0].solicitacaoAtrasada, false);
});

test('PAG-17: mensalidade aprovada sem caixa e calendário divergente exigem atenção', async () => {
  const painel = painelConciliacao({ caixas: [] });
  painel.dados.mensalidades[0].cobrancaDivergente = true;
  const { itens: [item] } = await painel.consultar({ origem: 'mensalidades' });
  assert.ok(item.problemas.some((p) => p.includes('sem caixa')));
  assert.ok(item.problemas.some((p) => p.includes('calendário')));
  assert.equal(item.expedicaoPermitida, false);
});

test('PAG-17: pagamentos pendentes, contestados e reembolsados nunca liberam expedição', async () => {
  for (const statusFinanceiro of ['aguardando_pagamento', 'em_contestacao', 'contestado', 'parcialmente_reembolsado', 'reembolsado']) {
    const painel = painelConciliacao();
    Object.assign(painel.dados.mensalidades[0], { statusFinanceiro, valorReembolsado: statusFinanceiro === 'reembolsado' ? 9490 : 0 });
    painel.dados.caixas[0].statusFinanceiro = statusFinanceiro;
    const { itens: [item] } = await painel.consultar({ origem: 'mensalidades' });
    assert.equal(item.expedicaoPermitida, false, statusFinanceiro);
  }
});

test('PAG-17: vínculos da caixa divergentes ou duplicados impedem liberação', async () => {
  const painel = painelConciliacao();
  painel.dados.caixas.push({ ...painel.dados.caixas[0], _id: 'duplicada' });
  painel.dados.caixas[0].competencia = '2026-12';
  const { itens: [item] } = await painel.consultar({ origem: 'mensalidades' });
  assert.equal(item.expedicaoPermitida, false);
  assert.ok(item.problemas.some((p) => p.includes('Mais de uma caixa')));
  assert.ok(item.problemas.some((p) => p.includes('competência')));
});

test('PAG-17: paginação percorre mais de 25 registros e filtros exatos alcançam legados', async () => {
  const painel = painelConciliacao();
  painel.dados.pedidos.splice(0, 1, ...Array.from({ length: 26 }, (_, i) => ({ _id: String(i), numero: `MS-${i}`, clienteId: 'legado', total: 100, status: 'pago' })));
  const primeira = await painel.consultar({ origem: 'pedidos' });
  const segunda = await painel.consultar({ origem: 'pedidos', pagina: '2' });
  assert.equal(primeira.itens.length, 25);
  assert.equal(primeira.temProxima, true);
  assert.equal(segunda.itens.length, 1);
  assert.equal(segunda.temProxima, false);
  assert.equal((await painel.consultar({ origem: 'pedidos', campo: 'numero', referencia: 'MS-25' })).itens[0].pedidoNumero, 'MS-25');
  assert.equal((await painel.consultar({ origem: 'pedidos', financeiro: 'aprovado' })).itens.length, 25);
  assert.ok(segunda.itens[0].problemas.some((p) => p.includes('legado')));
});

test('PAG-17: filtros rejeitam injeção, referências inválidas e paginação excessiva antes do banco', async () => {
  for (const query of [{ origem: 'outro' }, { pagina: 0 }, { pagina: 10001 }, { pagina: 1.5 },
    { referencia: { $ne: null } }, { campo: '$where', referencia: 'x' }, { referencia: 'x'.repeat(129) },
    { campo: 'clienteId', referencia: 'invalido' }, { financeiro: { $ne: null } },
    { origem: 'mensalidades', competencia: '2026-13' }, { competencia: '2026-11' }]) {
    const painel = painelConciliacao();
    await assert.rejects(painel.consultar(query));
    assert.equal(painel.consultas.length, 0);
  }
});

test('PAG-17: assinatura autorizada sem pagamento não é tratada como aprovação financeira', async () => {
  const painel = painelConciliacao();
  Object.assign(painel.dados.assinaturas[0], { statusAdesao: 'aguardando_pagamento', statusProvedor: 'authorized', senha: 'segredo', entrega: { rua: 'privada' } });
  const { itens: [item] } = await painel.consultar({ origem: 'assinaturas' });
  assert.equal(item.statusFinanceiro, 'desconhecido');
  assert.equal(item.expedicaoPermitida, false);
  assert.equal(item.total, null);
  assert.equal(JSON.stringify(item).includes('segredo'), false);
  assert.equal(JSON.stringify(item).includes('privada'), false);
});

test('PAG-17: rota exige administrador atual, não permite cache e oculta falhas internas', async () => {
  const jwt = require('jsonwebtoken');
  for (const caso of ['visitante', 'cliente', 'admin-revogado', 'admin', 'falha']) {
    let handlers;
    let chamadas = 0;
    const { autenticarAdmin } = criarAutenticacao({ jwtSecret: 'teste-painel',
      consultarConta: async () => ({ status: true, perfil: ['admin', 'falha'].includes(caso) ? 'admin' : 'cliente' }) });
    registrarConciliacaoAdmin({ app: { get(_url, ...lista) { handlers = lista; } }, autenticarAdmin,
      consultar: async () => { chamadas++; if (caso === 'falha') throw new Error('token-sensivel'); return { itens: [] }; } });
    const req = { headers: {}, session: {}, query: {} };
    if (caso !== 'visitante') req.headers.cookie = `token=${jwt.sign({ usuarioId: 'conta', perfil: caso === 'cliente' ? 'cliente' : 'admin' }, 'teste-painel')}`;
    const res = { statusCode: 200, set(nome, valor) { this[nome] = valor; }, status(valor) { this.statusCode = valor; return this; }, json(valor) { this.dados = valor; } };
    let autorizado = false;
    await handlers[0](req, res, () => { autorizado = true; });
    if (autorizado) await handlers[1](req, res);
    assert.equal(res.statusCode, { visitante: 401, cliente: 403, 'admin-revogado': 403, admin: 200, falha: 503 }[caso]);
    assert.equal(chamadas, autorizado ? 1 : 0);
    assert.equal(res['Cache-Control'], 'private, no-store');
    assert.equal(JSON.stringify(res.dados).includes('token-sensivel'), false);
  }
});

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
  const saidaLogs = Object.fromEntries(['log', 'warn', 'error'].map((nivel) => [nivel, (linha) => {
    if (falhas.logIndisponivel) throw new Error('Destino de logs indisponível');
    logs.push([linha]);
  }]));
  const loggerTeste = criarLoggerOperacional({ saida: saidaLogs });
  const consultasConta = [];
  let reservas;
  let resumoCheckout;
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
    if (nome === './backend/functions/logOperacional') return { loggerOperacional: loggerTeste };
    if (nome === './backend/functions/tentativasPagamento') {
      const modulo = requerer(nome);
      return { ...modulo, criarCobrancaComTentativa: (opcoes) => modulo.criarCobrancaComTentativa({ ...opcoes, logger: loggerTeste }) };
    }
    if (nome === './backend/functions/resumoCheckout') {
      const modulo = requerer(nome);
      return { ...modulo, criarResumoCheckout(opcoes) {
        resumoCheckout = modulo.criarResumoCheckout({ ...opcoes, agora: () => new Date(falhas.horaResumo ?? Date.now()) });
        return resumoCheckout;
      } };
    }
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
        findById(id) { const conta = { email: 'perfil@example.com', status: !falhas.contaInativa, perfil: falhas.perfilConta || 'cliente',
          cartoes: falhas.cartoes || [], provedorCustomerId: falhas.provedorCustomerId,
          enderecos: [{ _id: id === 'outro-cliente' ? 'outro-endereco' : 'endereco-1', cep: '01001000',
            rua: 'Rua Teste', numero: '1', bairro: 'Centro', cidade: 'São Paulo', estado: 'SP' }] };
          return { select: async () => { consultasConta.push(id); if (falhas.consultaConta) throw new Error('Falha token-sensivel'); return conta; },
            then(resolve, reject) { return Promise.resolve(conta).then(resolve, reject); } }; },
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
        async findOne(filtro) {
          if (filtro.numero && falhas.pedidoResumo?.numero === filtro.numero && falhas.pedidoResumo.clienteId === filtro.clienteId) return falhas.pedidoResumo;
          return pedidos.find((pedido) => Object.entries(filtro).every(([campo, valor]) => pedido[campo] === valor)) ?? null;
        },
        async create(dados) {
          if (falhas.pedido) throw new Error('Falha no registro do pedido');
          if (pedidos.some((pedido) => pedido.pagamentoId === dados.pagamentoId)) throw Object.assign(new Error('Pagamento duplicado'), { code: 11000 });
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
        find(filtro) { return { sort() { return this; }, async lean() {
          return (falhas.produtos || []).filter((produto) => Object.entries(filtro).every(([campo, valor]) => produto[campo] === valor));
        } }; },
        findOne(filtro) { return { async lean() {
          return (falhas.produtos || []).find((produto) => Object.entries(filtro).every(([campo, valor]) => produto[campo] === valor)) || null;
        } }; },
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
          if (tentativas.some((item) => (item.clienteId === dados.clienteId && item.chaveTentativa === dados.chaveTentativa) || (dados.cotacaoId && item.cotacaoId === dados.cotacaoId))) {
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
      MercadoPagoConfig: class {}, Customer: class { async getCard() { return falhas.cartaoRemoto; } },
      CardToken: class { async get() { return falhas.tokenSalvo; } }, PaymentRefund: class {}, PreApproval: class {
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
    get carrinho() { return carrinho; },
    get reservas() { return reservas; },
    get atualizarLogistica() { return atualizarLogistica; },
    async enviar(metodo, dados = {}) {
    const req = { body: { email: 'teste@example.com', cpf: '00000000000',
      nomeCompleto: 'Cliente Teste', token: 'token-teste', payment_method_id: 'visa',
      freteCentavos: 1500, cep: '01001000', servicoId: 1, ...dados },
      headers: dados.headers || {}, session: falhas.semSessao ? {} : { usuarioId: falhas.clienteId ?? 'cliente-teste' } };
    req.params = dados.parametros ?? { id: 'pedido-1' };
    req.query = dados.query ?? {};
    req.body.cliente ??= { nome: 'Cliente Teste', email: 'teste@example.com' };
    req.body.chaveTentativa ??= randomUUID();
    if (dados.semChave) delete req.body.chaveTentativa;
    req.body.entrega ??= { cep: req.body.cep, endereco: 'Rua Teste, 1' };
    const res = { statusCode: 200, status(valor) { this.statusCode = valor; return this; },
      set(nome, valor) { (this.headers ||= {})[nome] = valor; return this; },
      send(valor) { this.dados = valor; return this; },
      json(valor) { this.dados = valor; return this; } };
    const url = metodo.startsWith('/') ? metodo : `/api/pagamento/${metodo}`;
    if (url.startsWith('/api/pagamento/') && !Object.hasOwn(dados, 'cotacao') && !dados.semCotacao) {
      // Fixtures anteriores à PAG-15 recebem uma cotação de teste, emitida
      // pelo serviço real. Não existe esse preenchimento automático na API.
      try {
        const calculo = criarItensPedido(carrinho.itens);
        const meio = url.split('/').at(-1);
        req.body.cotacao = resumoCheckout.emitir({ clienteId: req.session.usuarioId, calculo,
          cep: String(req.body.cep).replace(/\D/g, ''), metodo: meio,
          frete: calculo.subtotal > 39990 ? 0 : Number(req.body.freteCentavos),
          servicoId: calculo.subtotal > 39990 ? 0 : Number(req.body.servicoId),
          parcelas: meio === 'cartao' ? Number(req.body.parcelas ?? 1) : 1, entrega: req.body.entrega }).cotacao;
      } catch { /* O handler continua validando o cenário inválido. */ }
    }
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

test('catálogo público desconta estoque de segurança na listagem e no detalhe sem expor o campo interno', async () => {
  for (const estoqueSeguranca of [undefined, 0, 3, 10]) {
    const produto = { _id: 'produto-teste', slug: 'kit', nome: 'Kit', tipo: 'kit', ativo: true, estoque: 10,
      ...(estoqueSeguranca !== undefined && { estoqueSeguranca }) };
    const original = JSON.stringify(produto);
    const servidor = montarServidor(4990, undefined, { produtos: [produto] });
    const lista = await servidor.enviar('/api/produtos', { httpMethod: 'get', query: {} });
    const detalhe = await servidor.enviar('/api/produto/:slug', { httpMethod: 'get', parametros: { slug: 'kit' } });
    assert.equal(lista.statusCode, 200);
    assert.equal(detalhe.statusCode, 200);
    for (const publico of [lista.dados.produtos[0], detalhe.dados.produto]) {
      assert.equal(publico.estoqueDisponivel, 10 - (estoqueSeguranca || 0));
      assert.equal(Object.hasOwn(publico, 'estoqueSeguranca'), false);
    }
    assert.equal(JSON.stringify(produto), original);
  }
});

test('catálogo público preserva filtro de tipo e oculta produtos inativos', async () => {
  const produtos = [{ slug: 'kit', nome: 'Kit', tipo: 'kit', ativo: true, estoque: 5, estoqueSeguranca: 2 },
    { slug: 'material', nome: 'Material', tipo: 'material', ativo: true, estoque: 3 },
    { slug: 'inativo', nome: 'Inativo', tipo: 'kit', ativo: false, estoque: 10 }];
  const servidor = montarServidor(4990, undefined, { produtos });
  const lista = await servidor.enviar('/api/produtos', { httpMethod: 'get', query: { tipo: 'KIT' } });
  assert.deepEqual(Array.from(lista.dados.produtos, (produto) => produto.slug), ['kit']);
  const detalhe = await servidor.enviar('/api/produto/:slug', { httpMethod: 'get', parametros: { slug: 'inativo' } });
  assert.equal(detalhe.statusCode, 404);
});

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
      if (contexto.antesAtualizar) contexto.antesAtualizar(nome, filtro, dados, contexto);
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
    interceptarAtualizacao(callback) { contexto.antesAtualizar = callback; },
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
  const usuario = { status: true, provedorCustomerId: 'customer-perfil', cartoes: [], async save() { this.salvo = true; } };
  const consultas = [];
  const dados = { id: token, status: 'active', luhn_validation: true, security_code_length: 3,
    last_four_digits: '1111', first_six_digits: '411111', expiration_month: 12,
    expiration_year: new Date().getUTCFullYear() + 2, date_due: new Date(Date.now() + 86400000).toISOString(),
    card_number: '4111111111111111', security_code: '123', cardholder: { name: 'Nome privado', identification: { number: 'documento-privado' } },
    ...alteracoes };
  const salvar = criarReferenciaCartao({ Usuario: { findById: async (id) => { consultas.push(id); return usuario; } },
    cardTokenModule: { get: async ({ id }) => { assert.equal(id, token); return dados; } },
    customerModule: { async createCard() { return { id: 'card-perfil', customer_id: 'customer-perfil',
      last_four_digits: dados.last_four_digits, expiration_month: dados.expiration_month, expiration_year: dados.expiration_year,
      payment_method: { id: 'visa', payment_type_id: 'credit_card' } }; } } });
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
    setCartoes() {}, setMostrarFormularioCartao() {}, toast() {},
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

test('PAG-14: cadastro e subtotal válidos geram snapshot sem usar o preço do navegador', () => {
  const produto = { _id: 'produto-1', slug: 'kit', nome: 'Kit', preco: 12990, ativo: true };
  const itens = [{ produtoId: produto, quantidade: 2, preco: 1 },
    { produtoId: { ...produto, _id: 'produto-2', preco: 499 }, quantidade: 1 }];
  const resultado = criarItensPedido(itens);
  assert.equal(resultado.subtotal, 26479);
  assert.equal(resultado.itensPedido[0].precoUnit, 12990);
  produto.preco = 100;
  assert.equal(resultado.itensPedido[0].precoUnit, 12990);
});

test('PAG-14: carrinho vazio, produto inativo, cadastro inválido e quantidade adulterada são recusados', () => {
  const produto = { _id: 'produto-1', preco: 1000, ativo: true };
  assert.throws(() => calcularSubtotalCentavos([]), ErroCalculoPagamento);
  assert.throws(() => calcularSubtotalCentavos([{ produtoId: { ...produto, ativo: false }, quantidade: 1 }]), ErroCalculoPagamento);
  for (const preco of [null, true, '', '1000', 10.5, -1, NaN, Infinity]) {
    assert.throws(() => calcularSubtotalCentavos([{ produtoId: { ...produto, preco }, quantidade: 1 }]), ErroCalculoPagamento, `preço ${String(preco)}`);
  }
  for (const quantidade of [null, true, '', '1', 0, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => calcularSubtotalCentavos([{ produtoId: produto, quantidade }]), ErroCalculoPagamento, `quantidade ${String(quantidade)}`);
  }
});

test('PAG-14: multiplicação, acúmulo e soma com frete não ultrapassam o inteiro seguro', () => {
  const maximo = Number.MAX_SAFE_INTEGER;
  const item = (preco, quantidade = 1) => ({ produtoId: { _id: 'p', preco, ativo: true }, quantidade });
  assert.equal(calcularSubtotalCentavos([item(maximo)]), maximo);
  assert.throws(() => calcularSubtotalCentavos([item(maximo, 2)]), ErroCalculoPagamento);
  assert.throws(() => calcularSubtotalCentavos([item(maximo), item(1)]), ErroCalculoPagamento);
  assert.equal(calcularValorBaseCentavos(maximo - 1500, 1500), maximo);
  assert.throws(() => calcularValorBaseCentavos(maximo, 1), ErroCalculoPagamento);
});

test('PAG-14: Pix usa arredondamento exato inclusive próximo ao maior inteiro seguro', () => {
  const subtotal = 9007199254731003;
  assert.equal(calcularPixCentavos(subtotal, 0).produtosLiquidos, 8556839291994453);
  assert.deepEqual(calcularPixCentavos(4990, 1500), { produtosLiquidos: 4741, desconto: 249, total: 6241 });
});

test('PAG-14: Pix conserva subtotal, desconto e frete em 5000 amostras determinísticas', () => {
  let estado = 20261116n;
  const modulo = BigInt(Number.MAX_SAFE_INTEGER);
  for (let indice = 0; indice < 5000; indice++) {
    estado = (estado * 6364136223846793005n + 1442695040888963407n) % modulo;
    const subtotal = Number(estado);
    const frete = indice % 10000;
    const esperado = Number((estado * 95n + 50n) / 100n);
    const resultado = calcularPixCentavos(subtotal, frete);
    assert.equal(resultado.produtosLiquidos, esperado, `amostra ${indice}, subtotal ${subtotal}`);
    assert.equal(resultado.desconto + resultado.produtosLiquidos, subtotal);
    assert.equal(resultado.total, esperado + frete);
    assert.ok(Object.values(resultado).every(Number.isSafeInteger));
  }
});

test('PAG-14: Pix e frete recusam tipos/valores inválidos e soma final insegura', () => {
  for (const valor of [null, true, '', '1000', [], {}, -1, 1.5, NaN, Infinity]) {
    assert.throws(() => calcularPixCentavos(valor, 0), ErroCalculoPagamento);
    assert.throws(() => calcularPixCentavos(1000, valor), ErroCalculoPagamento);
    assert.throws(() => calcularValorBaseCentavos(1000, valor), ErroCalculoPagamento);
    assert.throws(() => calcularFreteAplicavelCentavos(1000, valor), ErroCalculoPagamento);
  }
  assert.throws(() => calcularPixCentavos(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), ErroCalculoPagamento);
});

test('PAG-14: frete usa limite estrito anterior ao Pix e parcelas cobrem todos os restos de 1x a 6x', () => {
  for (const subtotal of [39989, 39990, 39991]) {
    const frete = calcularFreteAplicavelCentavos(subtotal, 1500);
    assert.equal(frete, subtotal > 39990 ? 0 : 1500);
    assert.equal(calcularPixCentavos(subtotal, frete).total, Number((BigInt(subtotal) * 95n + 50n) / 100n) + frete);
  }
  for (let parcelas = 1; parcelas <= 6; parcelas++) {
    for (let resto = 0; resto < parcelas; resto++) {
      const total = 4000 * parcelas + resto;
      const valores = calcularParcelasCentavos(total, parcelas);
      assert.deepEqual(valores, Array.from({ length: parcelas }, (_, indice) => indice < resto ? 4001 : 4000));
      assert.equal(valores.reduce((soma, valor) => soma + valor, 0), total);
    }
    if (parcelas > 1) assert.throws(() => calcularParcelasCentavos(4000 * parcelas - 1, parcelas), ErroCalculoPagamento);
  }
});

test('PAG-14: novo preço vale para nova tentativa e replay preserva preço já cobrado', async () => {
  const servidor = montarServidor();
  const chaveTentativa = randomUUID();
  const original = await servidor.enviar('cartao', { chaveTentativa });
  servidor.carrinho.itens[0].produtoId.preco = 9990;
  assert.deepEqual((await servidor.enviar('cartao', { chaveTentativa })).dados, original.dados);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal((await servidor.enviar('cartao')).statusCode, 200);
  assert.equal(servidor.cobrancas[1].transaction_amount, 114.9);
  servidor.carrinho.itens[0].produtoId.ativo = false;
  assert.equal((await servidor.enviar('cartao')).statusCode, 400);
  assert.equal(servidor.cobrancas.length, 2);
});

test('PAG-14: vinte tentativas disputam três unidades sem consumir margem de segurança (simulado)', async () => {
  const servidor = montarServidor(4990, undefined, { estoques: {
    'produto-teste': { estoque: 5, estoqueSeguranca: 2, ativo: true },
  } });
  const respostas = await Promise.all(Array.from({ length: 20 }, () => servidor.enviar('cartao')));
  assert.equal(respostas.filter((res) => res.statusCode === 200).length, 3);
  assert.equal(respostas.filter((res) => res.statusCode === 409).length, 17);
  assert.equal(servidor.cobrancas.length, 3);
  assert.equal(servidor.estoques['produto-teste'].estoque, 2);
  assert.equal(servidor.tentativas.filter((item) => item.estoqueEstado === 'reservado').length, 3);
});

test('PAG-14: cobrança aprovada no timeout é recuperada por webhook sem segunda cobrança', async () => {
  const opcoes = { gateway: true };
  const servidor = montarServidor(4990, undefined, opcoes);
  const chaveTentativa = randomUUID();
  assert.equal((await servidor.enviar('cartao', { chaveTentativa })).statusCode, 500);
  const evento = { type: 'payment', data: { id: '123' } };
  assert.equal((await servidor.enviar('/api/webhook', evento)).statusCode, 200);
  opcoes.gateway = false;
  assert.equal((await servidor.enviar('cartao', { chaveTentativa })).statusCode, 200);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-14: bloqueio de operação interrompida só permite retomada após expiração', async () => {
  const opcoes = { cancelamento: true, falhaCancelar: true };
  const sistema = montarRecorrencia(opcoes);
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  const operacao = sistema.colecoes.OperacaoClube[0];
  Object.assign(operacao, { estado: 'processando', lockToken: 'processo-interrompido',
    lockAte: '2026-11-10T16:02:00Z', proximaExecucaoEm: '2026-11-10T16:00:00Z' });
  opcoes.falhaCancelar = false;
  await sistema.cancelamento.processarPendentes({ forcar: true });
  assert.equal(sistema.chamadasCancelamento.length, 1);
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.chamadasCancelamento.length, 2);
  assert.equal(operacao.estado, 'concluida');
});

test('PAG-14: vinte processadores de reembolso concorrentes produzem uma devolução (simulado)', async () => {
  const opcoes = { cancelamento: true, falhaReembolso: true };
  const sistema = montarRecorrencia(opcoes);
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-10T16:01:00Z');
  sistema.definirHora('2026-11-10T16:02:00Z');
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  opcoes.falhaReembolso = false;
  sistema.definirHora('2026-11-10T16:04:00Z');
  await Promise.all(Array.from({ length: 20 }, () => sistema.cancelamento.processarPendentes()));
  assert.equal(sistema.reembolsos.size, 1);
  assert.equal(sistema.chamadasReembolso.length, 2); // Um timeout anterior + uma execução bem-sucedida.
  assert.equal(sistema.colecoes.CaixaClube.length, 1);
});

test('PAG-14: perder a posse da operação impede enviar POST de reembolso', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-10T16:01:00Z');
  sistema.definirHora('2026-11-10T16:02:00Z');
  sistema.interceptarAtualizacao((nome, filtro, dados, contexto) => {
    if (nome === 'OperacaoClube' && dados.$set?.valorSolicitado) {
      contexto.colecoes.OperacaoClube.find((item) => item._id === filtro._id).lockToken = 'outro-processador';
    }
  });
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  assert.equal(sistema.chamadasReembolso.length, 0);
  assert.equal(sistema.colecoes.CaixaClube[0].bloqueada, true);
});

test('PAG-14: falha no banco após resposta do reembolso recupera efeito sem outro POST', async () => {
  const sistema = montarRecorrencia({ cancelamento: true });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  sistema.adicionar('1', '2026-11-10T16:01:00Z');
  sistema.definirHora('2026-11-10T16:02:00Z');
  let falhou = false;
  sistema.interceptarAtualizacao((nome, _filtro, dados) => {
    if (nome === 'OperacaoClube' && dados.$set?.estado === 'aguardando_provedor' && !falhou) {
      falhou = true;
      throw new Error('Banco indisponível após efeito remoto');
    }
  });
  await sistema.processar({ tipo: 'payment', id: 'pag-1' });
  sistema.definirHora('2026-11-10T16:04:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.chamadasReembolso.length, 1);
  assert.equal(sistema.colecoes.CaixaClube[0].reembolsoEstado, 'concluido');
});

test('PAG-14: repetição antes do intervalo não chama novamente o provedor nem altera a identificação', async () => {
  const sistema = montarRecorrencia({ cancelamento: true, falhaCancelar: true });
  await sistema.cancelamento.solicitar('cliente-a', assinaturaTesteId);
  const operacao = sistema.colecoes.OperacaoClube[0];
  const identificadoEm = operacao.identificadoEm;
  sistema.definirHora('2026-11-10T16:00:59Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.chamadasCancelamento.length, 1);
  assert.equal(operacao.identificadoEm, identificadoEm);
  sistema.definirHora('2026-11-10T16:01:00Z');
  await sistema.cancelamento.processarPendentes();
  assert.equal(sistema.chamadasCancelamento.length, 2);
});

async function obterResumoTeste(servidor, dados = {}) {
  const resposta = await servidor.enviar('/api/checkout/resumo', { metodo: 'cartao', ...dados, testarAutenticacao: true });
  assert.equal(resposta.statusCode, 200, JSON.stringify(resposta.dados));
  return resposta.dados.resumo;
}

test('PAG-15: resumo exige conta autenticada, não permite cache e ignora valores do navegador', async () => {
  const visitante = montarServidor(4990, undefined, { semSessao: true });
  assert.equal((await visitante.enviar('/api/checkout/resumo', { testarAutenticacao: true })).statusCode, 401);
  const servidor = montarServidor();
  const resposta = await servidor.enviar('/api/checkout/resumo', { metodo: 'pix', subtotal: 1, frete: 0,
    total: 1, desconto: 99999, itens: [{ preco: 1 }], testarAutenticacao: true });
  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.headers['Cache-Control'], 'private, no-store');
  const resumo = resposta.dados.resumo;
  assert.deepEqual([resumo.subtotal, resumo.desconto, resumo.frete, resumo.total], [4990, 249, 1500, 6241]);
  assert.equal(resumo.itens[0].precoUnit, 4990);
  assert.equal(typeof resumo.cotacao, 'string');
  assert.equal(servidor.cobrancas.length + servidor.tentativas.length, 0);
});

test('PAG-15: sem CEP o servidor mostra produtos, mas não inventa frete, total ou cotação pagável', async () => {
  const resumo = await obterResumoTeste(montarServidor(), { cep: '' });
  assert.equal(resumo.subtotal, 4990);
  assert.equal(resumo.frete, null);
  assert.equal(resumo.total, null);
  assert.equal(resumo.cotacao, null);
  assert.equal(resumo.opcoesFrete.length, 0);
});

test('PAG-15: servidor entrega limites de frete e centavos de cada parcela', async () => {
  for (const preco of [39990, 39991]) {
    const resumo = await obterResumoTeste(montarServidor(preco), { metodo: 'pix' });
    assert.equal(resumo.frete, preco > 39990 ? 0 : 1500);
    assert.equal(resumo.servicoId, preco > 39990 ? 0 : 1);
  }
  const resumo = await obterResumoTeste(montarServidor(10501), { parcelas: 3 });
  assert.equal(resumo.total, 12001);
  assert.deepEqual(Array.from(resumo.valoresParcelas), [4001, 4000, 4000]);
  assert.equal(resumo.opcoesParcelas.length, 3);
  const simples = await obterResumoTeste(montarServidor(10501), { parcelas: 6 });
  assert.equal(simples.parcelas, 1);
});

test('PAG-15: nova cobrança requer cotação válida, mesmo quando os valores enviados estão corretos', async () => {
  for (const metodo of ['pix', 'boleto', 'cartao']) {
    const servidor = montarServidor();
    const sem = await servidor.enviar(metodo, { semCotacao: true });
    assert.equal(sem.statusCode, 400);
    assert.equal(sem.dados.resumo_invalido, true);
    const falsa = await servidor.enviar(metodo, { cotacao: 'cotacao-adulterada' });
    assert.equal(falsa.statusCode, 409);
    assert.equal(servidor.tentativas.length + servidor.cobrancas.length, 0);
  }
});

test('PAG-15: cotação expira após cinco minutos, mas replay recupera pagamento já criado', async () => {
  const opcoes = { horaResumo: Date.parse('2026-11-16T12:00:00Z') };
  const servidor = montarServidor(4990, undefined, opcoes);
  const resumo = await obterResumoTeste(servidor);
  assert.equal(resumo.validoAte, '2026-11-16T12:05:00.000Z');
  const chaveTentativa = randomUUID();
  const primeira = await servidor.enviar('cartao', { cotacao: resumo.cotacao, chaveTentativa });
  assert.equal(primeira.statusCode, 200);
  opcoes.horaResumo += 300000;
  assert.deepEqual((await servidor.enviar('cartao', { cotacao: resumo.cotacao, chaveTentativa })).dados, primeira.dados);
  assert.equal((await servidor.enviar('cartao', { cotacao: resumo.cotacao })).statusCode, 409);
  assert.equal(servidor.cobrancas.length, 1);
});

test('PAG-15: alterar itens, preço, quantidade, CEP, endereço, método ou parcelas invalida a cotação', async () => {
  const casos = [
    (servidor) => { servidor.carrinho.itens[0].produtoId.preco = 5990; return {}; },
    (servidor) => { servidor.carrinho.itens[0].quantidade = 2; return {}; },
    (servidor) => { servidor.carrinho.itens[0].produtoId._id = 'outro-produto'; return {}; },
    () => ({ cep: '01310100' }),
    () => ({ entrega: { cep: '01001000', endereco: 'Outro endereço, 99' } }),
  ];
  for (const alterar of casos) {
    const servidor = montarServidor();
    const resumo = await obterResumoTeste(servidor);
    assert.equal((await servidor.enviar('cartao', { cotacao: resumo.cotacao, ...alterar(servidor) })).statusCode, 409);
    assert.equal(servidor.tentativas.length + servidor.cobrancas.length, 0);
  }
  const servidor = montarServidor(15000);
  const resumo = await obterResumoTeste(servidor, { parcelas: 2 });
  assert.equal((await servidor.enviar('cartao', { cotacao: resumo.cotacao, parcelas: 3 })).statusCode, 409);
  assert.equal((await servidor.enviar('pix', { cotacao: resumo.cotacao })).statusCode, 409);
});

test('PAG-15: serviço de mesmo preço e frete reajustado não reutilizam cotação antiga', async () => {
  let preco = 1500;
  const servidor = montarServidor(4990, async () => [{ servicoId: 1, preco }, { servicoId: 2, preco }]);
  const resumo = await obterResumoTeste(servidor);
  assert.equal((await servidor.enviar('cartao', { cotacao: resumo.cotacao, servicoId: 2 })).statusCode, 409);
  preco = 1600;
  const alterado = await servidor.enviar('cartao', { cotacao: resumo.cotacao });
  assert.equal(alterado.statusCode, 400);
  assert.equal(alterado.dados.resumo_invalido, true);
  assert.equal(servidor.cobrancas.length, 0);
});

test('PAG-15: cotação não é transferível entre contas e produto inativo não é omitido silenciosamente', async () => {
  const opcoes = {};
  const servidor = montarServidor(4990, undefined, opcoes);
  const resumo = await obterResumoTeste(servidor);
  opcoes.clienteId = 'outro-cliente';
  assert.equal((await servidor.enviar('cartao', { cotacao: resumo.cotacao })).statusCode, 409);
  opcoes.clienteId = 'cliente-teste';
  servidor.carrinho.itens[0].produtoId.ativo = false;
  assert.equal((await servidor.enviar('cartao', { cotacao: resumo.cotacao })).statusCode, 400);
  assert.equal((await servidor.enviar('/api/checkout/resumo')).statusCode, 400);
  assert.equal(servidor.cobrancas.length, 0);
});

test('PAG-15: a mesma cotação não cria duas tentativas mesmo com chaves concorrentes diferentes', async () => {
  const servidor = montarServidor();
  const resumo = await obterResumoTeste(servidor);
  const respostas = await Promise.all([servidor.enviar('cartao', { cotacao: resumo.cotacao }), servidor.enviar('cartao', { cotacao: resumo.cotacao })]);
  assert.deepEqual(respostas.map((res) => res.statusCode).sort(), [200, 409]);
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.tentativas.length, 1);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  const { TentativaPagamento } = require('../backend/db/mongodb');
  assert.ok(TentativaPagamento.schema.indexes().some(([campos, opcoes]) => campos.cotacaoId && opcoes.unique));
});

test('PAG-15: replay devolve resumo efetivamente cobrado e endereço confirmado não pode ser trocado no registro', async () => {
  const servidor = montarServidor();
  const resumo = await obterResumoTeste(servidor);
  const chaveTentativa = randomUUID();
  const pagamento = await servidor.enviar('cartao', { chaveTentativa, cotacao: resumo.cotacao });
  servidor.carrinho.itens[0].produtoId.preco = 9990;
  const novo = await obterResumoTeste(servidor);
  assert.equal(novo.total, 11490);
  const replay = await servidor.enviar('cartao', { chaveTentativa, cotacao: novo.cotacao });
  assert.equal(replay.dados.resumo.total, 6490);
  assert.deepEqual(replay.dados.resumo, pagamento.dados.resumo);
  const pedido = await servidor.enviar('/api/pedidos', { pagamentoId: '123', entrega: { cep: '01001000', endereco: 'Endereço alterado' } });
  assert.equal(pedido.statusCode, 400);
  assert.equal(servidor.pedidos.length, 0);
});

test('PAG-15: pedido pendente usa cadastro do servidor e exige propriedade', async () => {
  const pedidoResumo = { numero: 'MS-PENDENTE', clienteId: 'cliente-teste', status: 'aguardando_pagamento',
    itens: [{ produtoId: { _id: 'produto-teste', nome: 'Kit atual', slug: 'kit', preco: 9990, ativo: true }, quantidade: 2 }],
    async populate() {} };
  const servidor = montarServidor(1, undefined, { pedidoResumo });
  const resumo = await obterResumoTeste(servidor, { pedidoNumero: pedidoResumo.numero, itens: [{ precoUnit: 1 }] });
  assert.equal(resumo.subtotal, 19980);
  assert.equal((await servidor.enviar('/api/checkout/resumo', { pedidoNumero: 'pedido-alheio' })).statusCode, 404);
  pedidoResumo.pagamentoId = '123';
  assert.equal((await servidor.enviar('/api/checkout/resumo', { pedidoNumero: pedidoResumo.numero })).statusCode, 409);
  assert.equal(servidor.cobrancas.length, 0);
});

test('PAG-15: cliente descarta resposta atrasada de resumo e ignora resposta após invalidar', async () => {
  const { criarConsultaResumo } = await import('../src/utils/resumoCheckout.mjs');
  const pendentes = [];
  const controle = criarConsultaResumo(async (_url, opcoes) => new Promise((resolve) => pendentes.push({ resolve, opcoes })));
  const primeiro = controle.consultar({ cep: '01001000' });
  const segundo = controle.consultar({ cep: '01310100' });
  pendentes[1].resolve({ ok: true, json: async () => ({ resumo: { total: 2500 } }) });
  assert.deepEqual(await segundo, { total: 2500 });
  pendentes[0].resolve({ ok: true, json: async () => ({ resumo: { total: 1 } }) });
  assert.equal(await primeiro, null);
  assert.equal(pendentes[0].opcoes.signal.aborted, true);
  const terceiro = controle.consultar({ cep: '20000000' });
  controle.cancelar();
  pendentes[2].resolve({ ok: true, json: async () => ({ resumo: { total: 9999 } }) });
  assert.equal(await terceiro, null);
});

test('PAG-15: erro do resumo atual não reaproveita valor antigo nem envia campos de cartão', async () => {
  const { criarConsultaResumo } = await import('../src/utils/resumoCheckout.mjs');
  const chamadas = [];
  const controle = criarConsultaResumo(async (url, opcoes) => {
    chamadas.push({ url, opcoes });
    return { ok: false, json: async () => ({ erro: 'Frete indisponível.' }) };
  });
  await assert.rejects(controle.consultar({ cep: '01001000', metodo: 'pix', parcelas: 1 }), /Frete indisponível/);
  assert.equal(chamadas[0].opcoes.credentials, 'include');
  assert.equal(chamadas[0].opcoes.cache, 'no-store');
  assert.equal(JSON.stringify(chamadas).includes('cvv'), false);
});

function executarCheckoutTeste(variaveis) {
  const fonte = readFileSync(resolve(__dirname, '../src/Pages/Checkout.jsx'), 'utf8');
  const inicio = fonte.indexOf('  const handleFinalizarPedido =');
  const handler = fonte.slice(inicio, fonte.indexOf('\n  return (', inicio));
  return runInNewContext(handler + '\nhandleFinalizarPedido({ preventDefault() {} });', { cartaoSalvoId: '', cartaoSalvo: null, ...variaveis });
}

test('PAG-15: handler do checkout envia cotação e token, e recebe o resumo oficial efetivamente cobrado', async () => {
  const servidor = montarServidor();
  const resumo = await obterResumoTeste(servidor);
  const envios = [];
  let confirmado;
  const valores = { resumo, cartItems: resumo.itens, subtotal: resumo.subtotal, valorFrete: resumo.frete,
    freteSelecionado: resumo.opcoesFrete[0], freteSelecionadoId: resumo.servicoId,
    parcelasSelecionadas: '1', pagamento: 'cartao', cep: '01001000', pedidoPendente: null,
    entregaResumo: { cep: '01001000', endereco: 'Rua Teste, 1' },
    formData: { email: 'teste@example.com', cpf: '00000000000', nome: 'Cliente Teste', endereco: 'Rua Teste', numero: '1',
      bairro: 'Centro', cidade: 'São Paulo', estado: 'SP', numeroCartao: '4111111111111111', nomeCartao: 'Nome Teste',
      validade: '12/30', cvv: '123', cpfTitular: '00000000000', bandeira: 'visa' },
    envioPagamentoRef: { current: false }, chavePagamentoRef: { current: null },
    sessionStorage: { getItem: () => null, setItem() {} }, crypto: { randomUUID },
    setLoading() {}, setResultado() {}, setFormData() {}, atualizarResumo() {}, toast(mensagem) { assert.fail(mensagem); },
    detectarBandeiraCartao: () => 'visa', mpInstance: { createCardToken: async () => ({ id: 'token-teste' }) },
    lerRespostaPagamento: async (resposta) => resposta.json(),
    concluirPagamento: async (_tipo, dados) => { confirmado = dados.resumo; },
    fetch: async (url, opcoes) => {
      const body = JSON.parse(opcoes.body);
      envios.push(body);
      const resposta = await servidor.enviar(url, { ...body, testarAutenticacao: true });
      return { json: async () => resposta.dados };
    },
  };
  await executarCheckoutTeste(valores);
  assert.equal(envios.length, 1);
  assert.equal(envios[0].cotacao, resumo.cotacao);
  assert.equal(envios[0].token, 'token-teste');
  assert.equal(JSON.stringify(envios).includes('4111111111111111'), false);
  assert.equal(Object.hasOwn(envios[0], 'cvv'), false);
  assert.equal(confirmado.total, 6490);
  assert.equal(servidor.cobrancas.length, 1);
});

test('PAG-15: handler do checkout bloqueia resumo ausente ou expirado antes de tokenizar ou cobrar', async () => {
  for (const resumo of [null, { cotacao: 'expirada', validoAte: '2020-01-01' }]) {
    let tokenizacoes = 0;
    let atualizacoes = 0;
    await executarCheckoutTeste({ resumo, cartItems: [{}], subtotal: 4990, freteSelecionado: {},
      formData: { email: 'teste@example.com', cpf: '00000000000', nome: 'Cliente Teste' },
      envioPagamentoRef: { current: false }, setLoading() {}, setResultado() {}, toast() {},
      atualizarResumo() { atualizacoes++; },
      mpInstance: { createCardToken: async () => { tokenizacoes++; } },
    });
    assert.equal(tokenizacoes, 0);
    assert.equal(atualizacoes, 1);
  }
});

async function consultarRecuperacao(servidor, chave) {
  return servidor.enviar('/api/pagamentos/tentativas/:chave', { httpMethod: 'get', parametros: { chave }, testarAutenticacao: true });
}

test('PAG-16: recarregar consulta a tentativa existente, restaura Pix e não registra pedido no GET', async () => {
  const servidor = montarServidor(4990, undefined, { status: 'pending', respostaGateway: {
    point_of_interaction: { transaction_data: { qr_code: 'pix-ficticio-da-tentativa', qr_code_base64: 'aGVsbG8=' } },
  } });
  const chave = randomUUID();
  await servidor.enviar('pix', { chaveTentativa: chave });
  for (let repeticao = 0; repeticao < 3; repeticao++) {
    const resposta = await consultarRecuperacao(servidor, chave);
    assert.equal(resposta.statusCode, 200);
    assert.equal(resposta.headers['Cache-Control'], 'private, no-store');
    assert.equal(resposta.dados.tentativa.dados.qr_code_pix, 'pix-ficticio-da-tentativa');
    assert.equal(resposta.dados.tentativa.statusFinanceiro, 'aguardando_pagamento');
    assert.equal(resposta.dados.tentativa.resumo.total, 6241);
    assert.equal(resposta.dados.tentativa.podeRegistrarPedido, true);
    assert.equal(JSON.stringify(resposta.dados).includes('teste@example.com'), false);
  }
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.pedidos.length, 0);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-16: recuperar exige proprietário e identidade válida, sem revelar tentativa alheia', async () => {
  const opcoes = {};
  const servidor = montarServidor(4990, undefined, opcoes);
  const chave = randomUUID();
  await servidor.enviar('cartao', { chaveTentativa: chave });
  opcoes.clienteId = 'outra-conta';
  assert.equal((await consultarRecuperacao(servidor, chave)).statusCode, 404);
  opcoes.semSessao = true;
  assert.equal((await consultarRecuperacao(servidor, chave)).statusCode, 401);
  opcoes.semSessao = false; opcoes.clienteId = 'cliente-teste';
  for (const invalida of ['curta', 'x'.repeat(81), '{$ne:null}']) assert.equal((await consultarRecuperacao(servidor, invalida)).statusCode, 404);
  assert.equal(servidor.cobrancas.length, 1);
});

test('PAG-16: falha no registro é recuperada do snapshot sem cobrar ou reservar novamente', async () => {
  const opcoes = { pedido: true };
  const servidor = montarServidor(4990, undefined, opcoes);
  const chave = randomUUID();
  await servidor.enviar('cartao', { chaveTentativa: chave });
  assert.equal((await servidor.enviar('/api/pedidos', { pagamentoId: '123' })).statusCode, 500);
  opcoes.pedido = false;
  const dados = { parametros: { chave }, testarAutenticacao: true, pagamentoId: 'pagamento-alheio', freteCentavos: 1,
    cliente: { nome: 'Alterado', email: 'outro@example.com' }, entrega: { cep: '20000000', endereco: 'Outro endereço' } };
  const respostas = await Promise.all([servidor.enviar('/api/pagamentos/tentativas/:chave/pedido', dados), servidor.enviar('/api/pagamentos/tentativas/:chave/pedido', dados)]);
  assert.ok(respostas.every((res) => res.statusCode === 200 || res.statusCode === 201));
  assert.equal(servidor.pedidos.length, 1);
  assert.equal(servidor.pedidos[0].total, 6490);
  assert.equal(servidor.pedidos[0].entrega.endereco, 'Rua Teste, 1');
  assert.equal(servidor.pedidos[0].cliente.nome, 'Cliente Teste');
  assert.equal(servidor.pedidos[0].cliente.email, 'teste@example.com');
  assert.equal(servidor.cobrancas.length, 1);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
  const recuperada = await consultarRecuperacao(servidor, chave);
  assert.equal(recuperada.dados.tentativa.pedido.numero, 'MS-1001');
  const porNumero = await servidor.enviar('/api/pedidos/:numero/pagamento', { httpMethod: 'get', parametros: { numero: 'MS-1001' }, testarAutenticacao: true });
  assert.equal(porNumero.statusCode, 200);
  assert.equal(porNumero.dados.tentativa.pedido.numero, 'MS-1001');
});

test('PAG-16: timeout sem resposta fica em conciliação, sem registro ou segunda cobrança', async () => {
  const servidor = montarServidor(4990, undefined, { gateway: true });
  const chave = randomUUID();
  await servidor.enviar('cartao', { chaveTentativa: chave });
  const recuperada = await consultarRecuperacao(servidor, chave);
  assert.equal(recuperada.dados.tentativa.situacao, 'conciliacao_pendente');
  assert.equal(recuperada.dados.tentativa.statusFinanceiro, 'desconhecido');
  assert.equal(recuperada.dados.tentativa.podeRegistrarPedido, false);
  assert.equal(recuperada.dados.tentativa.resumo.total, 6490);
  assert.equal((await servidor.enviar('/api/pagamentos/tentativas/:chave/pedido', { parametros: { chave } })).statusCode, 409);
  assert.equal(servidor.cobrancas.length, 1);
});

test('PAG-16: tentativa não cobrada e legado sem contato não inventam dados de entrega', async () => {
  const semEstoque = montarServidor(4990, undefined, { estoques: { 'produto-teste': { estoque: 0, estoqueSeguranca: 0, ativo: true } } });
  const chave = randomUUID();
  await semEstoque.enviar('cartao', { chaveTentativa: chave });
  assert.equal((await consultarRecuperacao(semEstoque, chave)).dados.tentativa.situacao, 'nao_cobrada');
  assert.equal(semEstoque.cobrancas.length, 0);
  const legado = montarServidor();
  await legado.enviar('cartao', { chaveTentativa: chave });
  delete legado.tentativas[0].clienteContato;
  assert.equal((await consultarRecuperacao(legado, chave)).dados.tentativa.podeRegistrarPedido, false);
  assert.equal((await legado.enviar('/api/pagamentos/tentativas/:chave/pedido', { parametros: { chave } })).statusCode, 409);
});

test('PAG-16: recuperação do pedido confere moeda e valor exato do provedor', async () => {
  for (const alteracao of [{ currency_id: 'USD' }, { transaction_amount: 64.89 }, { transaction_amount: 64.91 }]) {
    const opcoes = {};
    const servidor = montarServidor(4990, undefined, opcoes);
    const chave = randomUUID();
    await servidor.enviar('cartao', { chaveTentativa: chave });
    opcoes.pagamento = alteracao;
    assert.equal((await servidor.enviar('/api/pagamentos/tentativas/:chave/pedido', { parametros: { chave } })).statusCode, 400);
    assert.equal(servidor.pedidos.length, 0);
    assert.equal(servidor.cobrancas.length, 1);
  }
});

test('PAG-16: reembolso após entrega é recuperado sem apagar logística nem apresentar nova aprovação', async () => {
  const opcoes = {};
  const servidor = montarServidor(4990, undefined, opcoes);
  const chave = randomUUID();
  await servidor.enviar('cartao', { chaveTentativa: chave });
  await servidor.enviar('/api/pedidos', { pagamentoId: '123' });
  Object.assign(servidor.pedidos[0], { status: 'entregue', statusLogistico: 'entregue' });
  opcoes.status = 'refunded'; opcoes.pagamento = { date_last_updated: '2026-11-15T13:00:00Z' };
  await servidor.enviar('/api/webhook', { type: 'payment', data: { id: '123' } });
  const resultado = (await consultarRecuperacao(servidor, chave)).dados.tentativa;
  assert.equal(resultado.statusFinanceiro, 'reembolsado');
  assert.equal(resultado.valorReembolsado, 6490);
  assert.equal(resultado.statusLogistico, 'entregue');
  assert.equal(resultado.resumo.total, 6490);
  assert.equal(servidor.estoques['produto-teste'].estoque, 9);
});

test('PAG-16: referência de URL/sessão recupera apenas identificadores e boleto só abre HTTPS seguro', async () => {
  const { origemRecuperacao, permiteNovaCompra, urlBoletoSegura } = await import('../src/utils/recuperacaoPagamento.mjs');
  assert.deepEqual(origemRecuperacao('', { getItem: () => 'chave-da-sessao' }), { chave: 'chave-da-sessao' });
  assert.deepEqual(origemRecuperacao('?pedido=MS-1001', { getItem() { throw new Error('bloqueado'); } }), { pedido: 'MS-1001' });
  assert.deepEqual(origemRecuperacao('?tentativa=chave-url', { getItem: () => 'outra-chave' }), { chave: 'chave-url' });
  assert.equal(origemRecuperacao('', { getItem() { throw new Error('bloqueado'); } }), null);
  for (const url of ['javascript:alert(1)', 'data:text/html,teste', 'http://example.com/boleto', 'https://usuario:senha@example.com', 'inválida']) {
    assert.equal(urlBoletoSegura(url), null);
  }
  assert.equal(urlBoletoSegura('https://example.com/boleto'), 'https://example.com/boleto');
  assert.equal(permiteNovaCompra({ situacao: 'conciliacao_pendente', statusFinanceiro: 'desconhecido' }), false);
  assert.equal(permiteNovaCompra({ situacao: 'nao_cobrada' }), true);
  assert.equal(permiteNovaCompra({ situacao: 'localizada', statusFinanceiro: 'aprovado', pedido: { numero: 'MS-1' } }), true);
});

function superficieConsulta() {
  const eventos = new Map();
  return { hidden: false, addEventListener: (nome, callback) => eventos.set(nome, callback),
    removeEventListener: (nome) => eventos.delete(nome), emitir: (nome) => eventos.get(nome)?.() };
}

async function montarAcompanhamentoTeste(responder, opcoes = {}) {
  const { criarAcompanhamento } = await import('../src/utils/acompanhamento.mjs');
  const documento = superficieConsulta();
  const janela = superficieConsulta();
  const timers = new Map();
  const atualizacoes = [];
  let contador = 0;
  const consulta = criarAcompanhamento({ url: '/api/teste-privado', selecionar: (dados) => dados,
    aoAtualizar: (dados) => atualizacoes.push(dados), fetchImpl: responder, documento, janela,
    agendar: (callback, ms) => { const id = ++contador; timers.set(id, { callback, ms }); return id; },
    cancelar: (id) => timers.delete(id), agora: () => new Date('2026-11-16T12:00:00Z'), ...opcoes });
  return { consulta, documento, janela, timers, atualizacoes,
    async avancar() { const [id, timer] = timers.entries().next().value; timers.delete(id); await timer.callback(); } };
}

test('PAG-16: consultas não se sobrepõem, param fora da aba e retomam ao retornar', async () => {
  let chamadas = 0;
  let resolver;
  const caso = await montarAcompanhamentoTeste(async () => { chamadas++; return new Promise((resolve) => { resolver = resolve; }); });
  const inicial = caso.consulta.iniciar();
  await caso.consulta.atualizar();
  await caso.janela.emitir('focus');
  assert.equal(chamadas, 1);
  resolver({ ok: true, json: async () => ({ statusFinanceiro: 'aguardando_pagamento' }) });
  await inicial;
  assert.equal([...caso.timers.values()][0].ms, 4000);
  caso.documento.hidden = true;
  await caso.documento.emitir('visibilitychange');
  assert.equal(caso.timers.size, 0);
  const retorno = caso.documento.emitir('visibilitychange');
  await retorno;
  assert.equal(chamadas, 1);
  caso.documento.hidden = false;
  const visivel = caso.documento.emitir('visibilitychange');
  assert.equal(chamadas, 2);
  resolver({ ok: true, json: async () => ({ statusFinanceiro: 'aprovado' }) });
  await visivel;
  assert.equal([...caso.timers.values()][0].ms, 60000);
  caso.consulta.parar();
});

test('PAG-16: entregue/aprovado continua consultável para reembolso ou contestação posterior', async () => {
  let financeiro = 'aprovado';
  const caso = await montarAcompanhamentoTeste(async () => ({ ok: true, json: async () => ({ statusFinanceiro: financeiro, statusLogistico: 'entregue' }) }));
  await caso.consulta.iniciar();
  assert.equal([...caso.timers.values()][0].ms, 60000);
  financeiro = 'reembolsado';
  await caso.avancar();
  assert.equal(caso.atualizacoes.at(-1).dados.statusFinanceiro, 'reembolsado');
  financeiro = 'contestado';
  await caso.janela.emitir('focus');
  assert.equal(caso.atualizacoes.at(-1).dados.statusFinanceiro, 'contestado');
  caso.consulta.parar();
});

test('PAG-16: erro transitório mantém última consulta marcada e aplica backoff; acesso negado remove dados', async () => {
  let status = 200;
  const caso = await montarAcompanhamentoTeste(async () => ({ ok: status === 200, status,
    json: async () => ({ statusFinanceiro: 'aprovado' }) }));
  await caso.consulta.iniciar();
  status = 503;
  for (const intervalo of [30000, 60000, 120000]) {
    await caso.avancar();
    assert.equal(caso.atualizacoes.at(-1).desatualizado, true);
    assert.equal(caso.atualizacoes.at(-1).dados.statusFinanceiro, 'aprovado');
    assert.equal([...caso.timers.values()][0].ms, intervalo);
  }
  status = 403;
  await caso.avancar();
  assert.equal(caso.atualizacoes.at(-1).dados, null);
  assert.equal(caso.timers.size, 0);
  caso.consulta.parar();
});

test('PAG-16: consulta cancelada não publica resposta atrasada nem deixa timers', async () => {
  let resolver;
  let sinal;
  const caso = await montarAcompanhamentoTeste(async (_url, opcoes) => { sinal = opcoes.signal; return new Promise((resolve) => { resolver = resolve; }); });
  const inicial = caso.consulta.iniciar();
  caso.consulta.parar();
  resolver({ ok: true, json: async () => ({ statusFinanceiro: 'aprovado' }) });
  await inicial;
  assert.equal(sinal.aborted, true);
  assert.equal(caso.atualizacoes.length, 0);
  assert.equal(caso.timers.size, 0);
});

test('PAG-16: mensagens distinguem aprovação, reembolso parcial, crédito e contestação sem presumir sucesso', async () => {
  const { financeiroPedido, situacaoFinanceira } = await import('../src/utils/pedido.mjs');
  for (const status of ['aguardando_pagamento', 'recusado', 'cancelado', 'reembolsado', 'parcialmente_reembolsado', 'em_contestacao', 'contestado', 'desconhecido', 'futuro']) {
    assert.notEqual(financeiroPedido({ statusFinanceiro: status, status: 'entregue' }), 'aprovado');
  }
  assert.match(situacaoFinanceira('reembolsado').descricao, /crédito depende/);
  assert.match(situacaoFinanceira('parcialmente_reembolsado').descricao, /total original/);
  assert.match(situacaoFinanceira('em_contestacao').descricao, /histórico de entregas/);
});

test('PAG-16: boleto pendente é recuperado com os mesmos dados sem nova emissão', async () => {
  const servidor = montarServidor(4990, undefined, { status: 'pending', respostaGateway: {
    barcode: { content: '12345678901234567890123456789012345678901234567' },
    transaction_details: { external_resource_url: 'https://example.com/boleto-ficticio.pdf' },
  } });
  const chave = randomUUID();
  await servidor.enviar('boleto', { chaveTentativa: chave });
  const dados = (await consultarRecuperacao(servidor, chave)).dados.tentativa;
  assert.equal(dados.dados.link_boleto_pdf, 'https://example.com/boleto-ficticio.pdf');
  assert.equal(dados.dados.codigo_de_barras.length, 47);
  assert.equal(dados.statusFinanceiro, 'aguardando_pagamento');
  assert.equal(servidor.cobrancas.length, 1);
});

test('PAG-16: referência ainda não encontrada continua em consulta sem liberar outro pagamento', async () => {
  let status = 404;
  const caso = await montarAcompanhamentoTeste(async () => ({ ok: status === 200, status,
    json: async () => ({ situacao: 'conciliacao_pendente', statusFinanceiro: 'desconhecido' }) }), { repetir404: true });
  await caso.consulta.iniciar();
  assert.equal(caso.atualizacoes.at(-1).dados, null);
  assert.equal(caso.atualizacoes.at(-1).statusErro, 404);
  assert.equal(caso.timers.size, 1);
  assert.match(caso.atualizacoes.at(-1).erro, /antes de tentar outro pagamento/);
  status = 200;
  await caso.avancar();
  assert.equal(caso.atualizacoes.at(-1).dados.situacao, 'conciliacao_pendente');
  caso.consulta.parar();
});

test('PAG-16: falha de rede ao enviar pagamento preserva referência e abre recuperação sem repetir o POST', async () => {
  const referencias = [];
  const retomadas = [];
  let posts = 0;
  await executarCheckoutTeste({
    resumo: { cotacao: 'cotacao-de-teste', validoAte: new Date(Date.now() + 60000).toISOString() }, cartItems: [{}], subtotal: 4990,
    valorFrete: 1500, freteSelecionadoId: 1, parcelasSelecionadas: '1', freteSelecionado: {}, pagamento: 'cartao', cep: '01001000', pedidoPendente: null,
    entregaResumo: { cep: '01001000', endereco: 'Rua Teste, 1' },
    formData: { nome: 'Cliente Teste', email: 'teste@example.com', cpf: '00000000000', numeroCartao: '4111111111111111', nomeCartao: 'Cliente',
      validade: '12/30', cpfTitular: '00000000000', cvv: '123' },
    envioPagamentoRef: { current: false }, chavePagamentoRef: { current: null }, crypto: { randomUUID },
    sessionStorage: { getItem: () => null, setItem: (chave, valor) => referencias.push([chave, valor]) },
    window: { history: { state: null, replaceState: (_estado, _titulo, url) => referencias.push(['url', url]) } },
    mpInstance: { createCardToken: async () => ({ id: 'token-teste' }) }, detectarBandeiraCartao: () => 'visa',
    setLoading() {}, setResultado() {}, setFormData() {}, atualizarResumo() {},
    onRetomar: (chave) => retomadas.push(chave), toast: (mensagem) => assert.fail(mensagem),
    fetch: async () => { posts++; throw new Error('Resposta de rede perdida'); },
  });
  assert.equal(posts, 1);
  assert.equal(retomadas.length, 1);
  assert.equal(referencias[0][1], retomadas[0]);
  assert.equal(referencias[1][1], `/checkout?tentativa=${retomadas[0]}`);
  assert.equal(JSON.stringify(referencias).includes('4111111111111111'), false);
});

test('PAG-16: falha na tokenização não persiste referência de uma cobrança que não foi enviada', async () => {
  let persistencias = 0;
  let posts = 0;
  let retomadas = 0;
  const avisos = [];
  await executarCheckoutTeste({ resumo: { cotacao: 'cotacao-de-teste', validoAte: new Date(Date.now() + 60000).toISOString() },
    cartItems: [{}], subtotal: 4990, freteSelecionado: {}, pagamento: 'cartao',
    formData: { nome: 'Cliente Teste', email: 'teste@example.com', cpf: '00000000000', numeroCartao: '4111111111111111', nomeCartao: 'Cliente',
      validade: '12/30', cpfTitular: '00000000000', cvv: '123' },
    envioPagamentoRef: { current: false }, chavePagamentoRef: { current: null }, crypto: { randomUUID },
    sessionStorage: { getItem: () => null, setItem: () => { persistencias++; } },
    mpInstance: { createCardToken: async () => { throw new Error('erro com cartão'); } }, detectarBandeiraCartao: () => 'visa',
    setLoading() {}, setResultado() {}, setFormData() {}, atualizarResumo() {}, toast: (mensagem) => avisos.push(mensagem),
    onRetomar: () => { retomadas++; }, fetch: async () => { posts++; },
  });
  assert.equal(posts + persistencias + retomadas, 0);
  assert.equal(avisos.length, 1);
  assert.match(avisos[0], /validar o cartão/);
});
