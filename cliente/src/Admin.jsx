import React, { useState } from 'react';

export default function Admin() {
  const [abaAtiva, setAbaAtiva] = useState('VISÃO GERAL');

  const abas = ['VISÃO GERAL', 'ESTOQUE', 'MATERIAIS', 'PEDIDOS', 'CLUBE', 'TROCAS', 'TUTORIAIS'];

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full">
      <h1 className="text-4xl md:text-5xl font-['Archivo_Black'] text-[#3E2417] mb-8">PAINEL DA LOJA</h1>

      {/* Botões de Navegação entre Abas */}
      <div className="flex flex-wrap gap-3 mb-8">
        {abas.map((aba) => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba)}
            className={`px-5 py-2.5 rounded-full text-xs md:text-sm font-bold border transition-all ${
              abaAtiva === aba ? 'bg-[#3E2417] text-white border-[#3E2417]' : 'bg-white text-[#3E2417] border-stone-300'
            }`}
          >
            {aba}
          </button>
        ))}
      </div>

      {/* Conteúdo Dinâmico conforme a Aba Selecionada */}
      <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-300">
        {abaAtiva === 'VISÃO GERAL' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-stone-200 bg-[#FEF8F0]">
              <span className="text-stone-500 font-bold text-sm">PEDIDOS</span>
              <p className="text-4xl font-bold text-[#602D15] mt-2">1</p>
            </div>
            <div className="p-6 rounded-xl border border-stone-200 bg-[#FEF8F0]">
              <span className="text-stone-500 font-bold text-sm">FATURADO</span>
              <p className="text-4xl font-bold text-[#602D15] mt-2">R$ 154,80</p>
            </div>
            <div className="p-6 rounded-xl border border-stone-200 bg-[#FEF8F0]">
              <span className="text-stone-500 font-bold text-sm">ASSINANTES CLUBE</span>
              <p className="text-4xl font-bold text-[#602D15] mt-2">2</p>
            </div>
          </div>
        )}

        {abaAtiva === 'ESTOQUE' && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-bold text-[#3E2417] mb-2">Controle de Estoque dos Kits</h2>
            {['Coelhinho Amigurumi (8 un.)', 'Guirlanda de Flores (11 un.)', 'Bordado Arco-íris (14 un.)'].map((kit, index) => (
              <div key={index} className="flex justify-between items-center py-3 border-b border-stone-200">
                <span className="font-bold text-[#3E2417]">{kit}</span>
                <button className="px-4 py-1.5 border border-stone-300 rounded-lg text-sm hover:bg-stone-50">Editar</button>
              </div>
            ))}
          </div>
        )}

        {abaAtiva === 'PEDIDOS' && (
          <div>
            <h2 className="text-xl font-bold text-[#3E2417] mb-4">Últimos Pedidos</h2>
            <div className="p-4 bg-[#FEF8F0] rounded-lg border border-stone-200 flex justify-between items-center">
              <div>
                <p className="font-bold text-[#3E2417]">MS-1001 · Ana Souza</p>
                <p className="text-xs text-stone-500">1x Coelhinho Amigurumi</p>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-bold rounded-full">Entregue</span>
            </div>
          </div>
        )}

        {['MATERIAIS', 'CLUBE', 'TROCAS', 'TUTORIAIS'].includes(abaAtiva) && (
          <p className="text-stone-500">Gerenciamento da seção <strong>{abaAtiva}</strong> pronto para ser conectado ao backend.</p>
        )}
      </div>
    </div>
  );
}