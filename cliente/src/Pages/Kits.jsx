import { useEffect, useMemo, useState } from "react";
import CardKit from "../Componentes/CardKit";

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
                <CardKit key={kit._id} kit={kit} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
