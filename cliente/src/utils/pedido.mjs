const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const data = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short' });
const dataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });

export const ETAPAS = ['Liberação para preparo', 'Em preparação', 'Enviado', 'Entregue'];
const SITUACOES = {
  aguardando_pagamento: { etapa: 0, titulo: 'Aguardando pagamento', descricao: 'O pedido seguirá para preparação após a confirmação do pagamento.' },
  pago: { etapa: 1, titulo: 'Aguardando preparação', descricao: 'A situação financeira é apresentada separadamente e determina a liberação da expedição.' },
  em_separacao: { etapa: 2, titulo: 'Em preparação', descricao: 'Seus itens estão sendo separados. A próxima atualização será o envio.' },
  enviado: { etapa: 3, titulo: 'Pedido enviado', descricao: 'Seu pedido está a caminho. Consulte o código de rastreamento abaixo.' },
  entregue: { etapa: 4, titulo: 'Pedido entregue', descricao: 'A entrega foi registrada. Se precisar de ajuda com o que recebeu, fale com a gente.' },
  cancelado: { etapa: 0, titulo: 'Pedido cancelado', descricao: 'Este pedido foi cancelado. Para esclarecer o motivo ou a situação do pagamento, entre em contato.' },
};
const DESCONHECIDO = { etapa: 0, titulo: 'Status indisponível', descricao: 'Não foi possível identificar a etapa atual. Tente atualizar ou fale com a gente.' };

export function situacaoPedido(status) {
  return Object.hasOwn(SITUACOES, status) ? SITUACOES[status] : DESCONHECIDO;
}

const FINANCEIRO = {
  aguardando_pagamento: { titulo: 'Aguardando pagamento', descricao: 'Aguardamos a confirmação do pagamento.' },
  aprovado: { titulo: 'Pagamento aprovado', descricao: 'O provedor confirmou o pagamento.' },
  recusado: { titulo: 'Pagamento recusado', descricao: 'O pagamento foi recusado pelo provedor.' },
  cancelado: { titulo: 'Pagamento cancelado', descricao: 'O provedor confirmou o cancelamento do pagamento.' },
  reembolsado: { titulo: 'Pagamento reembolsado', descricao: 'O provedor registrou o reembolso. A disponibilização do crédito depende do meio de pagamento.' },
  parcialmente_reembolsado: { titulo: 'Pagamento parcialmente reembolsado', descricao: 'Uma parte do pagamento foi reembolsada. Consulte o valor registrado abaixo.' },
  em_contestacao: { titulo: 'Pagamento em contestação', descricao: 'O pagamento está em disputa. A expedição fica bloqueada enquanto houver pendência financeira.' },
  contestado: { titulo: 'Pagamento contestado', descricao: 'O provedor registrou uma contestação do pagamento. Entre em contato para acompanhar o caso.' },
  desconhecido: { titulo: 'Pagamento a conferir', descricao: 'A situação financeira precisa ser confirmada com o atendimento.' },
};

export function financeiroPedido(pedido) {
  if (pedido?.statusFinanceiro) return Object.hasOwn(FINANCEIRO, pedido.statusFinanceiro) ? pedido.statusFinanceiro : 'desconhecido';
  return ['pago', 'em_separacao', 'enviado', 'entregue'].includes(pedido?.status) ? 'aprovado'
    : pedido?.status === 'aguardando_pagamento' ? 'aguardando_pagamento' : 'desconhecido';
}

export function situacaoFinanceira(status) {
  return Object.hasOwn(FINANCEIRO, status) ? FINANCEIRO[status] : FINANCEIRO.desconhecido;
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
