// Destaques automáticos (seção 3 do relatório): frases geradas por regras
// fixas sobre os números já calculados em dados.js — sem chamada a LLM,
// conforme decisão do projeto. Cada regra vira um candidato com uma
// "relevância" (magnitude da variação/participação); no fim ordenamos por
// relevância e cortamos nos 5 primeiros, igual ao protótipo.

function gerarDestaques(dados) {
  const candidatos = [];
  const { kpis, por_setor: porSetor, por_categoria: porCategoria, tecnicos } = dados;

  // 1. Crescimento/queda do total de chamados no período.
  const deltaTotal = kpis.total_chamados.delta_pct;
  if (deltaTotal !== null && deltaTotal !== 0) {
    const verbo = deltaTotal > 0 ? 'cresceram' : 'caíram';
    candidatos.push({
      icone: 'trending-up',
      texto: `Os chamados ${verbo} ${Math.abs(deltaTotal)}% em relação ao mês anterior.`,
      relevancia: Math.abs(deltaTotal),
    });
  }

  // 2. Setor com maior aumento (não necessariamente o de maior volume) —
  // olhamos o setor com maior delta_pct positivo entre os que têm dados no
  // mês anterior, priorizando setores com bastante volume pra evitar destacar
  // um setor pequeno que dobrou de 1 pra 2 chamados.
  const setoresComAumento = porSetor
    .filter((s) => s.delta_pct !== null && s.delta_pct > 0 && s.total >= 5)
    .sort((a, b) => b.delta_pct - a.delta_pct);
  if (setoresComAumento.length > 0) {
    const maiorSetor = setoresComAumento[0];
    candidatos.push({
      icone: 'building',
      texto: `O setor ${maiorSetor.nome} apresentou aumento de ${maiorSetor.delta_pct}% nos incidentes.`,
      relevancia: maiorSetor.delta_pct,
    });
  }

  // 3. Tempo médio de resolução — só quando caiu (é a notícia boa a destacar).
  const deltaTempoMedio = kpis.tempo_medio_resolucao_seg.delta_pct;
  if (deltaTempoMedio !== null && deltaTempoMedio < 0) {
    candidatos.push({
      icone: 'check-circle',
      texto: `O tempo médio de resolução caiu ${Math.abs(deltaTempoMedio)}% no período.`,
      relevancia: Math.abs(deltaTempoMedio),
    });
  }

  // 4. Categoria com maior participação no total de chamados do mês.
  const maiorCategoria = porCategoria[0];
  if (maiorCategoria && maiorCategoria.percentual > 0) {
    candidatos.push({
      icone: 'printer',
      texto: `${maiorCategoria.nome} respondeu por ${maiorCategoria.percentual}% dos chamados.`,
      relevancia: maiorCategoria.percentual,
    });
  }

  // 5. Técnico que mais recebeu chamados no mês, como % do total de chamados.
  const maiorTecnico = tecnicos[0];
  if (maiorTecnico && kpis.total_chamados.valor > 0) {
    const pct = Math.round((maiorTecnico.resolvidos / kpis.total_chamados.valor) * 100);
    if (pct > 0) {
      candidatos.push({
        icone: 'user',
        texto: `${maiorTecnico.nome} recebeu ${pct}% dos chamados do mês.`,
        relevancia: pct,
      });
    }
  }

  // Ordena pelos mais relevantes (maior variação/participação primeiro) e
  // limita a 5, igual ao protótipo.
  return candidatos
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, 5)
    .map(({ icone, texto }) => ({ icone, texto }));
}

module.exports = { gerarDestaques };
