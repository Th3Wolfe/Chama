const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware');
const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.*, u.nome AS usuario_nome FROM equipamentos e
     LEFT JOIN usuarios u ON u.id = e.usuario_id
     ORDER BY e.nome`
  );
  res.json(rows);
});

router.post('/', requireAdmin, async (req, res) => {
  const { nome, marca, modelo, numero_serie, status, usuario_id } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  const { rows } = await pool.query(
    `INSERT INTO equipamentos (nome, marca, modelo, numero_serie, status, usuario_id)
     VALUES ($1, $2, $3, $4, COALESCE($5, 'ativo'), $6) RETURNING *`,
    [nome, marca || null, modelo || null, numero_serie || null, status, usuario_id || null]
  );
  res.status(201).json(rows[0]);
});

router.patch('/:id', requireAdmin, async (req, res) => {
  const { nome, marca, modelo, numero_serie, status, usuario_id } = req.body;
  const { rows } = await pool.query(
    `UPDATE equipamentos SET
       nome = COALESCE($1, nome),
       marca = COALESCE($2, marca),
       modelo = COALESCE($3, modelo),
       numero_serie = COALESCE($4, numero_serie),
       status = COALESCE($5, status),
       usuario_id = COALESCE($6, usuario_id)
     WHERE id = $7 RETURNING *`,
    [nome, marca, modelo, numero_serie, status, usuario_id, req.params.id]
  );
  if (rows.length === 0) return res.status(404).json({ erro: 'Equipamento não encontrado.' });
  res.json(rows[0]);
});

module.exports = router;
