const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware');
const router = express.Router();

// Lista categorias ativas (qualquer usuário autenticado, para preencher o formulário de abertura)
router.get('/', requireAuth, async (req, res) => {
  const somenteAtivas = req.query.todas === '1' ? '' : 'WHERE ativa = TRUE';
  const { rows } = await pool.query(
    `SELECT id, nome, descricao, prioridade_padrao, ativa FROM categorias ${somenteAtivas} ORDER BY nome`
  );
  res.json(rows);
});

// Cria categoria (admin)
router.post('/', requireAdmin, async (req, res) => {
  const { nome, descricao, prioridade_padrao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nome, descricao, prioridade_padrao) VALUES ($1, $2, $3) RETURNING *`,
      [nome, descricao || null, prioridade_padrao || 'media']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ erro: 'Já existe uma categoria com esse nome.' });
    throw err;
  }
});

// Edita categoria (admin) - nome, descrição, prioridade padrão, ativa/inativa
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { nome, descricao, prioridade_padrao, ativa } = req.body;
  const { rows } = await pool.query(
    `UPDATE categorias SET
       nome = COALESCE($1, nome),
       descricao = COALESCE($2, descricao),
       prioridade_padrao = COALESCE($3, prioridade_padrao),
       ativa = COALESCE($4, ativa)
     WHERE id = $5 RETURNING *`,
    [nome, descricao, prioridade_padrao, ativa, id]
  );
  if (rows.length === 0) return res.status(404).json({ erro: 'Categoria não encontrada.' });
  res.json(rows[0]);
});

// Exclui categoria (admin). Se houver chamados usando essa categoria, o banco
// bloqueia a exclusão (FK) — nesse caso orientamos a desativar em vez de excluir.
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM categorias WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ erro: 'Categoria não encontrada.' });
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        erro: 'Esta categoria está em uso por um ou mais chamados e não pode ser excluída. Desative-a em vez disso.',
      });
    }
    throw err;
  }
});

module.exports = router;
