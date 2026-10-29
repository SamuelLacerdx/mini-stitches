import React, { useState } from 'react';
import { Link } from 'react-router-dom';
// Importação de ícones para enriquecer o visual
import { Truck, Percent, Sparkles, Box, Heart } from 'lucide-react';

export default function Home() {

  const featuredProducts = [
    {
      id: 1,
      title: 'Coelhinho Amigurumi',
      tag: 'Iniciante · 7 a 10 anos',
      description: 'O primeiro bichinho que sai das suas mãos',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Coelhinho+Amigurumi',
      link: '/kits',
    },
    {
      id: 2,
      title: 'Coelhinho Amigurumi',
      tag: 'Iniciante · 7 a 10 anos',
      description: 'O primeiro bichinho que sai das suas mãos',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Coelhinho+Amigurumi',
      link: '/kits',
    },
    {
      id: 3,
      title: 'Coelhinho Amigurumi',
      tag: 'Iniciante · 7 a 10 anos',
      description: 'O primeiro bichinho que sai das suas mãos',
      price: '129,60',
      originalPrice: '159,50',
      image: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Coelhinho+Amigurumi',
      link: '/kits',
    },
  ];

  const testimonials = [
    {
      id: 1,
      text: '“A Manu terminou o coelhinho num sábado e dormiu abraçada com ele. Valeu cada ponto.”',
      author: 'Carla, mãe da Manuela (9 anos)',
    },
    {
      id: 2,
      text: '“A Manu terminou o coelhinho num sábado e dormiu abraçada com ele. Valeu cada ponto.”',
      author: 'Carla, mãe da Manuela (9 anos)',
    },
    {
      id: 3,
      text: '“A Manu terminou o coelhinho num sábado e dormiu abraçada com ele. Valeu cada ponto.”',
      author: 'Carla, mãe da Manuela (9 anos)',
    },
  ];

  return (
    <div className="w-full bg-[#FAF5EF] font-['Work_Sans',sans-serif]">
      {/* ========================================================= */}
      {/* 1. FAIXA SUPERIOR DE BENEFÍCIOS */}
      {/* ========================================================= */}
      <div className="bg-[#F7C6E5] px-4 py-2.5 font-['Archivo_Black',sans-serif] text-xs text-[#3E1B0E]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-4 md:justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-[#3E1B0E]" />
            <span>ENVIO PARA TODO BRASIL</span>
          </div>
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-[#3E1B0E]" />
            <span>5% OFF NO PIX</span>
          </div>
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-[#3E1B0E]" />
            <span>Até 6x sem juros</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. HERO SECTION (APRESENTAÇÃO PRINCIPAL) */}
      {/* ========================================================= */}
      <section className="bg-[#F7C6E5] px-4 py-12 text-[#3E1B0E] md:px-8 lg:py-16">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-12">
          
          {/* Lado Esquerdo: Mensagem e Chamadas para Ação */}
          <div className="flex flex-col items-start gap-6 lg:col-span-7">
            {/* Tag / Selo Superior */}
            <span className="inline-block rounded-2xl bg-[#3E1B0E] px-4 py-2 font-['Archivo_Black',sans-serif] text-xs uppercase tracking-wider text-[#FAF5EF] md:text-sm">
              KITS PARA FAZER COM A FAMÍLIA
            </span>

            {/* Título Principal */}
            <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase leading-tight text-[#3E1B0E] sm:text-5xl lg:text-6xl">
              BORDANDO<br />MEMÓRIAS,<br />UM PONTO<br />POR VEZ.
            </h1>

            {/* Subtítulo / Descrição */}
            <p className="max-w-xl font-['Archivo_Black',sans-serif] text-base leading-relaxed tracking-wide text-[#3E1B0E] md:text-lg">
              Caixas completas de crochê e bordado para crianças criarem com as próprias mãos. Sem tela, sem pressa, com muito orgulho no final.
            </p>

            {/* Botões de Ação */}
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                to="/clube-da-caixinha"
                className="rounded-2xl bg-[#3E1B0E] px-6 py-3.5 font-['Archivo_Black',sans-serif] text-xs uppercase text-[#FAF5EF] transition-transform hover:scale-105 md:text-sm"
              >
                VER CLUBE DA CAIXINHA
              </Link>
              <Link
                to="/kits"
                className="rounded-2xl border-2 border-[#3E1B0E] px-6 py-3.5 font-['Archivo_Black',sans-serif] text-xs uppercase text-[#3E1B0E] transition-colors hover:bg-[#3E1B0E] hover:text-[#FAF5EF] md:text-sm"
              >
                VER TODOS OS KITS
              </Link>
            </div>
          </div>

          {/* Lado Direito: Imagem Principal em Destaque */}
          <div className="flex justify-center lg:col-span-5">
            <img
              src="https://placehold.co/600x600/f8d7da/3e1b0e?text=Foto+Criança+Criando"
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
          <h2 className="font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E1B0E] sm:text-4xl">
            OS QUERIDINHOS DA CASA
          </h2>
          <Link
            to="/kits"
            className="text-lg font-bold text-[#3E1B0E] underline transition-colors hover:text-amber-900"
          >
            VER O CATÁLOGO INTEIRO
          </Link>
        </div>

        {/* Grelha de Produtos */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {featuredProducts.map((product) => (
            <div
              key={product.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-stone-300 bg-white transition-shadow hover:shadow-md"
            >
              <img
                src={product.image}
                alt={product.title}
                className="h-80 w-full object-cover"
              />
              <div className="flex grow flex-col justify-between p-5 font-['Work_Sans',sans-serif]">
  {/* BLOCO SUPERIOR: TAG, TÍTULO E DESCRIÇÃO */}
  <div className="flex flex-col gap-1">
    {/* Tag / Nível e Idade Recomentada */}
    <span className="text-xs font-semibold text-yellow-950">
      {product.tag}
    </span>

    {/* Título do Produto */}
    <h3 className="text-base font-black text-black">
      {product.title}
    </h3>

    {/* Descrição Curta */}
    <p className="text-xs font-normal text-yellow-900">
      {product.description}
    </p>
  </div>

  {/* BLOCO INFERIOR: PREÇO COM DESCONTO E PREÇO ORIGINAL */}
  <div className="mt-4 flex items-baseline gap-2.5">
    <span className="text-base font-black text-yellow-900">
      R${product.price}
    </span>
    <span className="text-xs font-normal text-stone-700 line-through">
      R${product.originalPrice}
    </span>
  </div>
</div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================= */}
      {/* 4. COMO FUNCIONA */}
      {/* ========================================================= */}
      <section className="bg-[#FDE7B2] px-4 py-16 md:px-8">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E1B0E] sm:text-4xl">
            COMO FUNCIONA
          </h2>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Passo 1 */}
            <div className="flex flex-col gap-3">
              <Sparkles className="h-8 w-8 text-[#3E1B0E]" />
              <span className="text-sm font-bold text-[#3E1B0E]">PASSO 1</span>
              <h3 className="font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E]">
                ESCOLHAM JUNTOS
              </h3>
              <p className="text-sm leading-relaxed text-stone-800">
                Cada kit mostra a idade indicada e o tempo de brincadeira, para acertar de primeira.
              </p>
            </div>

            {/* Passo 2 */}
            <div className="flex flex-col gap-3">
              <Box className="h-8 w-8 text-[#3E1B0E]" />
              <span className="text-sm font-bold text-[#3E1B0E]">PASSO 2</span>
              <h3 className="font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E]">
                ABRAM A CAIXA
              </h3>
              <p className="text-sm leading-relaxed text-stone-800">
                Fios, agulha e guia ilustrado chegam prontos. Nada de correr atrás de material.
              </p>
            </div>

            {/* Passo 3 */}
            <div className="flex flex-col gap-3">
              <Heart className="h-8 w-8 text-[#3E1B0E]" />
              <span className="text-sm font-bold text-[#3E1B0E]">PASSO 3</span>
              <h3 className="font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E]">
                DIGAM: EU QUE FIZ!
              </h3>
              <p className="text-sm leading-relaxed text-stone-800">
                No fim aparece algo de verdade, feito por mãos pequenas, para guardar ou presentear.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= */}
      {/* 5. DEPOIMENTOS DE CLIENTES */}
      {/* ========================================================= */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:px-8">
        <h2 className="mb-10 font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E] sm:text-3xl">
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

      {/* ========================================================= */}
      {/* 6. NEWSLETTER (RECEBER IDEIAS) */}
      {/* ========================================================= */}
      <section className="bg-[#F7C6E5] px-4 py-16 md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
          <h2 className="font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E1B0E] sm:text-4xl">
            RECEBA IDEIAS DE FAZER JUNTOS
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-stone-800 sm:text-lg">
            Um e-mail por mês com um projetinho simples e novidades da caixa. E 15% off na primeira compra.
          </p>

          <form
              className="mt-2 flex w-full max-w-md flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <input
              type="email"
              required
              placeholder="seu@email.com"
              className="w-full rounded-full border border-stone-300 bg-orange-50/95 px-5 py-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#3E1B0E] sm:w-72"
            />
            <button
              type="submit"
              className="w-full whitespace-nowrap rounded-full bg-[#3E1B0E] px-6 py-3 font-['Archivo_Black',sans-serif] text-sm text-white transition-colors hover:bg-amber-950 sm:w-auto"
            >
              QUERO RECEBER
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}