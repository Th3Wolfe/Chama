// Gera o HTML do relatório (ainda sem PDF — isso é a Sprint 8) e salva num
// arquivo local, pra abrir direto no navegador e comparar com o protótipo.
// Uso: node scripts/testar-relatorio-html.js 2026-07
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { buscarDadosRelatorio } = require('../src/relatorio/dados');
const { gerarHtmlRelatorio } = require('../src/relatorio/template');
const pool = require('../src/db');

async function main() {
  const mes = process.argv[2];
  const dados = await buscarDadosRelatorio(mes);
  const html = gerarHtmlRelatorio(dados);

  const saida = path.join(__dirname, 'relatorio-preview.html');
  fs.writeFileSync(saida, html, 'utf-8');
  console.log(`HTML gerado em: ${saida}`);
  console.log('Abra esse arquivo no navegador pra conferir visualmente.');
}

main()
  .catch((err) => console.error('Erro:', err))
  .finally(() => pool.end());
