import { useEffect, useState } from "react";

const formatarPreco = (valorEmCentavos) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(valorEmCentavos || 0) / 100);

export default function Carrinho() {
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let ativo = true;

    fetch("/api/carrinho", { credentials: "include" })
      .then(async (resposta) => {
        const dados = await resposta.json();
        if (!resposta.ok) {
          throw new Error(dados.erro || "Não foi possível carregar o carrinho.");
        }
        return dados;
      })
      .then((dados) => {
        if (ativo) {
          setItens(dados.itens || []);
        }
      })
      .catch((error) => {
        if (ativo) {
          setErro(error.message || "Não foi possível carregar o carrinho.");
        }
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  const alterarCarrinho = async (produtoId, metodo, quantidade) => {
    try {
      setSalvando(true);
      setErro("");

      const resposta = await fetch(`/api/carrinho/${produtoId}`, {
        method: metodo,
        credentials: "include",
        headers: metodo === "PATCH" ? { "Content-Type": "application/json" } : {},
        body: metodo === "PATCH" ? JSON.stringify({ quantidade }) : undefined,
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível atualizar o carrinho.");
      }

      setItens(dados.itens || []);
    } catch (error) {
      setErro(error.message || "Não foi possível atualizar o carrinho.");
    } finally {
      setSalvando(false);
    }
  };

  const subtotal = itens.reduce(
    (total, item) => total + item.preco * item.quantidade,
    0,
  );
  const pixTotal = Math.round(subtotal * 0.95);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full flex flex-col lg:flex-row gap-12">
      <div className="flex-1">
        <h1 className="text-4xl font-['Archivo_Black'] text-[#3E2417] mb-6">
          MEU CARRINHO
        </h1>
        <div className="border-b-2 border-orange-400/70 mb-4" />

        {erro && (
          <p role="alert" className="my-4 rounded-lg bg-red-50 p-3 text-red-700">
            {erro}
          </p>
        )}

        {carregando ? (
          <p className="text-stone-500 my-8">Carregando carrinho...</p>
        ) : itens.length === 0 ? (
          <p className="text-stone-500 my-8">Seu carrinho está vazio.</p>
        ) : (
          itens.map((item) => (
            <div
              key={item.produtoId}
              className="py-4 border-b border-orange-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4">
                {item.imagemUrl && (
                  <img
                    src={item.imagemUrl}
                    alt=""
                    className="h-16 w-16 rounded-lg border border-stone-200 object-cover"
                  />
                )}
                <div>
                  <h3 className="font-['Archivo_Black'] text-base text-[#3E2417]">
                    {item.nome}
                  </h3>
                  <span className="text-xs text-stone-500">{item.tipo}</span>
                  {!item.ativo && (
                    <p className="text-xs text-red-600">
                      Este produto não está mais disponível.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center border border-orange-400 rounded-lg">
                  <button
                    type="button"
                    disabled={salvando || item.quantidade <= 1}
                    onClick={() =>
                      alterarCarrinho(
                        item.produtoId,
                        "PATCH",
                        item.quantidade - 1,
                      )
                    }
                    aria-label={`Diminuir quantidade de ${item.nome}`}
                    className="px-3 py-1 font-['Archivo_Black'] text-[#3E2417] disabled:opacity-40"
                  >
                    -
                  </button>
                  <span className="px-3 text-sm font-['Archivo_Black']">
                    {item.quantidade}
                  </span>
                  <button
                    type="button"
                    disabled={salvando}
                    onClick={() =>
                      alterarCarrinho(
                        item.produtoId,
                        "PATCH",
                        item.quantidade + 1,
                      )
                    }
                    aria-label={`Aumentar quantidade de ${item.nome}`}
                    className="px-3 py-1 font-['Archivo_Black'] text-[#3E2417] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <span className="font-['Archivo_Black'] text-base text-[#3E2417]">
                  {formatarPreco(item.preco * item.quantidade)}
                </span>

                <button
                  type="button"
                  disabled={salvando}
                  onClick={() =>
                    alterarCarrinho(item.produtoId, "DELETE")
                  }
                  aria-label={`Remover ${item.nome} do carrinho`}
                  className="text-red-600 font-bold hover:opacity-80 disabled:opacity-40"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="w-full lg:w-96 bg-[#FBE6A8] p-6 rounded-xl flex flex-col gap-4 h-fit">
        <h2 className="text-xl font-['Archivo_Black'] text-[#3E2417]">
          RESUMO
        </h2>
        <div className="border-b border-orange-400/50" />

        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatarPreco(subtotal)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span>Frete</span>
          <span>Calculado no checkout</span>
        </div>

        <div className="border-b border-orange-400/50" />

        <div className="flex justify-between font-['Archivo_Black'] text-base">
          <span>No Pix (5% off)</span>
          <span>{formatarPreco(pixTotal)}</span>
        </div>

        <button
          type="button"
          disabled={itens.length === 0 || carregando}
          className="w-full bg-[#3E2417] hover:bg-[#602D15] disabled:opacity-50 text-white py-4 rounded-lg font-['Archivo_Black'] text-base transition-colors mt-2"
        >
          FINALIZAR COMPRA
        </button>
      </div>
    </div>
  );
}
