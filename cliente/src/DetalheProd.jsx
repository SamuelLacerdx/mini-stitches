import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

export default function DetalheProd() {

  // Estado para gerir a quantidade selecionada pelo utilizador
  const [quantidade, setQuantidade] = useState(1);

  // Função para incrementar ou decrementar a quantidade
  const alterarQuantidade = (delta) => {
    setQuantidade((prev) => Math.max(1, prev + delta));
  };

  // Dados simulados do kit para exibição
  const kitInfo = {
    nome: 'COELHINHO AMIGURUMI',
    subtitulo: 'Iniciante · A partir de 7 anos · Cerca de 4 Horas',
    chamada: 'O primeiro bichinho que sai das suas mãos',
    precoPix: 'R$ 123,41',
    precoNormal: 'R$ 129,60',
    precoAntigo: 'R$ 159,50',
    parcelamento: 'ou 3x de R$ 43,30 sem juros',
    descricao1: 'Um coelhinho fofo de crochê para fazer junto com quem você ama. As instruções são passo a passo, com fotos grandes e pontos explicados devagar.',
    descricao2: 'É o kit preferido de quem nunca pegou numa agulha e quer terminar o dia dizendo: eu que fiz!',
    itensCaixa: [
      '3 novelos de fio de algodão (creme, rosa e amarelo)',
      '1 agulha de crochê 3,5 mm em bambu',
      'Enchimento macio e olhinhos de segurança',
      'QR Code com tutoriais em vídeo para fazer junto'
    ],
    aulas: [
      { titulo: 'Conhecendo os materiais', duracao: '4 min', gratis: true },
      { titulo: 'Primeiros Pontos', duracao: '9 min', gratis: false },
      { titulo: 'Montagem e acabamento', duracao: '12 min', gratis: false }
    ]
  };

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] py-8 px-4 md:px-12 font-['Work_Sans'] text-[#3E2417]">
      <div className="max-w-6xl mx-auto space-y-12">
        
        {/* BOTÃO DE VOLTAR */}
        <div>
          <Link
            to="/kits"
            className="inline-flex items-center text-sm font-bold text-[#3E2417] hover:opacity-80 transition-opacity"
          >
            ← Voltar para os kits
          </Link>
        </div>

        {/* 1. SECÇÃO PRINCIPAL DE COMPRA (IMAGEM + INFORMAÇÕES) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          
          {/* Imagem do Produto */}
          <div className="w-full">
            <img
              src="https://placehold.co/700x700"
              alt={kitInfo.nome}
              className="w-full h-auto rounded-2xl border border-stone-300 object-cover shadow-sm"
            />
          </div>

          {/* Informações e Detalhes do Produto */}
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

            {/* Preços e Condições de Pagamento */}
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
                <strong className="text-[#3E2417]">{kitInfo.precoPix}</strong> no Pix · {kitInfo.parcelamento}
              </p>
            </div>

            {/* Parágrafos Explicativos */}
            <div className="space-y-3 text-sm text-stone-700 leading-relaxed border-t border-b border-orange-200/60 py-4">
              <p>{kitInfo.descricao1}</p>
              <p>{kitInfo.descricao2}</p>
            </div>

            {/* Controlo de Quantidade e Botão de Adicionar */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              
              {/* Seletor de Quantidade */}
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

              {/* Botão Adicionar ao Carrinho */}
              <button className="flex-1 min-w-[200px] bg-[#3E2417] hover:bg-[#602D15] text-[#FEF8F0] py-3.5 px-6 rounded-full font-['Archivo_Black'] text-xs uppercase tracking-wider transition-colors cursor-pointer">
                ADICIONAR AO CARRINHO
              </button>
            </div>

          </div>
        </div>

        {/* 2. CONTEÚDO DA CAIXA E LISTA DE AULAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          
          {/* O QUE VEM NA CAIXA */}
          <div className="bg-orange-200 p-8 rounded-[32px] space-y-4">
            <h2 className="text-2xl font-['Archivo_Black'] text-[#3E2417]">
              O QUE VEM NA CAIXA
            </h2>
            <ul className="space-y-3 text-sm text-stone-800 leading-relaxed">
              {kitInfo.itensCaixa.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-[#3E2417] font-bold">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* PRÉ-VISUALIZAÇÃO DE TUTORIAIS EM VÍDEO */}
          <div className="space-y-4">
            <h2 className="text-xl font-['Archivo_Black'] text-[#3E2417]">
              VÍDEOS PASSO A PASSO
            </h2>

            <div className="space-y-3">
              {kitInfo.aulas.map((aula, index) => (
                <div
                  key={index}
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
              ))}
            </div>

            <p className="text-xs text-stone-600 font-bold underline pt-2">
              <Link to="/conta">Entre ou crie uma conta para ver todos os vídeos.</Link>
            </p>
          </div>

        </div>

        {/* 3. RECOMENDAÇÕES ("TAMBÉM VÃO GOSTAR") */}
        <div className="space-y-6 pt-6 border-t border-orange-200/60">
          <h2 className="text-2xl md:text-3xl font-['Archivo_Black'] text-[#3E2417]">
            TAMBÉM VÃO GOSTAR
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { nome: 'Bolsinha de Crochê', nivel: 'Avançado · 7 a 10 anos', preco: 'R$129,60' },
              { nome: 'Mantinha da Boneca', nivel: 'Iniciante · A partir de 7 anos', preco: 'R$129,60' },
              { nome: 'Guirlanda de Flores', nivel: 'Iniciante · A partir de 7 anos', preco: 'R$129,60' }
            ].map((prod, index) => (
              <div key={index} className="bg-white rounded-2xl border border-stone-300 overflow-hidden flex flex-col justify-between">
                <img src="https://placehold.co/400x400" alt={prod.nome} className="w-full h-48 object-cover" />
                <div className="p-4 space-y-2">
                  <span className="text-[11px] font-semibold text-[#3E2417]">{prod.nivel}</span>
                  <h3 className="text-sm font-black text-black">{prod.nome}</h3>
                  <span className="text-sm font-black text-[#602D15] block">{prod.preco}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}