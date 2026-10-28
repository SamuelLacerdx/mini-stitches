import React from 'react';
import { Link } from 'react-router-dom';
// Importação dos ícones do Lucide React (incluindo Truck e Percent para os benefícios)
import { Search, ShoppingBag, User, Truck, Percent } from 'lucide-react';

// Importação da imagem da logo local
import logoMarca from '../logo.png';

export default function Header() {
  return (
    <header className="w-full font-['Archivo_Black',sans-serif]">
      {/* 1. FAIXA SUPERIOR DECORATIVA (MARROM ESCURO) */}
      <div className="h-7 w-full bg-[#4E2206]" />

      {/* 2. BARRA PRINCIPAL DO CABEÇALHO */}
      <div className="w-full border-b border-amber-100/50 bg-[#FAF5EF] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-full items-center justify-between gap-4">
          
          {/* LOGÓTIPO DA LOJA */}
          <div className="flex shrink-0 items-center">
            <Link to="/" className="flex items-center gap-2">
              <img
                src={logoMarca}
                alt="Logótipo Mini Stitches"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>

          {/* MENU DE NAVEGAÇÃO PRINCIPAL */}
          <nav className="hidden items-center gap-6 text-xs font-normal tracking-wide text-[#3E1B0E] lg:flex">
            <Link to="/" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800">
              INÍCIO
            </Link>
            <Link to="/kits" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800">
              KITS
            </Link>
            <Link to="/materiais" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800">
              MATERIAIS
            </Link>
            <Link to="/clube-da-caixinha" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800">
              CLUBE DA CAIXINHA
            </Link>
            <Link to="/nossa-historia" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800">
              NOSSA HISTÓRIA
            </Link>
            <Link to="/fale-com-a-gente" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800">
              FALE COM A GENTE
            </Link>
          </nav>

          {/* BOTOES DE AÇÃO (DIREITA) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-[#D8C2B0] px-4 py-1.5 text-xs text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD]"
            >
              <Search className="h-4 w-4 stroke-[1.75]" />
              <span>PESQUISAR</span>
            </button>

            <Link
              to="/carrinho"
              className="flex items-center gap-2 rounded-full border border-[#D8C2B0] px-4 py-1.5 text-xs text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD]"
            >
              <ShoppingBag className="h-4 w-4 stroke-[1.75]" />
              <span>CARRINHO</span>
            </Link>

            <Link
              to="/criar-conta"
              className="flex items-center gap-2 rounded-full border border-[#D8C2B0] px-4 py-1.5 text-xs text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD]"
            >
              <User className="h-4 w-4 stroke-[1.75]" />
              <span>CONTA</span>
            </Link>
          </div>

        </div>
      </div>

      {/* 3. BARRA DE BENEFÍCIOS (INTEGRADA AO HEADER) */}
      <div className="bg-[#F7C6E5] px-4 py-2.5 font-['Archivo_Black',sans-serif] text-xs text-[#3E1B0E]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 md:justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-[#3E1B0E]" />
            <span>ENVIO PARA TODO BRASIL</span>
          </div>
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-[#3E1B0E]" />
            <span>5% OFF NO PIX</span>
          </div>
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-[#3E1B0E]" />
            <span>ATÉ 6X SEM JUROS</span>
          </div>
        </div>
      </div>
    </header>
  );
}