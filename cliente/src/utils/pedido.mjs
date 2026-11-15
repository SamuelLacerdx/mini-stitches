const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const data = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' });
const dataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export const ETAPAS = ['Pagamento aprovado', 'Em preparação', 'Enviado', 'Entregue'];
const SITUACOES = {
  aguardando_pagamento: { etapa: 0, titulo: 'Aguardando pagamento', descricao: 'O pedido seguirá para preparação após a confirmação do pagamento.' },
  pago: { etapa: 1, titulo: 'Pagamento aprovado', descricao: 'Recebemos a confirmação. O próximo passo é separar os itens do seu pedido.' },
  em_separacao: { etapa: 2, titulo: 'Em preparação', descricao: 'Seus itens estão sendo separados. A próxima atualização será o envio.' },
  enviado: { etapa: 3, titulo: 'Pedido enviado', descricao: 'Seu pedido está a caminho. Consulte o código de rastreamento abaixo.' },
  entregue: { etapa: 4, titulo: 'Pedido entregue', descricao: 'A entrega foi registrada. Se precisar de ajuda com o que recebeu, fale com a gente.' },
  cancelado: { etapa: 0, titulo: 'Pedido cancelado', descricao: 'Este pedido foi cancelado. Para esclarecer o motivo ou a situação do pagamento, entre em contato.' },
};
const DESCONHECIDO = { etapa: 0, titulo: 'Status indisponível', descricao: 'Não foi possível identificar a etapa atual. Tente atualizar ou fale com a gente.' };

export function situacaoPedido(status) {
  return Object.hasOwn(SITUACOES, status) ? SITUACOES[status] : DESCONHECIDO;
}

export function formatarDinheiro(centavos) {
  return moeda.format((Number(centavos) || 0) / 100);
}

export function formatarData(valor, comHora = false) {
  if (!valor) return '';
  const instante = new Date(valor);
  return Number.isNaN(instante.getTime()) ? '' : (comHora ? dataHora : data).format(instante);
}

export function historicoPedido(historico) {
  return (Array.isArray(historico) ? historico : [])
    .filter((item) => item && formatarData(item.em))
    .sort((a, b) => new Date(b.em) - new Date(a.em));
}
