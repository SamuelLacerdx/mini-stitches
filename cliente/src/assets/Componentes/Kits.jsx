import React, { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Kits() {
  // Estados para controlar os filtros selecionados
  const [filtroIdade, setFiltroIdade] = useState('TODAS');
  const [filtroDificuldade, setFiltroDificuldade] = useState('TODOS');

  // Base de dados dos kits
  const kitsData = [
    {
      id: 1,
      title: 'Coelhinho Amigurumi',
      tag: 'Iniciante · A partir de 7 anos',
      idade: '7',
      dificuldade: 'INICIANTE',
      description: 'O primeiro bichinho que sai das suas mãos',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Coelhinho+Amigurumi',
    },
    {
      id: 2,
      title: 'Bordado Arco-Íris',
      tag: 'Iniciante · 7 a 10 anos',
      idade: '7',
      dificuldade: 'INICIANTE',
      description: 'Seis cores, um bastidor e muita imaginação.',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Bordado+Arco-Íris',
    },
    {
      id: 3,
      title: 'Guirlanda de Flores',
      tag: 'Iniciante · A partir de 7 anos',
      idade: '7',
      dificuldade: 'INICIANTE',
      description: 'O primeiro bichinho que sai das suas mãos',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Guirlanda+de+Flores',
    },
    {
      id: 4,
      title: 'Bolsinha de Crochê',
      tag: 'Avançado · 7 a 10 anos',
      idade: '7',
      dificuldade: 'AVANÇADO',
      description: 'O primeiro bichinho que sai das suas mãos',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Bolsinha+de+Crochê',
    },
    {
      id: 5,
      title: 'Mantinha da Boneca',
      tag: 'Iniciante · A partir de 7 anos',
      idade: '7',
      dificuldade: 'INICIANTE',
      description: 'O carinho de fazer algo para quem se ama',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Mantinha+da+Boneca',
    },
    {
      id: 6,
      title: 'Kit Leãozinho Amigurumi',
      tag: 'Intermediário · A partir de 4 anos',
      idade: '4',
      dificuldade: 'INTERMEDIÁRIO',
      description: 'Um leãozinho fofo e muito divertido de fazer',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Leão+Amigurumi',
    },
  ];

  // Lógica para filtrar a lista de kits com base nas seleções ativas
  const kitsFiltrados = kitsData.filter((kit) => {
    const atendeIdade =
      filtroIdade === 'TODAS' ||
      (filtroIdade === '4' && kit.idade === '4') ||
      (filtroIdade === '7' && kit.idade === '7');

    const atendeDificuldade =
      filtroDificuldade === 'TODOS' || kit.dificuldade === filtroDificuldade;

    return atendeIdade && atendeDificuldade;
  });

  return (
    <div className="w-full bg-[#FAF5EF] font-['Work_Sans',sans-serif]">
      {/* 1. FAIXA SUPERIOR DE DESTAQUE DA PÁGINA */}
      <section className="bg-[#F8D7DA] px-4 py-12 text-[#3E1B0E] md:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-4">
          <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase text-[#3E1B0E] sm:text-5xl lg:text-6xl">
            TODOS OS KITS
          </h1>
          <p className="max-w-3xl font-['Archivo_Black',sans-serif] text-sm uppercase leading-relaxed tracking-wider text-[#3E1B0E] md:text-base">
            Escolha pela idade e pelo tanto de desafio. Todos chegam com fio, agulha e um guia ilustrado para acompanhar sem correria.
          </p>
        </div>
      </section>

      {/* 2. ÁREA DE FILTROS E PRODUTOS */}
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        
        {/* BLOCO DE FILTROS */}
        <div className="flex flex-col gap-6">
          {/* Filtro de Idade */}
          <div className="flex flex-col gap-3">
            <span className="font-['Archivo_Black',sans-serif] text-sm uppercase tracking-widest text-[#3E1B0E]">
              IDADE
            </span>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setFiltroIdade('TODAS')}
                className={`rounded-full px-6 py-2.5 font-['Archivo_Black',sans-serif] text-xs uppercase transition-colors ${
                  filtroIdade === 'TODAS'
                    ? 'bg-[#3E1B0E] text-white'
                    : 'border border-[#3E1B0E] bg-transparent text-[#3E1B0E] hover:bg-[#3E1B0E]/10'
                }`}
              >
                TODAS
              </button>
              <button
                type="button"
                onClick={() => setFiltroIdade('4')}
                className={`rounded-full px-6 py-2.5 font-['Archivo_Black',sans-serif] text-xs uppercase transition-colors ${
                  filtroIdade === '4'
                    ? 'bg-[#3E1B0E] text-white'
                    : 'border border-[#3E1B0E] bg-transparent text-[#3E1B0E] hover:bg-[#3E1B0E]/10'
                }`}
              >
                A PARTIR DE 4 ANOS
              </button>
              <button
                type="button"
                onClick={() => setFiltroIdade('7')}
                className={`rounded-full px-6 py-2.5 font-['Archivo_Black',sans-serif] text-xs uppercase transition-colors ${
                  filtroIdade === '7'
                    ? 'bg-[#3E1B0E] text-white'
                    : 'border border-[#3E1B0E] bg-transparent text-[#3E1B0E] hover:bg-[#3E1B0E]/10'
                }`}
              >
                A PARTIR DE 7 ANOS
              </button>
            </div>
          </div>

          {/* Filtro de Dificuldade */}
          <div className="flex flex-col gap-3">
            <span className="font-['Archivo_Black',sans-serif] text-sm uppercase tracking-widest text-[#3E1B0E]">
              DIFICULDADE
            </span>
            <div className="flex flex-wrap gap-3">
              {['TODOS', 'INICIANTE', 'INTERMEDIÁRIO', 'AVANÇADO'].map((nivel) => (
                <button
                  key={nivel}
                  type="button"
                  onClick={() => setFiltroDificuldade(nivel)}
                  className={`rounded-full px-6 py-2.5 font-['Archivo_Black',sans-serif] text-xs uppercase transition-colors ${
                    filtroDificuldade === nivel
                      ? 'bg-[#3E1B0E] text-white'
                      : 'border border-[#3E1B0E] bg-transparent text-[#3E1B0E] hover:bg-[#3E1B0E]/10'
                  }`}
                >
                  {nivel}
                </button>
              ))}
            </div>
          </div>

          {/* CONTADOR DE RESULTADOS */}
          <div className="pt-2 font-['Archivo_Black',sans-serif] text-sm uppercase tracking-widest text-[#3E1B0E]/80">
            {kitsFiltrados.length} {kitsFiltrados.length === 1 ? 'kit encontrado' : 'kits encontrados'}
          </div>
        </div>

        {/* GRELHA DE KITS */}
        <div className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {kitsFiltrados.map((product) => (
            <div
              key={product.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-stone-300 bg-white transition-shadow hover:shadow-md"
            >
              <img
                src={product.image}
                alt={product.title}
                className="h-80 w-full object-cover"
              />

              <div className="flex flex-grow flex-col justify-between p-5 font-['Work_Sans',sans-serif]">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-yellow-950">
                    {product.tag}
                  </span>
                  <h3 className="text-base font-black text-black">
                    {product.title}
                  </h3>
                  <p className="text-xs font-normal text-yellow-900">
                    {product.description}
                  </p>
                </div>

                <div className="mt-4 flex items-baseline gap-2.5">
                  <span className="text-base font-black text-yellow-900">
                    R${product.price}
                  </span>
                  <span className="text-xs font-normal text-stone-700 line-through">
                    R${product.originalPrice}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </main>
    </div>
  );
}