import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SearchX } from 'lucide-react';

export default function NotFound({ termoBusca }) {
  // O hook useLocation permite capturar parâmetros passados pela navegação
  const location = useLocation();
  
  // Define o termo a exibir: usa a prop direta, o estado da rota ou um valor padrão
  const termo = termoBusca || location.state?.termo || 'sua pesquisa';

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center bg-[#FAF5EF] px-4 py-16 font-['Work_Sans',sans-serif] text-[#3E1B0E]">
      <div className="flex max-w-2xl flex-col items-center text-center">
        
        {/* 1. ÍCONE DE ALERTA / BUSCA VAZIA */}
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FDE7B2] text-[#3E1B0E]">
          <SearchX className="h-10 w-10 stroke-[1.5]" />
        </div>

        {/* 2. TAG DE ERRO */}
        <span className="mb-2 font-['Archivo_Black',sans-serif] text-sm uppercase tracking-[4px] text-amber-900">
          ERRO 404
        </span>

        {/* 3. TÍTULO PRINCIPAL */}
        <h1 className="mb-4 font-['Archivo_Black',sans-serif] text-5xl uppercase text-[#3E1B0E] sm:text-6xl md:text-7xl">
          NADA POR AQUI
        </h1>

        {/* 4. MENSAGEM EXPLICATIVA */}
        <p className="mb-8 max-w-lg text-lg leading-relaxed text-[#3E1B0E]/75">
          Não encontramos nenhum kit ou material com <span className="font-semibold text-amber-950">"{termo}"</span>. Confira a escrita ou tente outra palavra.
        </p>

        {/* 5. BOTÕES DE NAVEGAÇÃO / ALTERNATIVAS */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Botão Primário */}
          <Link
            to="/kits"
            className="flex h-14 items-center justify-center rounded-full bg-[#3E1B0E] px-8 font-['Archivo_Black',sans-serif] text-base uppercase tracking-wide text-[#FAF5EF] transition-transform hover:scale-105"
          >
            VER OS KITS
          </Link>

          {/* Botão Secundário Contornado */}
          <Link
            to="/materiais"
            className="flex h-14 items-center justify-center rounded-full border-2 border-[#3E1B0E] bg-[#FAF5EF] px-8 font-['Archivo_Black',sans-serif] text-base uppercase tracking-wide text-[#3E1B0E] transition-transform hover:scale-105"
          >
            VER MATERIAIS
          </Link>
        </div>

      </div>
    </div>
  );
}