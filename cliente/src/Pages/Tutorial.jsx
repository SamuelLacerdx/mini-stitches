import React, { useState } from 'react';

/**
 * Componente Tutorial (Tutorial.jsx)
 * Leitor interativo de aulas em vídeo para montagem dos kits.
 * Permite selecionar episódios na lista lateral e reproduzi-los no leitor principal.
 */
export default function Tutorial() {
  // Lista de vídeos/aulas do kit "Coelhinho Amigurumi"
  const listaVideos = [
    {
      id: 1,
      titulo: 'CONHECENDO OS MATERIAIS',
      tituloCurto: 'Conhecendo os materiais',
      duracaoExtensa: '4 minutos',
      duracaoCurta: '4 min',
      // Substitua pelo URL do vídeo incorporado (ex.: embed do YouTube ou Vimeo)
      urlEmbed: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      capa: 'https://placehold.co/800x500/F5C7E3/3E2417?text=Conhecendo+os+Materiais'
    },
    {
      id: 2,
      titulo: 'PRIMEIROS PONTOS',
      tituloCurto: 'Primeiros Pontos',
      duracaoExtensa: '9 minutos',
      duracaoCurta: '9 min',
      urlEmbed: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      capa: 'https://placehold.co/800x500/F7C6E5/3E2417?text=Primeiros+Pontos'
    },
    {
      id: 3,
      titulo: 'MONTAGEM E ACABAMENTO',
      tituloCurto: 'Montagem e acabamento',
      duracaoExtensa: '12 minutos',
      duracaoCurta: '12 min',
      urlEmbed: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      capa: 'https://placehold.co/800x500/FBE6A8/3E2417?text=Montagem+e+Acabamento'
    }
  ];

  // Estado que armazena a aula atualmente ativa (inicia na primeira aula)
  const [videoAtivo, setVideoAtivo] = useState(listaVideos[0]);
  // Estado para simular o clique de reprodução do vídeo
  const [estaAplay, setEstaAplay] = useState(false);

  // Função para trocar de aula ao clicar na lista lateral
  const handleSelecionarVideo = (video) => {
    setVideoAtivo(video);
    setEstaAplay(false); // Reinicia a reprodução ao trocar de vídeo
  };

  return (
    <div className="w-full flex-1 bg-[#FEF8F0] py-10 px-6 font-['Work_Sans'] text-[#3E2417]">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* CABEÇALHO DAS AULAS */}
        <div className="space-y-1">
          <h1 className="text-3xl sm:text-5xl font-['Archivo_Black'] text-[#3E2417] tracking-tight uppercase">
            VÍDEO PASSO A PASSO
          </h1>
          <h2 className="text-xl sm:text-3xl font-['Archivo_Black'] text-[#3E2417] tracking-tight uppercase">
            COELHINHO AMIGURUMI
          </h2>
        </div>

        {/* GRELHA PRINCIPAL (LEITOR + LISTA LATERAL) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          
          {/* COLUNA ESQUERDA: LEITOR DE VÍDEO PRINCIPAL (Ocupa 2 colunas em ecrãs grandes) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Contentor do Vídeo com Borda em Destaque Azul */}
            <div className="relative w-full aspect-video rounded-2xl border-4 border-sky-400 overflow-hidden bg-black shadow-sm group">
              {estaAplay ? (
                /* Leitor de Vídeo Incorporado (Iframe) */
                <iframe
                  src={`${videoAtivo.urlEmbed}?autoplay=1`}
                  title={videoAtivo.titulo}
                  className="w-full h-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                /* Capa com Botão Play Interativo */
                <div 
                  onClick={() => setEstaAplay(true)}
                  className="relative w-full h-full cursor-pointer flex items-center justify-center"
                >
                  <img
                    src={videoAtivo.capa}
                    alt={videoAtivo.titulo}
                    className="w-full h-full object-cover"
                  />
                  {/* Sobreposição escura suave ao passar o rato */}
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                  
                  {/* Ícone de Play Central */}
                  <div className="relative z-10 w-16 h-16 rounded-full bg-white/80 border-2 border-[#3E2417] flex items-center justify-center shadow-md transform group-hover:scale-110 transition-transform">
                    <svg
                      className="w-8 h-8 text-[#3E2417] translate-x-0.5"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              )}
            </div>

            {/* Título e Duração do Vídeo Ativo */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <h3 className="text-lg sm:text-xl font-['Archivo_Black'] text-[#3E2417] uppercase">
                {videoAtivo.titulo}
              </h3>
              <span className="px-3 py-1 bg-[#FEF9A7] rounded-full text-xs font-bold text-[#3E2417]">
                {videoAtivo.duracaoExtensa}
              </span>
            </div>

          </div>

          {/* COLUNA DIREITA: LISTA "TODOS VÍDEOS" */}
          <div className="space-y-4">
            <h3 className="text-xs font-['Archivo_Black'] text-[#3E2417] tracking-wider uppercase">
              TODOS VÍDEOS
            </h3>

            {/* Lista de Cards de Aulas */}
            <div className="space-y-3">
              {listaVideos.map((video) => {
                const isSelected = videoAtivo.id === video.id;

                return (
                  <button
                    key={video.id}
                    onClick={() => handleSelecionarVideo(video)}
                    className={`w-full p-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FEF9A7] border-2 border-[#3E2417] shadow-sm'
                        : 'bg-[#FEF9A7]/70 border border-transparent hover:bg-[#FEF9A7]'
                    }`}
                  >
                    {/* Miniatura do Card com Ícone Play */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-[#E2B79A]/40 border border-[#3E2417]/20 flex-shrink-0 flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full border border-[#3E2417] flex items-center justify-center bg-white/60">
                          <svg
                            className="w-3 h-3 text-[#3E2417] translate-x-0.5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M8 5v14l11-7z" />
                          </svg>
                        </div>
                      </div>

                      {/* Nome do Vídeo */}
                      <span className="text-xs sm:text-sm font-medium text-[#3E2417] truncate">
                        {video.tituloCurto}
                      </span>
                    </div>

                    {/* Duração Abreviada */}
                    <span className="text-[11px] font-medium text-[#3E2417]/70 whitespace-nowrap pl-2">
                      {video.duracaoCurta}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}