import React, { useState } from 'react';
import { Play } from 'lucide-react';

export default function Videos() {
  const playlist = [
    {
      id: 1,
      titulo: 'Conhecendo os materiais',
      duracao: '4 min',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // URL de demonstração
    },
    {
      id: 2,
      titulo: 'Primeiros Pontos',
      duracao: '9 min',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    },
    {
      id: 3,
      titulo: 'Montagem e acabamento',
      duracao: '12 min',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    },
  ];

  // Estado para armazenar o vídeo selecionado no momento
  const [videoAtivo, setVideoAtivo] = useState(playlist[0]);

  return (
    <div className="min-h-screen w-full bg-[#FAF5EF] font-['Work_Sans',sans-serif] text-[#3E1B0E]">
      <main className="mx-auto max-w-6xl px-4 py-10 md:px-8">
        
        {/* TÍTULO PRINCIPAL */}
        <div className="mb-8 flex flex-col gap-1">
          <h1 className="font-['Archivo_Black',sans-serif] text-4xl uppercase text-[#3E1B0E] sm:text-5xl lg:text-6xl">
            VÍDEO PASSO A PASSO
          </h1>
          <p className="font-['Archivo_Black',sans-serif] text-2xl uppercase tracking-wide text-[#3E1B0E]/80">
            COELHINHO AMIGURUMI
          </p>
        </div>

        {/* ÁREA DE CONTEÚDO (LEITOR + PLAYLIST) */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          
          {/* COLUNA ESQUERDA: LEITOR DE VÍDEO */}
          <div className="flex flex-col gap-4 lg:col-span-8">
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-md">
              <iframe
                className="h-full w-full"
                src={videoAtivo.embedUrl}
                title={videoAtivo.titulo}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            {/* DETALHES DO VÍDEO ATUAL */}
            <div className="flex items-center justify-between">
              <h2 className="font-['Archivo_Black',sans-serif] text-2xl uppercase text-[#3E1B0E]">
                {videoAtivo.titulo}
              </h2>
              <span className="rounded-xl bg-[#FDE7B2] px-3 py-1.5 text-sm font-medium text-stone-700">
                {videoAtivo.duracao}
              </span>
            </div>
          </div>

          {/* COLUNA DIREITA: PLAYLIST DE CAPÍTULOS */}
          <div className="flex flex-col gap-4 lg:col-span-4">
            <h3 className="font-['Archivo_Black',sans-serif] text-lg uppercase text-[#3E1B0E]">
              AULAS DO KIT
            </h3>

            <div className="flex flex-col gap-3">
              {playlist.map((item) => {
                const isSelected = item.id === videoAtivo.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setVideoAtivo(item)}
                    className={`flex items-center justify-between rounded-2xl p-4 text-left transition-colors ${
                      isSelected
                        ? 'bg-[#3E1B0E] text-white'
                        : 'bg-[#FDE7B2] text-[#3E1B0E] hover:bg-amber-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Play className={`h-5 w-5 ${isSelected ? 'fill-white text-white' : 'text-[#3E1B0E]'}`} />
                      <span className="text-sm font-semibold">
                        {item.titulo}
                      </span>
                    </div>
                    <span className="text-xs opacity-80">{item.duracao}</span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

      </main>
    </div>
  );
}