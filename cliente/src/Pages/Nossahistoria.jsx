import { Link } from 'react-router-dom';

export default function NossaHistoria() {
  return (
    <div className="w-full bg-[#FFFCF6] font-['Work_Sans'] text-[#3E2417]">
      
      {/* BANNER SUPERIOR ROSA (HERO) */}
      <section className="w-full bg-[#F8D8E8] py-16 px-6 text-center">
        <div className="max-w-3xl mx-auto space-y-4">
          <h1 className="text-4xl md:text-6xl font-['Archivo_Black'] text-[#3E2417] tracking-wide uppercase">
            NOSSA HISTORIA
          </h1>
          <p className="text-xs md:text-sm text-[#3E2417] leading-relaxed max-w-md mx-auto font-medium">
            A Mini Stitches nasceu numa mesa de cozinha, entre novelos coloridos e uma criança curiosa querendo saber como a vovó fazia aquilo.
          </p>
        </div>
      </section>

      {/* CONTEÚDO PRINCIPAL (FUNDO CREME) */}
      <section className="max-w-5xl mx-auto py-16 px-6 space-y-12 text-center">
        
        {/* TEXTO CENTRAL */}
        <div className="max-w-2xl mx-auto space-y-6 text-xs md:text-sm font-medium text-[#3E2417] leading-relaxed">
          <p>
            Percebemos que as crianças adoram fazer coisas com as próprias mãos — só faltava um jeito simples de começar. Por isso montamos kits com tudo dentro e instruções claras, sem pressa.
          </p>
          <p>
            Hoje, cada caixa leva um pouco dessa ideia: bordar memórias, um ponto por vez.
          </p>
        </div>

        {/* TRÊS CARTÕES AMARELOS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          
          <div className="bg-[#FDE89C] p-8 rounded-2xl flex flex-col items-center justify-center space-y-3 min-h-[180px]">
            <h2 className="text-base md:text-lg font-['Archivo_Black'] text-[#3E2417] uppercase">
              LONGE DAS TELAS
            </h2>
            <p className="text-xs text-[#3E2417] font-medium leading-relaxed">
              Mãos ocupadas, cabeça tranquila. Cada kit é um convite para desligar e criar.
            </p>
          </div>

          <div className="bg-[#FDE89C] p-8 rounded-2xl flex flex-col items-center justify-center space-y-3 min-h-[180px]">
            <h2 className="text-base md:text-lg font-['Archivo_Black'] text-[#3E2417] uppercase">
              FEITO JUNTOS
            </h2>
            <p className="text-xs text-[#3E2417] font-medium leading-relaxed">
              Pensamos cada passo para crianças e adultos fazerem lado a lado.
            </p>
          </div>

          <div className="bg-[#FDE89C] p-8 rounded-2xl flex flex-col items-center justify-center space-y-3 min-h-[180px]">
            <h2 className="text-base md:text-lg font-['Archivo_Black'] text-[#3E2417] uppercase">
              ERRAR FAZ PARTE
            </h2>
            <p className="text-xs text-[#3E2417] font-medium leading-relaxed">
              Ponto torto também é ponto. O importante é chegar ao fim orgulhoso.
            </p>
          </div>

        </div>

        {/* BOTÃO DE AÇÃO (CTA) */}
        <div className="pt-4">
          <Link
            to="/kits"
            className="inline-block bg-[#3E2417] hover:bg-[#2A180F] text-[#FFFCF6] font-['Archivo_Black'] text-xs px-8 py-3.5 rounded-full transition-colors uppercase tracking-wider"
          >
            VER OS KITS
          </Link>
        </div>

      </section>
    </div>
  );
}