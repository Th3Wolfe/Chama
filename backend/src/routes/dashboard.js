const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware');
const router = express.Router();

// SLA por prioridade: ainda não existe configuração de SLA no banco (confirmado
// via \d chamados / \d historico_status: não há tabela de SLA, só os enums
// prioridade_nivel e status_chamado), então usamos um prazo fixo por prioridade
// como regra de negócio provisória. Se/quando existir uma tabela de SLA por
// categoria, trocar esse CASE por um JOIN nela.
const SLA_INTERVALO = `CASE c.prioridade_atual
  WHEN 'alta' THEN INTERVAL '4 hours'
  WHEN 'media' THEN INTERVAL '24 hours'
  ELSE INTERVAL '72 hours'
END`;

// Usado nas listas "prioridade agora" e "minha fila": sem o solicitante (aberto_por).
const SELECT_CHAMADO_COM_SLA = `
  SELECT
    c.*, cat.nome AS categoria_nome, s.nome AS setor_nome, r.nome AS responsavel_nome,
    EXTRACT(EPOCH FROM ((c.criado_em + ${SLA_INTERVALO}) - now()))::int AS sla_segundos_restantes
  FROM chamados c
  JOIN categorias cat ON cat.id = c.categoria_id
  JOIN setores s ON s.id = c.setor_id
  LEFT JOIN usuarios r ON r.id = c.responsavel_id
`;

// Usado na tabela "Últimos chamados ativos": inclui o nome de quem abriu
// (coluna "Cliente" no protótipo).
const SELECT_CHAMADO_ATIVO = `
  SELECT
    c.*, cat.nome AS categoria_nome, s.nome AS setor_nome, r.nome AS responsavel_nome,
    ab.nome AS aberto_por_nome,
    EXTRACT(EPOCH FROM ((c.criado_em + ${SLA_INTERVALO}) - now()))::int AS sla_segundos_restantes
  FROM chamados c
  JOIN categorias cat ON cat.id = c.categoria_id
  JOIN setores s ON s.id = c.setor_id
  JOIN usuarios ab ON ab.id = c.aberto_por
  LEFT JOIN usuarios r ON r.id = c.responsavel_id
`;

router.get('/', requireAdmin, async (req, res) => {
  const meuId = req.user.id;
  // Período do gráfico "Tendência de chamados" — só aceita valores pré-definidos
  // (evita interpolar algo arbitrário de querystring direto no SQL).
  const diasTendencia = [7, 14, 30].includes(Number(req.query.dias)) ? Number(req.query.dias) : 7;

  const [
    contagens,
    tempoMedio,
    filaSemResponsavel,
    chamadosAtivos,
    resolvidosHoje,
    resolvidosOntem,
    porCategoria,
    serieSeteDias,
    prioridadeAgora,
    minhaFilaAguardando,
    minhaFilaClienteRespondeu,
    minhaFilaSlaVencendo,
    tendenciaTempoMedio,
    tendenciaSla,
    atividadeRecente,
    totalChamados,
    criadosHoje,
    criadosOntem,
    andamentoHojeOntem,
    aguardandoCliente,
    resolvidosTotal,
    alertasSla,
    porSetor,
    serieResolvidosSeteDias,
    slaGeral,
  ] = await Promise.all([
    pool.query(`SELECT * FROM vw_dashboard_admin`),
    pool.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (resolvido_em - criado_em))) AS segundos
      FROM chamados WHERE resolvido_em IS NOT NULL
    `),
    // Fila global de chamados sem responsável: qualquer um pode assumir.
    // Também reaproveitada dentro de "minha_fila.sem_responsavel".
    pool.query(`
      ${SELECT_CHAMADO_COM_SLA}
      WHERE c.responsavel_id IS NULL AND c.status <> 'resolvido'
      ORDER BY c.criado_em ASC
    `),
    // "Últimos chamados ativos": lista única (sem abas), mais recente primeiro,
    // igual ao protótipo — colunas Cliente/Prioridade/SLA/Atualizado em.
    pool.query(`
      ${SELECT_CHAMADO_ATIVO}
      WHERE c.status <> 'resolvido'
      ORDER BY c.atualizado_em DESC
      LIMIT 10
    `),
    pool.query(`
      SELECT COUNT(*)::int AS total FROM chamados
      WHERE status = 'resolvido' AND resolvido_em::date = CURRENT_DATE
    `),
    pool.query(`
      SELECT COUNT(*)::int AS total FROM chamados
      WHERE status = 'resolvido' AND resolvido_em::date = CURRENT_DATE - 1
    `),
    pool.query(`
      SELECT cat.nome, COUNT(*)::int AS total
      FROM chamados c JOIN categorias cat ON cat.id = c.categoria_id
      WHERE date_trunc('month', c.criado_em) = date_trunc('month', CURRENT_DATE)
      GROUP BY cat.nome ORDER BY total DESC
    `),
    // Chamados criados por dia, no período selecionado — alimenta o gráfico
    // "Tendência de chamados".
    pool.query(`
      SELECT
        dia::date AS dia,
        COUNT(c.id) FILTER (WHERE c.criado_em::date = dia)::int AS total
      FROM generate_series(CURRENT_DATE - INTERVAL '${diasTendencia - 1} days', CURRENT_DATE, INTERVAL '1 day') AS dia
      LEFT JOIN chamados c ON c.criado_em::date = dia
      GROUP BY dia ORDER BY dia
    `),
    // "Prioridade agora": o chamado que mais precisa de atenção neste instante.
    // Prioriza quem não tem responsável e, dentro disso, quem está mais perto
    // (ou já passou) do prazo de SLA calculado.
    pool.query(`
      ${SELECT_CHAMADO_COM_SLA}
      WHERE c.status <> 'resolvido'
      ORDER BY (c.responsavel_id IS NULL) DESC, sla_segundos_restantes ASC
      LIMIT 1
    `),
    // Minha fila (1): chamados atribuídos a mim que ainda não comecei a atender.
    pool.query(`
      ${SELECT_CHAMADO_COM_SLA}
      WHERE c.responsavel_id = $1 AND c.status = 'aberto'
      ORDER BY c.criado_em ASC
    `, [meuId]),
    // Minha fila (2): chamados meus em andamento onde a última resposta foi
    // do solicitante — ou seja, a bola está comigo.
    pool.query(`
      WITH ultimo_comentario AS (
        SELECT DISTINCT ON (chamado_id) chamado_id, autor_id, criado_em
        FROM comentarios ORDER BY chamado_id, criado_em DESC
      )
      ${SELECT_CHAMADO_COM_SLA.trim()}
      JOIN ultimo_comentario uc ON uc.chamado_id = c.id
      WHERE c.responsavel_id = $1 AND c.status = 'em_andamento' AND uc.autor_id <> $1
      ORDER BY uc.criado_em ASC
    `, [meuId]),
    // Minha fila (3): chamados meus com SLA vencendo em até 2 horas (ou já vencido).
    pool.query(`
      ${SELECT_CHAMADO_COM_SLA}
      WHERE c.responsavel_id = $1 AND c.status <> 'resolvido'
        AND (c.criado_em + ${SLA_INTERVALO}) - now() <= INTERVAL '2 hours'
      ORDER BY sla_segundos_restantes ASC
    `, [meuId]),
    // Tendência do tempo médio de resolução: últimas 24h vs 24h anteriores.
    pool.query(`
      SELECT
        AVG(EXTRACT(EPOCH FROM (resolvido_em - criado_em))) FILTER (WHERE resolvido_em >= now() - INTERVAL '24 hours') AS medio_hoje,
        AVG(EXTRACT(EPOCH FROM (resolvido_em - criado_em))) FILTER (WHERE resolvido_em >= now() - INTERVAL '48 hours' AND resolvido_em < now() - INTERVAL '24 hours') AS medio_ontem
      FROM chamados WHERE resolvido_em IS NOT NULL
    `),
    // Tendência de SLA cumprido: % resolvido dentro do prazo, hoje vs ontem.
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE resolvido_em::date = CURRENT_DATE)::int AS total_hoje,
        COUNT(*) FILTER (WHERE resolvido_em::date = CURRENT_DATE AND resolvido_em <= criado_em + ${SLA_INTERVALO})::int AS dentro_hoje,
        COUNT(*) FILTER (WHERE resolvido_em::date = CURRENT_DATE - 1)::int AS total_ontem,
        COUNT(*) FILTER (WHERE resolvido_em::date = CURRENT_DATE - 1 AND resolvido_em <= criado_em + ${SLA_INTERVALO})::int AS dentro_ontem
      FROM chamados c WHERE resolvido_em IS NOT NULL
    `),
    // Feed de atividades: últimos eventos do sistema (chamados criados,
    // comentários e mudanças de status), unificados por ordem cronológica.
    pool.query(`
      (
        SELECT 'novo_chamado' AS tipo, c.id AS chamado_id, c.titulo AS chamado_titulo,
               u.nome AS autor_nome, NULL::text AS detalhe, c.criado_em AS quando
        FROM chamados c JOIN usuarios u ON u.id = c.aberto_por
        ORDER BY c.criado_em DESC LIMIT 8
      )
      UNION ALL
      (
        SELECT 'comentario', co.chamado_id, c.titulo,
               u.nome, LEFT(co.texto, 80), co.criado_em
        FROM comentarios co
        JOIN chamados c ON c.id = co.chamado_id
        JOIN usuarios u ON u.id = co.autor_id
        ORDER BY co.criado_em DESC LIMIT 8
      )
      UNION ALL
      (
        SELECT 'mudanca_status', h.chamado_id, c.titulo,
               u.nome, h.status_novo::text, h.alterado_em
        FROM historico_status h
        JOIN chamados c ON c.id = h.chamado_id
        JOIN usuarios u ON u.id = h.alterado_por
        ORDER BY h.alterado_em DESC LIMIT 8
      )
      ORDER BY quando DESC
      LIMIT 8
    `),
    // Novo bloco de KPIs "estilo operação" (protótipo de alta fidelidade da Home).
    pool.query(`SELECT COUNT(*)::int AS total FROM chamados`),
    pool.query(`SELECT COUNT(*)::int AS total FROM chamados WHERE criado_em::date = CURRENT_DATE`),
    pool.query(`SELECT COUNT(*)::int AS total FROM chamados WHERE criado_em::date = CURRENT_DATE - 1`),
    // "Em andamento" (delta): chamados que entraram nesse status hoje vs ontem.
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE alterado_em::date = CURRENT_DATE)::int AS hoje,
        COUNT(*) FILTER (WHERE alterado_em::date = CURRENT_DATE - 1)::int AS ontem
      FROM historico_status WHERE status_novo = 'em_andamento'
    `),
    // "Aguardando cliente": chamados em andamento cujo último comentário foi do
    // responsável — ou seja, a bola está com o solicitante.
    pool.query(`
      WITH ultimo_comentario AS (
        SELECT DISTINCT ON (chamado_id) chamado_id, autor_id
        FROM comentarios ORDER BY chamado_id, criado_em DESC
      )
      SELECT COUNT(*)::int AS total
      FROM chamados c
      JOIN ultimo_comentario uc ON uc.chamado_id = c.id
      WHERE c.status = 'em_andamento' AND uc.autor_id = c.responsavel_id
    `),
    pool.query(`SELECT COUNT(*)::int AS total FROM chamados WHERE status = 'resolvido'`),
    // Alertas de SLA agrupados por faixa de urgência (para o painel "Alertas de SLA").
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE sla_segundos_restantes < 0)::int AS critico,
        COUNT(*) FILTER (WHERE sla_segundos_restantes >= 0 AND sla_segundos_restantes <= 7200)::int AS alto,
        COUNT(*) FILTER (WHERE sla_segundos_restantes > 7200 AND sla_segundos_restantes <= 28800)::int AS medio
      FROM (
        SELECT EXTRACT(EPOCH FROM ((c.criado_em + ${SLA_INTERVALO}) - now()))::int AS sla_segundos_restantes
        FROM chamados c WHERE c.status <> 'resolvido'
      ) sub
    `),
    // Chamados por setor (mês atual) — alimenta o gráfico de barras horizontal.
    pool.query(`
      SELECT s.nome, COUNT(*)::int AS total
      FROM chamados c JOIN setores s ON s.id = c.setor_id
      WHERE date_trunc('month', c.criado_em) = date_trunc('month', CURRENT_DATE)
      GROUP BY s.nome ORDER BY total DESC
    `),
    // Resolvidos por dia (últimos 7 dias) — série própria do card "Desempenho da
    // equipe", intencionalmente diferente da série de criados usada em "Tendência
    // de chamados" (uma mostra entrada de trabalho, a outra mostra vazão da equipe).
    pool.query(`
      SELECT dia::date AS dia, COUNT(c.id)::int AS total
      FROM generate_series(CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day') AS dia
      LEFT JOIN chamados c ON c.resolvido_em::date = dia
      GROUP BY dia ORDER BY dia
    `),
    // SLA geral (todo o histórico, não só hoje): usado no card "Desempenho da
    // equipe" para ficar consistente com as outras métricas do mesmo card (taxa
    // de resolução e tempo médio também são calculados sobre todo o histórico —
    // usar só "hoje" fazia esse número virar N/A sempre que não havia resolução
    // no dia, parecendo quebrado ao lado dos outros dois valores).
    pool.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE resolvido_em <= criado_em + ${SLA_INTERVALO})::int AS dentro
      FROM chamados c WHERE resolvido_em IS NOT NULL
    `),
  ]);

  const porStatus = Object.fromEntries(
    contagens.rows.map((r) => [r.status, { total: Number(r.total), sem_responsavel: Number(r.sem_responsavel) }])
  );
  const segundosMedio = tempoMedio.rows[0].segundos;

  // Calcula variação percentual com proteção contra divisão por zero.
  function variacaoPercentual(atual, anterior) {
    if (anterior === null || anterior === undefined || Number(anterior) === 0) return null;
    return Math.round(((Number(atual) - Number(anterior)) / Number(anterior)) * 100);
  }

  const resolvidosHojeTotal = resolvidosHoje.rows[0].total;
  const resolvidosOntemTotal = resolvidosOntem.rows[0].total;

  const { medio_hoje: medioHoje, medio_ontem: medioOntem } = tendenciaTempoMedio.rows[0];
  const { total_hoje: slaTotalHoje, dentro_hoje: slaDentroHoje, total_ontem: slaTotalOntem, dentro_ontem: slaDentroOntem } = tendenciaSla.rows[0];

  const slaPctHoje = slaTotalHoje > 0 ? Math.round((slaDentroHoje / slaTotalHoje) * 100) : null;
  const slaPctOntem = slaTotalOntem > 0 ? Math.round((slaDentroOntem / slaTotalOntem) * 100) : null;
  const slaPctGeral = slaGeral.rows[0].total > 0 ? Math.round((slaGeral.rows[0].dentro / slaGeral.rows[0].total) * 100) : null;

  res.json({
    por_status: porStatus,
    tempo_medio_segundos: segundosMedio ? Math.round(segundosMedio) : null,
    // Obs: aqui um valor negativo é bom (tempo médio caiu vs. ontem) — quem
    // consome decide como colorir, ao contrário dos outros deltas onde negativo é ruim.
    tempo_medio_delta_pct: variacaoPercentual(medioHoje, medioOntem),
    resolvidos_hoje: resolvidosHojeTotal,
    resolvidos_hoje_delta_pct: variacaoPercentual(resolvidosHojeTotal, resolvidosOntemTotal),
    sla_dentro_prazo_pct: slaPctGeral,
    sla_dentro_prazo_delta_pct: slaPctHoje !== null && slaPctOntem !== null ? slaPctHoje - slaPctOntem : null,
    fila_sem_responsavel: filaSemResponsavel.rows,
    chamados_ativos: chamadosAtivos.rows,
    por_categoria: porCategoria.rows,
    serie_sete_dias: serieSeteDias.rows,
    prioridade_agora: prioridadeAgora.rows[0] ?? null,
    minha_fila: {
      aguardando_meu_atendimento: minhaFilaAguardando.rows,
      cliente_respondeu: minhaFilaClienteRespondeu.rows,
      sla_vencendo: minhaFilaSlaVencendo.rows,
      sem_responsavel: filaSemResponsavel.rows,
    },
    atividade_recente: atividadeRecente.rows,
    total_chamados: totalChamados.rows[0].total,
    total_chamados_delta_pct: variacaoPercentual(criadosHoje.rows[0].total, criadosOntem.rows[0].total),
    em_andamento_delta_pct: variacaoPercentual(andamentoHojeOntem.rows[0].hoje, andamentoHojeOntem.rows[0].ontem),
    aguardando_cliente_total: aguardandoCliente.rows[0].total,
    taxa_resolucao_pct: totalChamados.rows[0].total > 0
      ? Math.round((resolvidosTotal.rows[0].total / totalChamados.rows[0].total) * 100)
      : null,
    alertas_sla: alertasSla.rows[0],
    por_setor: porSetor.rows,
    serie_resolvidos_sete_dias: serieResolvidosSeteDias.rows,
  });
});

module.exports = router;
