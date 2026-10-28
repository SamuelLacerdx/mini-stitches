import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, PlayCircle, Plus, Minus, ShoppingBag } from 'lucide-react';

export default function DetalheKit() {
  const [quantidade, setQuantidade] = useState(1);

  // Dados das aulas em vídeo vinculadas a este kit
  const aulas = [
    { id: 1, titulo: 'Conhecendo os materiais', duracao: '4 min', gratis: true },
    { id: 2, titulo: 'Primeiros Pontos', duracao: '9 min', gratis: false },
    { id: 3, titulo: 'Montagem e acabamento', duracao: '12 min', gratis: false },
  ];

  // Kits sugeridos no final da página
  const relacionados = [
    {
      id: 1,
      titulo: 'Bolsinha de Crochê',
      tag: 'Avançado · 7 a 10 anos',
      descricao: 'O primeiro bichinho que sai das suas mãos',
      preco: '129,60',
      precoOriginal: '159,50',
      imagem: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Bolsinha+de+Croche',
    },
    {
      id: 2,
      titulo: 'Mantinha da Boneca',
      tag: 'Iniciante · A partir de 7 anos',
      descricao: 'O carinho de fazer algo para quem se ama',
      preco: '129,60',
      precoOriginal: '159,50',
      imagem: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Mantinha+da+Boneca',
    },
    {
      id: 3,
      titulo: 'Bordado Arco-Íris',
      tag: 'Iniciante · 7 a 10 anos',
      descricao: 'Seis cores, um bastidor e muita imaginação',
      preco: '129,60',
      precoOriginal: '159,50',
      imagem: 'https://placehold.co/400x400/f8d7da/3e1b0e?text=Bordado+Arco-Íris',
    },
  ];

  return (
    <div className="w-full bg-[#FAF5EF] font-['Work_Sans',sans-serif] text-[#3E1B0E]">
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        
        {/* BOTÃO VOLTAR */}
        <Link
          to="/kits"
          className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-[#3E1B0E] hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Voltar para os kits</span>
        </Link>

        {/* SECÇÃO PRINCIPAL DO PRODUTO */}
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          
          {/* FOTO DO KITS (ESQUERDA) */}
          <div className="lg:col-span-6">
            <img
              src="https://placehold.co/700x700/f8d7da/3e1b0e?text=Coelhinho+Amigurumi"
              alt="Coelhinho Amigurumi"
              className="h-auto w-full rounded-2xl object-cover shadow-sm"
            />
          </div>

          {/* PAINEL DE INFORMAÇÕES E COMPRA (DIREITA) */}
          <div className="flex flex-col justify-between lg:col-span-6">
            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold text-[#3E1B0E]">
                Iniciante · A partir de 7 anos · Cerca de 4 Horas
              </span>
              <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase text-[#3E1B0E] sm:text-5xl">
                COELHINHO AMIGURUMI
              </h1>
              <p className="text-lg font-normal text-amber-900">
                O primeiro bichinho que sai das suas mãos
              </p>

              {/* PREÇOS */}
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-['Work_Sans'] text-3xl font-black text-amber-900">
                  R$129,60
                </span>
                <span className="text-lg text-stone-700 line-through">
                  R$159,50
                </span>
              </div>
              <p className="text-xs text-stone-600">
                R$ 123,41 no Pix · ou 3x de R$ 43,30 sem juros
              </p>

              {/* DESCRIÇÕES DO KIT */}
              <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed text-stone-700">
                <p>
                  Um coelhinho fofo de crochê para fazer junto com quem você ama. As instruções são passo a passo, com fotos grandes e pontos explicados devagar.
                </p>
                <p>
                  É o kit preferido de quem nunca pegou numa agulha e quer terminar o dia dizendo: eu que fiz!
                </p>
              </div>
            </div>

            {/* SELETOR DE QUANTIDADE E BOTÃO COMPRAR */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <div className="flex h-12 items-center justify-between gap-4 rounded-full border border-[#3E1B0E] px-4">
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  className="text-lg font-bold text-[#3E1B0E]"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-['Archivo_Black',sans-serif] text-base text-[#3E1B0E]">
                  {quantidade}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => q + 1)}
                  className="text-lg font-bold text-[#3E1B0E]"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => alert(`Adicionado ${quantidade} kit(s) ao carrinho!`)}
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#3E1B0E] px-8 font-['Archivo_Black',sans-serif] text-xs uppercase text-[#FAF5EF] transition-colors hover:bg-amber-950"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>ADICIONAR AO CARRINHO</span>
              </button>
            </div>
          </div>
        </div>

        {/* SECÇÃO SECUNDÁRIA: VÍDEOS + O QUE VEM NA CAIXA */}
        <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-12">
          
          {/* PRÉVIA DOS VÍDEOS */}
          <div className="flex flex-col gap-4 lg:col-span-7">
            <h2 className="font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E]">
              VÍDEOS DO KIT
            </h2>
            <div className="flex flex-col gap-3">
              {aulas.map((aula) => (
                <div
                  key={aula.id}
                  className="flex items-center justify-between rounded-2xl bg-[#FDE7B2] p-4 transition-colors hover:bg-amber-200"
                >
                  <div className="flex items-center gap-3">
                    <PlayCircle className="h-8 w-8 text-[#3E1B0E]" />
                    <span className="text-base font-semibold text-amber-950">
                      {aula.titulo}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-stone-700">
                    {aula.gratis && (
                      <span className="rounded-md bg-white px-2 py-1 font-['Archivo_Black'] uppercase text-[#3E1B0E]">
                        Grátis
                      </span>
                    )}
                    <span>{aula.duracao}</span>
                  </div>
                </div>
              ))}
            </div>

            <Link
              to="/videos"
              className="mt-2 text-xs font-bold text-stone-700 underline hover:text-[#3E1B0E]"
            >
              Entre ou crie uma conta para ver todos os vídeos.
            </Link>
          </div>

          {/* O QUE VEM NA CAIXA */}
          <div className="rounded-[36px] bg-[#FDE7B2] p-8 lg:col-span-5">
            <h2 className="font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E]">
              O QUE VEM NA CAIXA
            </h2>
            <ul className="mt-6 flex flex-col gap-3 text-sm leading-relaxed text-stone-800">
              <li>• 3 novelos de fio de algodão (creme, rosa e amarelo)</li>
              <li>• 1 agulha de crochê 3,5 mm em bambu</li>
              <li>• Enchimento macio e olhinhos de segurança</li>
              <li>• QR Code com tutoriais em vídeo para fazer junto</li>
            </ul>
          </div>
        </div>

        {/* PRODUTOS RELACIONADOS */}
        <section className="mt-20">
          <h2 className="font-['Archivo_Black',sans-serif] text-3xl uppercase text-[#3E1B0E]">
            TAMBÉM VÃO GOSTAR
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {relacionados.map((item) => (
              <div
                key={item.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-stone-300 bg-white"
              >
                <img
                  src={item.imagem}
                  alt={item.titulo}
                  className="h-72 w-full object-cover"
                />
                <div className="flex flex-col gap-2 p-5">
                  <span className="text-xs font-semibold text-[#3E1B0E]">
                    {item.tag}
                  </span>
                  <h3 className="font-['Work_Sans'] text-base font-black text-black">
                    {item.titulo}
                  </h3>
                  <p className="text-xs text-amber-900">{item.descricao}</p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-base font-black text-amber-900">
                      R${item.preco}
                    </span>
                    <span className="text-xs text-stone-700 line-through">
                      R${item.precoOriginal}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}