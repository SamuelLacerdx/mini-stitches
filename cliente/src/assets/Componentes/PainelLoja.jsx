import React, { useState } from 'react';

export default function PainelLoja() {
  // Estado para controlar a aba selecionada no painel
  const [abaAtiva, setAbaAtiva] = useState('VISÃO GERAL');

  // Lista com as abas do painel administrativo
  const abas = [
    'VISÃO GERAL',
    'ESTOQUE',
    'MATERIAIS',
    'PEDIDOS',
    'CLUBE',
    'TROCAS',
    'TUTORIAIS',
  ];

  // Dados dos indicadores principais (KPIs) exibidos na Visão Geral
  const kpis = [
    { titulo: 'PEDIDOS', valor: '1' },
    { titulo: 'AGUARDANDO PAGAMENTO', valor: '0' },
    { titulo: 'FATURADO', valor: 'R$ 154,80' },
    { titulo: 'ASSINANTES DO CLUBE', valor: '2' },
    { titulo: 'TROCAS EM ANÁLISE', valor: '0' },
    { titulo: 'VÍDEOS CADASTRADOS', valor: '18' },
  ];

  return (
    <div className="min-h-screen w-full bg-[#FAF5EF] px-4 py-10 font-['Work_Sans',sans-serif] text-[#3E1B0E] md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        
        {/* TÍTULO PRINCIPAL */}
        <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase text-[#3E1B0E] sm:text-5xl lg:text-6xl">
          PAINEL DA LOJA
        </h1>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex flex-wrap gap-3">
          {abas.map((aba) => {
            const isSelected = abaAtiva === aba;
            return (
              <button
                key={aba}
                type="button"
                onClick={() => setAbaAtiva(aba)}
                className={`rounded-full border border-stone-300 px-6 py-3 text-sm font-bold tracking-wide transition-colors ${
                  isSelected
                    ? 'bg-amber-900 text-white'
                    : 'bg-[#FAF5EF] text-[#3E1B0E] hover:bg-stone-200/60'
                }`}
              >
                {aba}
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO DA ABA: VISÃO GERAL */}
        {abaAtiva === 'VISÃO GERAL' && (
          <div className="flex flex-col gap-10">
            {/* GRELHA DE CARTÕES DE MÉTRICAS */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {kpis.map((kpi, idx) => (
                <div
                  key={idx}
                  className="flex h-40 flex-col justify-between rounded-2xl border border-stone-300 bg-white p-6 shadow-sm"
                >
                  <span className="text-sm font-bold uppercase tracking-wide text-stone-500">
                    {kpi.titulo}
                  </span>
                  <span className="font-['Work_Sans'] text-4xl font-bold text-amber-900 sm:text-5xl">
                    {kpi.valor}
                  </span>
                </div>
              ))}
            </div>

            {/* SECÇÃO DE ALERTA DE ESTOQUE */}
            <div className="flex flex-col gap-2 border-t border-stone-200 pt-6">
              <h2 className="text-2xl font-bold text-[#3E1B0E]">
                ESTOQUE BAIXO
              </h2>
              <p className="text-xl font-normal text-stone-500">
                Tudo abastecido.
              </p>
            </div>
          </div>
        )}

        {/* MENSAGEM PARA OUTRAS ABAS EM DESENVOLVIMENTO */}
        {abaAtiva !== 'VISÃO GERAL' && (
          <div className="flex min-h-[300px] items-center justify-center rounded-2xl border border-stone-300 bg-white p-8">
            <p className="text-center text-lg font-medium text-stone-500">
              Painel de gerenciamento de{' '}
              <span className="font-bold text-amber-900">{abaAtiva}</span> em desenvolvimento.
            </p>
          </div>
        )}

      </div>
    </div>
  );
}