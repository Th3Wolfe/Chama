// Testa a Sprint 1 direto, sem precisar do servidor rodando nem de login.
// Uso: node scripts/testar-relatorio.js 2026-07
require('dotenv').config();
const { buscarDadosRelatorio } = require('../src/relatorio/dados');
const pool = require('../src/db');

async function main() {
  const mes = process.argv[2]; // se não passar nada, usa o mês atual
  console.log(`Buscando dados do relatório para: ${mes || '(mês atual)'}\n`);

  const dados = await buscarDadosRelatorio(mes);
  console.log(JSON.stringify(dados, null, 2));

  // Conferência rápida: total = resolvidos + backlog deve fechar
  const { total_chamados, resolvidos, backlog } = dados.kpis;
  const bate = total_chamados.valor === resolvidos.valor + backlog.valor;
  console.log(`\nConferência: total (${total_chamados.valor}) = resolvidos (${resolvidos.valor}) + backlog (${backlog.valor}) → ${bate ? 'OK ✓' : 'DIVERGENTE ✗'}`);
}

main()
  .catch((err) => console.error('Erro:', err))
  .finally(() => pool.end());
