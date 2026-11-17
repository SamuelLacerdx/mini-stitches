import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import NotFound from "./NotFound";

const formatarPreco = (valor) => {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return "R$ 0,00";
  return `R$ ${(numero / 100).toFixed(2).replace(".", ",")}`;
};

export default function Busca() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get("q") || "";
  const [resultado, setResultado] = useState({ termo: null, produtos: [] });
  const produtos = resultado.termo === q ? resultado.produtos : [];
  const carregando = Boolean(q.trim() && resultado.termo !== q);

  useEffect(() => {
    if (!q.trim()) return;
    const controle = new AbortController();
    let ativo = true;
    Promise.all([
      fetch("/api/produtos?tipo=kit", { signal: controle.signal }).then((r) => {
        if (!r.ok) throw new Error('Consulta indisponível.');
        return r.json();
      }),
      fetch("/api/produtos?tipo=material", { signal: controle.signal }).then((r) => {
        if (!r.ok) throw new Error('Consulta indisponível.');
        return r.json();
      }),
    ])
      .then(([kits, materiais]) => {
        const todos = [
          ...(kits.produtos || []),
          ...(materiais.produtos || []),
        ];
        const termo = q.toLowerCase();
        if (ativo) setResultado({ termo: q, produtos: todos.filter((p) => p.nome?.toLowerCase().includes(termo)) });
      })
      .catch(() => { if (ativo) setResultado({ termo: q, produtos: [] }); });
    return () => { ativo = false; controle.abort(); };
  }, [q]);

  if (!q.trim()) return <NotFound />;
  if (carregando)
    return (
      <div className="flex min-h-[60vh] w-full items-center justify-center">
        <p className="text-stone-600">Buscando...</p>
      </div>
    );
  if (produtos.length === 0) return <NotFound termoBusca={q} />;

  return (
    <div className="mx-auto w-full max-w-7xl px-6 py-12">
      <h1 className="mb-2 font-['Archivo'] text-3xl text-[#422518]">
        RESULTADOS
      </h1>
      <p className="mb-8 text-sm text-[#422518]/70">
        {produtos.length} resultado{produtos.length !== 1 && "s"} para &ldquo;{q}&rdquo;
      </p>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {produtos.map((p) => (
          <Link
            key={p._id}
            to={`/produto/${p.slug}`}
            className="flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-300 bg-white transition-shadow hover:shadow-lg"
          >
            {p.imagemUrl && (
              <img
                src={p.imagemUrl}
                alt={p.nome}
                className="h-64 w-full object-cover"
              />
            )}
            <div className="flex flex-col gap-2 p-6">
              <h3 className="text-lg font-black text-black">{p.nome}</h3>
              <span className="text-lg font-black text-[#602C16]">
                {formatarPreco(p.preco)}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
