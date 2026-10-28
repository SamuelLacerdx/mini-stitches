import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { SeletorQuantidade } from './reutilizaveis';

export default function Carrinho() {
  const [itens, setItens] = useState([
    {
      id: 1,
      nome: 'Coelhinho Amigurumi',
      preco: 129.9,
      quantidade: 1,
      imagem: 'https://placehold.co/100x100',
    },
  ]);

  const handleIncrement = (id) => {
    setItens((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantidade: item.quantidade + 1 } : item
      )
    );
  };

  const handleDecrement = (id) => {
    setItens((prev) =>
      prev.map((item) =>
        item.id === id && item.quantidade > 1
          ? { ...item, quantidade: item.quantidade - 1 }
          : item
      )
    );
  };

  const handleRemover = (id) => {
    setItens((prev) => prev.filter((item) => item.id !== id));
  };

  const subtotal = itens.reduce((acc, i) => acc + i.preco * i.quantidade, 0);
  const descontoPix = subtotal * 0.05;
  const total = subtotal - descontoPix;

  return (
    <div className="min-h-screen bg-[#FAF5EF] px-4 py-10 font-['Work_Sans',sans-serif] text-[#3E1B0E] md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase sm:text-5xl">
          MEU CARRINHO
        </h1>

        {itens.length === 0 ? (
          <p className="text-lg text-stone-500">O seu carrinho está vazio.</p>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Lista de Itens */}
            <div className="flex flex-col gap-4 lg:col-span-2">
              {itens.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl border border-stone-300 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={item.imagem}
                      alt={item.nome}
                      className="h-20 w-20 rounded-xl object-cover"
                    />
                    <div>
                      <h3 className="font-bold">{item.nome}</h3>
                      <p className="text-amber-900 font-bold">
                        R$ {item.preco.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>

                  {/* SELETOR DE QUANTIDADE REUTILIZÁVEL */}
                  <div className="flex items-center gap-4">
                    <SeletorQuantidade
                      quantidade={item.quantidade}
                      onIncrement={() => handleIncrement(item.id)}
                      onDecrement={() => handleDecrement(item.id)}
                      tamanho="sm"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemover(item.id)}
                      className="text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Resumo do Pedido */}
            <div className="flex flex-col gap-4 rounded-2xl border border-stone-300 bg-white p-6 shadow-sm">
              <h2 className="font-['Archivo_Black',sans-serif] text-xl uppercase">
                RESUMO
              </h2>
              <div className="flex justify-between text-sm">
                <span>Subtotal</span>
                <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="flex justify-between text-sm text-green-700">
                <span>Desconto PIX (5%)</span>
                <span>- R$ {descontoPix.toFixed(2).replace('.', ',')}</span>
              </div>
              <div className="border-t border-stone-200 pt-4 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>R$ {total.toFixed(2).replace('.', ',')}</span>
              </div>
              <button
                type="button"
                className="mt-4 w-full rounded-full bg-amber-900 py-3 font-bold text-white transition-colors hover:bg-amber-950"
              >
                FINALIZAR COMPRA
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}