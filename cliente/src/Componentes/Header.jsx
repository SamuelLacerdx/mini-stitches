import { useEffect, useState, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import logoMarca from "../assets/logo.svg";
import { useCarrinho } from '../context/CarrinhoContext';
import { useSessao } from '../context/SessaoContext';
import {
  Search,
  ShoppingBag,
  User,
  Truck,
  Zap,
  CreditCard,
  X,
  Menu,
} from "lucide-react";

export default function Header() {
  const { abrir, aberto } = useCarrinho();
  const { usuario } = useSessao();
  const [termoBusca, setTermoBusca] = useState("");
  // Guardam a rota em que foram abertos: ao trocar de página fecham sozinhos,
  // sem efeito nem nova chamada à API.
  const [buscaRota, setBuscaRota] = useState(null);
  const [menuRota, setMenuRota] = useState(null);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const buscaAberta = buscaRota === location.pathname;
  const menuAberto = menuRota === location.pathname;

  // Foco automático ao abrir a busca
  useEffect(() => {
    if (buscaAberta && inputRef.current) {
      inputRef.current.focus();
    }
  }, [buscaAberta]);

  return (
    <header className="w-full font-['Archivo_Black',sans-serif]">
      {/* 1. FAIXA SUPERIOR ESCURA */}
      <div className="h-7 w-full bg-[#4E2206]" />

      {/* 2. BARRA DE NAVEGAÇÃO PRINCIPAL */}
      <div className="w-full border-b border-amber-100/50 bg-[#FAF5EF] px-4 py-3 md:px-8">
        <div className="mx-auto flex max-w-full items-center justify-between gap-4">
          {/* LOGÓTIPO */}
          <div className="flex shrink-0 items-center">
            <Link to="/" className="flex cursor-pointer items-center gap-2">
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
              className="cursor-pointer whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              INÍCIO
            </Link>
            <Link
              to="/kits"
              className="cursor-pointer whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              KITS
            </Link>
            <Link
              to="/materiais"
              className="cursor-pointer whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              MATERIAIS
            </Link>
            <Link
              to="/clube"
              className="cursor-pointer whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              CLUBE DA CAIXINHA
            </Link>
            <Link
              to="/nossa-historia"
              className="cursor-pointer whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              NOSSA HISTÓRIA
            </Link>
            <Link
              to="/contato"
              className="cursor-pointer whitespace-nowrap uppercase transition-colors duration-200 hover:text-amber-800"
            >
              FALE COM A GENTE
            </Link>
          </nav>

          {/* BOTÕES DE AÇÃO (PESQUISAR, CARRINHO, CONTA, MENU) */}
          <div className="relative flex items-center gap-2 lg:gap-3">
            {/* Wrapper relativo para conter o formulário absoluto sem quebrar o flex */}
            <div className="relative flex items-center">
              {/* Botão de Pesquisar (visível quando fechado) */}
              <button
                type="button"
                onClick={() => setBuscaRota(location.pathname)}
                className={`flex cursor-pointer items-center gap-2 rounded-full border border-[#D8C2B0] px-4 py-1.5 text-xs text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD] ${
                  buscaAberta ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
              >
                <Search className="h-4 w-4 shrink-0 stroke-[1.75]" />
                <span className="hidden sm:inline">PESQUISAR</span>
              </button>

              {/* Formulário de Busca (absoluto para não alterar o fluxo do header) */}
              {buscaAberta && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const q = termoBusca.trim();
                    if (!q) return;
                    setBuscaRota(null);
                    setTermoBusca("");
                    navigate(`/busca?q=${encodeURIComponent(q)}`);
                  }}
                  className="absolute right-0 z-20 flex items-center gap-2 rounded-full border border-[#D8C2B0] bg-[#FAF5EF] px-3 py-1.5 text-xs text-[#3E1B0E] shadow-sm sm:w-64"
                >
                  <Search className="h-4 w-4 shrink-0 stroke-[1.75]" />
                  <input
                    ref={inputRef}
                    value={termoBusca}
                    onChange={(e) => setTermoBusca(e.target.value)}
                    placeholder="Buscar produtos..."
                    className="w-full bg-transparent outline-none placeholder:text-[#3E1B0E]/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setBuscaRota(null);
                      setTermoBusca("");
                    }}
                    className="cursor-pointer rounded-full p-1 hover:bg-[#F2E8DD]"
                  >
                    <X className="h-4 w-4 shrink-0 stroke-[1.75]" />
                  </button>
                </form>
              )}
            </div>

            <button
              type="button"
              onClick={abrir}
              aria-label="Abrir carrinho"
              aria-haspopup="dialog"
              aria-expanded={aberto}
              aria-controls="carrinho-lateral"
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[#D8C2B0] px-4 py-1.5 text-xs text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD]"
            >
              <ShoppingBag className="h-4 w-4 shrink-0 stroke-[1.75]" />
              <span className="hidden sm:inline">CARRINHO</span>
            </button>

            <Link
              to={
                usuario
                  ? usuario.perfil === "admin"
                    ? "/admin"
                    : "/perfil"
                  : "/login"
              }
              className="flex cursor-pointer items-center gap-2 rounded-full border border-[#D8C2B0] px-4 py-1.5 text-xs text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD]"
            >
              <User className="h-4 w-4 shrink-0 stroke-[1.75]" />
              <span className="hidden max-w-[100px] truncate sm:inline">{usuario?.nome || "CONTA"}</span>
            </Link>

            {/* HAMBURGER – mobile only */}
            <button
              type="button"
              onClick={() => setMenuRota(location.pathname)}
              className="flex cursor-pointer items-center rounded-full border border-[#D8C2B0] p-1.5 text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD] lg:hidden"
            >
              <Menu className="h-5 w-5 stroke-[1.75]" />
            </button>
          </div>
        </div>
      </div>

      {/* MENU LATERAL MOBILE */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          onClick={() => setMenuRota(null)}
        >
          {/* overlay */}
          <div className="absolute inset-0 bg-black/40" />

          {/* drawer */}
          <nav
            className="absolute right-0 top-0 flex h-full w-64 flex-col gap-1 bg-[#FAF5EF] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setMenuRota(null)}
              className="mb-4 self-end cursor-pointer rounded-full p-1 hover:bg-[#F2E8DD]"
            >
              <X className="h-5 w-5 stroke-[1.75] text-[#3E1B0E]" />
            </button>

            {[
              { to: "/", label: "INÍCIO" },
              { to: "/kits", label: "KITS" },
              { to: "/materiais", label: "MATERIAIS" },
              { to: "/clube", label: "CLUBE DA CAIXINHA" },
              { to: "/nossa-historia", label: "NOSSA HISTÓRIA" },
              { to: "/contato", label: "FALE COM A GENTE" },
            ].map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMenuRota(null)}
                className="rounded-lg px-3 py-2.5 text-sm tracking-wide text-[#3E1B0E] transition-colors hover:bg-[#F2E8DD]"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* 3. FAIXA PROMOCIONAL ROSA */}
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
