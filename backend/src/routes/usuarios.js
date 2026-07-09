const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware');
const router = express.Router();

// Lista usuários ativos — usado pelo admin para atribuir responsáveis a
// chamados (só admins/técnicos, via ?perfil=admin) e donos de equipamentos
// (qualquer usuário, sem o filtro).
router.get('/', requireAdmin, async (req, res) => {
  const { perfil } = req.query;
  const condicao = perfil ? 'AND perfil = $1' : '';
  const valores = perfil ? [perfil] : [];
  const { rows } = await pool.query(
    `SELECT id, nome, email, perfil, setor FROM usuarios WHERE ativo = TRUE ${condicao} ORDER BY nome`,
    valores
  );
  res.json(rows);
});

module.exports = router;
