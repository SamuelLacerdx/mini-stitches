import { useCallback, useEffect, useRef, useState } from 'react';
import { criarConsultaResumo } from '../utils/resumoCheckout.mjs';

export function useResumoCheckout({ cep, metodo, parcelas, servicoId, pedidoNumero, entrega, ativo }) {
  const [revisao, setRevisao] = useState(0);
  const [estado, setEstado] = useState({ chave: '', resumo: null, erro: '' });
  const consulta = useRef(null);
  if (consulta.current === null) consulta.current = criarConsultaResumo();
  const body = JSON.stringify({ cep: cep.replace(/\D/g, '').length === 8 ? cep : '',
    metodo, parcelas, servicoId, pedidoNumero, entrega });
  const chave = `${revisao}:${body}`;
  const atualizar = useCallback(() => {
    consulta.current.cancelar();
    setRevisao((valor) => valor + 1);
  }, []);
  useEffect(() => {
    if (!ativo) return;
    let atual = true;
    const controle = consulta.current;
    const timer = setTimeout(async () => {
      try {
        const resumo = await controle.consultar(JSON.parse(body));
        if (atual && resumo) setEstado({ chave, resumo, erro: '' });
      } catch (erro) {
        if (atual) setEstado({ chave, resumo: null, erro: erro.message });
      }
    }, 250);
    return () => { atual = false; clearTimeout(timer); controle.cancelar(); };
  }, [body, chave, ativo]);
  const resumo = estado.chave === chave ? estado.resumo : null;
  useEffect(() => {
    if (!ativo || !resumo?.validoAte) return;
    const timer = setTimeout(atualizar, Math.max(0, Date.parse(resumo.validoAte) - Date.now()));
    return () => clearTimeout(timer);
  }, [resumo, ativo, atualizar]);
  useEffect(() => {
    const visivel = () => { if (document.visibilityState === 'visible') atualizar(); };
    const outraAba = (evento) => { if (evento.key === 'mini-stitches:carrinho-revisao') atualizar(); };
    window.addEventListener('focus', atualizar);
    window.addEventListener('pageshow', atualizar);
    document.addEventListener('visibilitychange', visivel);
    window.addEventListener('carrinho-atualizado', atualizar);
    window.addEventListener('storage', outraAba);
    return () => {
      window.removeEventListener('focus', atualizar);
      window.removeEventListener('pageshow', atualizar);
      document.removeEventListener('visibilitychange', visivel);
      window.removeEventListener('carrinho-atualizado', atualizar);
      window.removeEventListener('storage', outraAba);
    };
  }, [atualizar]);
  return { resumo, atualizar, erro: estado.chave === chave ? estado.erro : '', carregando: estado.chave !== chave };
}
