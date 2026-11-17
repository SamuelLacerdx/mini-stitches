import { useAcompanhamento } from '../hooks/useAcompanhamento';
import { situacaoFinanceira, formatarData, formatarDinheiro } from '../utils/pedido.mjs';

const selecionar = (dados) => Array.isArray(dados.caixas) ? dados.caixas : null;

export default function CaixasClube() {
  const { resultado, tentarNovamente } = useAcompanhamento('/api/clube/caixas', selecionar);
  const caixas = resultado?.dados || [];
  const erro = resultado?.erro;
  return <section className="space-y-3 rounded-2xl border border-[#C58752]/40 bg-white p-6">
    <div className="flex items-center justify-between gap-4">
      <h2 className="text-xl font-bold">Suas caixas do Clube</h2>
      <button type="button" onClick={tentarNovamente} className="underline">Atualizar</button>
    </div>
    {erro && <p role="alert">{erro}</p>}
    {resultado?.desatualizado && <p>As caixas abaixo correspondem à última consulta concluída.</p>}
    {!resultado && <p role="status">Consultando suas caixas...</p>}
    {resultado && !erro && !caixas.length && <p>Nenhuma caixa com mensalidade aprovada até o momento.</p>}
    {caixas.map((caixa) => <article key={caixa.id} className="space-y-1 rounded-lg bg-[#FEF9F3] p-4">
      <h3 className="font-bold">Caixa de {caixa.competencia.split('-').reverse().join('/')}</h3>
      <p>{situacaoFinanceira(caixa.statusFinanceiro).titulo}</p>
      {caixa.valorReembolsado > 0 && <p>Reembolso registrado: {formatarDinheiro(caixa.valorReembolsado)}</p>}
      <p>{caixa.bloqueadaParaReembolso ? caixa.reembolsoEstado === 'concluido' ? 'Reembolso integral confirmado pelo provedor. Esta caixa não será enviada.'
        : caixa.reembolsoEstado === 'solicitado' ? 'Reembolso integral solicitado. Esta caixa permanece bloqueada. O crédito depende do meio de pagamento.'
        : 'Pagamento aprovado após o cancelamento. Caixa bloqueada para reembolso integral.'
        : caixa.bloqueada ? 'Expedição bloqueada por pendência financeira. Consulte o atendimento.'
        : `Preparação: ${caixa.statusPreparacao}.`}</p>
      <p>{caixa.postagemPrevista ? `Previsão de postagem: ${caixa.postagemPrevista.split('-').reverse().join('/')}.`
        : 'Previsão de postagem aguardando confirmação da operação da transportadora.'}</p>
      {caixa.rastreio && <p>Rastreamento: {caixa.rastreio}</p>}
      {caixa.ocorrencias.map((item, indice) => <p key={indice}>{item.motivo} — nova previsão: {item.novaPrevisao.split('-').reverse().join('/')}.</p>)}
    </article>)}
    <p className="text-sm">As datas indicam a postagem. O recebimento depende do transporte para seu CEP.
      Caixas pagas antes do cancelamento continuam devidas.</p>
    {resultado?.atualizadoEm && <p className="text-sm">Última consulta: {formatarData(resultado.atualizadoEm, true)} · Horário de Brasília</p>}
  </section>;
}
