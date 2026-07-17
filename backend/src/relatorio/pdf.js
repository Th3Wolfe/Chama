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

// Transforma o HTML do relatório (gerarHtmlRelatorio) num Buffer de PDF A4,
// com fundo escuro preservado. O rodapé não é mais repetido por página via
// footerTemplate do Puppeteer (o fundo escuro dele em toda página não
// agradou visualmente) — quem cuida do rodapé agora é o próprio HTML, uma
// única vez, no fim do conteúdo.
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
      displayHeaderFooter: false,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
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

const PX_POR_MM_96DPI = 96 / 25.4;

// Transforma o HTML do relatório num PDF de UMA página A4 só, encolhendo o
// conteúdo o quanto for necessário pra caber (se necessário).
//
// Por que "zoom" e não o "scale" nativo do page.pdf(): o "scale" do
// Puppeteer encolhe o conteúdo só visualmente, mantendo-o ancorado no canto
// superior esquerdo da folha — o resultado é uma folha A4 cheia com uma
// versão em miniatura do relatório num canto e um vazio enorme embaixo/à
// direita. O CSS "zoom", em vez disso, faz o Chromium refluir o layout como
// se a página fosse fisicamente menor, então o conteúdo reduzido continua
// ocupando 100% da largura impressa.
//
// Processo em duas passadas:
//   1) renderiza em tamanho normal (zoom 1) só pra medir a altura real do
//      conteúdo;
//   2) se não coube em 1 página, calcula o zoom necessário e re-renderiza
//      com um viewport proporcionalmente mais largo, de forma que — depois
//      do zoom aplicado — o conteúdo volte a preencher a largura inteira da
//      folha.
async function gerarPdfRelatorioUmaPagina(html) {
  const browser = await obterBrowser();
  const page = await browser.newPage();
  try {
    // Sem margem de página: o Chromium nunca pinta o fundo (nem escuro nem
    // nenhum outro) dentro da área de margem do PDF — ela sempre aparece em
    // branco, não importa o que tenha na página. O respiro visual em volta
    // do conteúdo já vem do padding do próprio CSS (.conteudo,
    // .topo__conteudo), então margem de página aqui só criava as faixas
    // brancas no topo/rodapé.
    const LARGURA_A4_MM = 210;
    const ALTURA_A4_MM = 297;
    const larguraPx = Math.round(LARGURA_A4_MM * PX_POR_MM_96DPI);
    const alturaDisponivelPx = ALTURA_A4_MM * PX_POR_MM_96DPI;

    await page.setViewport({ width: larguraPx, height: 1200 });
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const alturaConteudoPx = await page.evaluate(() => document.body.scrollHeight);

    // Zoom mínimo de segurança: 0.55 (usado antes) deixava o texto pequeno
    // demais pra ler — 13px de fonte base virava ~7px. 0.85 é bem mais
    // conservador: encolhe só o necessário, e se o conteúdo ainda não couber
    // nos 297mm de A4 nesse piso, a página cresce além disso (continua sendo
    // UMA página só, sem quebra — só não é mais estritamente do tamanho
    // físico de uma folha A4).
    const ZOOM_MINIMO = 0.85;
    const zoomNecessario = alturaDisponivelPx / alturaConteudoPx;
    const zoom = Math.min(1, Math.max(ZOOM_MINIMO, zoomNecessario));

    if (zoom < 1) {
      const larguraAjustadaPx = Math.round(larguraPx / zoom);
      await page.setViewport({ width: larguraAjustadaPx, height: 1200 });
      // Importante: o zoom vai no wrapper .relatorio, NÃO no <body>. O
      // scrollHeight de um elemento não reflete o zoom aplicado a ele mesmo
      // — só é visível "de fora", pelo elemento pai. Medindo
      // document.body.scrollHeight com o zoom no filho (.relatorio), a
      // gente pega a altura já reduzida de verdade; aplicando no próprio
      // body, a leitura seguinte (document.body.scrollHeight) continuava
      // reportando o tamanho de ANTES do zoom, e por isso a página saía
      // grande demais com sobra de espaço em branco embaixo.
      await page.evaluate((z) => {
        document.querySelector('.relatorio').style.zoom = String(z);
      }, zoom);
    }

    // A altura final da página SEMPRE acompanha a altura real do conteúdo
    // (já reduzido pelo zoom, se foi aplicado) — nunca um mínimo fixo de A4
    // nem margem extra somada (ver comentário acima sobre margem de página).
    const alturaConteudoFinalPx = await page.evaluate(() => document.body.scrollHeight);
    const alturaFinalMm = Math.ceil(alturaConteudoFinalPx * (25.4 / 96));

    console.log(`[pdf] altura conteúdo (zoom 1): ${alturaConteudoPx}px`);
    console.log(`[pdf] zoom aplicado: ${zoom}`);
    console.log(`[pdf] altura conteúdo final (pós-zoom): ${alturaConteudoFinalPx}px`);
    console.log(`[pdf] altura da página gerada: ${alturaFinalMm}mm (A4 = 297mm)`);

    const pdfBuffer = await page.pdf({
      width: `${LARGURA_A4_MM}mm`,
      height: `${alturaFinalMm}mm`,
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      pageRanges: '1',
    });

    return pdfBuffer;
  } finally {
    await page.close();
  }
}

module.exports = { gerarPdfRelatorio, gerarPdfRelatorioUmaPagina, encerrarBrowser };
