import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

const formatarPreco = (valor) => {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return "R$ 0,00";
  return `R$ ${(numero / 100).toFixed(2).replace(".", ",")}`;
};

export default function DetalheProd() {
  const { slug } = useParams();
  const [produto, setProduto] = useState(null);
  const [quantidade, setQuantidade] = useState(1);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    const carregarProduto = async () => {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch(`/api/produto/${slug}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.erro || "Produto não encontrado.");
        }

        setProduto(dados.produto);
      } catch (error) {
        setErro(error.message || "Não foi possível carregar o produto.");
      } finally {
        setCarregando(false);
      }
    };

    if (slug) {
      carregarProduto();
    }
  }, [slug]);

  const alterarQuantidade = (delta) => {
    setQuantidade((prev) => Math.max(1, prev + delta));
  };

  const kitInfo = useMemo(() => {
    if (!produto || produto.tipo !== "kit") return null;

    const descricao = Array.isArray(produto.kit?.descricao)
      ? produto.kit.descricao
      : [];

    return {
      nome: produto.nome,
      subtitulo: `${produto.kit?.nivel || "Iniciante"} · ${produto.kit?.faixaEtaria || "A partir de 7 anos"} · ${produto.kit?.tempoEstimado || "Cerca de 4 horas"}`,
      chamada: produto.kit?.nomeChamada || "Kit Mini Stitches",
      precoPix: formatarPreco(produto.preco - 3000),
      precoNormal: formatarPreco(produto.preco),
      precoAntigo: formatarPreco(produto.preco + 3000),
      parcelamento: "ou 3x de R$ 43,30 sem juros",
      descricao1:
        descricao[0] ||
        "Um kit completo para criar com calma, passo a passo e muito prazer.",
      descricao2:
        descricao[1] ||
        "É uma experiência simples, encantadora e feita para dar vida a uma peça única.",
      itensCaixa: Array.isArray(produto.kit?.caixa) ? produto.kit.caixa : [],
      aulas: Array.isArray(produto.kit?.videos)
        ? produto.kit.videos
            .filter((video) => video?.ativo !== false)
            .map((video) => ({
              titulo: video.titulo || "Aula do kit",
              duracao: "Vídeo",
              gratis: true,
              url: video.url,
            }))
        : [],
    };
  }, [produto]);

  if (carregando) {
    return <div className="w-full p-10 text-center">Carregando produto...</div>;
  }

  if (erro) {
    return <div className="w-full p-10 text-center text-red-600">{erro}</div>;
  }

  if (!produto) {
    return null;
  }

  if (produto.tipo === "material") {
    return (
      <div className="w-full flex-1 bg-[#FEF8F0] py-8 px-4 md:px-12 font-['Work_Sans'] text-[#3E2417]">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <Link
              to="/materiais"
              className="inline-flex items-center text-sm font-bold text-[#3E2417] hover:opacity-80 transition-opacity"
            >
              ← Voltar para materiais
            </Link>
          </div>

          <div className="bg-white rounded-3xl border border-stone-300 p-8">
            <span className="text-xs font-semibold uppercase text-stone-600">
              {produto.material?.categoria || "Material"}
            </span>
            <h1 className="mt-3 text-3xl md:text-5xl font-['Archivo_Black'] text-[#3E2417] leading-tight">
              {produto.nome}
            </h1>

            <p className="mt-6 text-lg text-stone-700">
              {produto.material?.descricao ||
                "Material complementar para seus projetos."}
            </p>

            <div className="mt-8 flex items-baseline gap-3">
              <span className="text-3xl font-black text-[#602D15]">
                {formatarPreco(produto.preco)}
              </span>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex items-center border border-[#3E2417] rounded-full px-4 py-2 bg-white">
                <button
                  onClick={() => alterarQuantidade(-1)}
                  className="text-lg font-bold px-2 text-[#3E2417] hover:opacity-70"
                >
                  -
                </button>
                <span className="px-4 text-sm font-['Archivo_Black']">
                  {quantidade}
                </span>
                <button
                  onClick={() => alterarQuantidade(1)}
                  className="text-lg font-bold px-2 text-[#3E2417] hover:opacity-70"
                >
                  +
                </button>
              </div>

              <button className="flex-1 min-w-[200px] bg-[#3E2417] hover:bg-[#602D15] text-[#FEF8F0] py-3.5 px-6 rounded-full font-['Archivo_Black'] text-xs uppercase tracking-wider transition-colors cursor-pointer">
                ADICIONAR AO CARRINHO
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!kitInfo) {
    return null;
  }

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] py-8 px-4 md:px-12 font-['Work_Sans'] text-[#3E2417]">
      <div className="max-w-6xl mx-auto space-y-12">
        <div>
          <Link
            to="/kits"
            className="inline-flex items-center text-sm font-bold text-[#3E2417] hover:opacity-80 transition-opacity"
          >
            ← Voltar para os kits
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="w-full">
            <img
              src={produto.imagemUrl || "https://placehold.co/700x700"}
              alt={kitInfo.nome}
              className="w-full h-auto rounded-2xl border border-stone-300 object-cover shadow-sm"
            />
          </div>

          <div className="space-y-6">
            <span className="block text-xs font-semibold text-stone-600">
              {kitInfo.subtitulo}
            </span>

            <h1 className="text-3xl md:text-5xl font-['Archivo_Black'] text-[#3E2417] leading-tight">
              {kitInfo.nome}
            </h1>

            <p className="text-lg text-yellow-900 font-medium">
              {kitInfo.chamada}
            </p>

            <div className="space-y-1">
              <div className="flex items-baseline gap-3">
                <span className="text-3xl font-black text-[#602D15]">
                  {kitInfo.precoNormal}
                </span>
                <span className="text-sm text-stone-500 line-through">
                  {kitInfo.precoAntigo}
                </span>
              </div>
              <p className="text-xs text-stone-600">
                <strong className="text-[#3E2417]">{kitInfo.precoPix}</strong>{" "}
                no Pix · {kitInfo.parcelamento}
              </p>
            </div>

            <div className="space-y-3 text-sm text-stone-700 leading-relaxed border-t border-b border-orange-200/60 py-4">
              <p>{kitInfo.descricao1}</p>
              <p>{kitInfo.descricao2}</p>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center border border-[#3E2417] rounded-full px-4 py-2 bg-white">
                <button
                  onClick={() => alterarQuantidade(-1)}
                  className="text-lg font-bold px-2 text-[#3E2417] hover:opacity-70"
                >
                  -
                </button>
                <span className="px-4 text-sm font-['Archivo_Black']">
                  {quantidade}
                </span>
                <button
                  onClick={() => alterarQuantidade(1)}
                  className="text-lg font-bold px-2 text-[#3E2417] hover:opacity-70"
                >
                  +
                </button>
              </div>

              <button className="flex-1 min-w-[200px] bg-[#3E2417] hover:bg-[#602D15] text-[#FEF8F0] py-3.5 px-6 rounded-full font-['Archivo_Black'] text-xs uppercase tracking-wider transition-colors cursor-pointer">
                ADICIONAR AO CARRINHO
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-4">
            <h2 className="text-xl font-['Archivo_Black'] text-[#3E2417]">
              VÍDEOS PASSO A PASSO
            </h2>

            <div className="space-y-3">
              {kitInfo.aulas.length > 0 ? (
                kitInfo.aulas.map((aula, index) => (
                  <div
                    key={`${aula.titulo}-${index}`}
                    className="bg-yellow-100 p-4 rounded-2xl flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">▶</span>
                      <span className="text-sm font-medium text-yellow-900">
                        {aula.titulo}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-stone-600 font-medium">
                      {aula.gratis && (
                        <span className="bg-white px-2 py-0.5 rounded font-['Archivo_Black'] text-[#3E2417]">
                          Grátis
                        </span>
                      )}
                      <span>{aula.duracao}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-yellow-100 p-4 rounded-2xl text-sm text-stone-700">
                  Ainda não há vídeos cadastrados para este kit.
                </div>
              )}
            </div>

            <p className="text-xs text-stone-600 font-bold underline pt-2">
              <Link to="/login">
                Entre ou crie uma conta para ver todos os vídeos.
              </Link>
            </p>
          </div>

          <div className="bg-orange-200 p-8 rounded-[32px] space-y-4">
            <h2 className="text-2xl font-['Archivo_Black'] text-[#3E2417]">
              O QUE VEM NA CAIXA
            </h2>
            <ul className="space-y-3 text-sm text-stone-800 leading-relaxed">
              {kitInfo.itensCaixa.length > 0 ? (
                kitInfo.itensCaixa.map((item, index) => (
                  <li
                    key={`${item}-${index}`}
                    className="flex items-start gap-2"
                  >
                    <span className="text-[#3E2417] font-bold">•</span>
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="flex items-start gap-2">
                  <span className="text-[#3E2417] font-bold">•</span>
                  <span>Fios, agulha, materiais e instruções do kit.</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="space-y-6 pt-6 border-t border-orange-200/60">
          <h2 className="text-2xl md:text-3xl font-['Archivo_Black'] text-[#3E2417]">
            TAMBÉM VÃO GOSTAR
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                nome: "Bolsinha de Crochê",
                nivel: "Avançado · 7 a 10 anos",
                preco: "R$129,60",
              },
              {
                nome: "Mantinha da Boneca",
                nivel: "Iniciante · A partir de 7 anos",
                preco: "R$129,60",
              },
              {
                nome: "Guirlanda de Flores",
                nivel: "Iniciante · A partir de 7 anos",
                preco: "R$129,60",
              },
            ].map((prod, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl border border-stone-300 overflow-hidden flex flex-col justify-between"
              >
                <img
                  src="https://placehold.co/400x400"
                  alt={prod.nome}
                  className="w-full h-48 object-cover"
                />
                <div className="p-4 space-y-2">
                  <span className="text-[11px] font-semibold text-[#3E2417]">
                    {prod.nivel}
                  </span>
                  <h3 className="text-sm font-black text-black">{prod.nome}</h3>
                  <span className="text-sm font-black text-[#602D15] block">
                    {prod.preco}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
