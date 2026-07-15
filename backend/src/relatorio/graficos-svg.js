// Funções puras: recebem os dados já agregados (dados.js) e devolvem uma
// string SVG pronta pra ser injetada no HTML do relatório. Sem biblioteca de
// gráficos — é só geometria (mapear valor → coordenada), a mesma ideia dos
// componentes de gráfico em SVG puro do frontend, só que rodando no servidor
// dentro do Puppeteer.

const NOMES_MES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// `dia` pode vir como objeto Date (node-pg parseia colunas `date` assim) ou
// como string 'YYYY-MM-DD' — normaliza pros dois formatos de texto usados
// nos eixos/callout sem depender de fuso horário (sempre em UTC).
function normalizarData(dia) {
  if (dia instanceof Date) {
    const ano = dia.getUTCFullYear();
    const mes = String(dia.getUTCMonth() + 1).padStart(2, '0');
    const diaNum = String(dia.getUTCDate()).padStart(2, '0');
    return { ano, mes, dia: diaNum };
  }
  const [ano, mes, diaNum] = String(dia).split('-');
  return { ano: Number(ano), mes, dia: diaNum };
}

function formatarDataCurta(dia) {
  const d = normalizarData(dia);
  return `${d.dia}/${d.mes}`;
}

function formatarDataLonga(dia) {
  const d = normalizarData(dia);
  return `${d.dia}/${d.mes}/${d.ano}`;
}

// Interpolação linear simples entre dois números.
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Escala de calor do heatmap, extraída por amostragem de pixel do protótipo
// (paleta "inferno"-like: indigo escuro → roxo → magenta → vermelho → laranja
// coral). Os stops abaixo replicam as cores reais do design, não são mais
// inventados/aproximados.
const PARADAS_CALOR = [
  { t: 0, rgb: [18, 24, 59] },     // sem chamados — indigo escuro, ainda visível sobre o card
  { t: 0.166, rgb: [28, 27, 79] },
  { t: 0.333, rgb: [50, 32, 97] },
  { t: 0.5, rgb: [74, 37, 127] },   // roxo
  { t: 0.667, rgb: [140, 50, 98] }, // magenta
  { t: 0.833, rgb: [216, 91, 71] }, // vermelho/coral
  { t: 1, rgb: [254, 158, 77] },    // pico — laranja coral
];

function interpolarCorCalor(t) {
  const clamped = Math.max(0, Math.min(1, t));
  let i = 0;
  while (i < PARADAS_CALOR.length - 2 && clamped > PARADAS_CALOR[i + 1].t) i++;
  const a = PARADAS_CALOR[i];
  const b = PARADAS_CALOR[i + 1];
  const faixa = b.t - a.t || 1;
  const local = (clamped - a.t) / faixa;
  const rgb = [0, 1, 2].map((c) => Math.round(lerp(a.rgb[c], b.rgb[c], local)));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

// ---------------------------------------------------------------------------
// Gráfico de linha: série diária do mês + média móvel de 7 dias, com um
// callout fixo no dia de maior volume (igual ao protótipo).
// ---------------------------------------------------------------------------
function gerarGraficoLinha(serieDiaria) {
  const largura = 600;
  const altura = 260;
  const margem = { topo: 14, direita: 14, baixo: 26, esquerda: 32 };
  const larguraUtil = largura - margem.esquerda - margem.direita;
  const alturaUtil = altura - margem.topo - margem.baixo;

  const n = serieDiaria.length;
  if (n === 0) {
    return `<svg viewBox="0 0 ${largura} ${altura}" xmlns="http://www.w3.org/2000/svg">
      <text x="${largura / 2}" y="${altura / 2}" text-anchor="middle" fill="#8891A6" font-size="12">Sem dados no período</text>
    </svg>`;
  }

  const valorMax = Math.max(1, ...serieDiaria.map((p) => Math.max(p.total, p.media_movel || 0)));
  // Eixo Y arredondado pra cima num múltiplo "redondo" (múltiplos de 20, 10 ou 5
  // dependendo da escala), dividido em 5 faixas iguais — igual ao protótipo (0/20/40/60/80/100).
  const passoBase = valorMax > 60 ? 20 : valorMax > 30 ? 10 : 5;
  const eixoYMax = Math.ceil(valorMax / passoBase) * passoBase || passoBase;

  const x = (i) => margem.esquerda + (n === 1 ? 0 : (i / (n - 1)) * larguraUtil);
  const y = (v) => margem.topo + alturaUtil - (v / eixoYMax) * alturaUtil;

  const pontosLinha = serieDiaria.map((p, i) => `${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' L ');
  const pontosMedia = serieDiaria.map((p, i) => `${x(i).toFixed(1)},${y(p.media_movel ?? p.total).toFixed(1)}`).join(' L ');
  const areaPath = `M ${x(0).toFixed(1)},${y(0).toFixed(1)} L ${pontosLinha} L ${x(n - 1).toFixed(1)},${y(0).toFixed(1)} Z`;

  // Grade horizontal + rótulos do eixo Y (5 faixas: 0, 1/5, 2/5, 3/5, 4/5, máx).
  const NUM_FAIXAS = 5;
  let gradeY = '';
  for (let i = 0; i <= NUM_FAIXAS; i++) {
    const valor = (eixoYMax / NUM_FAIXAS) * i;
    const yy = y(valor).toFixed(1);
    gradeY += `
      <line x1="${margem.esquerda}" y1="${yy}" x2="${largura - margem.direita}" y2="${yy}" stroke="#212A3E" stroke-width="1" />
      <text x="${margem.esquerda - 6}" y="${Number(yy) + 3}" text-anchor="end" font-size="8.5" fill="#8891A6">${Math.round(valor)}</text>
    `;
  }

  // Rótulos do eixo X: ~6 marcações espalhadas pelo mês, sempre incluindo o
  // primeiro e o último dia.
  const NUM_ROTULOS = Math.min(6, n);
  const passoRotulo = n <= 1 ? 1 : (n - 1) / (NUM_ROTULOS - 1);
  const indicesRotulos = new Set();
  for (let i = 0; i < NUM_ROTULOS; i++) indicesRotulos.add(Math.round(i * passoRotulo));
  let rotulosX = '';
  indicesRotulos.forEach((i) => {
    rotulosX += `<text x="${x(i).toFixed(1)}" y="${altura - 6}" text-anchor="middle" font-size="8.5" fill="#8891A6">${formatarDataCurta(serieDiaria[i].dia)}</text>`;
  });

  // Ponto de destaque: dia de maior volume no mês, com callout fixo (data +
  // "X chamados") posicionado acima do ponto, com cuidado pra não estourar
  // as bordas do viewBox.
  let indicePico = 0;
  serieDiaria.forEach((p, i) => { if (p.total > serieDiaria[indicePico].total) indicePico = i; });
  const pico = serieDiaria[indicePico];
  const pxPico = x(indicePico);
  const pyPico = y(pico.total);
  const calloutTexto1 = formatarDataLonga(pico.dia);
  const calloutTexto2 = `${pico.total} chamados`;
  const calloutLargura = 96;
  const calloutAltura = 34;
  let calloutX = pxPico - calloutLargura / 2;
  calloutX = Math.max(margem.esquerda, Math.min(largura - margem.direita - calloutLargura, calloutX));
  let calloutY = pyPico - calloutAltura - 12;
  if (calloutY < 2) calloutY = pyPico + 12; // se o pico for muito no topo, mostra o callout abaixo do ponto

  const temPico = pico.total > 0;

  return `<svg viewBox="0 0 ${largura} ${altura}" xmlns="http://www.w3.org/2000/svg" font-family="'Segoe UI', -apple-system, Arial, sans-serif">
    <defs>
      <linearGradient id="grad-area-linha" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3B82F6" stop-opacity="0.35" />
        <stop offset="100%" stop-color="#3B82F6" stop-opacity="0" />
      </linearGradient>
    </defs>

    ${gradeY}

    <path d="${areaPath}" fill="url(#grad-area-linha)" stroke="none" />
    <path d="M ${pontosMedia}" fill="none" stroke="#8891A6" stroke-width="1.4" stroke-dasharray="4 3" />
    <path d="M ${pontosLinha}" fill="none" stroke="#3B82F6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />

    ${serieDiaria.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.total).toFixed(1)}" r="2" fill="#3B82F6" />`).join('')}

    ${rotulosX}

    ${temPico ? `
      <circle cx="${pxPico.toFixed(1)}" cy="${pyPico.toFixed(1)}" r="4" fill="#0A0E18" stroke="#3B82F6" stroke-width="2" />
      <rect x="${calloutX.toFixed(1)}" y="${calloutY.toFixed(1)}" width="${calloutLargura}" height="${calloutAltura}" rx="6" fill="#1B2338" stroke="#3B82F6" stroke-width="1" />
      <text x="${(calloutX + calloutLargura / 2).toFixed(1)}" y="${(calloutY + 14).toFixed(1)}" text-anchor="middle" font-size="8.5" font-weight="700" fill="#EAEDF5">${calloutTexto1}</text>
      <text x="${(calloutX + calloutLargura / 2).toFixed(1)}" y="${(calloutY + 26).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="#8891A6">${calloutTexto2}</text>
    ` : ''}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Heatmap: dia da semana × hora (24 colunas, 1h cada), rótulo de eixo a cada
// 4h, com legenda de gradiente. Cada célula recebe um brilho sutil (gradiente
// vertical claro→transparente por cima da cor sólida) pra não ficar "chapada",
// igual ao protótipo.
// ---------------------------------------------------------------------------
const ORDEM_DIAS_SEMANA = [1, 2, 3, 4, 5, 6, 0]; // segunda..domingo (DOW do Postgres: 0 = domingo)
const NOMES_DIAS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
const ROTULO_A_CADA_N_COLUNAS = 4; // só mostra "00h", "04h", "08h"... embora cada coluna seja 1h

// Suaviza a matriz [dia][hora] com um blur separável (gaussiano leve no eixo
// hora, mais suave ainda no eixo dia) antes de mapear pra cor. Isso é só pra
// exibição: faz o calor se propagar em "nuvem" ao redor do pico em vez de
// aparecer como quadrados isolados extremamente claros — igual ao protótipo.
// Os valores brutos continuam intactos em outras partes do relatório.
function suavizarMatriz(matriz) {
  const nLinhas = matriz.length;
  const nCols = matriz[0].length;
  const kernelHora = [0.06, 0.24, 0.40, 0.24, 0.06]; // radius 2
  const kernelDia = [0.25, 0.5, 0.25]; // radius 1

  const amostra = (arr, i) => arr[Math.max(0, Math.min(arr.length - 1, i))]; // clamp nas bordas

  // 1) blur horizontal (ao longo das horas) em cada linha.
  const passo1 = matriz.map((linha) =>
    linha.map((_, col) => kernelHora.reduce((soma, peso, k) => soma + peso * amostra(linha, col + k - 2), 0))
  );

  // 2) blur vertical (ao longo dos dias) em cada coluna do resultado.
  const passo2 = Array.from({ length: nLinhas }, (_, linha) =>
    Array.from({ length: nCols }, (_, col) =>
      kernelDia.reduce((soma, peso, k) => soma + peso * amostra(passo1, linha + k - 1)[col], 0)
    )
  );

  return passo2;
}

function gerarHeatmap(heatmapData) {
  const { blocos_hora: blocosHora, matriz } = heatmapData;
  const matrizSuave = suavizarMatriz(matriz);
  const largura = 460;
  const margemEsquerda = 34;
  const margemDireita = 10;
  const margemTopo = 26; // espaço pros rótulos de hora acima da grade
  const margemBaixoGrade = 34; // respiro entre a grade e a legenda
  const alturaBlocoLegenda = 20; // barra + texto da legenda
  const margemInferior = 4; // fio de respiro final, sem sobra — o resto de "ar" já vem do preenchimento (height:100%) do card

  // Células perfeitamente quadradas: calcula o lado a partir da largura
  // disponível e de um gap uniforme (mesmo valor nos dois eixos), depois deriva
  // a altura da grade — em vez de esticar a altura pra preencher um espaço fixo.
  const larguraGrade = largura - margemEsquerda - margemDireita;
  const numCols = blocosHora.length;
  const numLinhas = ORDEM_DIAS_SEMANA.length;
  const gap = 3.2;
  const lado = (larguraGrade - (numCols - 1) * gap) / numCols;
  const colWidth = lado + gap;
  const rowHeight = colWidth; // linha usa o mesmo passo da coluna → célula quadrada
  const alturaGrade = numLinhas * rowHeight - gap;
  const cellRx = Math.min(3, lado * 0.28);

  const valorMax = Math.max(1, ...matrizSuave.flat());

  let celulas = '';
  let rotulosLinha = '';
  ORDEM_DIAS_SEMANA.forEach((diaSemana, linha) => {
    const y = margemTopo + linha * rowHeight;
    rotulosLinha += `<text x="${margemEsquerda - 8}" y="${(y + lado / 2 + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#8891A6">${NOMES_DIAS_SEMANA[linha]}</text>`;
    blocosHora.forEach((_, col) => {
      const valor = matrizSuave[diaSemana][col] || 0;
      const t = valor / valorMax;
      const cor = interpolarCorCalor(t);
      const cx = margemEsquerda + col * colWidth;
      const w = lado.toFixed(1);
      const h = lado.toFixed(1);
      celulas += `<rect x="${cx.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="${cellRx.toFixed(1)}" fill="${cor}" />`;
      // Brilho: mesmo retângulo por cima, preenchido com o gradiente
      // compartilhado (claro no topo, transparente embaixo) — dá a sensação
      // de gradiente/glossy em vez de cor sólida chapada.
      celulas += `<rect x="${cx.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="${cellRx.toFixed(1)}" fill="url(#grad-celula-brilho)" />`;
    });
  });

  const rotulosColuna = blocosHora.map((h, col) => {
    if (h % ROTULO_A_CADA_N_COLUNAS !== 0) return '';
    const cx = margemEsquerda + col * colWidth;
    return `<text x="${cx.toFixed(1)}" y="${margemTopo - 10}" text-anchor="middle" font-size="9" fill="#8891A6">${String(h).padStart(2, '0')}h</text>`;
  }).join('');

  // Legenda: texto + barra de gradiente + texto, centralizados sob a grade,
  // com bastante respiro em relação à grade (a barra ficou mais fina e com
  // canto totalmente arredondado).
  const legendaY = margemTopo + alturaGrade + margemBaixoGrade;
  const legendaBarraX = margemEsquerda + 78;
  const legendaBarraLargura = larguraGrade - 78 - 74;
  const altura = legendaY + alturaBlocoLegenda + margemInferior; // sem sobra: o viewBox termina onde o conteúdo termina

  return `<svg class="heatmap-svg" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" font-family="'Segoe UI', -apple-system, Arial, sans-serif">
    <defs>
      <linearGradient id="grad-legenda-calor" x1="0" y1="0" x2="1" y2="0">
        ${PARADAS_CALOR.map((p) => `<stop offset="${p.t * 100}%" stop-color="rgb(${p.rgb.join(',')})" />`).join('')}
      </linearGradient>
      <linearGradient id="grad-celula-brilho" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.16" />
        <stop offset="55%" stop-color="#FFFFFF" stop-opacity="0.03" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.12" />
      </linearGradient>
    </defs>

    ${rotulosColuna}
    ${rotulosLinha}
    ${celulas}

    <text x="${margemEsquerda}" y="${legendaY + 5}" font-size="8.5" fill="#8891A6">Menos chamados</text>
    <rect x="${legendaBarraX}" y="${legendaY}" width="${legendaBarraLargura}" height="5" rx="2.5" fill="url(#grad-legenda-calor)" />
    <text x="${margemEsquerda + larguraGrade}" y="${legendaY + 5}" text-anchor="end" font-size="8.5" fill="#8891A6">Mais chamados</text>
  </svg>`;
}

module.exports = { gerarGraficoLinha, gerarHeatmap, formatarDataCurta, formatarDataLonga };
