import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { notificarAlteracaoCarrinho } from "../utils/resumoCheckout.mjs";

const formatarPreco = (valor) => {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return "R$ 0,00";
  return `R$ ${(numero / 100).toFixed(2).replace(".", ",")}`;
};

const extrairFaixa = (produto) => {
  const kit = produto?.kit || {};
  const faixa = kit.faixaEtaria || "A partir de 7 anos";
  const nivel = kit.nivel || "Iniciante";
  return `${nivel} · ${faixa}`;
};

function AdicionarKit({ kit }) {
  const [quantidade, setQuantidade] = useState("1");
  const [enviando, setEnviando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function adicionar(evento) {
    evento.preventDefault();
    const unidades = Number(quantidade);
    if (enviando || !Number.isSafeInteger(unidades) || unidades < 1) return;
    setEnviando(true);
    setMensagem("");
    try {
      const resposta = await fetch("/api/carrinho", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: kit.slug, quantidade: unidades }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.erro || "Não foi possível adicionar ao carrinho.");
      notificarAlteracaoCarrinho();
      setMensagem("Adicionado ao carrinho.");
    } catch (error) {
      setMensagem(error.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={adicionar} className="mt-5 grid gap-2">
      <label className="flex items-center justify-between gap-2 text-xs font-semibold">
        Quantidade
        <input type="number" inputMode="numeric" min="1" step="1" required
          value={quantidade} onChange={(evento) => setQuantidade(evento.target.value)}
          disabled={enviando} className="w-20 rounded border border-[#614233] px-2 py-1 text-center" />
      </label>
      <button type="submit" disabled={enviando}
        className="min-h-10 w-full rounded-full bg-[#602C16] px-3 py-2 font-['Archivo'] font-black text-[#FEF9F3] disabled:opacity-60">
        {enviando ? "Adicionando…" : "Adicionar ao carrinho"}
      </button>
      {mensagem && <p role="status" className="text-xs">{mensagem}</p>}
    </form>
  );
}

export default function Kits() {
  const [kits, setKits] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [filtroIdade, setFiltroIdade] = useState("TODAS");
  const [filtroDificuldade, setFiltroDificuldade] = useState("TODOS");

  useEffect(() => {
    const carregarKits = async () => {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch("/api/produtos?tipo=kit");
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.erro || "Erro ao carregar kits.");
        }

        setKits(dados.produtos || []);
      } catch (error) {
        setErro(error.message || "Não foi possível carregar os kits.");
      } finally {
        setCarregando(false);
      }
    };

    carregarKits();
  }, []);

  const kitsFiltrados = useMemo(() => {
    return kits.filter((kit) => {
      const idade = (kit.kit?.faixaEtaria || "").toUpperCase();
      const nivel = (kit.kit?.nivel || "").toUpperCase();

      const filtroIdadeOk =
        filtroIdade === "TODAS" ||
        idade.includes(filtroIdade.replace("A PARTIR DE ", "")) ||
        idade.includes(filtroIdade.replace("A PARTIR DE ", "A PARTIR DE "));

      const filtroDificuldadeOk =
        filtroDificuldade === "TODOS" || nivel === filtroDificuldade;

      return filtroIdadeOk && filtroDificuldadeOk;
    });
  }, [kits, filtroIdade, filtroDificuldade]);

  return (
    <div className="w-full flex-1 pb-16">
      {/* Banner Principal */}
      <div className="w-full bg-[#F6D1E7] py-12 px-6 text-center md:text-left md:px-16 mb-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-['Archivo'] text-[#422518] mb-4">
            TODOS OS KITS
          </h1>
          <p className="text-sm md:text-base font-['Archivo'] text-[#422518] max-w-2xl leading-relaxed">
            Escolha pela idade e pelo tanto de desafio. Todos chegam com fio,
            agulha e um guia ilustrado para acompanhar sem correria.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
        {/* Seção de Filtros */}
        <div className="flex flex-col gap-6 mb-8">
          <div>
            <span className="block text-xs font-['Archivo'] tracking-widest uppercase mb-3">
              IDADE
            </span>
            <div className="flex flex-wrap gap-2">
              {["TODAS", "A PARTIR DE 4 ANOS", "A PARTIR DE 7 ANOS"].map(
                (item) => (
                  <button
                    key={item}
                    onClick={() => setFiltroIdade(item)}
                    className={`px-6 py-2.5 rounded-full text-xs md:text-sm font-['Archivo'] border border-[#422518] transition-all ${
                      filtroIdade === item
                        ? "bg-[#422518] text-[#FEF9F3]"
                        : "bg-transparent text-[#422518]"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
          </div>

          <div>
            <span className="block text-xs font-['Archivo'] tracking-widest uppercase mb-3">
              DIFICULDADE
            </span>
            <div className="flex flex-wrap gap-2">
              {["TODOS", "INICIANTE", "INTERMEDIÁRIO", "AVANÇADO"].map(
                (item) => (
                  <button
                    key={item}
                    onClick={() => setFiltroDificuldade(item)}
                    className={`px-6 py-2.5 rounded-full text-xs md:text-sm font-['Archivo'] border border-[#422518] transition-all ${
                      filtroDificuldade === item
                        ? "bg-[#422518] text-[#FEF9F3]"
                        : "bg-transparent text-[#422518]"
                    }`}
                  >
                    {item}
                  </button>
                ),
              )}
            </div>
          </div>
        </div>

        {carregando ? (
          <p className="text-stone-600">Carregando kits...</p>
        ) : erro ? (
          <p className="text-red-600">{erro}</p>
        ) : (
          <>
            <p className="text-sm font-['Archivo'] text-[#602C16] mb-6">
              {kitsFiltrados.length} kits encontrados
            </p>

            {/* Grid de Produtos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {kitsFiltrados.map((kit) => (
                <article
                  key={kit._id}
                  className="flex flex-col overflow-hidden rounded-[15px] border border-[#e1d5c8] bg-white transition-shadow hover:shadow-lg"
                >
                  <Link to={`/produto/${kit.slug}`} className="block grow">
                  <img
                    src={kit.imagemUrl || "https://placehold.co/400x400"}
                    alt={kit.nome}
                    className="aspect-square w-full object-cover"
                  />
                  <div className="flex flex-col gap-1 px-[10px] pt-5">
                    <span className="text-xs font-semibold text-[#422518]">
                      {extrairFaixa(kit)}
                    </span>
                    <h3 className="font-sans text-base leading-normal font-black text-black">
                      {kit.nome}
                    </h3>
                    <p className="text-xs text-[#602C16] leading-relaxed">
                      {Array.isArray(kit.kit?.descricao)
                        ? kit.kit.descricao[0]
                        : kit.kit?.nomeChamada || "Kit Mini Stitches"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-baseline gap-3">
                      <span className="text-base font-black text-[#602C16]">
                        {formatarPreco(kit.preco)}
                      </span>
                      <span className="text-[13px] text-[#614233] line-through">
                        {formatarPreco(kit.preco + 3000)}
                      </span>
                    </div>
                  </div>
                  </Link>
                  <div className="px-[10px] pb-7">
                    <AdicionarKit kit={kit} />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
