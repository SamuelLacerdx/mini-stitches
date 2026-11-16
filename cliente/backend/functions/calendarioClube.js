const fuso = 'America/Sao_Paulo';
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: fuso, year: 'numeric',
  month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });

function instante(valor) {
  if (typeof valor !== 'string' && !(valor instanceof Date)) throw new Error('Data ausente.');
  const data = new Date(valor);
  if (!Number.isFinite(data.getTime())) throw new Error('Data inválida.');
  return data;
}

function brasilia(valor) {
  return Object.fromEntries(formato.formatToParts(instante(valor))
    .filter((parte) => parte.type !== 'literal').map((parte) => [parte.type, Number(parte.value)]));
}

function validarMes(mes) {
  if (typeof mes !== 'string' || !/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes)) throw new Error('Mês inválido.');
  return mes;
}

function somarMes(mes, quantidade) {
  validarMes(mes);
  if (!Number.isSafeInteger(quantidade) || quantidade < 0) throw new Error('Sequência inválida.');
  const [ano, numero] = mes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, numero - 1 + quantidade, 1));
  return validarMes(data.toISOString().slice(0, 7));
}

function mesLocal(valor) {
  const { year, month } = brasilia(valor);
  return `${year}-${String(month).padStart(2, '0')}`;
}

function corte(mes) {
  validarMes(mes);
  return new Date(`${mes}-10T12:00:00-03:00`);
}

function primeiraCompetencia(aprovadoEm) {
  const mes = mesLocal(aprovadoEm);
  return instante(aprovadoEm) <= corte(mes) ? mes : somarMes(mes, 1);
}

function loteElegivel(competencia, aprovadoEm) {
  validarMes(competencia);
  const mes = mesLocal(aprovadoEm);
  if (instante(aprovadoEm) <= corte(competencia)) return competencia;
  return instante(aprovadoEm) <= corte(mes) ? mes : somarMes(mes, 1);
}

// O dia original é sempre recuperado da primeira aprovação, nunca de fevereiro.
function vencimentoMensal(primeiraAprovacao, sequencia) {
  const origem = brasilia(primeiraAprovacao);
  const mes = somarMes(mesLocal(primeiraAprovacao), sequencia);
  const [ano, numero] = mes.split('-').map(Number);
  const dia = Math.min(origem.day, new Date(Date.UTC(ano, numero, 0)).getUTCDate());
  return `${mes}-${String(dia).padStart(2, '0')}`;
}

function validarPostagem(mes, data) {
  validarMes(mes);
  if (typeof data !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(data) ||
    !Number.isFinite(new Date(data).getTime()) || new Date(data).toISOString().slice(0, 10) !== data ||
    data < `${mes}-10`) throw new Error('Postagem deve ser uma data válida a partir do dia 10 do lote.');
  return data;
}

module.exports = { instante, brasilia, validarMes, somarMes, corte, primeiraCompetencia,
  loteElegivel, vencimentoMensal, validarPostagem };
