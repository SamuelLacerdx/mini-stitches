import { Link } from 'react-router-dom';
import { Calendar } from 'lucide-react';

export default function CriarConta() {
  return (
    <div className="min-h-screen w-full bg-[#FEF8F0] px-4 py-12 font-['Work_Sans',sans-serif] text-[#3E2417]">
      <div className="mx-auto flex w-full max-w-141.5 flex-col items-center gap-4">
        
        {/* TÍTULO E SUBTÍTULO */}
        <h1 className="text-center font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E2417] sm:text-4xl">
          CRIAR CONTA
        </h1>
        
        <p className="max-w-md text-center text-sm leading-relaxed text-[#3E2417]">
          Com uma conta você acompanha pedidos, assiste a todos os tutoriais e assina o Clube. Para comprar, não precisa de cadastro.
        </p>

        {/* FORMULÁRIO DE REGISTO */}
        <form action="/cadastro" method="POST" className="mt-2 flex w-full flex-col gap-4">
          
          {/* Nome Completo */}
          <div className="w-full">
            <input
              type="text"
              name="nome"
              required
              placeholder="Nome completo"
              className="h-11 w-full rounded-md border border-stone-400 bg-white px-3.5 text-sm text-stone-800 placeholder-stone-400 focus:border-[#3E2417] focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
            />
          </div>

          {/* CPF e Celular (Lado a lado em ecrãs maiores) */}
          <div className="flex w-full flex-col gap-3 sm:flex-row">
            <input
              type="text"
                name="cpf"
              required
              placeholder="CPF"
              className="h-11 w-full rounded-md border border-stone-400 bg-white px-3.5 text-sm text-stone-800 placeholder-stone-400 focus:border-[#3E2417] focus:outline-none focus:ring-1 focus:ring-[#3E2417] sm:w-1/2"
            />
            <input
              type="tel"
              name="telefone"
              required
              placeholder="Celular"
              className="h-11 w-full rounded-md border border-stone-400 bg-white px-3.5 text-sm text-stone-800 placeholder-stone-400 focus:border-[#3E2417] focus:outline-none focus:ring-1 focus:ring-[#3E2417] sm:w-1/2"
            />
          </div>

          {/* Data de Nascimento */}
          <div className="flex w-full flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#3E2417]">
              Data de nascimento
            </label>
            <div className="relative flex items-center">
              <input
                type="date"
                name="nascimento"
                required
                placeholder="dd/mm/aaaa"
                className="h-11 w-full rounded-md border border-stone-400 bg-white px-3.5 text-sm text-stone-800 placeholder-stone-400 focus:border-[#3E2417] focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
              />
              <Calendar className="pointer-events-none absolute right-3.5 h-4 w-4 text-stone-400" />
            </div>
          </div>

          {/* E-mail */}
          <div className="w-full">
            <input
              type="email"
              name="email"
              required
              placeholder="Seu e-mail"
              className="h-11 w-full rounded-md border border-stone-400 bg-white px-3.5 text-sm text-stone-800 placeholder-stone-400 focus:border-[#3E2417] focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
            />
          </div>

          {/* Senha */}
          <div className="w-full">
            <input
              type="password"
              name="senha"
              required
              minLength={8}
              placeholder="Senha"
              className="h-11 w-full rounded-md border border-stone-400 bg-white px-3.5 text-sm text-stone-800 placeholder-stone-400 focus:border-[#3E2417] focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
            />
          </div>

          {/* Repita a Senha */}
          <div className="w-full">
            <input
              type="password"
              name="repitaSenha"
              required
              minLength={8}
              placeholder="Repita a senha"
              className="h-11 w-full rounded-md border border-stone-400 bg-white px-3.5 text-sm text-stone-800 placeholder-stone-400 focus:border-[#3E2417] focus:outline-none focus:ring-1 focus:ring-[#3E2417]"
            />
          </div>

          {/* Nota Explicativa */}
          <p className="text-xs text-stone-500">
            Endereço e cartões você cadastra depois, em &quot;Minha conta&quot;.
          </p>

          {/* BOTÃO PRINCIPAL: CRIAR CONTA */}
          <button
            type="submit"
            className="mt-2 h-12 w-full rounded-3xl bg-[#3E2417] font-['Archivo_Black',sans-serif] text-base text-white transition-colors hover:bg-[#602D15]"
          >
            CRIAR CONTA
          </button>

          {/* LINK PARA LOGIN */}
          <div className="mt-2 text-center">
            <Link
              to="/login"
              className="text-sm font-normal text-[#3E2417] underline transition-colors hover:text-amber-900"
            >
              Já tem conta? Entrar
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}