import { useEffect, useState } from 'react';
import { criarAcompanhamento } from '../utils/acompanhamento.mjs';

export function useAcompanhamento(url, selecionar, { repetir404 = false } = {}) {
  const [estado, setEstado] = useState(null);
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    if (!url) return;
    const consulta = criarAcompanhamento({ url, selecionar, repetir404, aoAtualizar: (dados) => setEstado({ url, ...dados }) });
    consulta.iniciar();
    return () => consulta.parar();
  }, [url, selecionar, tentativa, repetir404]);
  return { resultado: estado?.url === url ? estado : null,
    tentarNovamente: () => setTentativa((valor) => valor + 1) };
}
