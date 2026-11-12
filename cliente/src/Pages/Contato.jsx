export default function Contato() {

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] py-16 px-6 font-['Work_Sans'] text-[#3E2417] flex items-center">
      <div className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
        
        {/* COLUNA ESQUERDA: INFORMAÇÕES DE CONTACTO */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-[#3E2417] font-['Archivo_Black'] tracking-tight leading-tight uppercase">
              FALE COM A GENTE
            </h1>
            <p className="text-base text-[#3E2417]/90 max-w-md leading-relaxed">
              Ficou com alguma dúvida? Mande uma mensagem, a gente responde rapidinho.
            </p>
          </div>

          {/* LISTA DE CONTACTOS COM ÍCONES */}
          <div className="space-y-4 text-sm font-medium text-[#3E2417]">
            {/* E-mail */}
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#3E2417]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <span>oi@ministitches.com.br</span>
            </div>

            {/* Localização */}
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#3E2417]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>São Paulo, SP</span>
            </div>

            {/* Horário */}
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-[#3E2417]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Seg a sex, 9h às 18h</span>
            </div>
          </div>
        </div>

        {/* COLUNA DIREITA: CARTÃO ROSA COM FORMULÁRIO */}
        <div className="bg-[#F5C7E3] p-6 sm:p-8 rounded-[28px] shadow-sm">
          <form className="space-y-4">
            
            {/* Campo: Seu nome */}
            <div>
              <input
                type="text"
                name="nome"
                placeholder="Seu nome"
                required
                className="w-full h-12 px-4 bg-white rounded-lg text-sm text-[#3E2417] placeholder-[#D2AABF] focus:outline-none focus:ring-2 focus:ring-[#3E2417]/20 border-none"
              />
            </div>

            {/* Campo: Seu e-mail */}
            <div>
              <input
                type="email"
                name="email"
                placeholder="Seu e-mail"
                required
                className="w-full h-12 px-4 bg-white rounded-lg text-sm text-[#3E2417] placeholder-[#D2AABF] focus:outline-none focus:ring-2 focus:ring-[#3E2417]/20 border-none"
              />
            </div>

            {/* Campo: Sua mensagem */}
            <div>
              <textarea
                name="mensagem"
                placeholder="Sua mensagem"
                rows="5"
                required
                className="w-full p-4 bg-white rounded-lg text-sm text-[#3E2417] placeholder-[#D2AABF] focus:outline-none focus:ring-2 focus:ring-[#3E2417]/20 border-none resize-none h-40"
              />
            </div>

            {/* Botão: Enviar Mensagem */}
            <button
              type="submit"
              className="w-full h-14 bg-[#3E2417] hover:bg-[#2B180F] text-white font-['Archivo_Black'] text-xs sm:text-sm uppercase tracking-wider rounded-full transition-colors cursor-pointer mt-2"
            >
              ENVIAR MENSAGEM
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}