// Formatadores reaproveitados por template.js e resumo-inteligente.js.
// Extraído à parte só pra evitar que resumo-inteligente.js precise dar
// require em template.js (e template.js em resumo-inteligente.js) — um
// puxaria o outro em círculo.

// Converte segundos em algo como "4h 12m" (ou "18m" se < 1h, ou "2d 3h" se
// passar de 24h) — mesma ideia usada nos KPIs de tempo médio do protótipo.
function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined) return '—';
  const totalMinutos = Math.round(segundos / 60);
  const dias = Math.floor(totalMinutos / (60 * 24));
  const horas = Math.floor((totalMinutos % (60 * 24)) / 60);
  const minutos = totalMinutos % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${minutos > 0 ? `${horas}h ${minutos}m` : `${horas}h`}`;
  return `${minutos}m`;
}

module.exports = { formatarDuracao };
