const express = require('express');
const passport = require('passport');
const router = express.Router();

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL}/login?erro=1`,
  }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL);
  }
);

router.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    const { id, nome, email, perfil, setor } = req.user;
    return res.json({ id, nome, email, perfil, setor });
  }
  res.status(401).json({ erro: 'Não autenticado.' });
});

router.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ erro: 'Erro ao encerrar sessão.' });
    res.json({ ok: true });
  });
});

module.exports = router;
