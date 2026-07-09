const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware');
const router = express.Router();

// Busca simples e rápida: cada tipo de resultado só aparece pra quem pode
// efetivamente ver aquele dado (usuário comum não vê chamados de outros,
// nem lista de usuários/equipamentos — isso é coisa de admin).
router.get('/', requireAuth, async (req, res) => {
  const termo = (req.query.q || '').trim();
  if (termo.length < 2) return res.json({ chamados: [], equipamentos: [], usuarios: [] });

  const isAdmin = req.user.perfil === 'admin';
  const curinga = `%${termo}%`;

  const consultaChamados = isAdmin
    ? pool.query(
        `SELECT id, titulo, status FROM chamados
         WHERE titulo ILIKE $1 OR descricao ILIKE $1
         ORDER BY criado_em DESC LIMIT 8`,
        [curinga]
      )
    : pool.query(
        `SELECT id, titulo, status FROM chamados
         WHERE aberto_por = $1 AND (titulo ILIKE $2 OR descricao ILIKE $2)
         ORDER BY criado_em DESC LIMIT 8`,
        [req.user.id, curinga]
      );

  const consultaEquipamentos = isAdmin
    ? pool.query(
        `SELECT id, nome, numero_serie FROM equipamentos
         WHERE nome ILIKE $1 OR numero_serie ILIKE $1 OR marca ILIKE $1 OR modelo ILIKE $1
         ORDER BY nome LIMIT 8`,
        [curinga]
      )
    : Promise.resolve({ rows: [] });

  const consultaUsuarios = isAdmin
    ? pool.query(
        `SELECT id, nome, email FROM usuarios
         WHERE ativo = TRUE AND (nome ILIKE $1 OR email ILIKE $1)
         ORDER BY nome LIMIT 8`,
        [curinga]
      )
    : Promise.resolve({ rows: [] });

  const [chamados, equipamentos, usuarios] = await Promise.all([
    consultaChamados,
    consultaEquipamentos,
    consultaUsuarios,
  ]);

  res.json({ chamados: chamados.rows, equipamentos: equipamentos.rows, usuarios: usuarios.rows });
});

module.exports = router;
