const pool = require('../db');

// Mesmo prazo provisório por prioridade usado em routes/dashboard.js — mantido
// aqui em vez de importado para não acoplar os dois módulos por causa de uma
// constante pequena. Só 3 níveis (baixa/media/alta): o sistema não tem
// "crítica" no schema, e o relatório foi ajustado pra refletir isso.
const SLA_INTERVALO = `CASE c.prioridade_atual
  WHEN 'alta' THEN INTERVAL '4 hours'
  WHEN 'media' THEN INTERVAL '24 hours'
  ELSE INTERVAL '72 hours'
END`;

const NOMES_MES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

// Converte "2026-07" em info de calendário usada em toda a função. Trabalha
// só com o primeiro dia de cada mês (como string 'YYYY-MM-DD'), deixando a
// aritmética de mês para o Postgres via INTERVAL — evita bug de fuso/dia 31
// que apareceria fazendo isso manualmente em JS.
function limitesMes(mesRef) {
  const [anoStr, mesStr] = mesRef.split('-');
  const ano = Number(anoStr);
  const mes = Number(mesStr);
  if (!ano || !mes || mes < 1 || mes > 12) {
    throw new Error('Parâmetro "mes" inválido. Use o formato YYYY-MM.');
  }
  const inicioMes = `${anoStr}-${mesStr}-01`;
  return { inicioMes, mesExtenso: `${NOMES_MES[mes - 1]} de ${ano}`, ano, mes };
}

function variacaoPercentual(atual, anterior) {
  const a = Number(atual) || 0;
  const b = Number(anterior);
  if (!b) return null;
  return Math.round(((a - b) / b) * 100);
}

// Média móvel simples de N dias sobre uma série já ordenada por data.
function comMediaMovel(serie, janela = 7) {
  return serie.map((ponto, i) => {
    const inicio = Math.max(0, i - janela + 1);
    const fatia = serie.slice(inicio, i + 1);
    const media = fatia.reduce((soma, p) => soma + p.total, 0) / fatia.length;
    return { ...ponto, media_movel: Math.round(media * 10) / 10 };
  });
}

async function buscarDadosRelatorio(mesRefBruto) {
  const mesRef = mesRefBruto || new Date().toISOString().slice(0, 7);
  const { inicioMes, mesExtenso, ano } = limitesMes(mesRef);

  // Filtro reaproveitado em várias queries: "está dentro do mês de referência".
  // $1 = inicioMes ('YYYY-MM-01'). Mês anterior = mesmo filtro subtraindo 1 mês.
  const FILTRO_MES_ATUAL = `date_trunc('month', c.criado_em) = date_trunc('month', $1::date)`;
  const FILTRO_MES_ANTERIOR = `date_trunc('month', c.criado_em) = date_trunc('month', $1::date - INTERVAL '1 month')`;

  const [
    kpisAtual,
    kpisAnterior,
    serieDiaria,
    heatmap,
    porCategoria,
    porSetor,
    porSetorAnterior,
    porPrioridade,
    equipamentosAtual,
    equipamentosAnterior,
    tecnicos,
    slaPorPrioridade,
  ] = await Promise.all([
    // KPIs do mês de referência.
    pool.query(
      `SELECT
         COUNT(*)::int AS total_chamados,
         COUNT(*) FILTER (WHERE c.status = 'resolvido')::int AS resolvidos,
         COUNT(*) FILTER (WHERE c.status <> 'resolvido')::int AS backlog,
         AVG(EXTRACT(EPOCH FROM (c.resolvido_em - c.criado_em))) FILTER (WHERE c.resolvido_em IS NOT NULL) AS tempo_medio_resolucao_seg,
         AVG(EXTRACT(EPOCH FROM (c.primeira_resposta_em - c.criado_em))) FILTER (WHERE c.primeira_resposta_em IS NOT NULL) AS tempo_medio_1a_resposta_seg,
         COUNT(*) FILTER (WHERE c.resolvido_em IS NOT NULL)::int AS total_com_resolucao,
         COUNT(*) FILTER (WHERE c.resolvido_em IS NOT NULL AND c.resolvido_em <= c.criado_em + ${SLA_INTERVALO})::int AS dentro_sla
       FROM chamados c WHERE ${FILTRO_MES_ATUAL}`,
      [inicioMes]
    ),
    // Mesmos KPIs, mês anterior — usados só para os deltas.
    pool.query(
      `SELECT
         COUNT(*)::int AS total_chamados,
         COUNT(*) FILTER (WHERE c.status = 'resolvido')::int AS resolvidos,
         COUNT(*) FILTER (WHERE c.status <> 'resolvido')::int AS backlog,
         AVG(EXTRACT(EPOCH FROM (c.resolvido_em - c.criado_em))) FILTER (WHERE c.resolvido_em IS NOT NULL) AS tempo_medio_resolucao_seg,
         AVG(EXTRACT(EPOCH FROM (c.primeira_resposta_em - c.criado_em))) FILTER (WHERE c.primeira_resposta_em IS NOT NULL) AS tempo_medio_1a_resposta_seg,
         COUNT(*) FILTER (WHERE c.resolvido_em IS NOT NULL)::int AS total_com_resolucao,
         COUNT(*) FILTER (WHERE c.resolvido_em IS NOT NULL AND c.resolvido_em <= c.criado_em + ${SLA_INTERVALO})::int AS dentro_sla
       FROM chamados c WHERE ${FILTRO_MES_ANTERIOR}`,
      [inicioMes]
    ),
    // Série diária de chamados criados no mês (base do gráfico de linha).
    pool.query(
      `SELECT
         dia::date AS dia,
         COUNT(c.id) FILTER (WHERE c.criado_em::date = dia)::int AS total
       FROM generate_series($1::date, ($1::date + INTERVAL '1 month' - INTERVAL '1 day')::date, INTERVAL '1 day') AS dia
       LEFT JOIN chamados c ON c.criado_em::date = dia
       GROUP BY dia ORDER BY dia`,
      [inicioMes]
    ),
    // Heatmap: dia da semana × hora, volume de chamados criados no mês.
    // (O eixo mostra rótulos só de 4 em 4 horas, mas cada quadrado é 1h — ver
    // gerarHeatmap em graficos-svg.js.)
    pool.query(
      `SELECT
         EXTRACT(DOW FROM c.criado_em)::int AS dia_semana,
         EXTRACT(HOUR FROM c.criado_em)::int AS hora_bloco,
         COUNT(*)::int AS total
       FROM chamados c WHERE ${FILTRO_MES_ATUAL}
       GROUP BY dia_semana, hora_bloco`,
      [inicioMes]
    ),
    // Distribuição por categoria (mês de referência).
    pool.query(
      `SELECT cat.nome, COUNT(*)::int AS total
       FROM chamados c JOIN categorias cat ON cat.id = c.categoria_id
       WHERE ${FILTRO_MES_ATUAL}
       GROUP BY cat.nome ORDER BY total DESC`,
      [inicioMes]
    ),
    // Distribuição por setor (mês de referência).
    pool.query(
      `SELECT s.nome, COUNT(*)::int AS total
       FROM chamados c JOIN setores s ON s.id = c.setor_id
       WHERE ${FILTRO_MES_ATUAL}
       GROUP BY s.nome ORDER BY total DESC`,
      [inicioMes]
    ),
    // Distribuição por setor do mês anterior — só pra calcular o delta % usado
    // nos Destaques automáticos (Sprint 3); não tinha sido trazido na Sprint 1.
    pool.query(
      `SELECT s.nome, COUNT(*)::int AS total
       FROM chamados c JOIN setores s ON s.id = c.setor_id
       WHERE ${FILTRO_MES_ANTERIOR}
       GROUP BY s.nome`,
      [inicioMes]
    ),
    // Distribuição por prioridade — só baixa/media/alta (ver nota no topo do arquivo).
    pool.query(
      `SELECT c.prioridade_atual, COUNT(*)::int AS total
       FROM chamados c WHERE ${FILTRO_MES_ATUAL}
       GROUP BY c.prioridade_atual`,
      [inicioMes]
    ),
    // Equipamentos problemáticos: quantidade no mês de referência...
    pool.query(
      `SELECT e.id, e.nome, e.marca, COUNT(*)::int AS total
       FROM chamados c JOIN equipamentos e ON e.id = c.equipamento_id
       WHERE ${FILTRO_MES_ATUAL}
       GROUP BY e.id, e.nome, e.marca ORDER BY total DESC LIMIT 5`,
      [inicioMes]
    ),
    // ...e no mês anterior, pra calcular a variação % em JS.
    pool.query(
      `SELECT e.id, COUNT(*)::int AS total
       FROM chamados c JOIN equipamentos e ON e.id = c.equipamento_id
       WHERE ${FILTRO_MES_ANTERIOR}
       GROUP BY e.id`,
      [inicioMes]
    ),
    // Desempenho dos técnicos: resolvidos no mês + % dentro do SLA, com foto do Google.
    pool.query(
      `SELECT
         u.id, u.nome, u.foto_url,
         COUNT(*)::int AS resolvidos,
         COUNT(*) FILTER (WHERE c.resolvido_em <= c.criado_em + ${SLA_INTERVALO})::int AS dentro_sla
       FROM chamados c JOIN usuarios u ON u.id = c.responsavel_id
       WHERE c.resolvido_em IS NOT NULL AND ${FILTRO_MES_ATUAL}
       GROUP BY u.id, u.nome, u.foto_url
       ORDER BY resolvidos DESC LIMIT 5`,
      [inicioMes]
    ),
    // SLA cumprido, quebrado por prioridade (para o velocímetro + tabela).
    pool.query(
      `SELECT
         c.prioridade_atual,
         COUNT(*) FILTER (WHERE c.resolvido_em IS NOT NULL)::int AS total,
         COUNT(*) FILTER (WHERE c.resolvido_em IS NOT NULL AND c.resolvido_em <= c.criado_em + ${SLA_INTERVALO})::int AS dentro_sla
       FROM chamados c WHERE ${FILTRO_MES_ATUAL}
       GROUP BY c.prioridade_atual`,
      [inicioMes]
    ),
  ]);

  // --- KPIs + deltas ---
  function montarKpis(atual, anterior) {
    const slaPct = atual.total_com_resolucao > 0
      ? Math.round((atual.dentro_sla / atual.total_com_resolucao) * 100)
      : null;
    const slaPctAnterior = anterior.total_com_resolucao > 0
      ? Math.round((anterior.dentro_sla / anterior.total_com_resolucao) * 100)
      : null;
    return {
      total_chamados: { valor: atual.total_chamados, delta_pct: variacaoPercentual(atual.total_chamados, anterior.total_chamados) },
      sla_cumprido_pct: { valor: slaPct, delta_pontos: slaPct !== null && slaPctAnterior !== null ? slaPct - slaPctAnterior : null },
      tempo_medio_resolucao_seg: { valor: atual.tempo_medio_resolucao_seg ? Math.round(atual.tempo_medio_resolucao_seg) : null, delta_pct: variacaoPercentual(atual.tempo_medio_resolucao_seg, anterior.tempo_medio_resolucao_seg) },
      tempo_medio_1a_resposta_seg: { valor: atual.tempo_medio_1a_resposta_seg ? Math.round(atual.tempo_medio_1a_resposta_seg) : null, delta_pct: variacaoPercentual(atual.tempo_medio_1a_resposta_seg, anterior.tempo_medio_1a_resposta_seg) },
      resolvidos: { valor: atual.resolvidos, delta_pct: variacaoPercentual(atual.resolvidos, anterior.resolvidos) },
      backlog: { valor: atual.backlog, delta_pct: variacaoPercentual(atual.backlog, anterior.backlog) },
    };
  }
  const kpis = montarKpis(kpisAtual.rows[0], kpisAnterior.rows[0]);

  // --- Série diária + média móvel de 7 dias ---
  const serieComMedia = comMediaMovel(serieDiaria.rows, 7);

  // --- Heatmap normalizado em matriz [dia_semana][hora] = total ---
  // Um quadrado por hora (0..23); os rótulos do eixo é que aparecem só de 4
  // em 4h — ver ROTULO_A_CADA_N_COLUNAS em gerarHeatmap.
  const blocosHora = Array.from({ length: 24 }, (_, hora) => hora);
  const heatmapMatriz = Array.from({ length: 7 }, (_, diaSemana) =>
    blocosHora.map((hora) => {
      const cel = heatmap.rows.find((r) => r.dia_semana === diaSemana && r.hora_bloco === hora);
      return cel ? cel.total : 0;
    })
  );

  // --- Distribuições com percentual calculado ---
  function comPercentual(linhas) {
    const total = linhas.reduce((s, r) => s + r.total, 0);
    return linhas.map((r) => ({ ...r, percentual: total > 0 ? Math.round((r.total / total) * 100) : 0 }));
  }

  // --- Equipamentos com variação vs. mês anterior ---
  const equipamentos = equipamentosAtual.rows.map((eq) => {
    const anteriorLinha = equipamentosAnterior.rows.find((r) => r.id === eq.id);
    return {
      nome: eq.nome,
      marca: eq.marca,
      total: eq.total,
      delta_pct: variacaoPercentual(eq.total, anteriorLinha ? anteriorLinha.total : 0),
    };
  });

  // --- Técnicos com % SLA individual ---
  const tecnicosComSla = tecnicos.rows.map((t) => ({
    nome: t.nome,
    foto_url: t.foto_url,
    resolvidos: t.resolvidos,
    sla_pct: t.resolvidos > 0 ? Math.round((t.dentro_sla / t.resolvidos) * 100) : null,
  }));

  // --- SLA por prioridade, incluindo o geral (para o velocímetro) ---
  const slaGeralTotal = slaPorPrioridade.rows.reduce((s, r) => s + r.total, 0);
  const slaGeralDentro = slaPorPrioridade.rows.reduce((s, r) => s + r.dentro_sla, 0);
  const slaPorPrioridadeFormatado = ['alta', 'media', 'baixa'].map((nivel) => {
    const linha = slaPorPrioridade.rows.find((r) => r.prioridade_atual === nivel) || { total: 0, dentro_sla: 0 };
    return {
      prioridade: nivel,
      total: linha.total,
      dentro_sla: linha.dentro_sla,
      pct: linha.total > 0 ? Math.round((linha.dentro_sla / linha.total) * 100) : null,
    };
  });

  return {
    periodo: {
      mes_ref: mesRef,
      mes_extenso: mesExtenso,
      ano,
      inicio: inicioMes,
      instituicao: 'Câmara Municipal de Itajubá',
      gerado_em: new Date().toISOString(),
    },
    kpis,
    serie_diaria: serieComMedia,
    heatmap: { blocos_hora: blocosHora, matriz: heatmapMatriz },
    por_categoria: comPercentual(porCategoria.rows),
    por_setor: comPercentual(porSetor.rows).map((r) => {
      const anteriorLinha = porSetorAnterior.rows.find((a) => a.nome === r.nome);
      return { ...r, delta_pct: variacaoPercentual(r.total, anteriorLinha ? anteriorLinha.total : 0) };
    }),
    por_prioridade: comPercentual(
      ['baixa', 'media', 'alta'].map((nivel) => ({
        nome: nivel,
        total: (porPrioridade.rows.find((r) => r.prioridade_atual === nivel) || { total: 0 }).total,
      }))
    ),
    equipamentos,
    tecnicos: tecnicosComSla,
    sla_por_prioridade: slaPorPrioridadeFormatado,
    sla_geral_pct: slaGeralTotal > 0 ? Math.round((slaGeralDentro / slaGeralTotal) * 100) : null,
  };
}

module.exports = { buscarDadosRelatorio };
