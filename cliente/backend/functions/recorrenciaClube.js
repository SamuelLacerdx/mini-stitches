const { PLANO_CLUBE } = require('./assinaturaClube');
const { financeiroDoProvedor } = require('./estadosPedido');
const { instante, brasilia, primeiraCompetencia, somarMes, loteElegivel, vencimentoMensal, validarPostagem } = require('./calendarioClube');

// As faturas não estão expostas pelo SDK instalado. A API REST é consultada
// exclusivamente no servidor; não se aceitam valores ou vínculos do webhook.
function criarConsultaFaturas({ accessToken, fetchImpl = globalThis.fetch }) {
  async function consultar(caminho, parametros = {}) {
    if (!accessToken || !fetchImpl) throw new Error('Consulta de recorrência indisponível.');
    const url = new URL(caminho, 'https://api.mercadopago.com');
    for (const [chave, valor] of Object.entries(parametros)) url.searchParams.set(chave, valor);
    const resposta = await fetchImpl(url, { headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(10000), redirect: 'error' });
    if (!resposta.ok) throw new Error('Falha na consulta de recorrência.');
    return resposta.json();
  }
  const idValido = (id) => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
  return {
    async obter(id) {
      if (!idValido(id)) throw new Error('Fatura inválida.');
      const fatura = await consultar(`/authorized_payments/${id}`);
      if (String(fatura.id) !== id) throw new Error('Fatura divergente.');
      return fatura;
    },
    async buscar(parametros) {
      const faturas = [];
      let offset = 0;
      for (let pagina = 0; pagina < 100; pagina++) {
        const dados = await consultar('/authorized_payments/search', { ...parametros, offset, limit: 100 });
        if (!Array.isArray(dados.results) || !Number.isSafeInteger(dados.paging?.total) || dados.paging.total < 0) {
          throw new Error('Paginação de faturas inválida.');
        }
        faturas.push(...dados.results);
        offset += dados.results.length;
        if (offset >= dados.paging.total) return faturas;
        if (!dados.results.length) break;
      }
      throw new Error('Histórico de faturas incompleto.');
    },
  };
}

function criarConciliadorClube({ Assinatura, MensalidadeClube, CaixaClube, CalendarioClube,
  consultaFaturas, preApprovalModule, paymentModule, executarTransacao, cancelamento }) {
  async function conciliar(preapprovalId, recebidoEm) {
    const acordo = await preApprovalModule.get({ id: preapprovalId });
    if (String(acordo.id) !== preapprovalId) throw new Error('Assinatura divergente.');
    const referencia = String(acordo.external_reference || '');
    if (!/^[a-fA-F0-9]{24}$/.test(referencia)) return 'sem_vinculo';
    const assinatura = await Assinatura.findOne({ _id: referencia });
    if (!assinatura) return 'sem_vinculo';
    if (assinatura.plano.codigo !== PLANO_CLUBE.codigo || assinatura.plano.valor !== PLANO_CLUBE.valor ||
      (assinatura.preapprovalId && assinatura.preapprovalId !== preapprovalId)) throw new Error('Contrato divergente.');
    const recorrencia = acordo.auto_recurring;
    if (recorrencia?.frequency !== 1 || recorrencia.frequency_type !== 'months' ||
      recorrencia.currency_id !== 'BRL' || Number(recorrencia.transaction_amount) !== PLANO_CLUBE.valor / 100) {
      throw new Error('Condições de recorrência divergentes.');
    }
    const faturas = await consultaFaturas.buscar({ preapproval_id: preapprovalId });
    const verificadas = [];
    const ids = new Set();
    for (const fatura of faturas) {
      const id = String(fatura.id);
      if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || ids.has(id) || String(fatura.preapproval_id) !== preapprovalId ||
        fatura.currency_id !== 'BRL' || Number(fatura.transaction_amount) !== PLANO_CLUBE.valor / 100) {
        throw new Error('Fatura inválida ou duplicada no provedor.');
      }
      ids.add(id);
      const vencimento = instante(fatura.debit_date);
      let pagamento = null;
      if (fatura.payment?.id) {
        pagamento = await paymentModule.get({ id: String(fatura.payment.id) });
        if (String(pagamento.id) !== String(fatura.payment.id) || pagamento.currency_id !== 'BRL' ||
          Number(pagamento.transaction_amount) !== PLANO_CLUBE.valor / 100 || pagamento.payment_type_id !== 'credit_card') {
          throw new Error('Pagamento da mensalidade divergente.');
        }
      }
      const financeiro = pagamento ? financeiroDoProvedor(pagamento, PLANO_CLUBE.valor)
        : { statusFinanceiro: 'aguardando_pagamento', valorReembolsado: 0 };
      const aprovadoEm = pagamento?.date_approved ? instante(pagamento.date_approved) : null;
      if (financeiro.statusFinanceiro === 'aprovado' && !aprovadoEm) throw new Error('Aprovação sem data efetiva.');
      verificadas.push({ id, vencimento, pagamento, financeiro, aprovadoEm,
        atualizadoEm: instante(pagamento?.date_last_updated || fatura.last_modified) });
    }
    verificadas.sort((a, b) => a.vencimento - b.vencimento || a.id.localeCompare(b.id));
    const pagas = verificadas.filter((item) => item.aprovadoEm);
    // O histórico completo resolve notificações que chegam fora de ordem.
    const primeira = pagas[0];
    if (primeira && pagas.some((item) => item.aprovadoEm < primeira.aprovadoEm)) {
      throw new Error('Ordem de aprovações requer conciliação.');
    }
    await Promise.all([MensalidadeClube.init(), CaixaClube.init()]);
    const resultado = await executarTransacao(async (session) => {
      // Serializa as renovações da mesma assinatura, inclusive em concorrência.
      const atual = await Assinatura.findOneAndUpdate({ _id: assinatura._id },
        { $inc: { versaoConciliacao: 1 } }, { session, new: true });
      await Assinatura.updateOne({ _id: atual._id }, { $set: { preapprovalId } }, { session, runValidators: true });
      if (primeira && atual.primeiraFaturaId && (atual.primeiraFaturaId !== primeira.id ||
        new Date(atual.assinadoEm).getTime() !== primeira.aprovadoEm.getTime())) {
        throw new Error('Primeira mensalidade já consolidada.');
      }
      for (const item of verificadas) {
        const anterior = await MensalidadeClube.findById(item.id, null, { session });
        if (anterior && (String(anterior.assinaturaId) !== String(atual._id) ||
          (anterior.aprovadoEm && anterior.pagamentoId && item.pagamento && anterior.pagamentoId !== String(item.pagamento.id)))) {
          throw new Error('Vínculo de mensalidade divergente.');
        }
        if (anterior && new Date(anterior.provedorAtualizadoEm) > item.atualizadoEm) continue;
        if (anterior && new Date(anterior.provedorAtualizadoEm).getTime() === item.atualizadoEm.getTime() &&
          (anterior.statusFinanceiro !== item.financeiro.statusFinanceiro || anterior.valorReembolsado !== item.financeiro.valorReembolsado)) {
          throw new Error('Versão financeira inconsistente.');
        }
        const sequencia = pagas.indexOf(item);
        const competencia = sequencia >= 0 ? somarMes(primeiraCompetencia(primeira.aprovadoEm), sequencia) : undefined;
        if (anterior?.competencia && anterior.competencia !== competencia) throw new Error('Competência já consolidada.');
        const mensalidade = { assinaturaId: atual._id, clienteId: atual.clienteId, preapprovalId,
          valor: PLANO_CLUBE.valor, ...item.financeiro, vencimentoProvedor: item.vencimento,
          provedorAtualizadoEm: item.atualizadoEm, recebidoEm,
          ...(item.pagamento && { pagamentoId: String(item.pagamento.id) }),
          ...(item.aprovadoEm && { aprovadoEm: item.aprovadoEm, competencia, sequencia,
            vencimentoContratual: vencimentoMensal(primeira.aprovadoEm, sequencia),
            cobrancaDivergente: sequencia > 0 && vencimentoMensal(item.vencimento, 0) !== vencimentoMensal(primeira.aprovadoEm, sequencia) }),
        };
        if (anterior?.pagamentoId && item.pagamento && anterior.pagamentoId !== String(item.pagamento.id)) {
          mensalidade.tentativasAnteriores = [...(anterior.tentativasAnteriores || []), {
            pagamentoId: anterior.pagamentoId, statusFinanceiro: anterior.statusFinanceiro,
            provedorAtualizadoEm: anterior.provedorAtualizadoEm,
          }];
        }
        await MensalidadeClube.updateOne({ _id: item.id }, { $set: mensalidade }, { session, upsert: true, runValidators: true });
        if (!competencia) continue; // Pendente ou recusada nunca libera uma caixa.
        const lote = loteElegivel(competencia, item.aprovadoEm);
        const calendario = await CalendarioClube.findById(lote, null, { session });
        const caixa = await CaixaClube.findOne({ mensalidadeId: item.id }, null, { session });
        const aposCancelamento = atual.canceladoEm && item.aprovadoEm > new Date(atual.canceladoEm);
        const bloqueada = item.financeiro.statusFinanceiro !== 'aprovado' || Boolean(aposCancelamento);
        const nova = { assinaturaId: atual._id, clienteId: atual.clienteId, mensalidadeId: item.id,
          pagamentoId: String(item.pagamento.id), competencia, lote, aprovadoEm: item.aprovadoEm,
          ...item.financeiro, bloqueada, bloqueadaParaReembolso: Boolean(aposCancelamento) };
        if (!caixa) {
          Object.assign(nova, { entrega: atual.entrega, statusPreparacao: 'aguardando',
            ...(calendario && { postagemPrevista: calendario.postagemPrevista }) });
        }
        if (caixa && !caixa.postagemPrevista && calendario) nova.postagemPrevista = calendario.postagemPrevista;
        await CaixaClube.updateOne({ mensalidadeId: item.id }, { $set: nova }, { session, upsert: true, runValidators: true });
      }
      if (cancelamento) await cancelamento.agendarConciliacao({ assinatura: atual, verificadas, recebidoEm, session });
      if (primeira) {
        await Assinatura.updateOne({ _id: atual._id }, { $set: {
          preapprovalId, primeiraFaturaId: primeira.id, assinadoEm: primeira.aprovadoEm,
          diaCobrancaOriginal: Number(vencimentoMensal(primeira.aprovadoEm, 0).slice(-2)),
          primeiraCompetencia: primeiraCompetencia(primeira.aprovadoEm),
          ...(atual.canceladoEm || atual.statusAdesao === 'cancelada' ? {} : { statusAdesao: 'ativa' }),
        } }, { session, runValidators: true });
      }
      return 'processada';
    });
    if (cancelamento) await cancelamento.processarPendentes({ assinaturaId: assinatura._id });
    return resultado;
  }
  return async function processar({ tipo, id, referencia, recebidoEm = new Date() }) {
    if (tipo === 'subscription_preapproval') return conciliar(id, recebidoEm);
    if (tipo === 'subscription_authorized_payment') {
      const fatura = await consultaFaturas.obter(id);
      return conciliar(String(fatura.preapproval_id), recebidoEm);
    }
    const faturas = await consultaFaturas.buscar({ payment_id: id });
    if (!faturas.length) {
      if (typeof referencia === 'string' && /^[a-fA-F0-9]{24}$/.test(referencia) &&
        await Assinatura.findOne({ _id: referencia })) throw new Error('Mensalidade ainda não visível no provedor.');
      return 'sem_vinculo';
    }
    if (faturas.length !== 1 || String(faturas[0].payment?.id) !== id) throw new Error('Pagamento com vínculo ambíguo.');
    return conciliar(String(faturas[0].preapproval_id), recebidoEm);
  };
}

function registrarRotasClube({ app, autenticar, autenticarAdmin, MensalidadeClube, CaixaClube, CalendarioClube, executarTransacao }) {
  app.get('/admin/clube/mensalidades', autenticarAdmin, async (_req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const mensalidades = await MensalidadeClube.find({}).sort({ vencimentoProvedor: -1 }).lean();
      res.json({ mensalidades });
    } catch { res.status(503).json({ erro: 'Não foi possível consultar as mensalidades.' }); }
  });
  app.get('/api/clube/caixas', autenticar, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const caixas = await CaixaClube.find({ clienteId: req.session.usuarioId }).sort({ competencia: 1 }).lean();
      res.json({ caixas: caixas.map(({ _id, assinaturaId, competencia, lote, statusPreparacao, postagemPrevista,
        rastreio, statusFinanceiro, valorReembolsado, bloqueada, bloqueadaParaReembolso, reembolsoEstado, reembolsoSolicitadoEm, ocorrencias }) => ({ id: String(_id), assinaturaId: String(assinaturaId),
        competencia, lote, statusPreparacao, postagemPrevista, rastreio, statusFinanceiro, bloqueada,
        valorReembolsado, bloqueadaParaReembolso, reembolsoEstado, reembolsoSolicitadoEm,
        ocorrencias: (ocorrencias || []).map(({ motivo, novaPrevisao, registradoEm }) => ({ motivo, novaPrevisao, registradoEm })) })) });
    } catch { res.status(503).json({ erro: 'Não foi possível consultar as caixas.' }); }
  });
  app.get('/admin/clube/caixas', autenticarAdmin, async (_req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const caixas = await CaixaClube.find({ statusFinanceiro: 'aprovado', bloqueada: false,
        statusPreparacao: { $in: ['aguardando', 'preparando'] } }).sort({ competencia: 1 }).lean();
      res.json({ caixas }); // Não filtra situação da assinatura: caixas pagas continuam devidas.
    } catch { res.status(503).json({ erro: 'Não foi possível consultar a expedição.' }); }
  });
  app.put('/admin/clube/calendario/:mes', autenticarAdmin, async (req, res) => {
    let postagemPrevista;
    try {
      if (req.body?.operacaoConfirmada !== true) throw new Error('Confirme a operação da transportadora.');
      postagemPrevista = validarPostagem(req.params.mes, req.body.postagemPrevista);
    } catch (erro) { return res.status(400).json({ erro: erro.message }); }
    try {
      await executarTransacao(async (session) => {
        await CalendarioClube.updateOne({ _id: req.params.mes }, { $set: { postagemPrevista,
          confirmadoPor: req.session.usuarioId, confirmadoEm: new Date() } }, { session, upsert: true, runValidators: true });
        await CaixaClube.updateMany({ lote: req.params.mes, statusPreparacao: { $in: ['aguardando', 'preparando'] },
          'ocorrencias.0': { $exists: false } }, { $set: { postagemPrevista } }, { session, runValidators: true });
      });
      res.json({ sucesso: true, postagemPrevista });
    } catch { res.status(503).json({ erro: 'Não foi possível registrar o calendário.' }); }
  });
  app.patch('/admin/clube/caixas/:id', autenticarAdmin, async (req, res) => {
    try {
      let atualizada;
      await executarTransacao(async (session) => {
        const caixa = await CaixaClube.findById(req.params.id, null, { session });
        if (!caixa) throw Object.assign(new Error('Caixa não encontrada.'), { status: 404 });
        const transicoes = { aguardando: 'preparando', preparando: 'enviada', enviada: 'entregue' };
        const status = req.body?.statusPreparacao;
        if (status !== transicoes[caixa.statusPreparacao]) throw Object.assign(new Error('Transição não permitida.'), { status: 409 });
        if (status !== 'entregue' && (caixa.bloqueada || caixa.statusFinanceiro !== 'aprovado')) {
          throw Object.assign(new Error('Mensalidade com pendência financeira.'), { status: 409 });
        }
        const dados = { statusPreparacao: status };
        if (status === 'enviada') {
          const hoje = brasilia(new Date());
          const data = `${hoje.year}-${String(hoje.month).padStart(2, '0')}-${String(hoje.day).padStart(2, '0')}`;
          if (!caixa.postagemPrevista || caixa.postagemPrevista > data ||
            typeof req.body.rastreio !== 'string' || !/^[a-zA-Z0-9-]{5,80}$/.test(req.body.rastreio)) {
            throw Object.assign(new Error('Confira o calendário e informe o rastreamento.'), { status: 409 });
          }
          dados.rastreio = req.body.rastreio;
        }
        atualizada = await CaixaClube.findOneAndUpdate({ _id: caixa._id }, { $set: dados }, { session, new: true, runValidators: true });
      });
      res.json({ sucesso: true, caixa: atualizada });
    } catch (erro) { res.status(erro.status || 503).json({ erro: erro.status ? erro.message : 'Não foi possível atualizar a caixa.' }); }
  });
  app.post('/admin/clube/caixas/:id/ocorrencias', autenticarAdmin, async (req, res) => {
    const body = req.body || {};
    if (typeof body.motivo !== 'string' || !body.motivo.trim() || body.motivo.length > 500 || body.clienteInformado !== true) {
      return res.status(400).json({ erro: 'Informe o motivo e confirme que o cliente recebeu a nova previsão.' });
    }
    try {
      await executarTransacao(async (session) => {
        const caixa = await CaixaClube.findById(req.params.id, null, { session });
        if (!caixa) throw Object.assign(new Error('Caixa não encontrada.'), { status: 404 });
        if (!['aguardando', 'preparando'].includes(caixa.statusPreparacao)) {
          throw Object.assign(new Error('Caixa já postada.'), { status: 409 });
        }
        let novaPrevisao;
        try { novaPrevisao = validarPostagem(caixa.lote, body.novaPrevisao); }
        catch (erro) { throw Object.assign(erro, { status: 400 }); }
        if (caixa.postagemPrevista && novaPrevisao < caixa.postagemPrevista) {
          throw Object.assign(new Error('Nova previsão anterior à previsão atual.'), { status: 400 });
        }
        const agora = new Date();
        await CaixaClube.updateOne({ _id: caixa._id }, { $set: { postagemPrevista: novaPrevisao },
          $push: { ocorrencias: { motivo: body.motivo.trim(), novaPrevisao, registradoEm: agora, clienteInformadoEm: agora } } },
        { session, runValidators: true });
      });
      res.json({ sucesso: true });
    } catch (erro) { res.status(erro.status || 503).json({ erro: erro.status ? erro.message : 'Não foi possível registrar a ocorrência.' }); }
  });
}

module.exports = { criarConsultaFaturas, criarConciliadorClube, registrarRotasClube };
