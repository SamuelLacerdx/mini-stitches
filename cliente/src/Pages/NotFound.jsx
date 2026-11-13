import { Link, useSearchParams } from "react-router-dom";
import { SearchX } from "lucide-react";

export default function NotFound({ termoBusca }) {
  const [searchParams] = useSearchParams();
  // Prioriza a prop termoBusca; se não houver, tenta ler "?q=" da URL
  const termo = termoBusca ?? searchParams.get("q");

  return (
    <main className="flex min-h-[75vh] w-full flex-col items-center justify-center bg-[#FAF5EF] px-4 py-20 text-center">
      <div className="flex max-w-xl flex-col items-center gap-5">
        {/* Ícone de Lupa com X */}
        <SearchX
          className="h-14 w-14 text-[#582B16]"
          strokeWidth={1.5}
          aria-hidden="true"
        />

        {/* Eyebrow */}
        <span className="font-['Archivo_Black',sans-serif] text-xs uppercase tracking-[4px] text-[#582B16] sm:text-sm">
          ERRO 404
        </span>

        {/* Título Principal */}
        <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase leading-none text-[#3E1B0E] sm:text-6xl md:text-7xl">
          NADA POR AQUI
        </h1>

        {/* Mensagem Dinâmica */}
        <p className="max-w-md font-['Work_Sans',sans-serif] text-base leading-relaxed text-[#3E1B0E]/75 sm:text-lg">
          {termo ? (
            <>
              Não encontramos nenhum kit ou material com &ldquo;{termo}&rdquo;.
              Confira a escrita ou tente outra palavra.
            </>
          ) : (
            <>
              A página que você está procurando não existe ou foi movida. Que
              tal explorar nossos kits e materiais?
            </>
          )}
        </p>

        {/* Botões de Ação */}
        <div className="mt-4 flex w-full flex-col items-center justify-center gap-4 sm:w-auto sm:flex-row">
          <Link
            to="/kits"
            className="w-full rounded-full bg-[#582B16] px-8 py-4 font-['Archivo_Black',sans-serif] text-sm uppercase tracking-wide text-[#FAF5EF] transition-transform hover:scale-105 hover:bg-[#3E1B0E] sm:w-52"
          >
            VER OS KITS
          </Link>

          <Link
            to="/materiais"
            className="w-full rounded-full border-2 border-[#3E1B0E] bg-transparent px-8 py-4 font-['Archivo_Black',sans-serif] text-sm uppercase tracking-wide text-[#3E1B0E] transition-colors hover:bg-[#3E1B0E] hover:text-[#FAF5EF] sm:w-52"
          >
            VER MATERIAIS
          </Link>
        </div>
      </div>
    </main>
  );
}