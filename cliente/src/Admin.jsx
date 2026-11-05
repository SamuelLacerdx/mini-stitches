import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const criarVideoPadrao = () => ({
  titulo: "",
  url: "",
  ordem: 1,
  ativo: true,
});

const estadoInicial = {
  tipo: "kit",
  nome: "",
  slug: "",
  nomeChamada: "",
  nivel: "",
  faixaEtaria: "",
  tempoEstimado: "",
  descricao: "",
  caixa: "",
  preco: "",
  estoque: "",
  imagemUrl: "",
  materialDescricao: "",
  materialCategoria: "geral",
  destaque: false,
  ativo: true,
  videos: [criarVideoPadrao(), criarVideoPadrao()],
};

const normalizarVideosDoKit = (videos) => {
  const lista = Array.isArray(videos) ? videos : [];

  return lista.map((video, index) => ({
    titulo: String(video?.titulo || video?.videoTitulo || "").trim(),
    url: String(video?.url || video?.videoUrl || "").trim(),
    ordem: Number(video?.ordem ?? index + 1),
    ativo: video?.ativo ?? true,
  }));
};

const garantirVideosDoKit = (videos) => {
  const lista = Array.isArray(videos) ? videos : [];

  if (lista.length >= 2) {
    return lista.map((video, index) => ({
      titulo: String(video?.titulo || "").trim(),
      url: String(video?.url || "").trim(),
      ordem: Number(video?.ordem ?? index + 1),
      ativo: video?.ativo ?? true,
    }));
  }

  const preenchidos = lista.length ? lista : [];
  const extras = Array.from({ length: 2 - preenchidos.length }, (_, index) => ({
    ...criarVideoPadrao(),
    ordem: preenchidos.length + index + 1,
  }));

  return [...preenchidos, ...extras];
};

export default function Admin() {
  const navigate = useNavigate();
  const [abaAtiva, setAbaAtiva] = useState("VISÃO GERAL");
  const [mostrarCadastro, setMostrarCadastro] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(estadoInicial);
  const [itens, setItens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [produtoAbertoId, setProdutoAbertoId] = useState(null);

  const sair = async () => {
    try {
      const resposta = await fetch("/sair", {
        method: "POST",
        credentials: "include",
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Não foi possível sair da conta.");
      }

      navigate("/");
    } catch (error) {
      window.alert(error.message || "Não foi possível sair da conta.");
    }
  };

  const abas = [
    "VISÃO GERAL",
    "ESTOQUE",
    "MATERIAIS",
    "PEDIDOS",
    "CLUBE",
    "TROCAS",
    "TUTORIAIS",
  ];

  const carregarItens = async () => {
    try {
      setCarregando(true);
      const resposta = await fetch("/admin/estoque", {
        credentials: "include",
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Erro ao carregar estoque.");
      }
      setItens(dados.produtos || []);
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: "erro", texto: error.message });
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (!["ESTOQUE", "MATERIAIS", "TUTORIAIS"].includes(abaAtiva)) return;

    let cancelado = false;

    const carregar = async () => {
      try {
        setCarregando(true);
        const resposta = await fetch("/admin/estoque", {
          credentials: "include",
        });
        const dados = await resposta.json();
        if (!resposta.ok) {
          throw new Error(dados.erro || "Erro ao carregar estoque.");
        }

        if (!cancelado) {
          setItens(dados.produtos || []);
        }
      } catch (error) {
        if (!cancelado) {
          console.error(error);
          setMensagem({ tipo: "erro", texto: error.message });
        }
      } finally {
        if (!cancelado) {
          setCarregando(false);
        }
      }
    };

    carregar();

    return () => {
      cancelado = true;
    };
  }, [abaAtiva]);

  const limparFormulario = () => {
    setForm(estadoInicial);
    setEditandoId(null);
    setMensagem({ tipo: "", texto: "" });
  };

  const abrirFormularioEdicao = (item) => {
    setEditandoId(item._id);
    setMostrarCadastro(true);
    setMensagem({ tipo: "", texto: "" });

    setForm({
      tipo: item.tipo || "kit",
      nome: item.nome || "",
      slug: item.slug || "",
      nomeChamada: item.kit?.nomeChamada || "",
      nivel: item.kit?.nivel || "",
      faixaEtaria: item.kit?.faixaEtaria || "",
      tempoEstimado: item.kit?.tempoEstimado || "",
      descricao: (item.kit?.descricao || []).join("\n") || "",
      caixa: (item.kit?.caixa || []).join("\n") || "",
      preco: String(item.preco ?? ""),
      estoque: String(item.estoque ?? ""),
      imagemUrl: item.imagemUrl || "",
      materialDescricao: item.material?.descricao || "",
      materialCategoria: item.material?.categoria || "geral",
      destaque: Boolean(item.kit?.destaque),
      ativo: Boolean(item.ativo),
      videos: garantirVideosDoKit(
        normalizarVideosDoKit(item.kit?.videos || item.kit?.tutoriais || []),
      ),
    });
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((anterior) => ({
      ...anterior,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleImagemChange = (event) => {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    if (arquivo.size > 6 * 1024 * 1024) {
      event.target.value = "";
      setMensagem({
        tipo: "erro",
        texto: "A imagem deve ter no máximo 6 MB.",
      });
      return;
    }

    setMensagem({ tipo: "", texto: "" });
    const leitor = new FileReader();
    leitor.onload = () => {
      setForm((anterior) => ({
        ...anterior,
        imagemUrl: String(leitor.result || ""),
      }));
    };
    leitor.readAsDataURL(arquivo);
  };

  const handleVideoChange = (index, campo, valor) => {
    setForm((anterior) => ({
      ...anterior,
      videos: (anterior.videos || []).map((video, videoIndex) =>
        videoIndex === index ? { ...video, [campo]: valor } : video,
      ),
    }));
  };

  const adicionarVideo = () => {
    setForm((anterior) => ({
      ...anterior,
      videos: [
        ...(anterior.videos || []),
        { ...criarVideoPadrao(), ordem: (anterior.videos || []).length + 1 },
      ],
    }));
  };

  const removerVideo = (index) => {
    setForm((anterior) => ({
      ...anterior,
      videos: (anterior.videos || [])
        .filter((_, videoIndex) => videoIndex !== index)
        .map((video, videoIndex) => ({ ...video, ordem: videoIndex + 1 })),
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMensagem({ tipo: "", texto: "" });

    try {
      const videosValidos = (form.videos || []).map((video) => ({
        titulo: String(video.titulo || "").trim(),
        url: String(video.url || "").trim(),
        ordem: Number(video.ordem || 1),
        ativo: Boolean(form.ativo),
      }));

      if (
        form.tipo === "kit" &&
        videosValidos.filter((video) => video.titulo && video.url).length < 2
      ) {
        throw new Error("O kit deve possuir pelo menos 2 vídeos cadastrados.");
      }

      const payload = {
        ...form,
        preco: Number(form.preco),
        estoque: Number(form.estoque),
        destaque: Boolean(form.destaque),
        ativo: Boolean(form.ativo),
        imagemUrl: form.imagemUrl || undefined,
        descricao: form.descricao
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        caixa: form.caixa
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        videos: videosValidos,
      };

      const metodo = editandoId ? "PATCH" : "POST";
      const url = editandoId
        ? `/admin/estoque/${editandoId}`
        : "/admin/estoque";

      const resposta = await fetch(url, {
        method: metodo,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!resposta.headers.get("content-type")?.includes("application/json")) {
        throw new Error(
          resposta.status === 413
            ? "A imagem é muito grande. Escolha uma imagem menor que 6 MB."
            : "O servidor retornou uma resposta inválida.",
        );
      }

      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Erro ao salvar item.");
      }

      limparFormulario();
      setMostrarCadastro(false);
      setMensagem({
        tipo: "sucesso",
        texto: editandoId
          ? "Item atualizado com sucesso!"
          : "Item cadastrado com sucesso!",
      });
      carregarItens();
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: "erro", texto: error.message });
    }
  };

  const handleExcluir = async (id) => {
    try {
      const resposta = await fetch(`/admin/estoque/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const dados = await resposta.json();
      if (!resposta.ok) {
        throw new Error(dados.erro || "Erro ao excluir item.");
      }
      setMensagem({ tipo: "sucesso", texto: "Item removido com sucesso." });
      if (produtoAbertoId === id) setProdutoAbertoId(null);
      carregarItens();
    } catch (error) {
      console.error(error);
      setMensagem({ tipo: "erro", texto: error.message });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 w-full">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl md:text-5xl font-['Archivo_Black'] text-[#3E2417]">
          PAINEL DA LOJA
        </h1>
        <button
          type="button"
          onClick={sair}
          className="text-amber-800 text-sm font-semibold underline hover:opacity-80"
        >
          Sair
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        {abas.map((aba) => (
          <button
            key={aba}
            onClick={() => setAbaAtiva(aba)}
            className={`px-5 py-2.5 rounded-full text-xs md:text-sm font-bold border transition-all ${
              abaAtiva === aba
                ? "bg-[#3E2417] text-white border-[#3E2417]"
                : "bg-white text-[#3E2417] border-stone-300"
            }`}
          >
            {aba}
          </button>
        ))}
      </div>

      <div className="bg-white p-6 md:p-8 rounded-2xl border border-stone-300">
        {abaAtiva === "VISÃO GERAL" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-xl border border-stone-200 bg-[#FEF8F0]">
              <span className="text-stone-500 font-bold text-sm">PEDIDOS</span>
              <p className="text-4xl font-bold text-[#602D15] mt-2">1</p>
            </div>
            <div className="p-6 rounded-xl border border-stone-200 bg-[#FEF8F0]">
              <span className="text-stone-500 font-bold text-sm">FATURADO</span>
              <p className="text-4xl font-bold text-[#602D15] mt-2">
                R$ 154,80
              </p>
            </div>
            <div className="p-6 rounded-xl border border-stone-200 bg-[#FEF8F0]">
              <span className="text-stone-500 font-bold text-sm">
                ASSINANTES CLUBE
              </span>
              <p className="text-4xl font-bold text-[#602D15] mt-2">2</p>
            </div>
          </div>
        )}

        {abaAtiva === "ESTOQUE" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold text-[#3E2417]">
                {mostrarCadastro
                  ? "Cadastrar item do estoque"
                  : "Itens cadastrados"}
              </h2>

              <button
                type="button"
                onClick={() => {
                  setMostrarCadastro((valorAtual) => !valorAtual);
                  setMensagem({ tipo: "", texto: "" });
                  if (mostrarCadastro) {
                    limparFormulario();
                  }
                }}
                className="bg-[#3E2417] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#602D15] transition-colors"
              >
                {mostrarCadastro ? "Fechar cadastro" : "Cadastrar item"}
              </button>
            </div>

            {mostrarCadastro ? (
              <div>
                <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-6 items-start">
                  <form
                    onSubmit={handleSubmit}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                      Tipo
                      <select
                        name="tipo"
                        value={form.tipo}
                        onChange={handleChange}
                        className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417] bg-white"
                      >
                        <option value="kit">Kit</option>
                        <option value="material">Material</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                      Nome do item
                      <input
                        name="nome"
                        value={form.nome}
                        onChange={handleChange}
                        placeholder="Ex.: Coelhinho Amigurumi"
                        className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                      Slug
                      <input
                        name="slug"
                        value={form.slug}
                        onChange={handleChange}
                        placeholder="coelhinho-amigurumi"
                        className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                      Imagem do card
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImagemChange}
                        className="block w-full text-sm text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:bg-[#3E2417] file:text-white"
                      />
                    </label>

                    {form.tipo === "kit" && (
                      <div className="md:col-span-2 space-y-3 rounded-2xl border border-stone-200 bg-[#FEF8F0] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-bold text-[#3E2417]">
                              Vídeos do kit
                            </p>
                            <p className="text-xs text-stone-500">
                              Mínimo de 2 vídeos cadastrados.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={adicionarVideo}
                            className="rounded-xl border border-[#3E2417] text-[#3E2417] px-3 py-2 text-xs font-bold hover:bg-[#F5E6D8]"
                          >
                            + Adicionar vídeo
                          </button>
                        </div>

                        {(form.videos || []).length === 0 ? (
                          <p className="text-sm text-stone-500">
                            Ainda não há vídeos para este kit.
                          </p>
                        ) : (
                          <div className="space-y-3">
                            {(form.videos || []).map((video, index) => (
                              <div
                                key={`${video.titulo || "video"}-${index}`}
                                className="rounded-xl border border-stone-200 bg-white p-3"
                              >
                                <div className="flex items-center justify-between gap-2 mb-3">
                                  <span className="text-xs font-bold uppercase text-[#7B5E4B]">
                                    Vídeo {index + 1}
                                  </span>
                                  {index > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => removerVideo(index)}
                                      className="text-xs font-bold text-red-600 hover:text-red-700"
                                    >
                                      Remover
                                    </button>
                                  )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                                    Título do vídeo
                                    <input
                                      value={video.titulo}
                                      onChange={(event) =>
                                        handleVideoChange(
                                          index,
                                          "titulo",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="Aula 1 - Conhecendo os pontos"
                                      className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                                      required={index < 2}
                                    />
                                  </label>

                                  <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                                    URL do vídeo
                                    <input
                                      value={video.url}
                                      onChange={(event) =>
                                        handleVideoChange(
                                          index,
                                          "url",
                                          event.target.value,
                                        )
                                      }
                                      placeholder="https://youtube.com/watch?..."
                                      className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                                      required={index < 2}
                                    />
                                  </label>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {form.tipo === "kit" ? (
                      <>
                        <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                          Nome de chamada
                          <input
                            name="nomeChamada"
                            value={form.nomeChamada}
                            onChange={handleChange}
                            placeholder="Coelhinho Amigurumi"
                            className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                          Nível
                          <input
                            name="nivel"
                            value={form.nivel}
                            onChange={handleChange}
                            placeholder="Iniciante"
                            className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                          Faixa etária
                          <input
                            name="faixaEtaria"
                            value={form.faixaEtaria}
                            onChange={handleChange}
                            placeholder="+8 anos"
                            className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                          Tempo estimado
                          <input
                            name="tempoEstimado"
                            value={form.tempoEstimado}
                            onChange={handleChange}
                            placeholder="2 horas"
                            className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                          />
                        </label>
                      </>
                    ) : (
                      <>
                        <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417] md:col-span-2">
                          Descrição do material
                          <textarea
                            name="materialDescricao"
                            value={form.materialDescricao}
                            onChange={handleChange}
                            placeholder="Fibra acrílica, algodão, etc."
                            className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417] min-h-22.5"
                          />
                        </label>

                        <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                          Categoria
                          <input
                            name="materialCategoria"
                            value={form.materialCategoria}
                            onChange={handleChange}
                            placeholder="geral"
                            className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                          />
                        </label>
                      </>
                    )}

                    <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417] md:col-span-2">
                      Descrição do produto
                      <textarea
                        name="descricao"
                        value={form.descricao}
                        onChange={handleChange}
                        placeholder="Uma descrição por linha"
                        className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417] min-h-25"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417] md:col-span-2">
                      Conteúdo da caixa
                      <textarea
                        name="caixa"
                        value={form.caixa}
                        onChange={handleChange}
                        placeholder="Item por linha"
                        className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417] min-h-25"
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                      Preço (em centavos)
                      <input
                        name="preco"
                        type="number"
                        min="0"
                        step="1"
                        value={form.preco}
                        onChange={handleChange}
                        placeholder="19900"
                        className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                        required
                      />
                    </label>

                    <label className="flex flex-col gap-2 text-sm font-medium text-[#3E2417]">
                      Estoque
                      <input
                        name="estoque"
                        type="number"
                        min="0"
                        step="1"
                        value={form.estoque}
                        onChange={handleChange}
                        placeholder="10"
                        className="border border-stone-300 rounded-xl px-3 py-2 outline-none focus:border-[#3E2417]"
                        required
                      />
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm font-medium text-[#3E2417]">
                      <input
                        type="checkbox"
                        name="destaque"
                        checked={form.destaque}
                        onChange={handleChange}
                      />
                      Destaque
                    </label>

                    <label className="inline-flex items-center gap-2 text-sm font-medium text-[#3E2417]">
                      <input
                        type="checkbox"
                        name="ativo"
                        checked={form.ativo}
                        onChange={handleChange}
                      />
                      Ativo
                    </label>

                    <div className="md:col-span-2 flex gap-3 mt-2">
                      <button
                        type="submit"
                        className="bg-[#3E2417] text-white font-bold px-5 py-2.5 rounded-xl hover:bg-[#602D15] transition-colors"
                      >
                        {editandoId ? "Atualizar item" : "Salvar item"}
                      </button>
                      <button
                        type="button"
                        onClick={limparFormulario}
                        className="border border-stone-300 text-[#3E2417] font-bold px-5 py-2.5 rounded-xl hover:bg-stone-50 transition-colors"
                      >
                        Limpar
                      </button>
                    </div>
                  </form>

                  <div className="rounded-2xl border border-stone-200 bg-[#FEF8F0] p-4">
                    <h3 className="text-lg font-bold text-[#3E2417] mb-3">
                      Preview do card
                    </h3>
                    <div className="overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-sm max-w-sm mx-auto">
                      <img
                        src={
                          form.imagemUrl ||
                          "https://placehold.co/600x600/f3e7dc/3e2417?text=Imagem+do+kit"
                        }
                        alt={form.nome || "Preview do item"}
                        className="h-56 w-full object-cover"
                      />
                      <div className="p-4">
                        <p className="text-xs font-semibold uppercase text-[#7B5E4B]">
                          {form.tipo === "kit" ? "KIT" : "MATERIAL"}
                        </p>
                        <h4 className="text-lg font-black text-[#3E2417] mt-1">
                          {form.nome || "Nome do item"}
                        </h4>
                        <p className="text-sm text-stone-600 mt-2 line-clamp-3">
                          {form.descricao ||
                            "Descrição do produto aparecerá aqui."}
                        </p>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-lg font-black text-[#3E2417]">
                            {form.preco
                              ? `R$ ${(Number(form.preco) / 100)
                                  .toFixed(2)
                                  .replace(".", ",")}`
                              : "R$ 0,00"}
                          </span>
                          <button
                            type="button"
                            className="bg-[#3E2417] text-white text-xs font-bold px-4 py-2 rounded-full"
                          >
                            ABRIR
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {mensagem.texto && (
                  <div
                    className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                      mensagem.tipo === "sucesso"
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-red-50 border-red-200 text-red-700"
                    }`}
                  >
                    {mensagem.texto}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {carregando ? (
                  <p className="text-stone-500">Carregando itens...</p>
                ) : itens.length === 0 ? (
                  <p className="text-stone-500">
                    Nenhum item cadastrado ainda.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {itens.map((item) => (
                      <div
                        key={item._id}
                        className="overflow-hidden rounded-2xl border border-stone-200 bg-[#FEF8F0] shadow-sm"
                      >
                        <img
                          src={
                            item.imagemUrl ||
                            "https://placehold.co/600x600/f3e7dc/3e2417?text=Imagem+do+kit"
                          }
                          alt={item.nome}
                          className="h-56 w-full object-cover"
                        />

                        <div className="p-4">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-[#7B5E4B]">
                              {item.tipo}
                            </span>
                            <span className="text-[10px] font-bold uppercase text-stone-500">
                              {item.estoque} em estoque
                            </span>
                          </div>

                          <h3 className="mt-2 text-lg font-black text-[#3E2417]">
                            {item.nome}
                          </h3>

                          <div className="mt-3 flex items-center justify-between gap-2">
                            <span className="text-lg font-black text-[#3E2417]">
                              {item.preco
                                ? `R$ ${(item.preco / 100)
                                    .toFixed(2)
                                    .replace(".", ",")}`
                                : "R$ 0,00"}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                setProdutoAbertoId(
                                  produtoAbertoId === item._id
                                    ? null
                                    : item._id,
                                )
                              }
                              className="bg-[#3E2417] text-white text-xs font-bold px-4 py-2 rounded-full hover:bg-[#602D15]"
                            >
                              {produtoAbertoId === item._id
                                ? "FECHAR"
                                : "ABRIR"}
                            </button>
                          </div>

                          {produtoAbertoId === item._id && (
                            <div className="mt-4 rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-700">
                              <p className="font-bold text-[#3E2417] mb-2">
                                Detalhes
                              </p>
                              <p>
                                <span className="font-semibold">Slug:</span>{" "}
                                {item.slug}
                              </p>
                              <p>
                                <span className="font-semibold">Tipo:</span>{" "}
                                {item.tipo}
                              </p>
                              <p>
                                <span className="font-semibold">Status:</span>{" "}
                                {item.ativo ? "Ativo" : "Inativo"}
                              </p>
                              {item.kit?.descricao?.length > 0 && (
                                <ul className="mt-2 list-disc pl-5 space-y-1">
                                  {item.kit.descricao.map((linha) => (
                                    <li key={linha}>{linha}</li>
                                  ))}
                                </ul>
                              )}
                              {item.material?.descricao && (
                                <p className="mt-2">
                                  <span className="font-semibold">
                                    Material:
                                  </span>{" "}
                                  {item.material.descricao}
                                </p>
                              )}
                              <div className="mt-4 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => abrirFormularioEdicao(item)}
                                  className="flex-1 rounded-xl bg-[#3E2417] text-white font-bold px-3 py-2 hover:bg-[#602D15]"
                                >
                                  Editar item
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleExcluir(item._id)}
                                  className="flex-1 rounded-xl border border-red-200 bg-red-50 text-red-700 font-bold px-3 py-2 hover:bg-red-100"
                                >
                                  Excluir item
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {abaAtiva === "MATERIAIS" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-[#3E2417]">
              Materiais cadastrados
            </h2>

            {carregando ? (
              <p className="text-stone-500">Carregando materiais...</p>
            ) : !itens.some((item) => item.tipo === "material") ? (
              <p className="text-stone-500">
                Nenhum material cadastrado ainda.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {itens
                  .filter((item) => item.tipo === "material")
                  .map((item) => (
                    <div
                      key={item._id}
                      className="rounded-2xl border border-stone-200 bg-[#FEF8F0] p-4 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-[#7B5E4B]">
                          Material
                        </span>
                        <span className="text-[10px] font-bold uppercase text-stone-500">
                          {item.estoque} em estoque
                        </span>
                      </div>

                      <h3 className="mt-2 text-lg font-black text-[#3E2417]">
                        {item.nome}
                      </h3>

                      <p className="mt-3 text-sm text-stone-700">
                        <span className="font-semibold">Descrição:</span>{" "}
                        {item.material?.descricao || "—"}
                      </p>

                      <p className="mt-2 text-sm text-stone-700">
                        <span className="font-semibold">Categoria:</span>{" "}
                        {item.material?.categoria || "geral"}
                      </p>

                      <p className="mt-3 text-lg font-black text-[#3E2417]">
                        {item.preco
                          ? `R$ ${(item.preco / 100).toFixed(2).replace(".", ",")}`
                          : "R$ 0,00"}
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {abaAtiva === "TUTORIAIS" && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-[#3E2417]">
              Tutoriais dos kits
            </h2>

            {carregando ? (
              <p className="text-stone-500">Carregando tutoriais...</p>
            ) : !itens.some(
                (item) =>
                  item.tipo === "kit" &&
                  Array.isArray(item.kit?.videos) &&
                  item.kit.videos.length > 0,
              ) ? (
              <p className="text-stone-500">
                Nenhum tutorial cadastrado ainda.
              </p>
            ) : (
              <div className="space-y-5">
                {itens
                  .filter((item) => item.tipo === "kit")
                  .map((item) => (
                    <div
                      key={item._id}
                      className="rounded-2xl border border-stone-200 bg-[#FEF8F0] p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#7B5E4B]">
                            Kit
                          </p>
                          <h3 className="mt-1 text-lg font-black text-[#3E2417]">
                            {item.nome}
                          </h3>
                        </div>
                        <span className="rounded-full bg-[#3E2417] text-white px-3 py-1 text-[10px] font-bold uppercase">
                          {item.kit?.videos?.length || 0} vídeos
                        </span>
                      </div>

                      <div className="space-y-3">
                        {(item.kit?.videos || []).map((video, index) => (
                          <div
                            key={`${item._id}-${video.titulo || index}`}
                            className="rounded-xl border border-stone-200 bg-white p-3"
                          >
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <p className="font-bold text-[#3E2417]">
                                {index + 1}.{" "}
                                {video.titulo || "Vídeo sem título"}
                              </p>
                              <span className="text-[10px] font-bold uppercase text-stone-500">
                                {video.ativo ? "Ativo" : "Inativo"}
                              </span>
                            </div>
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 inline-block text-sm text-[#602D15] underline break-all"
                            >
                              {video.url || "URL não informada"}
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
