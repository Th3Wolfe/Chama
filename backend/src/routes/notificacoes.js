const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware');
const router = express.Router();

// Lista notificações do usuário logado (mais recentes primeiro)
router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT n.*, c.titulo AS chamado_titulo
     FROM notificacoes n
     LEFT JOIN chamados c ON c.id = n.chamado_id
     WHERE n.usuario_id = $1
     ORDER BY n.criado_em DESC LIMIT 50`,
    [req.user.id]
  );
  res.json(rows);
});

// Contagem de não lidas — usado para o "sininho" ser atualizado via polling
router.get('/nao-lidas/contagem', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS total FROM notificacoes WHERE usuario_id = $1 AND lida = FALSE`,
    [req.user.id]
  );
  res.json(rows[0]);
});

router.patch('/:id/lida', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `UPDATE notificacoes SET lida = TRUE WHERE id = $1 AND usuario_id = $2 RETURNING *`,
    [req.params.id, req.user.id]
  );
  if (rows.length === 0) return res.status(404).json({ erro: 'Notificação não encontrada.' });
  res.json(rows[0]);
});

// Marca todas as notificações do usuário logado como lidas de uma vez
router.patch('/lidas', requireAuth, async (req, res) => {
  await pool.query(
    `UPDATE notificacoes SET lida = TRUE WHERE usuario_id = $1 AND lida = FALSE`,
    [req.user.id]
  );
  res.json({ ok: true });
});

module.exports = router;
