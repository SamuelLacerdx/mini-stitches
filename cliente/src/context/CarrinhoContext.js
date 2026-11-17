import { createContext, useContext } from 'react';

export const CarrinhoContext = createContext(null);
export function useCarrinho() {
  const contexto = useContext(CarrinhoContext);
  if (!contexto) throw new Error('Carrinho indisponível fora do provedor.');
  return contexto;
}
