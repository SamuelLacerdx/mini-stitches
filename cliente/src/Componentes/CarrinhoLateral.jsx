import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCarrinho } from '../context/CarrinhoContext';
import { formatarParcelasCarrinho } from '../utils/carrinho.mjs';
import fecharIcone from '../assets/carrinho/fechar.svg';
import menosIcone from '../assets/carrinho/menos.svg';
import maisIcone from '../assets/carrinho/mais.svg';
import removerIcone from '../assets/carrinho/remover.svg';
import setaIcone from '../assets/carrinho/seta.svg';
import cadeadoIcone from '../assets/carrinho/cadeado.svg';
import './CarrinhoLateral.css';

const moeda = (valor) => valor == null ? 'Indisponível' : (valor / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CarrinhoLateral() {
  const { aberto, fechar, itens, resumo, carregando, salvando, erro, alterar, recarregar, finalizarCompra, finalizando, focoAnterior } = useCarrinho();
  const dialogo = useRef(null);
  const fecharBotao = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const elemento = dialogo.current;
    const anterior = focoAnterior.current;
    const overflow = document.body.style.overflow;
    elemento.showModal();
    document.body.style.overflow = 'hidden';
    fecharBotao.current?.focus();
    return () => {
      elemento.close();
      document.body.style.overflow = overflow;
      if (anterior?.isConnected) anterior.focus();
    };
  }, [aberto, focoAnterior]);
  const quantidade = resumo?.quantidadeItens ?? itens.reduce((soma, item) => soma + item.quantidade, 0);
  const ocupado = carregando || salvando || finalizando;
  return <dialog ref={dialogo} id="carrinho-lateral" className="carrinho-dialogo" aria-labelledby="titulo-carrinho-lateral"
    aria-describedby="descricao-carrinho-lateral" onCancel={(e) => { e.preventDefault(); fechar(); }} onClick={(e) => {
      const caixa = e.currentTarget.getBoundingClientRect();
      if (e.target === e.currentTarget && (e.clientX < caixa.left || e.clientX > caixa.right || e.clientY < caixa.top || e.clientY > caixa.bottom)) fechar();
    }}>
    <div className="carrinho-painel">
      <header className="carrinho-cabecalho">
        <div className="carrinho-titulo-fechar">
          <div className="carrinho-titulo"><h2 id="titulo-carrinho-lateral">MEU CARRINHO</h2><span className="carrinho-contagem" aria-label={`${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`} aria-live="polite">{quantidade}</span></div>
          <button ref={fecharBotao} type="button" onClick={fechar} className="carrinho-fechar" aria-label="Fechar carrinho"><img src={fecharIcone} alt="" width="22" height="22" /></button>
        </div>
        <p id="descricao-carrinho-lateral">{quantidade === 1 ? '1 item para criar com as próprias mãos.' : `${quantidade} itens para criar com as próprias mãos.`}</p>
      </header>
      <div className="carrinho-produtos" aria-busy={carregando || salvando}>
        {erro && <div role="alert" className="carrinho-aviso"><p>{erro}</p><button type="button" onClick={recarregar} disabled={ocupado}>Tentar novamente</button></div>}
        {carregando && <p role="status" className="carrinho-mensagem">Atualizando carrinho...</p>}
        {!carregando && !itens.length && <div className="carrinho-vazio"><p>Seu carrinho está vazio.</p><Link to="/kits" onClick={fechar}>Conhecer os kits</Link></div>}
        {itens.map((item) => <article className="carrinho-item" key={item.produtoId}>
          <div className="carrinho-informacoes"><h3>{item.nome}</h3><p>{item.tipo}</p></div>
          <div className="carrinho-quantidade-valor">
            <div className="carrinho-controles">
              <div className="carrinho-quantidade">
                <button type="button" aria-label={`Diminuir quantidade de ${item.nome}`} disabled={ocupado || item.quantidade <= 1} onClick={() => alterar(item.produtoId, 'PATCH', item.quantidade - 1)}><img src={menosIcone} alt="" width="14" height="14" /></button>
                <span aria-label={`Quantidade de ${item.nome}`}>{item.quantidade}</span>
                <button type="button" aria-label={`Aumentar quantidade de ${item.nome}`} disabled={ocupado || !item.ativo || item.quantidade >= item.estoqueDisponivel} onClick={() => alterar(item.produtoId, 'PATCH', item.quantidade + 1)}><img src={maisIcone} alt="" width="14" height="14" /></button>
              </div>
              <button type="button" className="carrinho-remover" aria-label={`Remover ${item.nome} do carrinho`} disabled={ocupado} onClick={() => alterar(item.produtoId, 'DELETE')}><img src={removerIcone} alt="" width="36" height="36" /></button>
            </div>
            <span className="carrinho-valor-item">{moeda(item.preco * item.quantidade)}</span>
          </div>
          {(!item.ativo || item.quantidade > item.estoqueDisponivel) && <p className="carrinho-item-indisponivel">{!item.ativo ? 'Produto indisponível.' : 'Quantidade acima do estoque disponível.'}</p>}
        </article>)}
        {resumo?.erro && <p role="alert" className="carrinho-aviso">{resumo.erro}</p>}
      </div>
      <section className="carrinho-resumo" aria-label="Resumo dos produtos">
        <div className="carrinho-linha carrinho-subtotal"><span>SUBTOTAL</span><strong>{moeda(resumo?.subtotal)}</strong></div>
        <div className="carrinho-linha carrinho-frete"><span>Frete</span><span>{resumo?.freteGratis ? 'Grátis' : 'Calculado pelo CEP'}</span></div>
        <hr />
        <div className="carrinho-linha carrinho-pix"><span>No Pix (5% off)</span><strong>{moeda(resumo?.produtosPix)}</strong></div>
        <div className="carrinho-linha carrinho-parcelas"><span>No cartão</span><span title="Parcelamento dos produtos; o frete será incluído no checkout.">{formatarParcelasCarrinho(resumo?.parcelas)}</span></div>
      </section>
      <footer className="carrinho-acoes">
        <button type="button" className="carrinho-finalizar" onClick={finalizarCompra} disabled={ocupado || Boolean(erro) || !resumo?.podeContinuar}>{finalizando ? 'AGUARDE...' : 'FINALIZAR COMPRA'}<img src={setaIcone} alt="" width="20" height="20" /></button>
        <Link to="/carrinho" className="carrinho-ver" onClick={fechar}>VER O CARRINHO</Link>
        <p className="carrinho-seguranca"><img src={cadeadoIcone} alt="" width="13" height="13" />Compra segura, do primeiro ao último ponto.</p>
      </footer>
    </div>
  </dialog>;
}
