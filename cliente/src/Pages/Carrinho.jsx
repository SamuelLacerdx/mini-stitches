import React, { useState } from 'react';

export default function Carrinho() {
  const [itens, setItens] = useState([
    { id: 1, nome: 'COELHINHO AMIGURUMI', tipo: '7 a 10 anos', preco: 129.90, qtd: 1 },
    { id: 2, nome: 'NOVELO DE ALGODÃO ROSA', tipo: 'Material avulso', preco: 24.90, qtd: 1 },
    { id: 3, nome: 'NOVELO DE ALGODÃO AMARELO', tipo: 'Material avulso', preco: 24.90, qtd: 1 }
  ]);

  const atualizarQtd = (id, delta) => {
    setItens(itens.map(item => item.id === id ? { ...item, qtd: Math.max(1, item.qtd + delta) } : item));
  };

  const removerItem = (id) => {
    setItens(itens.filter(item => item.id !== id));
  };

  const subtotal = itens.reduce((acc, item) => acc + item.preco * item.qtd, 0);
  const pixTotal = subtotal * 0.95;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full flex flex-col lg:flex-row gap-12">
      {/* Lista de Itens */}
      <div className="flex-1">
        <h1 className="text-4xl font-['Archivo_Black'] text-[#3E2417] mb-6">MEU CARRINHO</h1>
        <div className="border-b-2 border-orange-400/70 mb-4" />

        {itens.length === 0 ? (
          <p className="text-stone-500 my-8">Seu carrinho está vazio.</p>
        ) : (
          itens.map((item) => (
            <div key={item.id} className="py-4 border-b border-orange-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-['Archivo_Black'] text-base text-[#3E2417]">{item.nome}</h3>
                <span className="text-xs text-stone-500">{item.tipo}</span>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center border border-orange-400 rounded-lg">
                  <button onClick={() => atualizarQtd(item.id, -1)} className="px-3 py-1 font-['Archivo_Black'] text-[#3E2417]">-</button>
                  <span className="px-3 text-sm font-['Archivo_Black']">{item.qtd}</span>
                  <button onClick={() => atualizarQtd(item.id, 1)} className="px-3 py-1 font-['Archivo_Black'] text-[#3E2417]">+</button>
                </div>

                <span className="font-['Archivo_Black'] text-base text-[#3E2417]">
                  R$ {(item.preco * item.qtd).toFixed(2).replace('.', ',')}
                </span>

                <button onClick={() => removerItem(item.id)} className="text-red-600 font-bold hover:opacity-80">
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Card de Resumo */}
      <div className="w-full lg:w-96 bg-[#FBE6A8] p-6 rounded-xl flex flex-col gap-4 h-fit">
        <h2 className="text-xl font-['Archivo_Black'] text-[#3E2417]">RESUMO</h2>
        <div className="border-b border-orange-400/50" />

        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span>Frete</span>
          <span>Calculado no checkout</span>
        </div>

        <div className="border-b border-orange-400/50" />

        <div className="flex justify-between font-['Archivo_Black'] text-base">
          <span>No Pix (5% off)</span>
          <span>R$ {pixTotal.toFixed(2).replace('.', ',')}</span>
        </div>

        <button className="w-full bg-[#3E2417] hover:bg-[#602D15] text-white py-4 rounded-lg font-['Archivo_Black'] text-base transition-colors mt-2">
          FINALIZAR COMPRA
        </button>
      </div>
    </div>
  );
}