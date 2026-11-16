const { FINANCEIROS, estadosPedido } = require('./estadosPedido');

const CAMPOS = {
  tentativas: '_id clienteId pagamentoId total statusFinanceiro valorReembolsado aprovadoEm ultimaNotificacaoEm provedorAtualizadoEm estado estoqueEstado criadoEm',
  pedidos: '_id numero clienteId tentativaId pagamentoId total status statusFinanceiro statusLogistico valorReembolsado pagamentoAprovadoEm pagamentoAtualizadoEm criadoEm rastreio',
  mensalidades: '_id assinaturaId clienteId preapprovalId pagamentoId valor statusFinanceiro valorReembolsado aprovadoEm recebidoEm provedorAtualizadoEm competencia cobrancaDivergente vencimentoContratual vencimentoProvedor',
  assinaturas: '_id clienteId preapprovalId statusAdesao statusProvedor canceladoEm cancelamentoEstado solicitadoEm assinadoEm',
  caixas: '_id assinaturaId clienteId mensalidadeId pagamentoId competencia lote aprovadoEm statusFinanceiro valorReembolsado bloqueada bloqueadaParaReembolso statusPreparacao postagemPrevista rastreio',
  operacoes: '_id assinaturaId pagamentoId tipo estado identificadoEm limiteSolicitacaoEm solicitadoEm finalizadoEm valorSolicitado',
};
const id = (valor) => valor == null ? '' : String(valor);
const iguais = (a, b) => Boolean(id(a) && id(a) === id(b));
const lista = (valores) => [...new Set(valores.map(id).filter(Boolean))];
const valido = (valor) => Number.isSafeInteger(valor) && valor >= 0;
const financeiro = (valor) => FINANCEIROS.includes(valor) ? valor : 'desconhecido';

class ErroConsulta extends Error {}
function parametros(query) {
  const origem = query.origem || 'tentativas';
  if (!['tentativas', 'pedidos', 'mensalidades', 'assinaturas'].includes(origem)) throw new ErroConsulta();
  const pagina = query.pagina == null ? 1 : Number(query.pagina);
  if (!Number.isSafeInteger(pagina) || pagina < 1 || pagina > 10000) throw new ErroConsulta();
  const filtro = {};
  if (query.financeiro) {
    if (origem === 'assinaturas' || !FINANCEIROS.includes(query.financeiro)) throw new ErroConsulta();
    if (origem === 'pedidos') {
      const legados = query.financeiro === 'aprovado' ? ['pago', 'em_separacao', 'enviado', 'entregue']
        : query.financeiro === 'aguardando_pagamento' ? ['aguardando_pagamento']
          : query.financeiro === 'desconhecido' ? ['cancelado'] : [];
      filtro.$or = [{ statusFinanceiro: query.financeiro },
        ...(legados.length ? [{ statusFinanceiro: { $exists: false }, status: { $in: legados } },
          { statusFinanceiro: null, status: { $in: legados } }] : [])];
    } else filtro.statusFinanceiro = query.financeiro;
  }
  if (query.competencia) {
    if (origem !== 'mensalidades' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(query.competencia)) throw new ErroConsulta();
    filtro.competencia = query.competencia;
  }
  if (query.referencia) {
    const campos = { tentativas: ['_id', 'pagamentoId', 'clienteId'], pedidos: ['numero', 'pagamentoId', 'clienteId'],
      mensalidades: ['_id', 'pagamentoId', 'assinaturaId', 'clienteId'], assinaturas: ['_id', 'preapprovalId', 'clienteId'] };
    const campo = query.campo || campos[origem][0];
    if (!campos[origem].includes(campo) || typeof query.referencia !== 'string' ||
      !/^[\w-]{1,128}$/.test(query.referencia) ||
      ((campo === 'clienteId' || campo === 'assinaturaId' || (campo === '_id' && origem !== 'mensalidades')) &&
        !/^[a-f\d]{24}$/i.test(query.referencia))) throw new ErroConsulta();
    filtro[campo] = query.referencia;
  }
  return { origem, pagina, filtro };
}

function criarConsultaConciliacao(modelos, agora = () => new Date()) {
  async function buscar(nome, filtro) {
    return modelos[nome].find(filtro).select(CAMPOS[nome]).lean();
  }
  async function relacionados(nome, alternativas) {
    const validas = alternativas.filter((f) => Object.values(f)[0].$in.length);
    return validas.length ? buscar(nome, { $or: validas }) : [];
  }
  return async function consultar(query = {}) {
    const { origem, pagina, filtro } = parametros(query);
    const limite = 25;
    const registros = await modelos[origem].find(filtro).select(CAMPOS[origem])
      .sort({ _id: -1 }).skip((pagina - 1) * limite).limit(limite + 1).lean();
    const temProxima = registros.length > limite;
    const base = registros.slice(0, limite);
    const pagamentos = lista(base.map((r) => r.pagamentoId));
    const ids = lista(base.map((r) => r._id));
    let tentativas = origem === 'tentativas' ? base : [];
    let pedidos = origem === 'pedidos' ? base : [];
    let assinaturas = origem === 'assinaturas' ? base : [];
    let caixas = [], operacoes = [];
    if (['tentativas', 'pedidos'].includes(origem)) {
      if (origem === 'tentativas') pedidos = await relacionados('pedidos', [
        { tentativaId: { $in: ids } }, { pagamentoId: { $in: pagamentos } }]);
      else tentativas = await relacionados('tentativas', [
        { _id: { $in: lista(base.map((r) => r.tentativaId)) } }, { pagamentoId: { $in: pagamentos } }]);
    } else {
      const assinaturasIds = origem === 'assinaturas' ? ids : lista(base.map((r) => r.assinaturaId));
      if (origem === 'mensalidades') assinaturas = await relacionados('assinaturas', [{ _id: { $in: assinaturasIds } }]);
      // O histórico completo é paginado na origem mensalidades; não carregue todas as renovações de cada assinatura.
      [caixas, operacoes] = origem === 'mensalidades' ? await Promise.all([
        relacionados('caixas', [{ mensalidadeId: { $in: ids } }, { pagamentoId: { $in: pagamentos } }]),
        relacionados('operacoes', [{ pagamentoId: { $in: pagamentos } }]),
      ]) : [[], []];
    }

    const itens = base.map((registro) => {
      const problemas = [];
      const alertar = (condicao, texto) => { if (condicao) problemas.push(texto); };
      let tentativa, pedido, mensalidade, assinatura, caixa;
      if (['tentativas', 'pedidos'].includes(origem)) {
        const vinculados = origem === 'tentativas' ? pedidos.filter((p) => iguais(p.tentativaId, registro._id) || iguais(p.pagamentoId, registro.pagamentoId))
          : tentativas.filter((t) => iguais(t._id, registro.tentativaId) || iguais(t.pagamentoId, registro.pagamentoId));
        alertar(vinculados.length > 1, 'Mais de um registro vinculado à mesma cobrança.');
        pedido = origem === 'pedidos' ? registro : pedidos.find((p) => iguais(p.tentativaId, registro._id) || iguais(p.pagamentoId, registro.pagamentoId));
        tentativa = origem === 'tentativas' ? registro : tentativas.find((t) => iguais(t._id, registro.tentativaId) || iguais(t.pagamentoId, registro.pagamentoId));
        alertar(!tentativa, 'Pedido sem tentativa vinculada (legado ou vínculo ausente).');
        alertar(tentativa?.estado === 'resultado_desconhecido' || tentativa?.estado === 'registrada', 'Resultado da cobrança ainda não confirmado.');
        alertar(!pedido && tentativa?.estado !== 'nao_cobrada', 'Tentativa sem pedido registrado.');
        if (tentativa && pedido) {
          alertar(!iguais(tentativa.clienteId, pedido.clienteId), 'Cliente diverge entre tentativa e pedido.');
          alertar(!iguais(tentativa.pagamentoId, pedido.pagamentoId), 'Pagamento diverge entre tentativa e pedido.');
          alertar(tentativa.total !== pedido.total, 'Total diverge entre tentativa e pedido.');
          alertar(financeiro(tentativa.statusFinanceiro) !== estadosPedido(pedido).statusFinanceiro ||
            (tentativa.valorReembolsado || 0) !== (pedido.valorReembolsado || 0), 'Situação financeira diverge entre tentativa e pedido.');
        }
      } else if (origem === 'mensalidades') {
        mensalidade = registro;
        assinatura = assinaturas.find((a) => iguais(a._id, registro.assinaturaId));
        caixa = caixas.find((c) => iguais(c.mensalidadeId, registro._id) || iguais(c.pagamentoId, registro.pagamentoId));
        alertar(caixas.filter((c) => iguais(c.mensalidadeId, registro._id) || iguais(c.pagamentoId, registro.pagamentoId)).length > 1,
          'Mais de uma caixa vinculada à mesma cobrança.');
        alertar(!assinatura, 'Assinatura vinculada não encontrada.');
        alertar(assinatura && (!iguais(assinatura.clienteId, registro.clienteId) || !iguais(assinatura.preapprovalId, registro.preapprovalId)), 'Cliente ou autorização diverge da assinatura.');
        alertar(registro.cobrancaDivergente, 'Vencimento do provedor diverge do calendário contratado.');
        alertar(registro.statusFinanceiro === 'aprovado' && !caixa, 'Mensalidade aprovada sem caixa vinculada.');
        alertar(registro.valor !== 9490, 'Mensalidade diverge do plano SUB-02.');
        if (caixa) {
          alertar(!iguais(caixa.assinaturaId, registro.assinaturaId) || !iguais(caixa.clienteId, registro.clienteId) ||
            !iguais(caixa.mensalidadeId, registro._id) || !iguais(caixa.pagamentoId, registro.pagamentoId) ||
            caixa.competencia !== registro.competencia, 'Vínculo ou competência da caixa diverge da mensalidade.');
          alertar(caixa.statusFinanceiro !== registro.statusFinanceiro || (caixa.valorReembolsado || 0) !== (registro.valorReembolsado || 0), 'Situação financeira da caixa diverge da mensalidade.');
          alertar(registro.statusFinanceiro !== 'aprovado' && !caixa.bloqueada, 'Caixa sem bloqueio apesar da pendência financeira.');
        }
      } else assinatura = registro;
      const fonte = tentativa || mensalidade || pedido;
      const status = fonte ? (fonte === pedido ? estadosPedido(pedido).statusFinanceiro : financeiro(fonte.statusFinanceiro)) : 'desconhecido';
      const total = fonte?.total ?? fonte?.valor;
      const reembolsado = fonte?.valorReembolsado || 0;
      alertar(status === 'reembolsado' && reembolsado !== total, 'Reembolso integral sem valor integral confirmado.');
      alertar(fonte && (!valido(total) || !valido(reembolsado) || reembolsado > total), 'Valores financeiros inválidos.');
      alertar(fonte && status === 'desconhecido' && tentativa?.estado !== 'nao_cobrada', 'Situação financeira não confirmada.');
      const aprovadoEm = fonte?.aprovadoEm || fonte?.pagamentoAprovadoEm;
      alertar(['aprovado', 'parcialmente_reembolsado', 'reembolsado'].includes(status) && !aprovadoEm, 'Data efetiva de aprovação indisponível.');
      const aposCancelamento = Boolean(mensalidade && assinatura?.canceladoEm && aprovadoEm &&
        new Date(aprovadoEm) > new Date(assinatura.canceladoEm));
      const ops = operacoes.filter((o) => iguais(o.assinaturaId, mensalidade?.assinaturaId) && iguais(o.pagamentoId, mensalidade?.pagamentoId));
      alertar(aposCancelamento && status !== 'reembolsado', 'Aprovação posterior ao cancelamento: bloquear caixa e acompanhar reembolso integral.');
      alertar(aposCancelamento && status !== 'reembolsado' && !ops.some((o) => o.tipo === 'reembolsar_pagamento'), 'Operação de reembolso integral ausente.');
      const expedicaoPermitida = Boolean(caixa && status === 'aprovado' && caixa.statusFinanceiro === 'aprovado' &&
        !aposCancelamento && !caixa.bloqueada && !caixa.bloqueadaParaReembolso &&
        ['aguardando', 'preparando'].includes(caixa.statusPreparacao) && !problemas.length);
      return {
        id: id(registro._id), origem, clienteId: id(registro.clienteId),
        tentativaId: id(tentativa?._id), estadoTentativa: tentativa?.estado, estoqueEstado: tentativa?.estoqueEstado,
        pedidoNumero: pedido?.numero, pagamentoId: fonte?.pagamentoId, assinaturaId: id(assinatura?._id || mensalidade?.assinaturaId),
        preapprovalId: assinatura?.preapprovalId || mensalidade?.preapprovalId,
        adesao: assinatura?.statusAdesao, canceladoEm: assinatura?.canceladoEm, cancelamentoEstado: assinatura?.cancelamentoEstado,
        mensalidadeId: id(mensalidade?._id), competencia: mensalidade?.competencia,
        vencimentoContratual: mensalidade?.vencimentoContratual, vencimentoProvedor: mensalidade?.vencimentoProvedor,
        statusFinanceiro: status, total: valido(total) ? total : null,
        valorReembolsado: valido(reembolsado) ? reembolsado : null,
        saldo: valido(total) && valido(reembolsado) && reembolsado <= total ? total - reembolsado : null,
        aprovadoEm, notificacaoRecebidaEm: tentativa?.ultimaNotificacaoEm || mensalidade?.recebidoEm,
        provedorAtualizadoEm: tentativa?.provedorAtualizadoEm || mensalidade?.provedorAtualizadoEm || pedido?.pagamentoAtualizadoEm,
        statusLogistico: pedido ? estadosPedido(pedido).statusLogistico : caixa?.statusPreparacao,
        caixa: caixa ? { id: id(caixa._id), competencia: caixa.competencia, lote: caixa.lote,
          postagemPrevista: caixa.postagemPrevista, bloqueada: caixa.bloqueada, bloqueadaParaReembolso: caixa.bloqueadaParaReembolso,
          rastreio: caixa.rastreio } : null,
        expedicaoPermitida,
        operacoes: ops.map((o) => ({ id: id(o._id), tipo: o.tipo, estado: o.estado,
          identificadoEm: o.identificadoEm, limiteSolicitacaoEm: o.limiteSolicitacaoEm, solicitadoEm: o.solicitadoEm,
          finalizadoEm: o.finalizadoEm, valorSolicitado: o.valorSolicitado,
          solicitacaoAtrasada: o.tipo === 'reembolsar_pagamento' && !o.solicitadoEm && o.estado !== 'concluida' &&
            Boolean(o.limiteSolicitacaoEm && new Date(o.limiteSolicitacaoEm) < agora()) })),
        problemas,
      };
    });
    return { origem, pagina, limite, temProxima, consultadoEm: agora(), itens };
  };
}

function registrarConciliacaoAdmin({ app, autenticarAdmin, consultar }) {
  app.get('/admin/conciliacao', autenticarAdmin, async (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    try { res.json(await consultar(req.query)); }
    catch (erro) {
      res.status(erro instanceof ErroConsulta ? 400 : 503).json({ erro: erro instanceof ErroConsulta
        ? 'Filtros de conciliação inválidos.' : 'Não foi possível consultar a conciliação.' });
    }
  });
}
module.exports = { criarConsultaConciliacao, registrarConciliacaoAdmin };
