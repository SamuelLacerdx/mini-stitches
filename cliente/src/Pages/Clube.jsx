import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import CaixasClube from '../Componentes/CaixasClube';

const moeda = (valor) => (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const campo = 'mt-1 w-full rounded-lg border border-[#C58752]/50 bg-white p-3';
const vazio = { numero: '', titular: '', validade: '', cvv: '', cpf: '' };

export default function Clube() {
  const [plano, setPlano] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [sdk, setSdk] = useState(null);
  const [enderecoId, setEnderecoId] = useState('');
  const [cartao, setCartao] = useState(vazio);
  const [aceite, setAceite] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [assinatura, setAssinatura] = useState(null);
  const envioRef = useRef(false);
  const chaveRef = useRef(null);

  useEffect(() => {
    let ativo = true;
    async function carregar() {
      try {
        const [oferta, conta, config] = await Promise.all([
          fetch('/api/assinatura/plano'),
          fetch('/api/perfil', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/config'),
        ]);
        if (!oferta.ok || !config.ok || (!conta.ok && conta.status !== 401)) throw new Error('Não foi possível carregar o Clube.');
        const dadosPlano = await oferta.json();
        const dadosConfig = await config.json();
        const usuario = conta.ok ? (await conta.json()).usuario : null;
        let atual = null;
        if (usuario) {
          const consulta = await fetch('/api/assinaturas', { credentials: 'include', cache: 'no-store' });
          if (!consulta.ok) throw new Error('Não foi possível conferir suas contratações. Tente novamente antes de assinar.');
          const dados = await consulta.json();
          atual = dados.assinaturas?.find((item) => ['iniciando', 'resultado_desconhecido', 'aguardando_pagamento', 'ativa'].includes(item.statusAdesao)) || null;
        }
        if (!ativo) return;
        setPlano(dadosPlano.plano);
        setPerfil(usuario);
        setAssinatura(atual);
        const enderecos = usuario?.enderecos || [];
        setEnderecoId((enderecos.find((item) => item.principal) || enderecos[0])?._id || '');
        setCartao((anterior) => ({ ...anterior, cpf: usuario?.cpf || '' }));
        if (dadosConfig.publicKey && window.MercadoPago) {
          setSdk(new window.MercadoPago(dadosConfig.publicKey, { locale: 'pt-BR' }));
        }
      } catch (error) {
        if (ativo) setErro(error.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    }
    carregar();
    return () => { ativo = false; };
  }, []);

  const alterar = (event) => setCartao((anterior) => ({ ...anterior, [event.target.name]: event.target.value }));

  const contratar = async (event) => {
    event.preventDefault();
    if (envioRef.current) return;
    envioRef.current = true;
    setEnviando(true);
    setErro('');
    try {
      if (!sdk || !aceite || !enderecoId) throw new Error('Confira o cartão, o endereço e a autorização mensal.');
      const numero = cartao.numero.replace(/\D/g, '');
      const metodos = await sdk.getPaymentMethods({ bin: numero.slice(0, 6) });
      if (!metodos.results?.some((item) => item.payment_type_id === 'credit_card')) {
        throw new Error('Use um cartão de crédito para contratar o Clube.');
      }
      const [mes, ano] = cartao.validade.split('/');
      let token;
      try {
        token = await sdk.createCardToken({
          cardNumber: numero, cardholderName: cartao.titular,
          cardExpirationMonth: mes, cardExpirationYear: ano?.length === 2 ? `20${ano}` : ano,
          securityCode: cartao.cvv,
          identification: { type: 'CPF', number: cartao.cpf.replace(/\D/g, '') },
        });
      } catch { throw new Error('Não foi possível validar o cartão. Confira os dados informados.'); }
      if (!token?.id) throw new Error('Não foi possível validar o cartão.');
      chaveRef.current ??= sessionStorage.getItem('mini-stitches:adesao-clube') || crypto.randomUUID();
      sessionStorage.setItem('mini-stitches:adesao-clube', chaveRef.current);
      const resposta = await fetch('/api/assinatura/criar', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plano: plano.codigo, metodo: 'cartao', tokenCartao: token.id,
          enderecoId, aceiteRecorrencia: aceite, chaveTentativa: chaveRef.current }),
      });
      const dados = await resposta.json();
      setCartao(vazio);
      if (resposta.status === 401) throw new Error('Entre na sua conta novamente para contratar.');
      if (!resposta.ok) throw new Error(dados.mensagem || 'Não foi possível confirmar a contratação. Consulte o atendimento antes de repetir.');
      setAssinatura(dados.assinatura);
    } catch (error) {
      setErro(error.message || 'Não foi possível concluir a contratação.');
    } finally {
      envioRef.current = false;
      setEnviando(false);
    }
  };

  return (
    <div className="w-full bg-[#FEF9F3] px-4 py-10 text-[#422518] md:px-10">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="rounded-2xl bg-[#F6D1E7] p-7 text-center">
          <h1 className="text-3xl font-bold uppercase">Clube da Caixinha</h1>
          <p className="mt-3">Uma nova aventura criativa por mês para crianças de 4 a 10 anos.</p>
        </header>
        {carregando && <p role="status">Carregando o Clube...</p>}
        {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{erro}</p>}
        {perfil && <CaixasClube />}
        {plano && <>
          <section className="space-y-4 rounded-2xl border border-[#C58752]/40 bg-white p-6">
            <h2 className="text-2xl font-bold">{plano.nome}</h2>
            <p className="text-3xl font-bold">{moeda(plano.valor)}<span className="text-base font-normal"> / mês</span></p>
            <ul className="list-inside list-disc space-y-2">
              <li>Para uma criança: um Kit DIY inédito e um brinde surpresa por mês.</li>
              <li>Entrega incluída para todo o Brasil: {moeda(plano.frete)} de frete.</li>
              <li>Cobrança mensal recorrente no cartão de crédito, sem fidelidade.</li>
              <li>QR Code para a biblioteca de vídeos, disponível a qualquer pessoa com login.</li>
            </ul>
            <p className="text-sm">Cancelamento livre. A primeira caixa depende da aprovação da mensalidade e do calendário do Clube.</p>
          </section>
          {assinatura ? (
            <section className="space-y-3 rounded-2xl border border-[#C58752]/40 bg-white p-6" role="status">
              <h2 className="text-xl font-bold">{assinatura.statusAdesao === 'ativa' ? 'Assinatura ativa' : 'Solicitação de assinatura registrada'}</h2>
              <p>{assinatura.statusAdesao === 'ativa' ? `Primeira caixa: ${assinatura.primeiraCompetencia || 'em conciliação'}. Consulte o acompanhamento das caixas nesta página.`
                : assinatura.statusAdesao === 'cancelada' ? 'A autorização foi cancelada pelo provedor. Consulte o atendimento para acompanhar a solicitação.'
                : ['iniciando', 'resultado_desconhecido'].includes(assinatura.statusAdesao)
                  ? 'A contratação aguarda conciliação. Consulte o atendimento antes de solicitar outra assinatura.'
                  : 'Aguardamos a confirmação da primeira mensalidade. A autorização da recorrência ainda não confirma o pagamento da caixa.'}</p>
              <p className="text-sm">Referência: {assinatura.id}</p>
              <Link to="/contato" className="inline-block underline">Falar com o atendimento</Link>
            </section>
          ) : !perfil ? (
            !carregando && <Link to="/login?redirect=%2Fclube" className="inline-block rounded-xl bg-[#602C16] px-6 py-3 font-bold text-white">Entrar para assinar</Link>
          ) : (
            <form onSubmit={contratar} className="space-y-5 rounded-2xl border border-[#C58752]/40 bg-white p-6">
              <h2 className="text-xl font-bold">Contratar o plano mensal</h2>
              <label className="block">Endereço de entrega
                <select required className={campo} value={enderecoId} onChange={(event) => setEnderecoId(event.target.value)} disabled={enviando}>
                  <option value="">Selecione um endereço da sua conta</option>
                  {(perfil.enderecos || []).map((item) => <option key={item._id} value={item._id}>{item.rua}, {item.numero} — {item.cidade}/{item.estado}</option>)}
                </select>
              </label>
              {!perfil.enderecos?.length && <Link to="/perfil" className="inline-block underline">Cadastrar endereço no perfil</Link>}
              <div className="grid gap-4 md:grid-cols-2">
                <label>Número do cartão de crédito<input required name="numero" autoComplete="cc-number" inputMode="numeric" value={cartao.numero} onChange={alterar} className={campo} disabled={enviando} /></label>
                <label>Nome no cartão<input required name="titular" autoComplete="cc-name" value={cartao.titular} onChange={alterar} className={campo} disabled={enviando} /></label>
                <label>Validade (MM/AA)<input required name="validade" autoComplete="cc-exp" placeholder="MM/AA" pattern="(0[1-9]|1[0-2])/[0-9]{2,4}" value={cartao.validade} onChange={alterar} className={campo} disabled={enviando} /></label>
                <label>Código de segurança<input required type="password" name="cvv" autoComplete="cc-csc" inputMode="numeric" pattern="[0-9]{3,4}" maxLength={4} value={cartao.cvv} onChange={alterar} className={campo} disabled={enviando} /></label>
                <label>CPF do titular<input required name="cpf" inputMode="numeric" value={cartao.cpf} onChange={alterar} className={campo} disabled={enviando} /></label>
              </div>
              <label className="flex items-start gap-3">
                <input required type="checkbox" checked={aceite} onChange={(event) => setAceite(event.target.checked)} disabled={enviando} className="mt-1" />
                <span>Autorizo a cobrança recorrente de {moeda(plano.valor)} por mês no cartão de crédito, com entrega incluída, até solicitar o cancelamento.</span>
              </label>
              <p className="text-sm">O cartão será validado pelo Mercado Pago. A ativação depende da confirmação da primeira mensalidade.</p>
              <button disabled={enviando || !sdk || !enderecoId} className="rounded-xl bg-[#602C16] px-6 py-3 font-bold text-white disabled:opacity-50">
                {enviando ? 'Enviando contratação...' : `Assinar por ${moeda(plano.valor)}/mês`}
              </button>
              {!sdk && <p className="text-sm" role="status">A contratação por cartão está indisponível no momento.</p>}
            </form>
          )}
        </>}
      </div>
    </div>
  );
}
