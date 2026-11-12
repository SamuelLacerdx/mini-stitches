const jwt = require("jsonwebtoken");

function criarAutenticacao({ jwtSecret }) {
  function lerToken(req) {
    const tokenCookie = (req.headers.cookie || "")
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("token="));
    return tokenCookie?.slice("token=".length);
  }

  function autenticar(req, res, next) {
    const token = lerToken(req);

    if (token) {
      try {
        const dadosToken = jwt.verify(token, jwtSecret);
        req.session.usuarioId = dadosToken.usuarioId;
        req.session.perfil = dadosToken.perfil;
      } catch {
        return res
          .status(401)
          .json({ erro: "Sessão inválida. Faça login novamente." });
      }
    }

    if (!req.session.usuarioId) {
      return res.status(401).json({ erro: "Faça login para continuar." });
    }
    next();
  }

  function autenticarAdmin(req, res, next) {
    autenticar(req, res, () => {
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
        const dadosToken = jwt.verify(token, jwtSecret);
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
