const puppeteer = require('puppeteer');

// Instância única do browser Chromium, reaproveitada entre requisições —
// abrir/fechar um browser inteiro a cada PDF é caro (alguns segundos) e
// desnecessário; só a "page" é criada e destruída por requisição.
let browserPromise = null;

function obterBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: 'new',
      // --no-sandbox costuma ser necessário em ambientes Linux sem os pacotes
      // de sandbox do Chromium instalados (containers, alguns servidores);
      // inofensivo no Windows, onde não tem efeito. Mantido por segurança do
      // ambiente de deploy.
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    // Se o launch falhar, permite tentar de novo na próxima chamada em vez
    // de ficar preso numa Promise rejeitada para sempre.
    browserPromise.catch(() => {
      browserPromise = null;
    });
  }
  return browserPromise;
}

// Rodapé fixo repetido em toda página do PDF — feito via footerTemplate
// nativo do Puppeteer (mais confiável que tentar reproduzir isso com CSS de
// impressão, ver decisão registrada em gerarRodape() no template.js).
const FOOTER_TEMPLATE = `
  <div style="font-size:8px; width:100%; text-align:center; color:#8891A6; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;">
    Relatório gerado automaticamente pelo sistema Chama · Câmara Municipal de Itajubá
  </div>
`;

// Transforma o HTML do relatório (gerarHtmlRelatorio) num Buffer de PDF A4,
// com fundo escuro preservado e rodapé repetido em cada página.
async function gerarPdfRelatorio(html) {
  const browser = await obterBrowser();
  const page = await browser.newPage();
  try {
    // 'networkidle0' garante que qualquer recurso externo (ex.: fontes, se
    // algum dia forem carregadas via <link>) termine de carregar antes de
    // gerar o PDF. O ícone da capa já vem embutido em base64, então isso é
    // mais uma proteção do que uma necessidade hoje.
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      // Essencial: sem isso o Chromium imprime fundo branco e o tema escuro
      // do relatório inteiro se perde.
      printBackground: true,
      displayHeaderFooter: true,
      footerTemplate: FOOTER_TEMPLATE,
      headerTemplate: '<div></div>',
      margin: { top: '0mm', bottom: '14mm', left: '0mm', right: '0mm' },
    });

    return pdfBuffer;
  } finally {
    await page.close();
  }
}

// Encerra o browser Chromium compartilhado — útil num shutdown gracioso do
// processo (ex.: SIGTERM do PM2), pra não deixar o processo do Chromium
// órfão no servidor Windows.
async function encerrarBrowser() {
  if (!browserPromise) return;
  const browser = await browserPromise.catch(() => null);
  browserPromise = null;
  if (browser) await browser.close();
}

module.exports = { gerarPdfRelatorio, encerrarBrowser };
