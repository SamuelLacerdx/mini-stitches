class ErroSegurancaPagamento extends Error {
  constructor(message = 'Envie somente dados tokenizados do cartão.') { super(message); this.status = 400; }
}

function validarCorpoSeguro(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ErroSegurancaPagamento('Dados da solicitação inválidos.');
  const proibidos = new Set(['cardnumber', 'numerocartao', 'pan', 'cardpan', 'cvv', 'cvv2', 'cvc', 'cvc2',
    'securitycode', 'cardsecuritycode', 'codigoseguranca', 'senha', 'password', 'accesstoken', 'authorization', 'cookie']);
  let campos = 0;
  function visitar(valor, profundidade, contextoCartao = false) {
    if (profundidade > 12 || ++campos > 2000) throw new ErroSegurancaPagamento('Dados da solicitação inválidos.');
    if (!valor || typeof valor !== 'object') return;
    for (const [chave, conteudo] of Object.entries(valor)) {
      const normalizada = chave.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (proibidos.has(normalizada) || (contextoCartao && ['numero', 'number'].includes(normalizada)) ||
        (['numero', 'number'].includes(normalizada) && typeof conteudo === 'string' && /^\d{13,19}$/.test(conteudo.replace(/[ -]/g, '')))) {
        throw new ErroSegurancaPagamento();
      }
      visitar(conteudo, profundidade + 1, contextoCartao || ['card', 'cartao'].includes(normalizada));
    }
  }
  visitar(body, 0);
}

function validarTokenCartao(token) {
  if (typeof token !== 'string' || !/^[a-zA-Z0-9_-]{10,200}$/.test(token) || /^\d+$/.test(token)) {
    throw new ErroSegurancaPagamento('Informe um token de cartão válido.');
  }
  return token;
}

function segredosAplicacao(env) {
  const sessionSecret = env.SESSION_SECRET || 'mini-stitches-secret';
  const jwtSecret = env.JWT_SECRET || sessionSecret;
  if (env.NODE_ENV === 'production' && (!env.SESSION_SECRET || !env.JWT_SECRET || [sessionSecret, jwtSecret].some((valor) =>
    typeof valor !== 'string' || valor.trim().length < 32 || valor === 'mini-stitches-secret'))) {
    throw new Error('Configure SESSION_SECRET e JWT_SECRET fortes antes de iniciar em produção.');
  }
  return { sessionSecret, jwtSecret };
}

module.exports = { ErroSegurancaPagamento, validarCorpoSeguro, validarTokenCartao, segredosAplicacao };
