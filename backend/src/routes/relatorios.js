const express = require('express');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { requireAdmin } = require('../middleware');
const router = express.Router();

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

module.exports = router;
