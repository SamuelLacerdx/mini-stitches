import React, { useState } from 'react';

/**
 * Componente Clube da Caixinha (Clube.jsx)
 * Exibe as informações do clube de assinatura, vantagens e planos disponíveis.
 */
export default function Clube() {
  // Estado para armazenar o plano selecionado pelo utilizador
  const [planoSelecionado, setPlanoSelecionado] = useState(null);

  // Lista dos 4 benefícios principais extraídos do design do Figma
  const beneficios = [
    {
      id: 1,
      titulo: 'CAIXA SURPRESA POR MÊS',
      descricao: 'Todo mês uma caixa temática chega na sua casa com materiais e instruções.',
      icone: '📦'
    },
    {
      id: 2,
      titulo: 'ENVIO PARA TODO BRASIL',
      descricao: 'Entregamos em qualquer canto do Brasil com segurança e rapidez.',
      icone: '🚚'
    },
    {
      id: 3,
      titulo: 'TUTORIAIS EM VÍDEO',
      descricao: 'Acesso a vídeos passo a passo para não se perder em nenhum ponto.',
      icone: '🎥'
    },
    {
      id: 4,
      titulo: 'CANCELE QUANDO QUISER',
      descricao: 'Sem fidelidade, sem burocracia. Você cancela quando quiser.',
      icone: '✨'
    }
  ];

  // Função para processar o clique de assinatura
  const handleAssinar = (nomePlano) => {
    setPlanoSelecionado(nomePlano);
    alert(`Opção selecionada: Plano ${nomePlano}. A redirecionar para o checkout!`);
  };

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] pb-16 font-['Work_Sans'] text-[#3E2417]">
      
      {/* 1. SEÇÃO HERO / CABEÇALHO */}
      <section className="w-full bg-orange-200 py-12 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-3">
          <h1 className="text-3xl md:text-5xl font-['Archivo_Black'] text-[#3E2417]">
            CLUBE DA CAIXINHA
          </h1>
          <p className="text-xs md:text-sm font-medium text-[#3E2417] leading-relaxed max-w-xl mx-auto">
            Todo mês, uma nova aventura de fazer com as mãos chega na sua casa. Para crianças de 4 a 10 anos.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 mt-10 space-y-12">
        
        {/* 2. GRELHA DE BENEFÍCIOS */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {beneficios.map((item) => (
            <div
              key={item.id}
              className="bg-orange-200 p-6 rounded-2xl flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <div className="text-2xl mb-3">{item.icone}</div>
                <h3 className="text-xs font-['Archivo_Black'] text-[#3E2417] mb-2 leading-tight">
                  {item.titulo}
                </h3>
                <p className="text-xs text-yellow-900 font-medium leading-relaxed">
                  {item.descricao}
                </p>
              </div>
            </div>
          ))}
        </section>

        {/* 3. SEÇÃO DE PLANOS DE ASSINATURA */}
        <section className="bg-pink-200 p-8 md:p-12 rounded-[20px] max-w-3xl mx-auto text-center space-y-8">
          <h2 className="text-2xl md:text-3xl font-['Archivo_Black'] text-[#3E2417]">
            PLANOS
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* PLANO MENSAL */}
            <div className="bg-[#FEF8F0] p-6 rounded-2xl flex flex-col justify-between border border-orange-200 shadow-sm hover:scale-[1.02] transition-transform">
              <div className="space-y-3">
                <h3 className="text-lg font-['Archivo_Black'] text-[#3E2417]">
                  MENSAL
                </h3>
                <p className="text-3xl font-['Archivo_Black'] text-yellow-900">
                  R$ 89,80
                </p>
                <p className="text-xs font-medium text-[#3E2417]">
                  por caixa / cobrado mensalmente
                </p>
              </div>

              <button
                onClick={() => handleAssinar('Mensal')}
                className="mt-6 w-full py-3 bg-[#3E2417] hover:bg-[#602D15] text-[#FEF8F0] rounded-2xl font-['Archivo_Black'] text-xs uppercase transition-colors cursor-pointer"
              >
                ASSINAR MENSAL
              </button>
            </div>

            {/* PLANO TRIMESTRAL */}
            <div className="bg-[#FEF8F0] p-6 rounded-2xl flex flex-col justify-between border border-orange-200 shadow-sm hover:scale-[1.02] transition-transform">
              <div className="space-y-3">
                <h3 className="text-lg font-['Archivo_Black'] text-[#3E2417]">
                  TRIMESTRAL
                </h3>
                <p className="text-3xl font-['Archivo_Black'] text-yellow-900">
                  R$ 240,00
                </p>
                <p className="text-xs font-medium text-[#3E2417]">
                  R$ 80,00/caixa · cobrado a cada 3 meses
                </p>
              </div>

              <button
                onClick={() => handleAssinar('Trimestral')}
                className="mt-6 w-full py-3 bg-[#3E2417] hover:bg-[#602D15] text-[#FEF8F0] rounded-2xl font-['Archivo_Black'] text-xs uppercase transition-colors cursor-pointer"
              >
                ASSINAR TRIMESTRAL
              </button>
            </div>

          </div>
        </section>

      </div>
    </div>
  );
}