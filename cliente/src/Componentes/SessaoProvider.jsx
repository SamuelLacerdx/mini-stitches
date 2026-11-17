import { useCallback, useEffect, useState } from 'react';
import { SessaoContext } from '../context/SessaoContext';

// Uma única leitura de /api/perfil por sessão: as telas leem daqui em vez de
// chamar a API por conta própria. Recarrega ao receber 'sessao-alterada',
// disparado no login e na saída da conta.
export default function SessaoProvider({ children }) {
  const [sessao, setSessao] = useState({ usuario: null, carregando: true, erro: '' });

  const recarregar = useCallback(() => {
    fetch('/api/perfil', { credentials: 'include' })
      .then(async (resposta) => {
        if (!resposta.ok) {
          if (resposta.status !== 401 && resposta.status !== 404) {
            throw new Error('Não foi possível verificar sua conta.');
          }
          return null;
        }
        const dados = await resposta.json();
        return dados.usuario || null;
      })
      .then((usuario) => setSessao({ usuario, carregando: false, erro: '' }))
      .catch((error) => {
        console.error(error);
        setSessao({ usuario: null, carregando: false, erro: error.message || 'Não foi possível verificar sua conta.' });
      });
  }, []);

  useEffect(() => {
    recarregar();
    window.addEventListener('sessao-alterada', recarregar);
    return () => window.removeEventListener('sessao-alterada', recarregar);
  }, [recarregar]);

  return <SessaoContext.Provider value={{ ...sessao, recarregar }}>{children}</SessaoContext.Provider>;
}
