// Gera o PDF do relatório de ponta a ponta (dados → HTML → Puppeteer) e salva
// num arquivo local, sem precisar do servidor Express nem de sessão de admin.
// Uso: node scripts/testar-relatorio-pdf.js 2026-07
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { buscarDadosRelatorio } = require('../src/relatorio/dados');
const { gerarHtmlRelatorio } = require('../src/relatorio/template');
const { gerarPdfRelatorioUmaPagina, encerrarBrowser } = require('../src/relatorio/pdf');
const pool = require('../src/db');

async function main() {
  const mes = process.argv[2];

  console.log(`Buscando dados do relatório para: ${mes || '(mês atual)'}`);
  const dados = await buscarDadosRelatorio(mes);

  console.log('Gerando HTML (modo página única)...');
  const html = gerarHtmlRelatorio(dados, { paginaUnica: true });

  console.log('Abrindo Chromium e gerando PDF (pode levar alguns segundos)...');
  const pdfBuffer = await gerarPdfRelatorioUmaPagina(html);

  const saida = path.join(__dirname, `relatorio-preview-${dados.periodo.mes_ref}.pdf`);
  fs.writeFileSync(saida, pdfBuffer);
  console.log(`PDF gerado em: ${saida}`);
  console.log('Abra esse arquivo pra conferir se ficou tudo numa página só, sem rodapé repetido.');
}

main()
  .catch((err) => console.error('Erro:', err))
  .finally(async () => {
    // Sem isso o processo do Node nunca sai sozinho: o browser do Puppeteer
    // e o pool de conexões do Postgres ficam abertos esperando a próxima
    // chamada, exatamente como fariam dentro do servidor de verdade.
    await encerrarBrowser();
    await pool.end();
  });
