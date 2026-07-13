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

// Lista paginada + métricas agregadas, usada pela tela administrativa de Setores
// (cards de resumo, busca por nome, contagem de chamados vinculados por setor).
router.get('/admin', requireAdmin, async (req, res) => {
  const busca = (req.query.busca || '').trim();
  const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 6, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * pageSize;

  const condicoes = [];
  const valores = [];
  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`s.nome ILIKE $${valores.length}`);
  }
  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  valores.push(pageSize, offset);
  const { rows } = await pool.query(
    `SELECT s.id, s.nome, s.icone, s.ativo, s.atualizado_em,
            COUNT(ch.id) AS chamados_vinculados,
            COUNT(*) OVER() AS total_geral
     FROM setores s
     LEFT JOIN chamados ch ON ch.setor_id = s.id
     ${where}
     GROUP BY s.id
     ORDER BY s.nome
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores
  );

  const total = rows.length > 0 ? Number(rows[0].total_geral) : 0;
  const dados = rows.map(({ total_geral, chamados_vinculados, ...resto }) => ({
    ...resto,
    chamados_vinculados: Number(chamados_vinculados),
  }));

  const { rows: statsRows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM setores) AS total,
       (SELECT COUNT(*) FROM setores WHERE ativo) AS ativos,
       (SELECT COUNT(*) FROM chamados) AS chamados_vinculados`
  );

  res.json({
    dados,
    total,
    page,
    page_size: pageSize,
    total_paginas: Math.max(Math.ceil(total / pageSize), 1),
    stats: {
      total: Number(statsRows[0].total),
      ativos: Number(statsRows[0].ativos),
      chamados_vinculados: Number(statsRows[0].chamados_vinculados),
    },
  });
});

// Cria setor (admin)
router.post('/', requireAdmin, async (req, res) => {
  const { nome, icone } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO setores (nome, icone) VALUES ($1, $2) RETURNING *`,
      [nome, icone || 'building-2']
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
  const { nome, ativo, icone } = req.body;
  const { rows } = await pool.query(
    `UPDATE setores SET
       nome = COALESCE($1, nome),
       ativo = COALESCE($2, ativo),
       icone = COALESCE($3, icone)
     WHERE id = $4 RETURNING *`,
    [nome, ativo, icone, id]
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
