import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const formatarPreco = (valor) => {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return "R$ 0,00";
  return `R$ ${(numero / 100).toFixed(2).replace(".", ",")}`;
};

export default function Materiais() {
  const [materiais, setMateriais] = useState([]);
  const [quantidades, setQuantidades] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [adicionandoId, setAdicionandoId] = useState(null);
  const [mensagens, setMensagens] = useState({});

  useEffect(() => {
    const carregarMateriais = async () => {
      try {
        setCarregando(true);
        setErro("");

        const resposta = await fetch("/api/produtos?tipo=material");
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.erro || "Erro ao carregar materiais.");
        }

        setMateriais(dados.produtos || []);
      } catch (error) {
        setErro(error.message || "Não foi possível carregar os materiais.");
      } finally {
        setCarregando(false);
      }
    };

    carregarMateriais();
  }, []);

  const alterarQuantidade = (id, delta) => {
    setQuantidades((prev) => {
      const atual = prev[id] || 1;
      const novoValor = Math.max(1, atual + delta);
      return { ...prev, [id]: novoValor };
    });
  };

  const adicionarAoCarrinho = async (item) => {
    const quantidade = quantidades[item._id] || 1;

    try {
      setAdicionandoId(item._id);
      setMensagens((prev) => ({ ...prev, [item._id]: null }));

      const resposta = await fetch("/api/carrinho", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: item.slug, quantidade }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível adicionar ao carrinho.");
      }

      setMensagens((prev) => ({
        ...prev,
        [item._id]: {
          texto: `${item.nome} foi adicionado ao carrinho.`,
          sucesso: true,
        },
      }));
    } catch (error) {
      setMensagens((prev) => ({
        ...prev,
        [item._id]: {
          texto: error.message || "Não foi possível adicionar ao carrinho.",
          sucesso: false,
        },
      }));
    } finally {
      setAdicionandoId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full">
      <h1 className="text-4xl md:text-6xl font-['Archivo_Black'] text-[#3E2417] mb-4">
        MATERIAIS
      </h1>
      <p className="text-[#3E2417] text-sm md:text-base font-['Archivo_Black'] max-w-3xl leading-relaxed mb-8">
        Fios, agulhas e acessórios dos mesmos fornecedores dos nossos kits.
        Perfeitos para repor o que acabou ou continuar criando.
      </p>

      {carregando ? (
        <p className="text-stone-600">Carregando materiais...</p>
      ) : erro ? (
        <p className="text-red-600">{erro}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {materiais.map((item) => (
            <div
              key={item._id}
              className="bg-white p-6 rounded-xl border border-stone-300 flex flex-col justify-between"
            >
              <div>
                <span className="text-xs font-semibold text-[#3E2417] block mb-1">
                  {item.material?.categoria || "ACESSÓRIOS"}
                </span>
                <h3 className="text-base font-black text-[#602D15] mb-2">
                  {item.nome}
                </h3>
                <p className="text-xs text-[#602D15] mb-4">
                  {item.material?.descricao ||
                    "Material complementar para seus kits."}
                </p>
                <span className="text-lg font-black text-[#602D15] block mb-4">
                  {formatarPreco(item.preco)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center border border-[#3E2417] rounded-full px-3 py-1">
                  <button
                    onClick={() => alterarQuantidade(item._id, -1)}
                    className="text-lg font-bold px-1 text-[#3E2417]"
                  >
                    -
                  </button>
                  <span className="px-3 text-xs font-['Archivo_Black']">
                    {quantidades[item._id] || 1}
                  </span>
                  <button
                    onClick={() => alterarQuantidade(item._id, 1)}
                    className="text-lg font-bold px-1 text-[#3E2417]"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => adicionarAoCarrinho(item)}
                  disabled={adicionandoId === item._id}
                  className="flex-1 bg-[#3E2417] text-white py-2 px-4 rounded-full text-xs font-['Archivo_Black'] hover:bg-[#602D15] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {adicionandoId === item._id ? "ADICIONANDO..." : "ADICIONAR"}
                </button>
              </div>
              {mensagens[item._id] && (
                <p
                  role="status"
                  className={`mt-3 text-xs ${
                    mensagens[item._id].sucesso ? "text-[#3E2417]" : "text-red-600"
                  }`}
                >
                  {mensagens[item._id].texto}{" "}
                  {mensagens[item._id].sucesso && (
                    <Link to="/carrinho" className="font-bold underline">
                      Ver carrinho
                    </Link>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
