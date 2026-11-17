import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CarrinhoContext } from '../context/CarrinhoContext';
import { criarControleCarrinho } from '../utils/carrinho.mjs';
import { notificarAlteracaoCarrinho } from '../utils/resumoCheckout.mjs';

export default function CarrinhoProvider({ children }) {
  const { key } = useLocation();
  const navigate = useNavigate();
  const [controle] = useState(() => criarControleCarrinho());
  const estado = useSyncExternalStore(controle.assinar, controle.ler, controle.ler);
  const [visibilidade, setVisibilidade] = useState({ key, aberto: false });
  if (visibilidade.key !== key) setVisibilidade({ key, aberto: false });
  const focoAnterior = useRef(null);
  const finalizandoRef = useRef(false);
  const [finalizando, setFinalizando] = useState(false);
  const [erroCheckout, setErroCheckout] = useState('');
  const aberto = visibilidade.key === key && visibilidade.aberto;
  const abrir = () => { focoAnterior.current = document.activeElement; setErroCheckout(''); setVisibilidade({ key, aberto: true }); controle.carregar(); };
  useEffect(() => {
    const atualizar = (evento) => {
      if (evento.detail?.abrir) { focoAnterior.current = document.activeElement; setErroCheckout(''); setVisibilidade({ key, aberto: true }); }
      if (evento.detail?.origem !== 'gaveta') controle.carregar();
    };
    const outraAba = (evento) => { if (evento.key === 'mini-stitches:carrinho-revisao') controle.carregar(); };
    const foco = () => controle.carregar();
    window.addEventListener('carrinho-atualizado', atualizar);
    window.addEventListener('storage', outraAba);
    window.addEventListener('focus', foco);
    controle.carregar();
    return () => {
      window.removeEventListener('carrinho-atualizado', atualizar);
      window.removeEventListener('storage', outraAba);
      window.removeEventListener('focus', foco);
      controle.cancelarLeitura();
    };
  }, [controle, key]);
  const alterar = async (...argumentos) => {
    setErroCheckout('');
    if (await controle.alterar(...argumentos)) notificarAlteracaoCarrinho({ origem: 'gaveta' });
  };
  const finalizarCompra = async () => {
    if (finalizandoRef.current || !estado.resumo?.podeContinuar || estado.carregando || estado.salvando || estado.erro) return;
    finalizandoRef.current = true; setFinalizando(true); setErroCheckout('');
    try {
      const resposta = await fetch('/api/perfil', { credentials: 'include', cache: 'no-store' });
      if (resposta.status === 401) navigate(`/login?redirect=${encodeURIComponent('/checkout')}`);
      else if (resposta.ok) navigate('/checkout');
      else setErroCheckout('Não foi possível validar sua conta. Tente novamente.');
    } catch { setErroCheckout('Não foi possível validar sua conta. Tente novamente.'); }
    finally { finalizandoRef.current = false; setFinalizando(false); }
  };
  return <CarrinhoContext.Provider value={{ ...estado, erro: estado.erro || erroCheckout, aberto, abrir, fechar: () => setVisibilidade({ key, aberto: false }),
    finalizando, finalizarCompra, recarregar: () => { setErroCheckout(''); controle.carregar(); }, alterar, focoAnterior }}>{children}</CarrinhoContext.Provider>;
}
