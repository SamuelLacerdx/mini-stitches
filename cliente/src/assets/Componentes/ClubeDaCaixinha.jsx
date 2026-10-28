import React from 'react';
import { Gift, Truck, Video, RefreshCw } from 'lucide-react';

export default function ClubeDaCaixinha() {
  // Lista dos 4 benefícios principais do Clube
  const beneficios = [
    {
      icon: Gift,
      titulo: 'CAIXA SURPRESA POR MÊS',
      descricao: 'Todo mês uma caixa temática chega na sua casa com materiais e instruções.',
    },
    {
      icon: Truck,
      titulo: 'ENVIO PARA TODO BRASIL',
      descricao: 'Entregamos em qualquer canto do Brasil com segurança e rapidez.',
    },
    {
      icon: Video,
      titulo: 'TUTORIAIS EM VÍDEO',
      descricao: 'Acesso a vídeos passo a passo para não se perder em nenhum ponto.',
    },
    {
      icon: RefreshCw,
      titulo: 'CANCELE QUANDO QUISER',
      descricao: 'Sem fidelidade, sem burocracia. Você cancela quando quiser.',
    },
  ];

  return (
    <div className="w-full bg-[#FAF5EF] font-['Work_Sans',sans-serif] text-[#3E1B0E]">
      {/* 1. HERO / CABEÇALHO */}
      <section className="bg-[#F8D7DA] px-4 py-12 text-center md:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-4">
          <h1 className="font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E1B0E] sm:text-4xl lg:text-5xl">
            CLUBE DA CAIXINHA
          </h1>
          <p className="text-xs font-medium tracking-wide text-[#3E1B0E] sm:text-sm md:text-base">
            Todo mês, uma nova aventura de fazer com as mãos chega na sua casa. Para crianças de 4 a 10 anos.
          </p>
        </div>
      </section>

      {/* 2. CARTÕES DE BENEFÍCIOS */}
      <section className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {beneficios.map((item, idx) => {
            const IconComponent = item.icon;
            return (
              <div
                key={idx}
                className="flex flex-col gap-3 rounded-2xl bg-[#FDE7B2] p-6 shadow-sm transition-transform hover:-translate-y-1"
              >
                <IconComponent className="h-6 w-6 text-[#3E1B0E]" />
                <h3 className="font-['Archivo_Black',sans-serif] text-xs uppercase text-[#3E1B0E]">
                  {item.titulo}
                </h3>
                <p className="text-xs font-medium leading-relaxed text-[#3E1B0E]/80">
                  {item.descricao}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. SECÇÃO DE PLANOS */}
      <section className="mx-auto max-w-3xl px-4 pb-16 md:px-8">
        <div className="rounded-[20px] bg-[#F8D7DA] p-6 text-center md:p-8">
          <h2 className="mb-6 font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E]">
            PLANOS
          </h2>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* PLANO MENSAL */}
            <div className="flex flex-col items-center justify-between rounded-2xl bg-[#FAF5EF] p-6 shadow-sm">
              <span className="font-['Archivo_Black',sans-serif] text-lg text-[#3E1B0E]">
                MENSAL
              </span>
              <span className="my-2 font-['Archivo_Black',sans-serif] text-3xl text-amber-900">
                R$ 89,80
              </span>
              <p className="mb-6 text-xs text-[#3E1B0E]">
                por caixa / cobrado mensalmente
              </p>
              <button
                type="button"
                onClick={() => alert('Assinatura do Plano Mensal iniciada!')}
                className="w-full rounded-2xl bg-[#3E1B0E] py-3 font-['Archivo_Black',sans-serif] text-xs text-[#FAF5EF] transition-colors hover:bg-amber-950"
              >
                ASSINAR MENSAL
              </button>
            </div>

            {/* PLANO TRIMESTRAL */}
            <div className="flex flex-col items-center justify-between rounded-2xl bg-[#FAF5EF] p-6 shadow-sm">
              <span className="font-['Archivo_Black',sans-serif] text-lg text-[#3E1B0E]">
                TRIMESTRAL
              </span>
              <span className="my-2 font-['Archivo_Black',sans-serif] text-3xl text-amber-900">
                R$ 240,00
              </span>
              <p className="mb-6 text-xs text-[#3E1B0E]">
                R$ 80,00/caixa · cobrado a cada 3 meses
              </p>
              <button
                type="button"
                onClick={() => alert('Assinatura do Plano Trimestral iniciada!')}
                className="w-full rounded-2xl bg-[#3E1B0E] py-3 font-['Archivo_Black',sans-serif] text-xs text-[#FAF5EF] transition-colors hover:bg-amber-950"
              >
                ASSINAR TRIMESTRAL
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}