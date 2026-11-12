import { useState } from 'react';

export default function Trocas() {
  // Estado 1: Controla se a solicitação é de 'TROCA' ou 'DEVOLUÇÃO'
  const [tipoSolicitacao, setTipoSolicitacao] = useState('TROCA');

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] py-12 px-6 font-['Work_Sans'] text-[#3E2417]">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        
        {/* COLUNA 1: TEXTOS INFORMATIVOS */}
        <div className="space-y-6">
          <h1 className="text-4xl md:text-5xl font-['Archivo_Black'] text-[#3E2417] leading-tight">
            TROCAS E<br />DEVOLUÇÕES
          </h1>
          <div className="space-y-4 text-base leading-relaxed text-[#3E2417]">
            <p>
              Você tem 7 dias após o recebimento para desistir da compra. Kits com defeito são trocados sem custo.
            </p>
            <p>
              Não precisa ter conta: use o número do pedido e o e-mail da compra.
            </p>
          </div>
        </div>

        {/* COLUNA 2: FORMULÁRIO DE SOLICITAÇÃO */}
        <div className="bg-[#FEF8F0] space-y-4">
          
          {/* SELETOR DE ABA (TROCA / DEVOLUÇÃO) */}
          <div className="flex gap-0.5 p-1">
            <button
              type="button"
              onClick={() => setTipoSolicitacao('TROCA')}
              className={`flex-1 py-3 rounded-full text-sm font-['Archivo_Black'] uppercase transition-colors cursor-pointer ${
                tipoSolicitacao === 'TROCA'
                  ? 'bg-[#3E2417] text-white'
                  : 'bg-white text-[#3E2417]'
              }`}
            >
              TROCA
            </button>
            <button
              type="button"
              onClick={() => setTipoSolicitacao('DEVOLUÇÃO')}
              className={`flex-1 py-3 rounded-full text-sm font-['Archivo_Black'] uppercase transition-colors cursor-pointer ${
                tipoSolicitacao === 'DEVOLUÇÃO'
                  ? 'bg-[#3E2417] text-white'
                  : 'bg-white text-[#3E2417]'
              }`}
            >
              DEVOLUÇÃO
            </button>
          </div>

          {/* FORMULÁRIO */}
          <form className="space-y-4">
            
            {/* Campo: Número do Pedido */}
            <div>
              <input
                type="text"
                name="numeroPedido"
                placeholder="Número do pedido (ex.: MS-1001)"
                required
                className="w-full h-14 px-4 bg-white rounded-lg border border-pink-200 text-base text-[#3E2417] placeholder-stone-400 focus:outline-none focus:border-[#3E2417]"
              />
            </div>

            {/* Campo: E-mail da Compra */}
            <div>
              <input
                type="email"
                name="email"
                placeholder="E-mail da compra"
                required
                className="w-full h-14 px-4 bg-white rounded-lg border border-pink-200 text-base text-[#3E2417] placeholder-stone-400 focus:outline-none focus:border-[#3E2417]"
              />
            </div>

            {/* Campo: Motivo */}
            <div>
              <textarea
                name="motivo"
                placeholder="Motivo"
                rows="4"
                required
                className="w-full p-4 bg-white rounded-lg border border-pink-200 text-base text-[#3E2417] placeholder-stone-400 focus:outline-none focus:border-[#3E2417] resize-none"
              />
            </div>

            {/* Botão de Envio */}
            <button
              type="submit"
              className="w-full h-14 bg-[#3E2417] hover:bg-[#602D15] text-white font-['Archivo_Black'] text-sm uppercase tracking-widest rounded-full transition-colors cursor-pointer"
            >
              ENVIAR SOLICITAÇÃO
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}