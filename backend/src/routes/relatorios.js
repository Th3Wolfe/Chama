const express = require('express');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const pool = require('../db');
const { requireAdmin } = require('../middleware');
const { buscarDadosRelatorio } = require('../relatorio/dados');
const { gerarHtmlRelatorio } = require('../relatorio/template');
const { gerarPdfRelatorio } = require('../relatorio/pdf');
const router = express.Router();

// Relatório Executivo Operacional — dados agregados de um mês específico.
// Só os dados por enquanto (sem HTML/PDF ainda, isso entra nas próximas sprints).
// mes no formato YYYY-MM; sem o parâmetro, assume o mês corrente.
router.get('/executivo/dados', requireAdmin, async (req, res) => {
  try {
    const dados = await buscarDadosRelatorio(req.query.mes);
    res.json(dados);
  } catch (err) {
    if (err.message.includes('Parâmetro "mes" inválido')) {
      return res.status(400).json({ erro: err.message });
    }
    throw err;
  }
});

// Relatório Executivo Operacional — PDF final, pronto pra download.
// mes no formato YYYY-MM; sem o parâmetro, assume o mês corrente.
router.get('/executivo/pdf', requireAdmin, async (req, res) => {
  let dados;
  try {
    dados = await buscarDadosRelatorio(req.query.mes);
  } catch (err) {
    if (err.message.includes('Parâmetro "mes" inválido')) {
      return res.status(400).json({ erro: err.message });
    }
    throw err;
  }

  const html = gerarHtmlRelatorio(dados);
  const pdfBuffer = await gerarPdfRelatorio(html);

  const nomeArquivo = `relatorio-executivo-${dados.periodo.mes_ref}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  res.send(pdfBuffer);
});

async function enviarExcel(res, nomeArquivo, colunas, linhas) {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet('Relatório');
  planilha.columns = colunas;
  planilha.getRow(1).font = { bold: true };
  linhas.forEach((linha) => planilha.addRow(linha));

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  await workbook.xlsx.write(res);
  res.end();
}

function iniciarPdf(res, nomeArquivo, titulo) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  const doc = new PDFDocument({ margin: 50 });
  doc.pipe(res);
  doc.fontSize(18).text(titulo, { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).fillColor('gray').text(`Gerado em ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });
  doc.moveDown(1.5);
  doc.fillColor('black');
  return doc;
}

// Relatório mensal: totais, resolvidos, pendentes, tempo médio, por categoria
router.get('/mensal', requireAdmin, async (req, res) => {
  const mesRef = req.query.mes || new Date().toISOString().slice(0, 7); // YYYY-MM

  const [totais, porCategoria] = await Promise.all([
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status = 'resolvido')::int AS resolvidos,
         COUNT(*) FILTER (WHERE status <> 'resolvido')::int AS pendentes,
         AVG(EXTRACT(EPOCH FROM (resolvido_em - criado_em))) FILTER (WHERE resolvido_em IS NOT NULL) AS segundos_medio
       FROM chamados
       WHERE to_char(criado_em, 'YYYY-MM') = $1`,
      [mesRef]
    ),
    pool.query(
      `SELECT cat.nome, COUNT(*)::int AS total
       FROM chamados c JOIN categorias cat ON cat.id = c.categoria_id
       WHERE to_char(c.criado_em, 'YYYY-MM') = $1
       GROUP BY cat.nome ORDER BY total DESC`,
      [mesRef]
    ),
  ]);

  const t = totais.rows[0];
  const doc = iniciarPdf(res, `relatorio-mensal-${mesRef}.pdf`, `Relatório Mensal — ${mesRef}`);

  doc.fontSize(12);
  doc.text(`Total de chamados: ${t.total}`);
  doc.text(`Resolvidos: ${t.resolvidos}`);
  doc.text(`Pendentes: ${t.pendentes}`);
  doc.text(`Tempo médio de resolução: ${t.segundos_medio ? Math.round(t.segundos_medio / 3600) + 'h' : 'N/A'}`);
  doc.moveDown();
  doc.fontSize(14).text('Por categoria', { underline: true });
  doc.fontSize(12);
  porCategoria.rows.forEach((c) => doc.text(`${c.nome}: ${c.total}`));

  doc.end();
});

// Relatório mensal em Excel — mesmos dados do PDF, em planilha
router.get('/mensal/excel', requireAdmin, async (req, res) => {
  const mesRef = req.query.mes || new Date().toISOString().slice(0, 7);
  const { rows } = await pool.query(
    `SELECT cat.nome AS categoria, COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE c.status = 'resolvido')::int AS resolvidos,
            COUNT(*) FILTER (WHERE c.status <> 'resolvido')::int AS pendentes
     FROM chamados c JOIN categorias cat ON cat.id = c.categoria_id
     WHERE to_char(c.criado_em, 'YYYY-MM') = $1
     GROUP BY cat.nome ORDER BY total DESC`,
    [mesRef]
  );
  await enviarExcel(
    res,
    `relatorio-mensal-${mesRef}.xlsx`,
    [
      { header: 'Categoria', key: 'categoria', width: 30 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Resolvidos', key: 'resolvidos', width: 14 },
      { header: 'Pendentes', key: 'pendentes', width: 14 },
    ],
    rows
  );
});

// Relatório por técnico
router.get('/tecnico', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.nome, COUNT(*)::int AS total,
            AVG(EXTRACT(EPOCH FROM (c.resolvido_em - c.criado_em))) FILTER (WHERE c.resolvido_em IS NOT NULL) AS segundos_medio
     FROM chamados c JOIN usuarios u ON u.id = c.responsavel_id
     GROUP BY u.nome ORDER BY total DESC`
  );

  const doc = iniciarPdf(res, 'relatorio-por-tecnico.pdf', 'Relatório por Técnico');
  rows.forEach((r) => {
    const tempo = r.segundos_medio ? `${Math.round(r.segundos_medio / 3600)}h` : 'N/A';
    doc.fontSize(12).text(`${r.nome} — ${r.total} chamados — tempo médio: ${tempo}`);
  });
  doc.end();
});

// Relatório por setor
router.get('/setor', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.nome, COUNT(*)::int AS total
     FROM chamados c JOIN setores s ON s.id = c.setor_id
     GROUP BY s.nome ORDER BY total DESC`
  );
  const doc = iniciarPdf(res, 'relatorio-por-setor.pdf', 'Relatório por Setor');
  rows.forEach((r) => doc.fontSize(12).text(`${r.nome}: ${r.total}`));
  doc.end();
});

// Relatório por técnico em Excel
router.get('/tecnico/excel', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.nome AS tecnico, COUNT(*)::int AS total,
            AVG(EXTRACT(EPOCH FROM (c.resolvido_em - c.criado_em))) FILTER (WHERE c.resolvido_em IS NOT NULL) AS segundos_medio
     FROM chamados c JOIN usuarios u ON u.id = c.responsavel_id
     GROUP BY u.nome ORDER BY total DESC`
  );
  const linhas = rows.map((r) => ({
    tecnico: r.tecnico,
    total: r.total,
    tempo_medio_horas: r.segundos_medio ? Math.round((r.segundos_medio / 3600) * 10) / 10 : null,
  }));
  await enviarExcel(
    res,
    'relatorio-por-tecnico.xlsx',
    [
      { header: 'Técnico', key: 'tecnico', width: 30 },
      { header: 'Total de chamados', key: 'total', width: 18 },
      { header: 'Tempo médio (h)', key: 'tempo_medio_horas', width: 18 },
    ],
    linhas
  );
});

// Relatório por setor em Excel
router.get('/setor/excel', requireAdmin, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT s.nome AS setor, COUNT(*)::int AS total
     FROM chamados c JOIN setores s ON s.id = c.setor_id
     GROUP BY s.nome ORDER BY total DESC`
  );
  await enviarExcel(
    res,
    'relatorio-por-setor.xlsx',
    [
      { header: 'Setor', key: 'setor', width: 30 },
      { header: 'Total de chamados', key: 'total', width: 18 },
    ],
    rows
  );
});

module.exports = router;
