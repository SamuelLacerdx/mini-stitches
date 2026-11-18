import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import imgPrincipal from "../assets/imgPrincipal.jpg"
// Importação de ícones para enriquecer o visual
import { Sparkles, Box, Heart } from "lucide-react";

import CardKit from "../Componentes/CardKit";

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [carregandoDestaques, setCarregandoDestaques] = useState(true);
  const [erroDestaques, setErroDestaques] = useState("");

  useEffect(() => {
    let cancelado = false;

    const carregarDestaques = async () => {
      try {
        const resposta = await fetch("/api/produtos?tipo=kit");
        const dados = await resposta.json();

        if (!resposta.ok) {
          throw new Error(dados.erro || "Erro ao carregar produtos destacados.");
        }

        if (!cancelado) {
          setFeaturedProducts(
            (dados.produtos || []).filter((produto) => produto.kit?.destaque),
          );
        }
      } catch (error) {
        if (!cancelado) {
          setErroDestaques(
            error.message || "Não foi possível carregar os produtos destacados.",
          );
        }
      } finally {
        if (!cancelado) {
          setCarregandoDestaques(false);
        }
      }
    };

    carregarDestaques();

    return () => {
      cancelado = true;
    };
  }, []);

  const testimonials = [
    {
      id: 1,
      text: "“A Manu terminou o coelhinho num sábado e dormiu abraçada com ele. Valeu cada ponto.”",
      author: "Carla, mãe da Manuela (9 anos)",
    },
    {
      id: 2,
      text: "“A Manu terminou o coelhinho num sábado e dormiu abraçada com ele. Valeu cada ponto.”",
      author: "Carla, mãe da Manuela (9 anos)",
    },
    {
      id: 3,
      text: "“A Manu terminou o coelhinho num sábado e dormiu abraçada com ele. Valeu cada ponto.”",
      author: "Carla, mãe da Manuela (9 anos)",
    },
  ];

  return (
    <div className="w-full bg-[#FEF9F3] font-['Work_Sans',sans-serif]">
      {/* ========================================================= */}
      {/* 2. HERO SECTION (APRESENTAÇÃO PRINCIPAL) */}
      {/* ========================================================= */}
      <section className="bg-[#F6D1E7] px-4 py-12 text-[#422518] md:px-8 lg:py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-12">
          {/* Lado Esquerdo: Mensagem e Chamadas para Ação */}
          <div className="flex flex-col items-start gap-6 lg:col-span-7">
            {/* Tag / Selo Superior */}
            <span className="inline-block rounded-2xl bg-[#602C16] px-4 py-2 font-['Archivo',sans-serif] text-xs font-black uppercase text-[#FEF9F3] md:text-sm">
              KITS PARA FAZER COM A FAMÍLIA
            </span>

            {/* Título Principal */}
            <h1 className="font-['Archivo',sans-serif] text-4xl uppercase leading-tight text-[#422518] sm:text-5xl lg:text-6xl">
              BORDANDO
              <br />
              MEMÓRIAS,
              <br />
              UM PONTO
              <br />
              POR VEZ.
            </h1>

            {/* Subtítulo / Descrição */}
            <p className="max-w-xl font-['Work_Sans',sans-serif] text-base leading-relaxed text-[#422518] md:text-lg">
              Caixas completas de crochê e bordado para crianças criarem com as
              próprias mãos. Sem tela, sem pressa, com muito orgulho no final.
            </p>

            {/* Botões de Ação */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                to="/clube"
                className="rounded-2xl bg-[#602C16] px-6 py-3.5 font-['Archivo',sans-serif] text-xs font-black uppercase text-[#FEF9F3] transition-transform hover:scale-105 md:text-sm"
              >
                VER CLUBE DA CAIXINHA
              </Link>
              <Link
                to="/kits"
                className="rounded-2xl border-2 border-[#602C16] px-6 py-3.5 font-['Archivo',sans-serif] text-xs font-black uppercase text-[#602C16] transition-colors hover:bg-[#602C16] hover:text-[#FEF9F3] md:text-sm"
              >
                VER TODOS OS KITS
              </Link>
            </div>
          </div>

          {/* Lado Direito: Imagem Principal em Destaque */}
          <div className="flex justify-center lg:col-span-5">
            <img
              src={imgPrincipal}
              alt="Criança bordando e criando artesanalmente"
              className="w-full max-w-120 rounded-[37px] object-cover lg:max-w-none"
            />
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 3. PRODUTOS EM DESTAQUE (OS QUERIDINHOS DA CASA) */}
      {/* ========================================================= */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <div className="mb-10 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
          <h2 className="font-['Archivo',sans-serif] text-3xl uppercase text-[#422518] sm:text-4xl">
            OS QUERIDINHOS DA CASA
          </h2>
          <Link
            to="/kits"
            className="text-lg font-bold text-[#422518] underline transition-colors hover:text-amber-900"
          >
            VER O CATÁLOGO INTEIRO
          </Link>
        </div>

        {carregandoDestaques ? (
          <p className="text-stone-600">Carregando produtos destacados...</p>
        ) : erroDestaques ? (
          <p className="text-red-600">{erroDestaques}</p>
        ) : featuredProducts.length === 0 ? (
          <p className="text-stone-600">
            Em breve, novos produtos estarão em destaque.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <CardKit key={product._id} kit={product} />
            ))}
          </div>
        )}
      </section>

      {/* ========================================================= */}
      {/* 4. COMO FUNCIONA */}
      {/* ========================================================= */}
      <section className="bg-[#F6D1E7] px-4 py-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 font-['Archivo',sans-serif] text-3xl uppercase text-[#422518] sm:text-4xl">
            COMO FUNCIONA
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Passo 1 */}
            <div className="flex flex-col gap-3">
              <Sparkles className="h-8 w-8 text-[#422518]" />
              <span className="text-sm font-bold text-[#422518]">PASSO 1</span>
              <h3 className="font-['Archivo',sans-serif] text-2xl uppercase text-[#422518]">
                ESCOLHAM JUNTOS
              </h3>
              <p className="text-sm leading-relaxed text-stone-800">
                Cada kit mostra a idade indicada e o tempo de brincadeira, para
                acertar de primeira.
              </p>
            </div>

            {/* Passo 2 */}
            <div className="flex flex-col gap-3">
              <Box className="h-8 w-8 text-[#422518]" />
              <span className="text-sm font-bold text-[#422518]">PASSO 2</span>
              <h3 className="font-['Archivo',sans-serif] text-2xl uppercase text-[#422518]">
                ABRAM A CAIXA
              </h3>
              <p className="text-sm leading-relaxed text-stone-800">
                Fios, agulha e guia ilustrado chegam prontos. Nada de correr
                atrás de material.
              </p>
            </div>

            {/* Passo 3 */}
            <div className="flex flex-col gap-3">
              <Heart className="h-8 w-8 text-[#422518]" />
              <span className="text-sm font-bold text-[#422518]">PASSO 3</span>
              <h3 className="font-['Archivo',sans-serif] text-2xl uppercase text-[#422518]">
                DIGAM: EU QUE FIZ!
              </h3>
              <p className="text-sm leading-relaxed text-stone-800">
                No fim aparece algo de verdade, feito por mãos pequenas, para
                guardar ou presentear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. DEPOIMENTOS DE CLIENTES */}
      {/* ========================================================= */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <h2 className="mb-10 font-['Archivo',sans-serif] text-2xl uppercase text-[#422518] sm:text-3xl">
          FAMÍLIAS QUE JÁ CRIARAM COM A GENTE
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {testimonials.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between gap-4 rounded-[20px] border border-stone-300 bg-white p-6"
            >
              <p className="text-base leading-relaxed text-stone-700">
                {item.text}
              </p>
              <span className="text-xs font-light text-stone-500">
                {item.author}
              </span>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}
