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

// Lista paginada + métricas agregadas, usada pela tela administrativa de Categorias
// (cards de resumo, busca por nome, contagem de chamados vinculados por categoria).
router.get('/admin', requireAdmin, async (req, res) => {
  const busca = (req.query.busca || '').trim();
  const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 6, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * pageSize;

  const condicoes = [];
  const valores = [];
  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`c.nome ILIKE $${valores.length}`);
  }
  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  // COUNT(*) OVER() traz o total de linhas (após o filtro de busca, antes do
  // LIMIT) na mesma consulta — mesmo padrão usado em GET /chamados.
  valores.push(pageSize, offset);
  const { rows } = await pool.query(
    `SELECT c.id, c.nome, c.descricao, c.icone, c.prioridade_padrao, c.ativa, c.atualizado_em,
            COUNT(ch.id) AS chamados_vinculados,
            COUNT(*) OVER() AS total_geral
     FROM categorias c
     LEFT JOIN chamados ch ON ch.categoria_id = c.id
     ${where}
     GROUP BY c.id
     ORDER BY c.nome
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores
  );

  const total = rows.length > 0 ? Number(rows[0].total_geral) : 0;
  const dados = rows.map(({ total_geral, chamados_vinculados, ...resto }) => ({
    ...resto,
    chamados_vinculados: Number(chamados_vinculados),
  }));

  // Métricas dos cards de resumo no topo — sempre sobre o total geral, não
  // sobre a página/busca atual.
  const { rows: statsRows } = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM categorias) AS total,
       (SELECT COUNT(*) FROM categorias WHERE ativa) AS ativas,
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
      ativas: Number(statsRows[0].ativas),
      chamados_vinculados: Number(statsRows[0].chamados_vinculados),
    },
  });
});

// Cria categoria (admin)
router.post('/', requireAdmin, async (req, res) => {
  const { nome, descricao, prioridade_padrao, icone } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório.' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO categorias (nome, descricao, prioridade_padrao, icone) VALUES ($1, $2, $3, $4) RETURNING *`,
      [nome, descricao || null, prioridade_padrao || 'media', icone || 'monitor']
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
  const { nome, descricao, prioridade_padrao, ativa, icone } = req.body;
  const { rows } = await pool.query(
    `UPDATE categorias SET
       nome = COALESCE($1, nome),
       descricao = COALESCE($2, descricao),
       prioridade_padrao = COALESCE($3, prioridade_padrao),
       ativa = COALESCE($4, ativa),
       icone = COALESCE($5, icone)
     WHERE id = $6 RETURNING *`,
    [nome, descricao, prioridade_padrao, ativa, icone, id]
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
