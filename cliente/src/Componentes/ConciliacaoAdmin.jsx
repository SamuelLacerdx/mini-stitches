import { useState } from 'react';
import { useAcompanhamento } from '../hooks/useAcompanhamento';
import { situacaoFinanceira } from '../utils/pedido.mjs';

const ORIGENS = {
  tentativas: { titulo: 'Tentativas avulsas', campos: { _id: 'Tentativa', pagamentoId: 'Pagamento', clienteId: 'Cliente' } },
  pedidos: { titulo: 'Pedidos (inclui legados)', campos: { numero: 'Número do pedido', pagamentoId: 'Pagamento', clienteId: 'Cliente' } },
  mensalidades: { titulo: 'Mensalidades do Clube', campos: { _id: 'Mensalidade', pagamentoId: 'Pagamento', assinaturaId: 'Assinatura', clienteId: 'Cliente' } },
  assinaturas: { titulo: 'Assinaturas', campos: { _id: 'Assinatura', preapprovalId: 'Autorização', clienteId: 'Cliente' } },
};
const selecionar = (dados) => Array.isArray(dados.itens) ? dados : null;
const moeda = (valor) => valor == null ? 'Indisponível' : (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const data = (valor) => valor && Number.isFinite(new Date(valor).getTime())
  ? new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Indisponível';
const campoClasse = 'rounded-lg border border-stone-300 bg-white p-2';
const FINANCEIROS = ['aguardando_pagamento', 'aprovado', 'recusado', 'cancelado', 'reembolsado', 'parcialmente_reembolsado', 'em_contestacao', 'contestado', 'desconhecido'];

export default function ConciliacaoAdmin() {
  const [filtros, setFiltros] = useState({ origem: 'tentativas', campo: '_id', referencia: '', competencia: '' });
  const [consulta, setConsulta] = useState({ origem: 'tentativas', pagina: 1 });
  const url = `/admin/conciliacao?${new URLSearchParams(consulta)}`;
  const { resultado, tentarNovamente } = useAcompanhamento(url, selecionar);
  const dados = resultado?.dados;
  function pesquisar(evento) {
    evento.preventDefault();
    setConsulta({ ...filtros, pagina: 1 });
    tentarNovamente();
  }
  return <section className="space-y-5 text-[#422518]">
    <h2 className="text-xl font-bold">Conciliação de pagamentos</h2>
    <p className="text-sm">Registros locais atualizados pelas notificações verificadas do provedor. Aprovação financeira, cancelamento e entrega são situações independentes. Horários de Brasília.</p>
    <form onSubmit={pesquisar} className="flex flex-wrap items-end gap-3">
      <label className="grid gap-1 text-sm">Origem<select className={campoClasse} value={filtros.origem} onChange={(e) => {
        const origem = e.target.value;
        setFiltros({ origem, campo: Object.keys(ORIGENS[origem].campos)[0], referencia: '', competencia: '', financeiro: '' });
      }}>{Object.entries(ORIGENS).map(([chave, valor]) => <option key={chave} value={chave}>{valor.titulo}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Buscar por<select className={campoClasse} value={filtros.campo} onChange={(e) => setFiltros({ ...filtros, campo: e.target.value })}>
        {Object.entries(ORIGENS[filtros.origem].campos).map(([chave, valor]) => <option key={chave} value={chave}>{valor}</option>)}
      </select></label>
      <label className="grid gap-1 text-sm">Identificador exato<input className={campoClasse} maxLength={128} value={filtros.referencia} onChange={(e) => setFiltros({ ...filtros, referencia: e.target.value.trim() })} /></label>
      {filtros.origem !== 'assinaturas' && <label className="grid gap-1 text-sm">Situação financeira<select className={campoClasse} value={filtros.financeiro || ''} onChange={(e) => setFiltros({ ...filtros, financeiro: e.target.value })}>
        <option value="">Todas</option>{FINANCEIROS.map((status) => <option key={status} value={status}>{situacaoFinanceira(status).titulo}</option>)}
      </select></label>}
      {filtros.origem === 'mensalidades' && <label className="grid gap-1 text-sm">Mês da caixa<input className={campoClasse} type="month" value={filtros.competencia} onChange={(e) => setFiltros({ ...filtros, competencia: e.target.value })} /></label>}
      <button className="rounded-lg bg-[#422518] p-2 text-white" type="submit">Consultar</button>
    </form>
    <div className="flex flex-wrap gap-3 text-sm">
      <button type="button" className="underline" onClick={tentarNovamente}>Atualizar agora</button>
      {dados && <span>Consulta: {data(dados.consultadoEm)} · {ORIGENS[dados.origem].titulo} · Página {dados.pagina}</span>}
    </div>
    {!resultado && <p role="status">Consultando conciliação...</p>}
    {resultado?.erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{resultado.erro} {dados && 'Os dados abaixo são da última consulta concluída.'}</p>}
    {dados?.itens.length === 0 && <p>Nenhum registro para esta consulta.</p>}
    {dados?.itens.map((item) => <article key={item.id} className="space-y-3 rounded-xl border border-stone-200 bg-[#FEF8F0] p-4 text-sm">
      <h3 className="break-all font-bold">{item.pedidoNumero || item.id}</h3>
      <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries({ Cliente: item.clienteId, Tentativa: item.tentativaId, 'Estado da tentativa': item.estadoTentativa,
          Estoque: item.estoqueEstado, Pedido: item.pedidoNumero, Pagamento: item.pagamentoId,
          Assinatura: item.assinaturaId, Autorização: item.preapprovalId, Adesão: item.adesao,
          Mensalidade: item.mensalidadeId, 'Mês da caixa': item.competencia, 'Preparação / entrega': item.statusLogistico,
        }).filter(([, valor]) => valor).map(([rotulo, valor]) => <div key={rotulo} className="break-all"><dt className="font-semibold">{rotulo}</dt><dd>{valor}</dd></div>)}
      </dl>
      {item.origem !== 'assinaturas' && <div className="space-y-1">
        <p className="font-semibold">{situacaoFinanceira(item.statusFinanceiro).titulo}</p>
        <p>Total original: {moeda(item.total)} · Reembolso confirmado: {moeda(item.valorReembolsado)} · Total menos reembolso: {moeda(item.saldo)}</p>
        <p>Aprovação efetiva: {data(item.aprovadoEm)}</p>
        <p>Recebimento da notificação: {data(item.notificacaoRecebidaEm)}</p>
        <p>Atualização no provedor: {data(item.provedorAtualizadoEm)}</p>
        {item.vencimentoContratual && <p>Vencimento contratado: {item.vencimentoContratual} · Provedor: {data(item.vencimentoProvedor)}</p>}
      </div>}
      {item.canceladoEm && <p>Cancelamento solicitado: {data(item.canceladoEm)} · {item.cancelamentoEstado || 'Confirmação indisponível'}</p>}
      {item.origem === 'assinaturas' && <button type="button" className="underline" onClick={() => {
        const proxima = { origem: 'mensalidades', campo: 'assinaturaId', referencia: item.assinaturaId, competencia: '' };
        setFiltros(proxima); setConsulta({ ...proxima, pagina: 1 });
      }}>Ver mensalidades e caixas desta assinatura</button>}
      {item.caixa && <div className="space-y-1">
        <p>Caixa: {item.caixa.id} · Competência: {item.caixa.competencia} · Lote: {item.caixa.lote}</p>
        <p>Postagem prevista: {item.caixa.postagemPrevista || 'Indisponível'} · Rastreio: {item.caixa.rastreio || 'Não informado'}</p>
        <p className="font-semibold">{item.expedicaoPermitida ? 'Paga e pendente de postagem' : 'Sem liberação para nova postagem'}</p>
        {item.caixa.bloqueadaParaReembolso && <p>Caixa bloqueada para reembolso.</p>}
      </div>}
      {item.operacoes.map((op) => <div key={op.id} className="rounded-lg border border-stone-200 p-2">
        <p>{op.tipo} · {op.estado} · Valor solicitado: {moeda(op.valorSolicitado)}</p>
        <p>Identificação: {data(op.identificadoEm)} · Limite de solicitação: {data(op.limiteSolicitacaoEm)}</p>
        <p>Solicitação: {data(op.solicitadoEm)} · Conclusão: {data(op.finalizadoEm)}</p>
        {op.solicitacaoAtrasada && <p className="font-bold text-red-800">Prazo de solicitação de reembolso ultrapassado.</p>}
      </div>)}
      {item.problemas.length > 0 && <ul className="list-inside list-disc rounded-lg bg-amber-50 p-3">{item.problemas.map((problema) => <li key={problema}>{problema}</li>)}</ul>}
    </article>)}
    {dados && <nav aria-label="Páginas de conciliação" className="flex gap-4">
      <button type="button" disabled={dados.pagina === 1} className="underline disabled:opacity-40" onClick={() => setConsulta({ ...consulta, pagina: dados.pagina - 1 })}>Anterior</button>
      <button type="button" disabled={!dados.temProxima} className="underline disabled:opacity-40" onClick={() => setConsulta({ ...consulta, pagina: dados.pagina + 1 })}>Próxima</button>
    </nav>}
  </section>;
}
