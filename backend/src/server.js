const app = require('./app');
const { encerrarBrowser } = require('./relatorio/pdf');

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

// PM2 envia SIGINT/SIGTERM em restart/reload/stop — sem isso, o processo do
// Chromium aberto pelo Puppeteer (relatorio/pdf.js) pode ficar órfão no
// servidor Windows.
async function desligar() {
  await encerrarBrowser();
  server.close(() => process.exit(0));
}
process.on('SIGINT', desligar);
process.on('SIGTERM', desligar);
