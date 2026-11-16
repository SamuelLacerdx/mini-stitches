const { createHash, randomUUID, timingSafeEqual } = require('crypto');
const { loggerOperacional } = require('./logOperacional');
const { assinaturaPublica, ErroAssinatura, PLANO_CLUBE } = require('./assinaturaClube');
const { financeiroDoProvedor } = require('./estadosPedido');
const { instante } = require('./calendarioClube');

function chaveOperacao(tipo, id) {
  const hash = createHash('sha256').update(`${tipo}:${id}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function criarCancelamentoClube({ Assinatura, MensalidadeClube, CaixaClube, OperacaoClube,
  preApprovalModule, paymentModule, refundModule, executarTransacao, agora = () => new Date(), logger = loggerOperacional }) {
  async function agendar(tipo, assinatura, pagamentoId, identificadoEm, session) {
    const id = `${tipo}:${pagamentoId || assinatura._id}`;
    await OperacaoClube.updateOne({ _id: id }, { $setOnInsert: {
      tipo, assinaturaId: assinatura._id, clienteId: assinatura.clienteId,
      ...(pagamentoId && { pagamentoId }), estado: 'pendente',
      chaveIdempotencia: chaveOperacao(tipo, pagamentoId || String(assinatura._id)),
      identificadoEm, proximaExecucaoEm: identificadoEm,
      // Limite interno conservador: solicita imediatamente e alerta em 48h
      // corridas, sem depender de uma presunção de feriados para os 2 dias úteis.
      ...(tipo === 'reembolsar_pagamento' && { limiteSolicitacaoEm: new Date(identificadoEm.getTime() + 48 * 60 * 60 * 1000) }),
    } }, { session, upsert: true, runValidators: true });
  }

  async function agendarConciliacao({ assinatura, verificadas, recebidoEm, session }) {
    if (!assinatura.canceladoEm) return;
    await agendar('cancelar_assinatura', assinatura, null, recebidoEm, session);
    for (const item of verificadas) {
      if (!item.pagamento) continue;
      const id = String(item.pagamento.id);
      if (item.financeiro.statusFinanceiro === 'aguardando_pagamento') {
        await agendar('cancelar_pagamento', assinatura, id, recebidoEm, session);
      } else if (item.aprovadoEm && item.aprovadoEm > new Date(assinatura.canceladoEm)) {
        await agendar('reembolsar_pagamento', assinatura, id, recebidoEm, session);
      }
    }
  }

  async function concluir(operacao, dados = {}) {
    await OperacaoClube.updateOne({ _id: operacao._id, lockToken: operacao.lockToken }, { $set: {
      estado: 'concluida', finalizadoEm: agora(), lockAte: null, ...dados,
    } }, { runValidators: true });
  }

  async function processarUma(id, forcar) {
    const operacao = await executarTransacao(async (session) => {
      const atual = await OperacaoClube.findById(id, null, { session });
      const hora = agora();
      if (!atual || atual.estado === 'concluida' || (atual.lockAte && new Date(atual.lockAte) > hora) ||
        (!forcar && atual.proximaExecucaoEm && new Date(atual.proximaExecucaoEm) > hora)) return null;
      return OperacaoClube.findOneAndUpdate({ _id: id }, { $set: {
        estado: 'processando', lockToken: randomUUID(), lockAte: new Date(hora.getTime() + 120000),
      }, $inc: { tentativas: 1 } }, { session, new: true, runValidators: true });
    });
    if (!operacao) return;
    try {
      const assinatura = await Assinatura.findOne({ _id: operacao.assinaturaId });
      if (!assinatura?.canceladoEm) throw new Error('Cancelamento não registrado.');
      const requestOptions = { idempotencyKey: operacao.chaveIdempotencia };
      if (operacao.tipo === 'cancelar_assinatura') {
        if (!preApprovalModule) throw new Error('Autorização indisponível.');
        if (!assinatura.preapprovalId) {
          // Recupera uma criação cuja resposta se perdeu. Não depende de uma
          // busca textual: confere a referência exata em todas as páginas.
          const encontrados = [];
          let offset = 0;
          let completa = false;
          for (let pagina = 0; pagina < 100; pagina++) {
            const dados = await preApprovalModule.search({ options: { offset, limit: 100 } });
            if (!Array.isArray(dados.results) || !Number.isSafeInteger(dados.paging?.total)) throw new Error('Busca de autorização incompleta.');
            encontrados.push(...dados.results.filter((item) => String(item.external_reference) === String(assinatura._id)));
            offset += dados.results.length;
            if (offset >= dados.paging.total) { completa = true; break; }
            if (!dados.results.length) break;
          }
          if (!completa || encontrados.length !== 1 || !encontrados[0].id) throw new Error('Autorização requer conciliação.');
          assinatura.preapprovalId = String(encontrados[0].id);
          await Assinatura.updateOne({ _id: assinatura._id }, { $set: { preapprovalId: assinatura.preapprovalId } }, { runValidators: true });
        }
        let acordo = await preApprovalModule.get({ id: assinatura.preapprovalId });
        if (String(acordo.id) !== assinatura.preapprovalId || String(acordo.external_reference) !== String(assinatura._id)) {
          throw new Error('Autorização divergente.');
        }
        if (!['cancelled', 'canceled'].includes(acordo.status)) {
          await preApprovalModule.update({ id: assinatura.preapprovalId, body: { status: 'cancelled' }, requestOptions });
          acordo = await preApprovalModule.get({ id: assinatura.preapprovalId });
        }
        if (String(acordo.id) !== assinatura.preapprovalId || String(acordo.external_reference) !== String(assinatura._id) ||
          !['cancelled', 'canceled'].includes(acordo.status)) throw new Error('Cancelamento ainda não confirmado.');
        await Assinatura.updateOne({ _id: assinatura._id }, { $set: {
          cancelamentoEstado: 'confirmado', cancelamentoConfirmadoEm: agora(), statusProvedor: acordo.status,
        } }, { runValidators: true });
        await concluir(operacao);
        return;
      }
      if (!paymentModule) throw new Error('Pagamentos indisponíveis.');
      const mensalidade = await MensalidadeClube.findOne({ assinaturaId: assinatura._id, pagamentoId: operacao.pagamentoId });
      if (!mensalidade) throw new Error('Mensalidade sem vínculo confirmado.');
      let pagamento = await paymentModule.get({ id: operacao.pagamentoId });
      const conferir = (valor) => {
        if (String(valor.id) !== operacao.pagamentoId || valor.currency_id !== 'BRL' ||
          Number(valor.transaction_amount) !== PLANO_CLUBE.valor / 100 || valor.payment_type_id !== 'credit_card') {
          throw new Error('Pagamento divergente.');
        }
        return financeiroDoProvedor(valor, PLANO_CLUBE.valor);
      };
      let financeiro = conferir(pagamento);
      if (operacao.tipo === 'cancelar_pagamento' && financeiro.statusFinanceiro === 'aguardando_pagamento') {
        try { await paymentModule.update({ id: operacao.pagamentoId, body: { status: 'cancelled' }, requestOptions }); }
        catch { /* Pode ter aprovado durante a solicitação: consulte novamente. */ }
        pagamento = await paymentModule.get({ id: operacao.pagamentoId });
        financeiro = conferir(pagamento);
        if (financeiro.statusFinanceiro === 'aguardando_pagamento') throw new Error('Pagamento ainda pendente.');
      }
      const aprovadoEm = pagamento.date_approved ? instante(pagamento.date_approved) : null;
      if (financeiro.statusFinanceiro === 'aprovado' && !aprovadoEm) throw new Error('Aprovação sem data efetiva.');
      const posterior = aprovadoEm && aprovadoEm > new Date(assinatura.canceladoEm);
      if (operacao.tipo === 'cancelar_pagamento') {
        if (posterior) await executarTransacao(async (session) => {
          await CaixaClube.updateMany({ assinaturaId: assinatura._id, pagamentoId: operacao.pagamentoId },
            { $set: { bloqueada: true, bloqueadaParaReembolso: true } }, { session });
          await agendar('reembolsar_pagamento', assinatura, operacao.pagamentoId, agora(), session);
        });
        await concluir(operacao);
        return;
      }
      if (!posterior) throw new Error('Aprovação anterior ao cancelamento não pode ser reembolsada automaticamente.');
      if (financeiro.statusFinanceiro === 'reembolsado') {
        await executarTransacao(async (session) => {
          await Assinatura.updateOne({ _id: assinatura._id }, { $inc: { versaoConciliacao: 1 } }, { session });
          const atual = await MensalidadeClube.findOne({ assinaturaId: assinatura._id, pagamentoId: operacao.pagamentoId }, null, { session });
          const atualizadoEm = instante(pagamento.date_last_updated);
          if (new Date(atual.provedorAtualizadoEm) <= atualizadoEm) {
            await MensalidadeClube.updateOne({ _id: atual._id }, { $set: { ...financeiro, provedorAtualizadoEm: atualizadoEm } }, { session, runValidators: true });
            await CaixaClube.updateMany({ assinaturaId: assinatura._id, pagamentoId: operacao.pagamentoId },
              { $set: { ...financeiro, bloqueada: true, reembolsoEstado: 'concluido' } }, { session, runValidators: true });
          }
        });
        await concluir(operacao);
        return;
      }
      if (!['aprovado', 'parcialmente_reembolsado'].includes(financeiro.statusFinanceiro) || !refundModule) {
        throw new Error('Pagamento ainda não disponível para reembolso.');
      }
      // Persiste o corpo antes do POST. Repetições mantêm chave E valor,
      // inclusive se a resposta do provedor se perder depois do reembolso.
      const valor = operacao.valorSolicitado ?? PLANO_CLUBE.valor - financeiro.valorReembolsado;
      const corpoSalvo = await OperacaoClube.updateOne({ _id: id, lockToken: operacao.lockToken },
        { $set: { valorSolicitado: valor } }, { runValidators: true });
      if (corpoSalvo.matchedCount !== 1) throw new Error('Execução assumida por outro processador.');
      const resposta = operacao.reembolsoId
        ? await refundModule.get({ payment_id: operacao.pagamentoId, refund_id: operacao.reembolsoId })
        : await refundModule.create({ payment_id: operacao.pagamentoId, body: { amount: valor / 100 }, requestOptions });
      if (!resposta?.id || String(resposta.payment_id) !== operacao.pagamentoId || Math.round(Number(resposta.amount) * 100) !== valor ||
        !['approved', 'in_process', 'pending'].includes(resposta.status)) throw new Error('Resposta de reembolso inconclusiva.');
      await OperacaoClube.updateOne({ _id: id, lockToken: operacao.lockToken }, { $set: {
        estado: 'aguardando_provedor', solicitadoEm: operacao.solicitadoEm || agora(),
        reembolsoId: String(resposta.id), lockAte: null, proximaExecucaoEm: new Date(agora().getTime() + 60000),
      } }, { runValidators: true });
      await CaixaClube.updateMany({ assinaturaId: assinatura._id, pagamentoId: operacao.pagamentoId },
        { $set: { bloqueada: true, reembolsoEstado: 'solicitado', reembolsoSolicitadoEm: operacao.solicitadoEm || agora() } }, { runValidators: true });
    } catch {
      logger.error('clube.operacao_pendente', { operacaoId: id, assinaturaId: operacao.assinaturaId ? String(operacao.assinaturaId) : undefined,
        pagamentoId: operacao.pagamentoId });
      await OperacaoClube.updateOne({ _id: id, lockToken: operacao.lockToken }, { $set: {
        estado: 'pendente', lockAte: null, proximaExecucaoEm: new Date(agora().getTime() + 60000),
      } }, { runValidators: true });
    }
  }

  async function processarPendentes({ assinaturaId, forcar = false } = {}) {
    const filtro = { estado: { $ne: 'concluida' }, ...(assinaturaId && { assinaturaId }),
      ...(!forcar && { $or: [{ proximaExecucaoEm: { $lte: agora() } }, { proximaExecucaoEm: { $exists: false } }] }) };
    const operacoes = await OperacaoClube.find(filtro).sort({ identificadoEm: 1 }).limit(50).lean();
    for (const operacao of operacoes) await processarUma(operacao._id, forcar);
  }

  async function solicitar(clienteId, id) {
    if (!/^[a-fA-F0-9]{24}$/.test(id)) throw new ErroAssinatura('Assinatura inválida.');
    await OperacaoClube.init();
    await executarTransacao(async (session) => {
      const assinatura = await Assinatura.findOneAndUpdate({ _id: id, clienteId },
        { $inc: { versaoConciliacao: 1 } }, { session, new: true });
      if (!assinatura) throw new ErroAssinatura('Assinatura não encontrada.', 404);
      const canceladoEm = assinatura.canceladoEm ? new Date(assinatura.canceladoEm) : agora();
      if (!assinatura.canceladoEm) await Assinatura.updateOne({ _id: id }, { $set: {
        canceladoEm, statusAdesao: 'cancelada', cancelamentoEstado: 'pendente',
      } }, { session, runValidators: true });
      await agendar('cancelar_assinatura', assinatura, null, agora(), session);
      await CaixaClube.updateMany({ assinaturaId: assinatura._id, aprovadoEm: { $gt: canceladoEm } },
        { $set: { bloqueada: true, bloqueadaParaReembolso: true } }, { session, runValidators: true });
      const mensalidades = await MensalidadeClube.find({ assinaturaId: assinatura._id }).session(session).lean();
      for (const mensalidade of mensalidades) {
        if (!mensalidade.pagamentoId) continue;
        if (mensalidade.statusFinanceiro === 'aguardando_pagamento') {
          await agendar('cancelar_pagamento', assinatura, mensalidade.pagamentoId, agora(), session);
        } else if (mensalidade.aprovadoEm && new Date(mensalidade.aprovadoEm) > canceladoEm) {
          await agendar('reembolsar_pagamento', assinatura, mensalidade.pagamentoId, agora(), session);
        }
      }
    });
    await processarPendentes({ assinaturaId: id, forcar: true });
    return assinaturaPublica(await Assinatura.findOne({ _id: id, clienteId }));
  }

  return { solicitar, agendarConciliacao, processarPendentes };
}

function registrarRotasCancelamento({ app, autenticar, autenticarAdmin, cancelamento, processarRecorrencia, Assinatura, OperacaoClube, cronSecret }) {
  app.post('/api/assinaturas/:id/cancelar', autenticar, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const assinatura = await cancelamento.solicitar(req.session.usuarioId, req.params.id);
      // A consulta posterior também encontra pendências ainda não notificadas.
      const local = await Assinatura.findOne({ _id: req.params.id, clienteId: req.session.usuarioId });
      if (local.preapprovalId) {
        try { await processarRecorrencia({ tipo: 'subscription_preapproval', id: local.preapprovalId }); }
        catch { return res.status(202).json({ assinatura, conciliacaoPendente: true }); }
      }
      return res.status(assinatura.cancelamentoEstado === 'confirmado' ? 200 : 202).json({ assinatura });
    } catch (erro) {
      res.status(erro instanceof ErroAssinatura ? erro.status : 503).json({ erro: erro instanceof ErroAssinatura
        ? erro.message : 'Não foi possível confirmar o cancelamento. Consulte a situação antes de repetir.' });
    }
  });
  app.get('/admin/clube/operacoes', autenticarAdmin, async (_req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try {
      const operacoes = await OperacaoClube.find({ estado: { $ne: 'concluida' } }).sort({ identificadoEm: 1 }).limit(100).lean();
      res.json({ operacoes: operacoes.map((operacao) => ({ ...operacao, prazoExcedido: Boolean(
        !operacao.solicitadoEm && operacao.limiteSolicitacaoEm && new Date(operacao.limiteSolicitacaoEm) < new Date()) })) });
    }
    catch { res.status(503).json({ erro: 'Não foi possível consultar as operações.' }); }
  });
  async function retomar() {
    // Reconsulta contratos cancelados: uma pendência pode aprovar sem webhook.
    const assinaturas = await Assinatura.find({ canceladoEm: { $ne: null } }).sort({ canceladoEm: 1 }).lean();
    let pendente = false;
    for (const assinatura of assinaturas) {
      if (assinatura.preapprovalId) {
        try { await processarRecorrencia({ tipo: 'subscription_preapproval', id: assinatura.preapprovalId }); }
        catch { pendente = true; }
      }
    }
    await cancelamento.processarPendentes();
    if (pendente) throw new Error('Conciliação pendente.');
  }
  app.post('/admin/clube/operacoes/processar', autenticarAdmin, async (_req, res) => {
    try { await retomar(); res.json({ sucesso: true }); }
    catch { res.status(503).json({ erro: 'Conciliação pendente. As operações continuam registradas.' }); }
  });
  app.get('/api/clube/operacoes/processar', async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    const recebido = req.headers.authorization;
    const esperado = cronSecret ? `Bearer ${cronSecret}` : '';
    if (!esperado) return res.status(503).json({ erro: 'Agendador indisponível.' });
    if (typeof recebido !== 'string' || Buffer.byteLength(recebido) !== Buffer.byteLength(esperado) ||
      !timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado))) return res.status(401).json({ erro: 'Acesso negado.' });
    try { await retomar(); res.json({ sucesso: true }); }
    catch { res.status(503).json({ erro: 'Conciliação pendente.' }); }
  });
}

module.exports = { criarCancelamentoClube, registrarRotasCancelamento, chaveOperacao };
