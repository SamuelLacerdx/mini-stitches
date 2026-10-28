import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Sparkles, Smile, ShieldCheck, ArrowRight } from 'lucide-react';
import { CardDestaque } from './reutilizaveis';

export default function NossaHistoria() {
  // Os 4 pilares da marca Mini Stitches
  const pilares = [
    {
      icone: <Sparkles className="h-8 w-8 text-amber-900" />,
      titulo: 'Criatividade Longe das Telas',
      descricao: 'Desenvolvemos kits pensados para estimular a imaginação, foco e coordenação motora de forma leve e divertida.',
    },
    {
      icone: <Heart className="h-8 w-8 text-amber-900" />,
      titulo: 'Conexão em Família',
      descricao: 'Projetos manuais criados para aproximar pais, mães, avós e filhos num momento especial de cooperação.',
    },
    {
      icone: <ShieldCheck className="h-8 w-8 text-amber-900" />,
      titulo: 'Materiais Ecológicos e Seguros',
      descricao: 'Priorizamos fios de algodão 100% natural, agulhas de bambu com pontas arredondadas e embalagens sustentáveis.',
    },
    {
      icone: <Smile className="h-8 w-8 text-amber-900" />,
      titulo: 'Autonomia para Criar',
      descricao: 'Nossos guias em vídeo passo a passo garantem que as crianças alcancem resultados incríveis com orgulho do que fizeram.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAF5EF] px-4 py-12 font-['Work_Sans',sans-serif] text-[#3E1B0E] md:px-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-12">
        
        {/* TOPO / CABEÇALHO DA PÁGINA */}
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="rounded-full bg-amber-200/60 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-amber-900">
            Sobre Nós
          </span>
          <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase text-[#3E1B0E] sm:text-5xl lg:text-6xl">
            NOSSA HISTÓRIA
          </h1>
          <p className="max-w-2xl text-lg font-medium text-stone-600 sm:text-xl">
            Bordando memórias, um ponto por vez.
          </p>
        </div>

        {/* SEÇÃO PRINCIPAL DA HISTÓRIA */}
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
          <div className="flex flex-col gap-4 text-base leading-relaxed text-[#3E1B0E]">
            <h2 className="font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E]">
              Como Tudo Começou
            </h2>
            <p>
              A <strong>Mini Stitches</strong> nasceu em São Paulo do desejo de resgatar o encanto das atividades manuais na infância. Num mundo cada vez mais digital, percebemos a importância de oferecer às crianças uma pausa longe dos ecrãs e monitores.
            </p>
            <p>
              Acreditamos que fazer algo com as próprias mãos transforma a autoconfiança da criança. Cada ponto de crochê e cada bordado finalizado torna-se uma conquista tangível e inesquecível.
            </p>
          </div>

          {/* IMAGEM ILUSTRATIVA DA MARCA */}
          <div className="overflow-hidden rounded-3xl border border-stone-300 shadow-sm">
            <img
              src="https://placehold.co/600x400"
              alt="Criança fazendo trabalho manual"
              className="h-full w-full object-cover"
            />
          </div>
        </div>

        {/* SEÇÃO DE PILARES E VALORES (USA CARD DESTAQUE REUTILIZÁVEL) */}
        <div className="flex flex-col gap-8 pt-4">
          <div className="text-center">
            <h2 className="font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E1B0E]">
              NOSSOS VALORES
            </h2>
            <p className="mt-2 text-stone-600">
              O que nos guia no desenvolvimento de cada caixinha de artesanato.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {pilares.map((pilar, index) => (
              <CardDestaque key={index} corFundo="bg-white" className="border border-stone-300 shadow-sm">
                <div className="flex flex-col gap-3">
                  <div>{pilar.icone}</div>
                  <h3 className="font-['Archivo_Black',sans-serif] text-lg uppercase text-[#3E1B0E]">
                    {pilar.titulo}
                  </h3>
                  <p className="text-sm text-stone-600">
                    {pilar.descricao}
                  </p>
                </div>
              </CardDestaque>
            ))}
          </div>
        </div>

        {/* CHAMADA PARA AÇÃO (CTA) */}
        <CardDestaque corFundo="bg-[#FDE7B2]" className="flex flex-col items-center text-center gap-4 py-10">
          <h2 className="font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E] sm:text-3xl">
            PRONTO PARA COMECAR A CRIAR?
          </h2>
          <p className="max-w-xl text-sm font-medium text-amber-950 sm:text-base">
            Descubra a nossa coleção de kits criativos e receba tudo o que precisa diretamente na sua casa.
          </p>
          <Link
            to="/kits"
            className="mt-2 flex items-center gap-2 rounded-full bg-amber-900 px-8 py-3.5 font-bold text-white shadow-sm transition-colors hover:bg-amber-950"
          >
            CONHECER NOSSOS KITS <ArrowRight className="h-5 w-5" />
          </Link>
        </CardDestaque>

      </div>
    </div>
  );
}