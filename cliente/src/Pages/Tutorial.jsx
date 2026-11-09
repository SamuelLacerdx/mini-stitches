import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

const prepararVideo = (video, index) => {
  const urlOriginal = String(video?.url || '').trim();
  let urlEmbed = urlOriginal;
  let capa = '';

  try {
    const url = new URL(urlOriginal);
    const host = url.hostname.replace(/^www\./, '');
    let idYoutube = '';

    if (host === 'youtu.be') {
      idYoutube = url.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (url.pathname === '/watch') {
        idYoutube = url.searchParams.get('v') || '';
      } else {
        idYoutube = url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)/)?.[1] || '';
      }
    }

    if (idYoutube) {
      urlEmbed = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(idYoutube)}`;
      capa = `https://img.youtube.com/vi/${encodeURIComponent(idYoutube)}/hqdefault.jpg`;
    }
  } catch {
    urlEmbed = '';
  }

  return {
    id: `${video?.ordem ?? index + 1}-${index}`,
    titulo: video?.titulo || `Aula ${index + 1}`,
    tituloCurto: video?.titulo || `Aula ${index + 1}`,
    duracaoExtensa: video?.duracao || '',
    duracaoCurta: video?.duracao || '',
    urlEmbed,
    urlOriginal,
    capa,
  };
};

/**
 * Componente Tutorial (Tutorial.jsx)
 * Leitor interativo de aulas em vídeo para montagem dos kits.
 * Permite selecionar episódios na lista lateral e reproduzi-los no leitor principal.
 */
export default function Tutorial() {
  const location = useLocation();
  const kitNome = location.state?.kitNome || 'Kit selecionado';
  const listaVideos = Array.isArray(location.state?.videos)
    ? location.state.videos
        .filter((video) => video?.ativo !== false)
        .map(prepararVideo)
    : [];
  const [estadoAcesso, setEstadoAcesso] = useState({
    locationKey: location.key,
    status: 'verificando',
    erro: '',
  });
  const acessoAtual =
    estadoAcesso.locationKey === location.key
      ? estadoAcesso
      : { status: 'verificando', erro: '' };
  const usuarioAutenticado = acessoAtual.status === 'autenticado';
  const [selecao, setSelecao] = useState({
    locationKey: location.key,
    videoId: null,
    estaAplay: false,
  });
  const selecaoAtual = selecao.locationKey === location.key ? selecao : null;
  const videoAtivo =
    listaVideos.find((video) => video.id === selecaoAtual?.videoId) ||
    listaVideos[0];
  const estaAplay = selecaoAtual?.estaAplay ?? false;

  useEffect(() => {
    let ativo = true;

    fetch('/api/perfil', { credentials: 'include' })
      .then(async (resposta) => {
        if (resposta.status === 401) {
          return false;
        }
        if (!resposta.ok) {
          throw new Error('Não foi possível verificar sua conta.');
        }
        return true;
      })
      .then((autenticado) => {
        if (ativo) {
          setEstadoAcesso({
            locationKey: location.key,
            status: autenticado ? 'autenticado' : 'visitante',
            erro: '',
          });
        }
      })
      .catch((error) => {
        console.error(error);
        if (ativo) {
          setEstadoAcesso({
            locationKey: location.key,
            status: 'erro',
            erro: error.message || 'Não foi possível verificar sua conta.',
          });
        }
      });

    return () => {
      ativo = false;
    };
  }, [location.key]);

  const podeAssistir = (index) =>
    acessoAtual.status === 'autenticado' ||
    (acessoAtual.status === 'visitante' && index === 0);

  const handleSelecionarVideo = (video) => {
    const index = listaVideos.findIndex((item) => item.id === video.id);
    if (acessoAtual.status === 'verificando' || !podeAssistir(index)) {
      return;
    }

    setSelecao({
      locationKey: location.key,
      videoId: video.id,
      estaAplay: false,
    });
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
            {kitNome.toUpperCase()}
          </h2>
        </div>

        {listaVideos.length === 0 ? (
          <div className="rounded-2xl bg-yellow-100 p-6 text-sm text-stone-700">
            Nenhum vídeo foi encontrado para este kit. Volte à página do kit e
            selecione uma aula para assistir.
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
          
          {/* COLUNA ESQUERDA: LEITOR DE VÍDEO PRINCIPAL (Ocupa 2 colunas em ecrãs grandes) */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Contentor do Vídeo com Borda em Destaque Azul */}
            <div className="relative w-full aspect-video rounded-2xl border-4 border-sky-400 overflow-hidden bg-black shadow-sm group">
              {estaAplay && videoAtivo.urlEmbed ? (
                /* Leitor de Vídeo Incorporado (Iframe) */
                <iframe
                  src={`${videoAtivo.urlEmbed}${videoAtivo.urlEmbed.includes('?') ? '&' : '?'}autoplay=1`}
                  title={videoAtivo.titulo}
                  className="w-full h-full border-none"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : videoAtivo.capa ? (
                /* Capa com Botão Play Interativo */
                <div className="relative w-full h-full">
                  <img
                    src={videoAtivo.capa}
                    alt={videoAtivo.titulo}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors" />
                  <button
                    type="button"
                    disabled={
                      acessoAtual.status === 'verificando' ||
                      !podeAssistir(
                        listaVideos.findIndex(
                          (video) => video.id === videoAtivo.id,
                        ),
                      )
                    }
                    onClick={() =>
                      setSelecao({
                        locationKey: location.key,
                        videoId: videoAtivo.id,
                        estaAplay: true,
                      })
                    }
                    className="absolute left-1/2 top-1/2 z-10 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[#3E2417] bg-white/80 shadow-md transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Reproduzir ${videoAtivo.titulo}`}
                  >
                    <svg
                      className="h-8 w-8 translate-x-0.5 text-[#3E2417]"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#F5E6D8] p-6 text-center">
                  <p className="font-bold">{videoAtivo.titulo}</p>
                  <p className="text-sm text-stone-700">
                    Não foi possível incorporar este endereço de vídeo.
                  </p>
                  {videoAtivo.urlOriginal && (
                    <a
                      href={videoAtivo.urlOriginal}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-[#3E2417] px-5 py-2 text-sm font-bold text-white"
                    >
                      Abrir vídeo
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Título e Duração do Vídeo Ativo */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <h3 className="text-lg sm:text-xl font-['Archivo_Black'] text-[#3E2417] uppercase">
                {videoAtivo.titulo}
              </h3>
              {videoAtivo.duracaoExtensa && (
                <span className="px-3 py-1 bg-[#FEF9A7] rounded-full text-xs font-bold text-[#3E2417]">
                  {videoAtivo.duracaoExtensa}
                </span>
              )}
            </div>

          </div>

          {/* COLUNA DIREITA: LISTA "TODOS VÍDEOS" */}
          <div className="space-y-4">
            <h3 className="text-xs font-['Archivo_Black'] text-[#3E2417] tracking-wider uppercase">
              TODOS VÍDEOS
            </h3>

            {/* Lista de Cards de Aulas */}
            <div className="space-y-3">
              {listaVideos.map((video, index) => {
                const isSelected = videoAtivo.id === video.id;
                const bloqueado =
                  acessoAtual.status !== 'autenticado' && index > 0;

                return (
                  <button
                    key={video.id}
                    onClick={() => handleSelecionarVideo(video)}
                    disabled={
                      acessoAtual.status === 'verificando' || bloqueado
                    }
                    className={`w-full p-3 rounded-2xl flex items-center justify-between gap-3 text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#FEF9A7] border-2 border-[#3E2417] shadow-sm'
                        : 'bg-[#FEF9A7]/70 border border-transparent hover:bg-[#FEF9A7]'
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {/* Miniatura do Card com Ícone Play */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-[#E2B79A]/40 border border-[#3E2417]/20 flex-shrink-0 flex items-center justify-center">
                        {bloqueado ? (
                          <svg
                            className="h-5 w-5 text-[#3E2417]"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M7 11V7a5 5 0 0 1 10 0v4m-11 0h12v10H6V11Z"
                            />
                          </svg>
                        ) : (
                          <div className="w-6 h-6 rounded-full border border-[#3E2417] flex items-center justify-center bg-white/60">
                            <svg
                              className="w-3 h-3 text-[#3E2417] translate-x-0.5"
                              fill="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Nome do Vídeo */}
                      <span className="text-xs sm:text-sm font-medium text-[#3E2417] truncate">
                        {video.tituloCurto}
                      </span>
                    </div>

                    {/* Duração Abreviada */}
                    {video.duracaoCurta && (
                      <span className="text-[11px] font-medium text-[#3E2417]/70 whitespace-nowrap pl-2">
                        {video.duracaoCurta}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {acessoAtual.status === 'verificando' && (
              <p className="text-sm text-stone-600">Verificando sua conta...</p>
            )}
            {acessoAtual.status === 'erro' && (
              <p role="alert" className="text-sm text-red-700">
                {acessoAtual.erro}
              </p>
            )}
            {!usuarioAutenticado && acessoAtual.status === 'visitante' && (
              <p className="text-sm text-stone-700">
                A primeira aula é grátis.{' '}
                <Link
                  to="/login"
                  className="font-bold underline"
                >
                  Entre ou crie uma conta
                </Link>{' '}
                para assistir aos outros vídeos.
              </p>
            )}
          </div>
        </div>
        )}

      </div>
    </div>
  );
}