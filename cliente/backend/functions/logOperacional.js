const { createHash } = require('node:crypto');

const EVENTOS = new Set([
  'api.falha', 'banco.indisponivel', 'banco.conectado', 'servidor.iniciado',
  'webhook.configuracao', 'webhook.invalido', 'webhook.conciliado', 'webhook.pendente',
  'pagamento.pix_falhou', 'pagamento.boleto_falhou', 'pagamento.cartao_falhou',
  'pagamento.persistencia_pendente', 'pagamento.resultado_desconhecido', 'pagamento.reserva_pendente',
  'clube.contratacao_pendente', 'clube.autorizacao_pendente', 'clube.operacao_pendente',
  'cartao.referencia_falhou', 'pedido.pagamento_ausente', 'pedido.valor_divergente',
  'pedido.registro_falhou', 'pedido.listagem_falhou', 'pedido.status_falhou', 'pedido.consulta_falhou',
  'frete.consulta_falhou', 'frete.provedor_indisponivel', 'frete.resposta_invalida', 'frete.autorizacao_recusada',
  'conta.recuperacao_falhou', 'conta.redefinicao_falhou',
]);
const IDENTIFICADORES = ['tentativaId', 'pagamentoId', 'assinaturaId', 'operacaoId', 'preapprovalId', 'mensalidadeId'];
const RESULTADOS = new Set(['processada', 'duplicada', 'antiga', 'sem_vinculo', 'recorrente']);

// Aceita somente propriedades próprias de dados: não serializa objetos, Error,
// getters, requisições, respostas do provedor ou mensagens livres.
function propriedade(objeto, chave) {
  return objeto && typeof objeto === 'object' ? Object.getOwnPropertyDescriptor(objeto, chave)?.value : undefined;
}
function referenciaOperacional(tipo, identificador) {
  if (!IDENTIFICADORES.includes(tipo) || typeof identificador !== 'string' || !identificador || identificador.length > 256) return undefined;
  return createHash('sha256').update(`${tipo}:${identificador}`).digest('hex');
}
function criarLoggerOperacional({ saida = console, agora = () => new Date() } = {}) {
  function emitir(nivel, evento, contexto) {
    try {
      const registro = { versao: 1, em: agora().toISOString(), nivel,
        evento: EVENTOS.has(evento) ? evento : 'registro.descartado' };
      if (EVENTOS.has(evento)) {
        for (const tipo of IDENTIFICADORES) {
          const referencia = referenciaOperacional(tipo, propriedade(contexto, tipo));
          if (referencia) registro[tipo.replace(/Id$/, 'Ref')] = referencia;
        }
        const resultado = propriedade(contexto, 'resultado');
        if (RESULTADOS.has(resultado)) registro.resultado = resultado;
        const httpStatus = propriedade(contexto, 'httpStatus');
        if (Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) registro.httpStatus = httpStatus;
        const configurada = propriedade(contexto, 'configurada');
        if (typeof configurada === 'boolean') registro.configurada = configurada;
      }
      const destino = nivel === 'info' ? 'log' : nivel;
      saida[destino](JSON.stringify(registro));
    } catch { /* Indisponibilidade de logs não repete nem altera uma operação financeira. */ }
  }
  return { info: (evento, contexto) => emitir('info', evento, contexto),
    warn: (evento, contexto) => emitir('warn', evento, contexto),
    error: (evento, contexto) => emitir('error', evento, contexto) };
}
const loggerOperacional = criarLoggerOperacional();
module.exports = { criarLoggerOperacional, referenciaOperacional, loggerOperacional };
