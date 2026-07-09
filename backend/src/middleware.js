function requireAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ erro: 'Não autenticado.' });
}

function requireAdmin(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated() && req.user && req.user.perfil === 'admin') {
    return next();
  }
  return res.status(403).json({ erro: 'Acesso restrito a administradores.' });
}

module.exports = { requireAuth, requireAdmin };
