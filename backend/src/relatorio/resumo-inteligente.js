// Resumo Executivo Inteligente (seção 8): parágrafos gerados por templates
// condicionais sobre os números já calculados em dados.js — mesma técnica dos
// "Destaques automáticos" (Sprint 3), só que em prosa mais longa (4 a 6 frases)
// e sem corte por relevância: aqui as frases têm uma ordem fixa e lógica
// (contexto geral → detalhamento → recomendação), não um ranking.
//
// Decisão do projeto: sem chamada a LLM, tudo por regra/template fixo.

const { formatarDuracao } = require('./formatadores');

// Meta de SLA usada só como referência neste resumo (o sistema não tem uma
// meta configurável ainda) — 90% é um valor de mercado comum pra suporte de TI.
const META_SLA_PCT = 90;

const NOMES_DIA_SEMANA = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado',
];

// Divide as 24h do dia em 4 períodos, pra descrever a concentração do heatmap
// de um jeito legível ("no período da manhã de segunda-feira") em vez de
// citar um horário cru ("às 9h").
const PERIODOS_DIA = [
  { nome: 'na madrugada', inicio: 0, fim: 6 },
  { nome: 'no período da manhã', inicio: 6, fim: 12 },
  { nome: 'no período da tarde', inicio: 12, fim: 18 },
  { nome: 'no período da noite', inicio: 18, fim: 24 },
];

// Acha o dia da semana com mais chamados no heatmap e, dentro dele, o período
// (madrugada/manhã/tarde/noite) de maior concentração.
function encontrarPicoOperacional(heatmap) {
  const { matriz } = heatmap;
  const totalPorDia = matriz.map((horas) => horas.reduce((s, v) => s + v, 0));
  const totalGeral = totalPorDia.reduce((s, v) => s + v, 0);
  if (totalGeral === 0) return null;

  const diaComMais = totalPorDia.indexOf(Math.max(...totalPorDia));
  const horasDoDia = matriz[diaComMais];

  const totalPorPeriodo = PERIODOS_DIA.map((p) => {
    let soma = 0;
    for (let h = p.inicio; h < p.fim; h += 1) soma += horasDoDia[h] || 0;
    return soma;
  });
  const periodoComMais = PERIODOS_DIA[totalPorPeriodo.indexOf(Math.max(...totalPorPeriodo))];

  return { diaNome: NOMES_DIA_SEMANA[diaComMais], periodoTexto: periodoComMais.nome };
}

function gerarResumoInteligente(dados) {
  const { kpis, por_setor: porSetor, por_categoria: porCategoria, equipamentos, sla_geral_pct: slaGeralPct, heatmap } = dados;
  const itens = [];

  // 1. Total de chamados e crescimento/queda em relação ao mês anterior.
  const deltaTotal = kpis.total_chamados.delta_pct;
  if (deltaTotal === null) {
    itens.push({
      icone: 'trending-up',
      texto: `Durante ${dados.periodo.mes_extenso} foram registrados ${kpis.total_chamados.valor} chamados.`,
    });
  } else {
    const substantivo = deltaTotal >= 0 ? 'crescimento' : 'redução';
    itens.push({
      icone: 'trending-up',
      texto: `Durante ${dados.periodo.mes_extenso} foram registrados ${kpis.total_chamados.valor} chamados, um ${substantivo} de ${Math.abs(deltaTotal)}% em relação ao mês anterior.`,
    });
  }

  // 2. Setor com maior demanda + categoria de maior origem dos incidentes.
  const maiorSetor = porSetor[0];
  const maiorCategoria = porCategoria[0];
  if (maiorSetor && maiorCategoria) {
    itens.push({
      icone: 'building',
      texto: `O setor ${maiorSetor.nome} concentrou a maior demanda (${maiorSetor.total} chamados), enquanto a categoria ${maiorCategoria.nome} permaneceu como a principal origem dos incidentes.`,
    });
  }

  // 3. SLA cumprido vs. meta de referência + variação do tempo médio de resolução.
  if (slaGeralPct !== null) {
    const relacaoMeta = slaGeralPct >= META_SLA_PCT ? 'acima da meta definida' : 'abaixo da meta definida';
    const deltaTempo = kpis.tempo_medio_resolucao_seg.delta_pct;
    const duracaoAtual = formatarDuracao(kpis.tempo_medio_resolucao_seg.valor);
    let complemento = '';
    if (deltaTempo !== null) {
      const verbo = deltaTempo <= 0 ? 'caiu' : 'subiu';
      const efeito = deltaTempo <= 0 ? 'indicando melhora na eficiência da equipe' : 'indicando atenção necessária na eficiência da equipe';
      complemento = `, e o tempo médio de resolução ${verbo} para ${duracaoAtual}, ${efeito}`;
    }
    itens.push({
      icone: 'check-circle',
      texto: `O cumprimento de SLA foi de ${slaGeralPct}%, ${relacaoMeta} (${META_SLA_PCT}%)${complemento}.`,
    });
  }

  // 4. Concentração de chamados por dia da semana / período do dia (heatmap).
  const pico = encontrarPicoOperacional(heatmap);
  if (pico) {
    itens.push({
      icone: 'calendar',
      texto: `Observou-se concentração de chamados ${pico.periodoTexto} de ${pico.diaNome}, sugerindo um pico operacional recorrente.`,
    });
  }

  // 5. Recomendação final: equipamento com alta variação positiva sugere
  // manutenção preventiva; setor concentrando muita demanda sugere revisar a
  // distribuição de chamados entre os técnicos.
  const recomendacoes = [];
  const equipProblematico = equipamentos.find((eq) => eq.delta_pct !== null && eq.delta_pct >= 15);
  if (equipProblematico) {
    const alvo = /impressora/i.test(equipProblematico.nome) ? 'impressoras' : `equipamentos como ${equipProblematico.nome}`;
    recomendacoes.push(`priorizar ações preventivas em ${alvo}`);
  }
  const setorConcentrado = porSetor.find((s) => s.percentual >= 25);
  if (setorConcentrado) {
    recomendacoes.push('revisar a distribuição de chamados entre os técnicos para reduzir sobrecarga');
  }
  if (recomendacoes.length > 0) {
    itens.push({
      icone: 'lightbulb',
      texto: `Recomenda-se ${recomendacoes.join(' e ')}.`,
    });
  }

  return itens;
}

module.exports = { gerarResumoInteligente, META_SLA_PCT };
