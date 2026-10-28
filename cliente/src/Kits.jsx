import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const kitsData = [
  { id: 1, nome: 'Coelhinho Amigurumi', idade: 'Iniciante · A partir de 7 anos', desc: 'O primeiro bichinho que sai das suas mãos', preco: 'R$129,60', precoAntigo: 'R$159,50' },
  { id: 2, nome: 'Bordado Arco-Íris', idade: 'Iniciante · 7 a 10 anos', desc: 'Seis cores, um bastidor e muita imaginação.', preco: 'R$129,60', precoAntigo: 'R$159,50' },
  { id: 3, nome: 'Guirlanda de Flores', idade: 'Iniciante · A partir de 7 anos', desc: 'O primeiro bichinho que sai das suas mãos', preco: 'R$129,60', precoAntigo: 'R$159,50' },
  { id: 4, nome: 'Bolsinha de Crochê', idade: 'Avançado · 7 a 10 anos', desc: 'O primeiro bichinho que sai das suas mãos', preco: 'R$129,60', precoAntigo: 'R$159,50' },
  { id: 5, nome: 'Mantinha da Boneca', idade: 'Iniciante · A partir de 7 anos', desc: 'O carinho de fazer algo para quem se ama', preco: 'R$129,60', precoAntigo: 'R$159,50' }
];

export default function Kits() {
  const [filtroIdade, setFiltroIdade] = useState('TODAS');
  const [filtroDificuldade, setFiltroDificuldade] = useState('TODOS');

  return (
    <div className="w-full flex-1 pb-16">
      {/* Banner Principal */}
      <div className="w-full bg-[#F7C6E5] py-12 px-6 text-center md:text-left md:px-16 mb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-['Archivo_Black'] text-[#3E2417] mb-4">TODOS OS KITS</h1>
          <p className="text-sm md:text-base font-['Archivo_Black'] text-[#3E2417] max-w-2xl leading-relaxed">
            Escolha pela idade e pelo tanto de desafio. Todos chegam com fio, agulha e um guia ilustrado para acompanhar sem correria.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        {/* Seção de Filtros */}
        <div className="flex flex-col gap-6 mb-8">
          <div>
            <span className="block text-xs font-['Archivo_Black'] tracking-widest uppercase mb-3">IDADE</span>
            <div className="flex flex-wrap gap-2">
              {['TODAS', 'A PARTIR DE 4 ANOS', 'A PARTIR DE 7 ANOS'].map((item) => (
                <button
                  key={item}
                  onClick={() => setFiltroIdade(item)}
                  className={`px-6 py-2.5 rounded-full text-xs md:text-sm font-['Archivo_Black'] border border-[#3E2417] transition-all ${
                    filtroIdade === item ? 'bg-[#3E2417] text-[#FEF8F0]' : 'bg-transparent text-[#3E2417]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-xs font-['Archivo_Black'] tracking-widest uppercase mb-3">DIFICULDADE</span>
            <div className="flex flex-wrap gap-2">
              {['TODOS', 'INICIANTE', 'INTERMEDIÁRIO', 'AVANÇADO'].map((item) => (
                <button
                  key={item}
                  onClick={() => setFiltroDificuldade(item)}
                  className={`px-6 py-2.5 rounded-full text-xs md:text-sm font-['Archivo_Black'] border border-[#3E2417] transition-all ${
                    filtroDificuldade === item ? 'bg-[#3E2417] text-[#FEF8F0]' : 'bg-transparent text-[#3E2417]'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-sm font-['Archivo_Black'] text-[#602D15] mb-6">{kitsData.length} kits encontrados</p>

        {/* Grid de Produtos */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {kitsData.map((kit) => (
            <Link key={kit.id} to={`/kit/${kit.id}`} className="bg-white rounded-2xl border border-stone-300 overflow-hidden hover:shadow-lg transition-shadow flex flex-col justify-between">
              <img src="https://placehold.co/400x400" alt={kit.nome} className="w-full h-64 object-cover" />
              <div className="p-6 flex flex-col gap-2">
                <span className="text-xs font-semibold text-[#3E2417]">{kit.idade}</span>
                <h3 className="text-lg font-black text-black">{kit.nome}</h3>
                <p className="text-xs text-[#602D15] leading-relaxed">{kit.desc}</p>
                <div className="flex items-center gap-3 mt-4">
                  <span className="text-lg font-black text-[#602D15]">{kit.preco}</span>
                  <span className="text-xs text-stone-500 line-through">{kit.precoAntigo}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}