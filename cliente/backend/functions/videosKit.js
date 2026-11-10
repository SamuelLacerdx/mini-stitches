function normalizarVideosDoKit(videos) {
  if (!Array.isArray(videos)) {
    return [];
  }

  return videos
    .map((video, index) => {
      const titulo = String(video?.titulo || "").trim();
      const url = String(video?.url || "").trim();

      if (!titulo && !url) {
        return null;
      }

      return {
        titulo,
        url,
        ordem: Number(video?.ordem ?? index + 1),
        ativo: video?.ativo !== undefined ? Boolean(video.ativo) : true,
      };
    })
    .filter(Boolean);
}

function sincronizarVideosDoKitComStatus(videos, ativoKit) {
  if (!Array.isArray(videos)) {
    return [];
  }

  return videos.map((video) => ({
    ...(video && typeof video === "object" ? video : {}),
    ativo: Boolean(ativoKit) && video?.ativo !== false,
  }));
}

module.exports = { normalizarVideosDoKit, sincronizarVideosDoKitComStatus };
