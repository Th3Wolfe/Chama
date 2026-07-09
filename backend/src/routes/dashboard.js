const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware');
const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  const [contagens, tempoMedio, filaSemResponsavel, listaAbertos, listaAndamento, resolvidosHoje, porCategoria, serieDiaria] = await Promise.all([
    pool.query(`SELECT * FROM vw_dashboard_admin`),
    pool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (resolvido_em - criado_em))) AS segundos
      FROM chamados WHERE resolvido_em IS NOT NULL
    `),
    // Fila de chamados sem responsável: para o admin assumir rapidamente
    pool.query(`
      SELECT c.*, cat.nome AS categoria_nome, s.nome AS setor_nome FROM chamados c
      JOIN categorias cat ON cat.id = c.categoria_id
      JOIN setores s ON s.id = c.setor_id
      WHERE c.responsavel_id IS NULL AND c.status <> 'resolvido'
      ORDER BY c.criado_em ASC
    `),
    // Todos os chamados abertos (independente de ter responsável ou não) —
    // é o que o técnico precisa ver de cara ao abrir o painel.
    pool.query(`
      SELECT c.*, cat.nome AS categoria_nome, s.nome AS setor_nome, r.nome AS responsavel_nome FROM chamados c
      JOIN categorias cat ON cat.id = c.categoria_id
      JOIN setores s ON s.id = c.setor_id
      LEFT JOIN usuarios r ON r.id = c.responsavel_id
      WHERE c.status = 'aberto'
      ORDER BY c.criado_em DESC
    `),
    // Todos os chamados em andamento (independente de ter responsável ou não)
    pool.query(`
      SELECT c.*, cat.nome AS categoria_nome, s.nome AS setor_nome, r.nome AS responsavel_nome FROM chamados c
      JOIN categorias cat ON cat.id = c.categoria_id
      JOIN setores s ON s.id = c.setor_id
      LEFT JOIN usuarios r ON r.id = c.responsavel_id
      WHERE c.status = 'em_andamento'
      ORDER BY c.criado_em DESC
    `),
    pool.query(`
      SELECT COUNT(*)::int AS total FROM chamados
      WHERE status = 'resolvido' AND resolvido_em::date = CURRENT_DATE
    `),
    pool.query(`
      SELECT cat.nome, COUNT(*)::int AS total
      FROM chamados c JOIN categorias cat ON cat.id = c.categoria_id
      WHERE date_trunc('month', c.criado_em) = date_trunc('month', CURRENT_DATE)
      GROUP BY cat.nome ORDER BY total DESC
    `),
    pool.query(`
      SELECT
        dia::date AS dia,
        COUNT(*) FILTER (WHERE c.status = 'aberto' AND c.criado_em::date <= dia)::int AS abertos,
        COUNT(*) FILTER (WHERE c.status = 'em_andamento' AND c.criado_em::date <= dia)::int AS em_andamento,
        COUNT(*) FILTER (WHERE c.status = 'resolvido' AND c.resolvido_em::date = dia)::int AS resolvidos
      FROM generate_series(CURRENT_DATE - INTERVAL '29 days', CURRENT_DATE, INTERVAL '1 day') AS dia
      LEFT JOIN chamados c ON c.criado_em::date <= dia
      GROUP BY dia ORDER BY dia
    `),
  ]);

  const porStatus = Object.fromEntries(contagens.rows.map((r) => [r.status, { total: Number(r.total), sem_responsavel: Number(r.sem_responsavel) }]));
  const segundosMedio = tempoMedio.rows[0].segundos;

  res.json({
    por_status: porStatus,
    tempo_medio_segundos: segundosMedio ? Math.round(segundosMedio) : null,
    resolvidos_hoje: resolvidosHoje.rows[0].total,
    fila_sem_responsavel: filaSemResponsavel.rows,
    chamados_abertos: listaAbertos.rows,
    chamados_em_andamento: listaAndamento.rows,
    por_categoria: porCategoria.rows,
    serie_diaria: serieDiaria.rows,
  });
});

module.exports = router;
