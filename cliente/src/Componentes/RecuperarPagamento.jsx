import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAcompanhamento } from '../hooks/useAcompanhamento';
import { situacaoFinanceira, formatarDinheiro, formatarData } from '../utils/pedido.mjs';
import { permiteNovaCompra, urlBoletoSegura, urlRecuperacao } from '../utils/recuperacaoPagamento.mjs';

const selecionar = (dados) => dados.tentativa && typeof dados.tentativa.situacao === 'string' ? dados.tentativa : null;

export default function RecuperarPagamento({ origem, onNovaCompra }) {
  const { resultado, tentarNovamente } = useAcompanhamento(urlRecuperacao(origem), selecionar, { repetir404: Boolean(origem.chave) });
  const [registro, setRegistro] = useState(null);
  const [copiado, setCopiado] = useState('');
  const registrando = useRef(false);
  const tentou = useRef(false);
  const tentativa = resultado?.dados;
  const dados = tentativa?.dados;
  const financeiro = situacaoFinanceira(tentativa?.statusFinanceiro);
  const resumo = tentativa?.resumo;
  const pendente = tentativa?.statusFinanceiro === 'aguardando_pagamento' && tentativa?.situacao === 'localizada' && tentativa?.statusLogistico !== 'cancelado';
  const boleto = pendente && tentativa.metodo === 'boleto' ? urlBoletoSegura(dados?.link_boleto_pdf) : null;

  const registrar = async () => {
    if (!origem.chave || registrando.current) return;
    registrando.current = true;
    setRegistro('Concluindo o registro do pedido...');
    try {
      const res = await fetch(`/api/pagamentos/tentativas/${encodeURIComponent(origem.chave)}/pedido`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      if (!res.ok) throw new Error('O pagamento continua registrado, mas o pedido ainda precisa ser concluído. Tente novamente ou fale com o atendimento.');
      setRegistro(null);
      tentarNovamente();
    } catch (erro) { setRegistro(erro.message); }
    finally { registrando.current = false; }
  };
  useEffect(() => {
    if (tentativa?.podeRegistrarPedido && origem.chave && !tentou.current) {
      tentou.current = true;
      const timer = setTimeout(() => registrar(), 0);
      return () => { clearTimeout(timer); tentou.current = false; };
    }
    // A ação é idempotente e só é repetida por intervenção do cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tentativa?.podeRegistrarPedido, origem.chave]);

  const copiar = async (codigo) => {
    try { await navigator.clipboard.writeText(codigo); setCopiado('Código copiado.'); }
    catch { setCopiado('Não foi possível copiar. Selecione o código abaixo.'); }
  };

  return <div className="w-full bg-[#FEF9F3] px-4 py-10 text-[#422518]">
    <section className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-[#C58752]/30 bg-white p-6">
      <h1 className="text-2xl font-bold">Acompanhamento do pagamento</h1>
      <p>Esta consulta recupera o pagamento existente. Atualizar a página não solicita outra cobrança.</p>
      {!resultado && <p role="status">Consultando sua conta...</p>}
      {resultado?.erro && <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        <p>{resultado.erro}</p>
        {resultado.desatualizado && <p>Os valores abaixo pertencem à última consulta concluída.</p>}
        {resultado.statusErro === 401 ? <Link className="underline" to={`/login?redirect=${encodeURIComponent(`/checkout?${origem.pedido ? 'pedido' : 'tentativa'}=${encodeURIComponent(origem.pedido || origem.chave)}`)}`}>Entrar na conta</Link>
          : <button type="button" className="underline" onClick={tentarNovamente}>Tentar novamente</button>}
      </div>}
      {tentativa && <>
        <div role="status" className="space-y-2">
          <h2 className="text-xl font-semibold">{tentativa.situacao === 'conciliacao_pendente' ? 'Pagamento em conciliação'
            : tentativa.situacao === 'nao_cobrada' ? 'Nenhuma cobrança foi solicitada nesta tentativa' : financeiro.titulo}</h2>
          <p>{tentativa.situacao === 'conciliacao_pendente'
            ? 'Ainda não foi possível confirmar o resultado no provedor. Aguarde ou fale com o atendimento antes de tentar outro pagamento.'
            : tentativa.situacao === 'nao_cobrada' ? 'A tentativa terminou antes da solicitação ao provedor. Você pode voltar ao checkout.' : financeiro.descricao}</p>
          {tentativa.valorReembolsado > 0 && <p>Reembolso registrado: {formatarDinheiro(tentativa.valorReembolsado)}.</p>}
          {tentativa.statusLogistico === 'cancelado' && tentativa.statusFinanceiro === 'aprovado' && <p>O cancelamento do pedido não confirma estorno do pagamento. Consulte o atendimento.</p>}
          {tentativa.statusLogistico === 'cancelado' && tentativa.statusFinanceiro === 'aguardando_pagamento' && <p>O pedido foi cancelado na operação. Não refaça o pagamento; consulte o atendimento sobre a cobrança pendente.</p>}
        </div>
        {resumo && <dl className="space-y-1 border-y border-[#C58752]/20 py-4">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatarDinheiro(resumo.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Desconto</dt><dd>{formatarDinheiro(resumo.desconto)}</dd></div>
          <div className="flex justify-between"><dt>Frete</dt><dd>{formatarDinheiro(resumo.frete)}</dd></div>
          <div className="flex justify-between font-bold"><dt>Total original</dt><dd>{formatarDinheiro(resumo.total)}</dd></div>
        </dl>}
        {pendente && tentativa.metodo === 'pix' && dados?.qr_code_pix && <div className="space-y-3">
          <p>Pague apenas uma vez e aguarde a confirmação. Se você já pagou, não repita o pagamento.</p>
          {dados.qr_code_base64 && /^[A-Za-z0-9+/=]+$/.test(dados.qr_code_base64) && dados.qr_code_base64.length < 1000000 &&
            <img alt="QR Code do Pix pendente" className="mx-auto w-56" src={`data:image/png;base64,${dados.qr_code_base64}`} />}
          <textarea readOnly aria-label="Código Pix" value={dados.qr_code_pix} className="w-full rounded border p-3" />
          <button type="button" className="underline" onClick={() => copiar(dados.qr_code_pix)}>Copiar Pix</button>
        </div>}
        {pendente && tentativa.metodo === 'boleto' && (boleto || dados?.codigo_de_barras) && <div className="space-y-3">
          {boleto && <a className="underline" href={boleto} target="_blank" rel="noopener noreferrer">Abrir boleto existente</a>}
          {dados.codigo_de_barras && <><p className="break-all select-all">{dados.codigo_de_barras}</p>
            <button type="button" className="underline" onClick={() => copiar(dados.codigo_de_barras)}>Copiar código do boleto</button></>}
          <p>A emissão do boleto não confirma o pagamento. Se já pagou, aguarde a atualização.</p>
        </div>}
        {copiado && <p role="status">{copiado}</p>}
        {tentativa.pedido ? <Link className="block underline" to={`/pedido-status/${encodeURIComponent(tentativa.pedido.numero)}`}>Acompanhar pedido {tentativa.pedido.numero}</Link>
          : <div className="space-y-2">
            {registro && <p role="status">{registro}</p>}
            {tentativa.podeRegistrarPedido ? <button type="button" className="underline" onClick={registrar}>Concluir registro do pedido sem cobrar novamente</button>
              : tentativa.situacao === 'localizada' && <p>O pagamento pode ser consultado, mas ainda não há pedido vinculado. Fale com o atendimento para concluir a conciliação.</p>}
          </div>}
        {permiteNovaCompra(tentativa) && <div className="space-y-1 border-t pt-4">
          <button type="button" className="underline" onClick={onNovaCompra}>Iniciar uma nova compra</button>
          {tentativa.pedido && <p className="text-sm">O pedido anterior continua disponível no seu perfil. Esta ação não cancela o pagamento anterior.</p>}
        </div>}
      </>}
      {resultado?.atualizadoEm && <p className="text-sm">Última consulta: {formatarData(resultado.atualizadoEm, true)} · Horário de Brasília</p>}
      <div className="flex gap-4"><button type="button" className="underline" onClick={tentarNovamente}>Atualizar consulta</button>
        <Link className="underline" to="/contato">Falar com o atendimento</Link></div>
    </section>
  </div>;
}
