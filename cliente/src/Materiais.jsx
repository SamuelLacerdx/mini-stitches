import React, { useState } from 'react';

const materiaisData = [
  { id: 1, categoria: 'FIOS E NOVELO', nome: 'NOVELO DE ALGODÃO - CREME', preco: 'R$24,90', desc: 'Fio de algodão 100% macio, o mesmo dos kits.' },
  { id: 2, categoria: 'FIOS E NOVELO', nome: 'NOVELO DE ALGODÃO - ROSA', preco: 'R$24,90', desc: 'Fio de algodão 100% macio, o mesmo dos kits.' },
  { id: 3, categoria: 'AGULHAS', nome: 'AGULHA DE CROCHÊ DE BAMBU', preco: 'R$18,90', desc: 'Leve e quentinha nas mãos, em ponta arredondada.' },
  { id: 4, categoria: 'ACABAMENTO', nome: 'OLHINHOS DE SEGURANÇA', preco: 'R$14,90', desc: 'Com arruela de travar para firmeza total.' },
  { id: 5, categoria: 'BORDADO', nome: 'MEADAS DE BORDADO (6 CORES)', preco: 'R$24,90', desc: 'Seis meadas nas cores do arco-íris.' }
];

export default function Materiais() {
  const [quantidades, setQuantidades] = useState({});

  const alterarQuantidade = (id, delta) => {
    setQuantidades((prev) => {
      const atual = prev[id] || 1;
      const novoValor = Math.max(1, atual + delta);
      return { ...prev, [id]: novoValor };
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full">
      <h1 className="text-4xl md:text-6xl font-['Archivo_Black'] text-[#3E2417] mb-4">MATERIAIS</h1>
      <p className="text-[#3E2417] text-sm md:text-base font-['Archivo_Black'] max-w-3xl leading-relaxed mb-8">
        Fios, agulhas e acessórios dos mesmos fornecedores dos nossos kits. Perfeitos para repor o que acabou ou continuar criando.
      </p>

      {/* Grid de Materiais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {materiaisData.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-xl border border-stone-300 flex flex-col justify-between">
            <div>
              <span className="text-xs font-semibold text-[#3E2417] block mb-1">{item.categoria}</span>
              <h3 className="text-base font-black text-[#602D15] mb-2">{item.nome}</h3>
              <p className="text-xs text-[#602D15] mb-4">{item.desc}</p>
              <span className="text-lg font-black text-[#602D15] block mb-4">{item.preco}</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Seletor de Quantidade */}
              <div className="flex items-center border border-[#3E2417] rounded-full px-3 py-1">
                <button onClick={() => alterarQuantidade(item.id, -1)} className="text-lg font-bold px-1 text-[#3E2417]">-</button>
                <span className="px-3 text-xs font-['Archivo_Black']">{quantidades[item.id] || 1}</span>
                <button onClick={() => alterarQuantidade(item.id, 1)} className="text-lg font-bold px-1 text-[#3E2417]">+</button>
              </div>

              {/* Botão Adicionar */}
              <button className="flex-1 bg-[#3E2417] text-white py-2 px-4 rounded-full text-xs font-['Archivo_Black'] hover:bg-[#602D15] transition-colors">
                ADICIONAR
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}