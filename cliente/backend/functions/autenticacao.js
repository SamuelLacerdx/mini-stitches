const jwt = require("jsonwebtoken");

function criarAutenticacao({ jwtSecret, consultarConta }) {
  function lerToken(req) {
    const tokenCookie = (req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("token="));
    return tokenCookie?.slice("token=".length);
  }

  function autenticar(req, res, next) {
    res.set('Cache-Control', 'private, no-store');
    const token = lerToken(req);

    if (token) {
      try {
        const dadosToken = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
        if (!dadosToken || typeof dadosToken !== 'object' || typeof dadosToken.usuarioId !== 'string' || !dadosToken.usuarioId.trim()) {
          throw new Error('Identidade inválida');
        }
        req.session.usuarioId = dadosToken.usuarioId;
        req.session.perfil = dadosToken.perfil;
      } catch {
        return res
          .status(401)
          .json({ erro: "Sessão inválida. Faça login novamente." });
      }
    }

    if (!req.session.usuarioId || (typeof req.session.usuarioId !== 'string' && typeof req.session.usuarioId.toHexString !== 'function')) {
      return res.status(401).json({ erro: "Faça login para continuar." });
    }
    if (!consultarConta) return next();
    return Promise.resolve().then(() => consultarConta(String(req.session.usuarioId))).then((conta) => {
      if (!conta || conta.status !== true) {
        delete req.session.usuarioId;
        delete req.session.perfil;
        return res.status(403).json({ erro: 'Conta indisponível para esta operação.' });
      }
      // Privilégios são lidos do banco, sem confiar em um JWT antigo.
      req.session.perfil = conta.perfil === 'admin' ? 'admin' : 'cliente';
      return next();
    }, () => res.status(503).json({ erro: 'Não foi possível validar sua conta. Tente novamente.' }));
  }

  function autenticarAdmin(req, res, next) {
    return autenticar(req, res, () => {
      if (req.session.perfil !== "admin") {
        return res
          .status(403)
          .json({ erro: "Acesso restrito ao painel administrativo." });
      }
      next();
    });
  }

  function clienteIdDoCarrinho(req) {
    if (req.session.usuarioId) {
      return String(req.session.usuarioId);
    }

    const token = lerToken(req);

    if (token) {
      try {
        const dadosToken = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
        if (typeof dadosToken?.usuarioId !== 'string' || !dadosToken.usuarioId.trim()) throw new Error('Identidade inválida');
        req.session.usuarioId = dadosToken.usuarioId;
        req.session.perfil = dadosToken.perfil;
        return String(dadosToken.usuarioId);
      } catch {
        // Sessões expiradas continuam podendo usar um carrinho de visitante.
      }
    }

    req.session.carrinhoVisitante = true;
    return null;
  }

  return { autenticar, autenticarAdmin, clienteIdDoCarrinho };
}

module.exports = { criarAutenticacao };
