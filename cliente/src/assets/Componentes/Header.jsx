import React from 'react';
import { Link } from 'react-router-dom';
import logoMarca from '../logo.svg';
import { Search, ShoppingBag, User } from 'lucide-react';

export default function Header() {
  return (
    <header className="w-full font-['Archivo_Black',sans-serif]">
      <div className="h-7 w-full bg-[#4E2206]" />

      <div className="w-full border-b border-amber-100/50 bg-[#FAF5EF] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-full items-center justify-between gap-4">
          
          <div className="flex shrink-0 items-center">
            <Link to="/" className="flex items-center gap-2">
              <img
                src={logoMarca}
                alt="Logótipo Mini Stitches"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>

          <nav className="hidden items-center gap-6 text-xs font-normal tracking-wide text-[#3E1B0E] lg:flex">
            <Link to="/" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"> INÍCIO </Link>
            <Link to="/kits" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"> KITS </Link>
            <Link to="/materiais" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"> MATERIAIS </Link>
            <Link to="/Clube" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"> CLUBE DA CAIXINHA </Link>
            <Link to="/nossa-historia" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"> NOSSA HISTÓRIA </Link>
            <Link to="/fale-com-a-gente" className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"> FALE COM A GENTE </Link>
          </nav>

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
              to="/Login"
              className="flex items-center gap-2 rounded-full border border-[#D8C2B0] px-4 py-1.5 text-xs text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD]"
            >
              <User className="h-4 w-4 stroke-[1.75]" />
              <span>CONTA</span>
            </Link>
          </div>

        </div>
      </div>
    </header>
  );
}