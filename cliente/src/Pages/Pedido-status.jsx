import { usePedido } from '../hooks/usePedido';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ETAPAS, situacaoPedido, situacaoFinanceira, financeiroPedido, formatarDinheiro, formatarData, historicoPedido } from '../utils/pedido.mjs';

const card = 'rounded-2xl border border-[#C58752]/25 bg-white p-5 md:p-7';
const acao = 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#3E2417] px-5 py-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-4';

// Uma requisição por vez; pausa fora da aba e encerra em estados finais.
export default function PedidoStatus() {
  const { id = '' } = useParams();
  const { resultado, tentarNovamente } = usePedido(id);
  const [copia, setCopia] = useState(null);
  const pedido = resultado?.pedido;
  const situacao = situacaoPedido(pedido?.status);
  const historico = historicoPedido(pedido?.historicoStatus);
  const financeiro = situacaoFinanceira(financeiroPedido(pedido));

  const copiarRastreio = async () => {
    try {
      await navigator.clipboard.writeText(pedido.rastreio);
      setCopia({ id, codigo: pedido.rastreio, mensagem: 'Código copiado.' });
    } catch {
      setCopia({ id, codigo: pedido.rastreio, mensagem: 'Não foi possível copiar. Selecione o código e copie manualmente.' });
    }
  };

  return (
    <div className="w-full bg-[#FEF8F0] px-4 py-8 text-[#3E2417] md:px-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link to="/perfil" className="inline-flex min-h-11 items-center text-sm underline">← Meus pedidos</Link>

        {!id ? <p role="alert">Selecione um pedido no seu perfil.</p> : !resultado ? (
          <p role="status">Carregando pedido...</p>
        ) : null}

        {resultado?.erro && (
          <div role="alert" className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
            <p>{resultado.erro}</p>
            {pedido && <p className="text-sm">Os dados abaixo são da última consulta concluída.</p>}
            {resultado.statusErro === 401 ? (
              <Link className="inline-block underline" to={`/login?redirect=${encodeURIComponent(`/pedido-status/${id}`)}`}>Fazer login</Link>
            ) : <button type="button" onClick={tentarNovamente} className="min-h-11 underline">Tentar novamente</button>}
          </div>
        )}

        {pedido && <>
          <header className="space-y-1">
            <h1 className="text-xl font-bold md:text-2xl">Pedido #{pedido.numero}</h1>
            {formatarData(pedido.criadoEm) && <p className="text-sm text-[#80695B]">Realizado em {formatarData(pedido.criadoEm)}</p>}
          </header>

          <section className={card} aria-label="Situação financeira">
            <h2 className="text-lg font-bold">{financeiro.titulo}</h2>
            <p role="status" className="mt-2 text-sm">{financeiro.descricao}</p>
            {pedido.valorReembolsado > 0 && <p className="mt-2 font-semibold">Reembolso registrado: {formatarDinheiro(pedido.valorReembolsado)}</p>}
            {pedido.statusLogistico === 'cancelado' && financeiroPedido(pedido) === 'aprovado' && <p className="mt-2 text-sm">O pedido foi cancelado na operação. O pagamento permanece aprovado até a confirmação de um estorno pelo provedor.</p>}
          </section>

          <section aria-labelledby="status-pedido" className="space-y-5 rounded-2xl bg-[#F7C6E5]/60 p-6 md:p-8">
            <div className="space-y-2" role="status">
              <h2 id="status-pedido" className="text-2xl font-bold md:text-3xl">{situacao.titulo}</h2>
              <p>{situacao.descricao}</p>
            </div>
            {financeiroPedido(pedido) === 'aguardando_pagamento' && pedido.statusLogistico !== 'cancelado' && (
              <div className="space-y-4">
                <p className="text-sm">Se você já pagou, aguarde a confirmação. Para evitar cobranças duplicadas, confira o pagamento antes de tentar novamente.</p>
                <Link to="/checkout" state={{ pedido }} className={acao}>Finalizar pagamento</Link>
              </div>
            )}
            {pedido.status === 'cancelado' && <Link to="/contato" className={acao}>Pedir ajuda</Link>}
            {pedido.status === 'enviado' && (pedido.rastreio ? (
              <div className="space-y-2">
                <p className="text-sm font-semibold">Código de rastreamento</p>
                <div className="flex flex-wrap items-center gap-3">
                  <code className="break-all rounded bg-white/70 px-3 py-2 text-lg select-all">{pedido.rastreio}</code>
                  <button type="button" onClick={copiarRastreio} className={acao}>Copiar código</button>
                </div>
                <p role="status" className="text-sm">{copia?.id === id && copia.codigo === pedido.rastreio ? copia.mensagem : ''}</p>
              </div>
            ) : <p className="text-sm">O código de rastreamento ainda não foi informado.</p>)}
          </section>

          {situacao.etapa > 0 && (
            <ol aria-label="Etapas do pedido" className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {ETAPAS.map((etapa, index) => {
                const atual = situacao.etapa === index + 1;
                const concluida = situacao.etapa > index + 1;
                return <li key={etapa} aria-current={atual ? 'step' : undefined} className={`rounded-lg border p-3 text-sm ${atual ? 'border-[#3E2417] bg-[#FDE89C] font-bold' : 'border-[#C58752]/25'}`}>
                  <span className="mb-1 block text-xs">{concluida ? 'Concluída' : atual ? 'Etapa atual' : 'Próxima etapa'}</span>
                  {etapa}
                </li>;
              })}
            </ol>
          )}

          <section aria-labelledby="historico-pedido" className={card}>
            <h2 id="historico-pedido" className="mb-4 text-lg font-bold">Histórico do pedido</h2>
            {historico.length ? <ol className="divide-y divide-[#C58752]/20">
              {historico.map((item, index) => <li key={`${item.em}-${index}`} className="py-3 first:pt-0">
                <p className="font-semibold">{situacaoPedido(item.status).titulo}</p>
                <time dateTime={item.em} className="text-sm text-[#80695B]">{formatarData(item.em, true)} · Horário de Brasília</time>
              </li>)}
            </ol> : <p className="text-sm text-[#80695B]">Nenhuma atualização registrada.</p>}
          </section>

          <section className={card} aria-label="Histórico financeiro">
            <h2 className="mb-3 text-lg font-bold">Histórico financeiro</h2>
            {historicoPedido(pedido.historicoFinanceiro).map((item, index) => <p key={`${item.em}-${index}`} className="py-2 text-sm">
              {situacaoFinanceira(item.status).titulo} · {formatarData(item.em, true)}
              {item.valorReembolsado > 0 && ` · Reembolso: ${formatarDinheiro(item.valorReembolsado)}`}
            </p>)}
          </section>

          <div className="grid items-start gap-5 md:grid-cols-2">
            <details className={card}>
              <summary className="cursor-pointer text-lg font-bold">Itens da compra ({pedido.itens.reduce((soma, item) => soma + item.quantidade, 0)})</summary>
              <ul className="mt-4 divide-y divide-[#C58752]/20">
                {pedido.itens.map((item, index) => <li key={`${item.slug}-${index}`} className="space-y-1 py-3">
                  <p className="font-semibold">{item.nome}</p>
                  <p className="text-sm">{item.quantidade} × {formatarDinheiro(item.precoUnit)} <span className="float-right font-semibold">{formatarDinheiro(item.quantidade * item.precoUnit)}</span></p>
                </li>)}
              </ul>
            </details>

            <section aria-labelledby="resumo-pedido" className={card}>
              <h2 id="resumo-pedido" className="mb-4 text-lg font-bold">Resumo de valores</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3"><dt>Subtotal</dt><dd>{formatarDinheiro(pedido.subtotal)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Frete</dt><dd>{formatarDinheiro(pedido.frete)}</dd></div>
                {pedido.desconto > 0 && <div className="flex justify-between gap-3"><dt>Desconto</dt><dd>− {formatarDinheiro(pedido.desconto)}</dd></div>}
                <div className="flex justify-between gap-3 border-t border-[#C58752]/20 pt-3 text-base font-bold"><dt>Total do pedido</dt><dd>{formatarDinheiro(pedido.total)}</dd></div>
                <div className="flex justify-between gap-3"><dt>Forma de pagamento</dt><dd>{({ pix: 'Pix', boleto: 'Boleto', cartao: 'Cartão de crédito' })[pedido.pagamento] || 'Não informada'}</dd></div>
              </dl>
            </section>

            <details className={card}>
              <summary className="cursor-pointer text-lg font-bold">Endereço de entrega</summary>
              <div className="mt-4 space-y-1 text-sm">
                <p className="font-semibold">{pedido.cliente?.nome}</p>
                <p>{pedido.entrega?.endereco || 'Endereço não informado.'}</p>
                {pedido.entrega?.cep && <p>CEP {pedido.entrega.cep}</p>}
              </div>
            </details>
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#C58752]/25 pt-5 text-sm">
            <p>Precisa de ajuda com o pedido #{pedido.numero}?</p>
            <Link to="/contato" className="inline-flex min-h-11 items-center font-semibold underline">Fale com a gente</Link>
          </footer>
        </>}
      </div>
    </div>
  );
}
