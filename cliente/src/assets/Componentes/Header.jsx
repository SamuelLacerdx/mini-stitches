import React from "react";
import { Link } from "react-router-dom";
import logoMarca from "../logo.svg";
import {
  Search,
  ShoppingBag,
  User,
  Truck,
  Zap,
  CreditCard,
} from "lucide-react";

export default function Header() {
  return (
    <header className="w-full font-['Archivo_Black',sans-serif]">
      {/* 1. FAIXA SUPERIOR ESCURA */}
      <div className="h-7 w-full bg-[#4E2206]" />

      {/* 2. BARRA DE NAVEGAÇÃO PRINCIPAL */}
      <div className="w-full border-b border-amber-100/50 bg-[#FAF5EF] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-full items-center justify-between gap-4">
          {/* LOGÓTIPO */}
          <div className="flex shrink-0 items-center">
            <Link to="/" className="flex items-center gap-2">
              <img
                src={logoMarca}
                alt="Logótipo Mini Stitches"
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>

          {/* MENU DE ROTAS PRINCIPAIS */}
          <nav className="hidden items-center gap-6 text-xs font-normal tracking-wide text-[#3E1B0E] lg:flex">
            <Link
              to="/"
              className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              INÍCIO
            </Link>
            <Link
              to="/Kits"
              className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              KITS
            </Link>
            <Link
              to="/Materiais"
              className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              MATERIAIS
            </Link>
            <Link
              to="/Clube"
              className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              CLUBE DA CAIXINHA
            </Link>
            <Link
              to="/NossaHistoria"
              className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              NOSSA HISTÓRIA
            </Link>
            <Link
              to="/Contato"
              className="whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              FALE COM A GENTE
            </Link>
          </nav>

          {/* BOTÕES DE AÇÃO (PESQUISAR, CARRINHO, CONTA) */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-[#D8C2B0] px-4 py-1.5 text-xs text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD]"
            >
              <Search className="h-4 w-4 stroke-[1.75]" />
              <span>PESQUISAR</span>
            </button>

            <Link
              to="/Carrinho"
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

      {/* 3. FAIXA PROMOCIONAL ROSA (NOVA) */}
      <div className="w-full bg-[#F7C6E5] py-2 px-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-around gap-4 text-xs font-normal tracking-wide text-[#3E1B0E]">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 stroke-[1.75]" />
            <span>ENVIO PARA TODO BRASIL</span>
          </div>

          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 stroke-[1.75]" />
            <span>5% OFF NO PIX</span>
          </div>

          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 stroke-[1.75]" />
            <span>ATÉ 3X SEM JUROS</span>
          </div>
        </div>
      </div>
    </header>
  );
}
