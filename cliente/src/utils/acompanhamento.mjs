export function criarAcompanhamento({ url, selecionar, aoAtualizar, fetchImpl = fetch,
  documento = document, janela = window, agendar = setTimeout, cancelar = clearTimeout,
  agora = () => new Date(), repetir404 = false }) {
  let ativo = false;
  let consultando = false;
  let bloqueado = false;
  let falhas = 0;
  let timer;
  let controller;
  let dadosAnteriores = null;
  let atualizadoEm = null;

  async function consultar() {
    if (!ativo || consultando || bloqueado || documento.hidden) return;
    cancelar(timer);
    consultando = true;
    controller = new AbortController();
    const timeout = agendar(() => controller.abort(), 15000);
    let intervalo = 60000;
    try {
      const resposta = await fetchImpl(url, { credentials: 'include', cache: 'no-store', signal: controller.signal });
      if (!resposta.ok) {
        const erro = new Error('Falha na consulta');
        erro.status = resposta.status;
        throw erro;
      }
      const dados = selecionar(await resposta.json());
      if (!dados) throw new Error('Resposta inválida');
      if (!ativo) return;
      falhas = 0;
      dadosAnteriores = dados;
      atualizadoEm = agora().toISOString();
      const financeiro = dados.statusFinanceiro || dados.pedido?.statusFinanceiro;
      intervalo = ['aguardando_pagamento', 'desconhecido'].includes(financeiro) || dados.situacao === 'conciliacao_pendente' ? 4000 : 60000;
      aoAtualizar({ dados, atualizadoEm, erro: null, desatualizado: false });
    } catch (erro) {
      if (!ativo) return;
      const semAcesso = [401, 403, 404].includes(erro.status);
      bloqueado = semAcesso && !(erro.status === 404 && repetir404);
      if (semAcesso) dadosAnteriores = null;
      falhas++;
      intervalo = Math.min(30000 * 2 ** Math.min(falhas - 1, 3), 120000);
      aoAtualizar({ dados: semAcesso ? null : dadosAnteriores, atualizadoEm,
        statusErro: erro.status, desatualizado: !semAcesso && Boolean(dadosAnteriores),
        erro: erro.status === 401 ? 'Entre na sua conta para consultar o pagamento ou pedido.'
          : erro.status === 403 ? 'Sua conta não está autorizada para esta consulta.'
            : erro.status === 404 ? repetir404 ? 'Ainda não encontramos esta tentativa na sua conta. Aguarde ou consulte o atendimento antes de tentar outro pagamento.' : 'Pagamento ou pedido não encontrado na sua conta.'
              : erro.name === 'AbortError' ? 'A consulta demorou mais que o esperado. Tente novamente.'
                : 'Não foi possível atualizar a consulta. Os dados anteriores podem estar desatualizados.' });
    } finally {
      cancelar(timeout);
      consultando = false;
      if (ativo && !bloqueado && !documento.hidden) timer = agendar(consultar, intervalo);
    }
  }

  function atualizar() { cancelar(timer); return consultar(); }
  function visibilidade() { cancelar(timer); if (!documento.hidden) return consultar(); }
  return {
    iniciar() {
      if (ativo) return;
      ativo = true;
      documento.addEventListener('visibilitychange', visibilidade);
      janela.addEventListener('focus', atualizar);
      janela.addEventListener('pageshow', atualizar);
      return consultar();
    },
    parar() {
      ativo = false; cancelar(timer); controller?.abort();
      documento.removeEventListener('visibilitychange', visibilidade);
      janela.removeEventListener('focus', atualizar);
      janela.removeEventListener('pageshow', atualizar);
    },
    atualizar,
  };
}
