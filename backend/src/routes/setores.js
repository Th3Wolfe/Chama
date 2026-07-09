const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware');
const router = express.Router();

// Lista setores ativos (qualquer usuário autenticado, para preencher o formulário de abertura)
router.get('/', requireAuth, async (req, res) => {
  const somenteAtivos = req.query.todas === '1' ? '' : 'WHERE ativo = TRUE';
  const { rows } = await pool.query(
    `SELECT id, nome, ativo FROM setores ${somenteAtivos} ORDER BY nome`
  );
  res.json(rows);
});

// Cria setor (admin)
router.post('/', requireAdmin, async (req, res) => {
  const { nome } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO setores (nome) VALUES ($1) RETURNING *`,
      [nome]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe um setor com esse nome.' });
    throw err;
  }
});

// Edita setor (admin) - nome, ativo/inativo
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, ativo } = req.body;
  const { rows } = await pool.query(
    `UPDATE setores SET
       nome = COALESCE($1, nome),
       ativo = COALESCE($2, ativo)
     WHERE id = $3 RETURNING *`,
    [nome, ativo, id]
  );
  if (rows.length === 0) return res.status(404).json({ erro: 'Setor não encontrado.' });
  res.json(rows[0]);
});

// Exclui setor (admin). Se houver chamados usando esse setor, o banco
// bloqueia a exclusão (FK) — nesse caso orientamos a desativar em vez de excluir.
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM setores WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ erro: 'Setor não encontrado.' });
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        erro: 'Este setor está em uso por um ou mais chamados e não pode ser excluído. Desative-o em vez disso.',
      });
    }
    throw err;
  }
});

module.exports = router;
