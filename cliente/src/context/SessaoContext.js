import { createContext, useContext } from 'react';

export const SessaoContext = createContext(null);
export function useSessao() {
  const contexto = useContext(SessaoContext);
  if (!contexto) throw new Error('Sessão indisponível fora do provedor.');
  return contexto;
}
