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
  { t: 0, rgb: [34, 22, 48] },      // sem chamados — plum escuro e quente (era indigo/azul frio)
  { t: 0.166, rgb: [46, 24, 66] },
  { t: 0.333, rgb: [66, 28, 88] },
  { t: 0.5, rgb: [92, 35, 118] },   // roxo
  { t: 0.667, rgb: [148, 48, 95] }, // magenta
  { t: 0.833, rgb: [206, 70, 66] }, // vermelho puro (era [216, 91, 71], verde a mais deixava "sujo")
  { t: 1, rgb: [255, 150, 70] },    // pico — laranja coral
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
  const altura = 190;
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
// 4h, com legenda de gradiente. Em vez de um brilho por cima (que quebrava
// cada célula em 3 tons e as isolava das vizinhas), a opacidade de cada
// célula acompanha o valor de calor: áreas frias ficam quase transparentes e
// revelam o fundo do card, enquanto áreas quentes ficam sólidas — combinado
// com o blur de suavizarMatriz, isso faz o calor se fundir em "setores"
// contínuos em vez de blocos isolados, igual ao protótipo de alta fidelidade.
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
      // Opacidade acompanha o calor: perto de 0 a célula esmaece bastante,
      // mas OPACIDADE_MIN garante que ainda dê pra enxergar contra o fundo do
      // card (não é mais 0.12 → sumia quase por completo). A curva (raiz,
      // não linear) reforça os valores baixos/médios sem achatar o topo da
      // escala, que continua chegando em opacidade 1.
      const OPACIDADE_MIN = 0.38;
      const opacidade = OPACIDADE_MIN + (1 - OPACIDADE_MIN) * Math.pow(t, 0.55);
      const cx = margemEsquerda + col * colWidth;
      const w = lado.toFixed(1);
      const h = lado.toFixed(1);
      celulas += `<rect x="${cx.toFixed(1)}" y="${y.toFixed(1)}" width="${w}" height="${h}" rx="${cellRx.toFixed(1)}" fill="${cor}" fill-opacity="${opacidade.toFixed(2)}" />`;
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
    </defs>

    ${rotulosColuna}
    ${rotulosLinha}
    ${celulas}

    <text x="${margemEsquerda}" y="${legendaY + 5}" font-size="8.5" fill="#8891A6">Menos chamados</text>
    <rect x="${legendaBarraX}" y="${legendaY}" width="${legendaBarraLargura}" height="5" rx="2.5" fill="url(#grad-legenda-calor)" />
    <text x="${margemEsquerda + larguraGrade}" y="${legendaY + 5}" text-anchor="end" font-size="8.5" fill="#8891A6">Mais chamados</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Donut: recebe itens já coloridos (`[{ nome, total, cor }]` — a cor é
// decidida por quem chama, em template.js, pra que a mesma paleta apareça
// tanto no anel quanto na legenda em HTML ao lado) e desenha o anel com um
// pequeno vão entre fatias, mais o total no centro.
// ---------------------------------------------------------------------------
function gerarDonut(itens, totalGeral) {
  const tamanho = 200;
  const centro = tamanho / 2;
  const raio = 72;
  const espessura = 24;
  const circunferencia = 2 * Math.PI * raio;
  const gapArco = 3; // vão visual entre fatias, em px de comprimento de arco

  let offsetAcumulado = 0;
  const arcos = itens.map((item) => {
    const fracao = totalGeral > 0 ? item.total / totalGeral : 0;
    const comprimentoCheio = fracao * circunferencia;
    const comprimentoVisivel = Math.max(0, comprimentoCheio - gapArco);
    const dasharray = `${comprimentoVisivel.toFixed(2)} ${(circunferencia - comprimentoVisivel).toFixed(2)}`;
    const dashoffset = (-offsetAcumulado).toFixed(2);
    offsetAcumulado += comprimentoCheio;
    if (comprimentoCheio <= 0) return '';
    return `<circle cx="${centro}" cy="${centro}" r="${raio}" fill="none" stroke="${item.cor}" stroke-width="${espessura}" stroke-dasharray="${dasharray}" stroke-dashoffset="${dashoffset}" transform="rotate(-90 ${centro} ${centro})" />`;
  }).join('');

  return `<svg viewBox="0 0 ${tamanho} ${tamanho}" xmlns="http://www.w3.org/2000/svg" font-family="'Segoe UI', -apple-system, Arial, sans-serif">
    <circle cx="${centro}" cy="${centro}" r="${raio}" fill="none" stroke="#1B2338" stroke-width="${espessura}" />
    ${arcos}
    <text x="${centro}" y="${centro - 3}" text-anchor="middle" font-size="28" font-weight="700" fill="#EAEDF5">${totalGeral}</text>
    <text x="${centro}" y="${centro + 17}" text-anchor="middle" font-size="10.5" fill="#8891A6">Total</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Barras horizontais: um item por linha (nome à esquerda, barra escalada por
// um eixo X com marcações "redondas", igual ao critério do gráfico de linha).
// ---------------------------------------------------------------------------
function gerarBarrasHorizontais(itens) {
  const largura = 460;
  // Coluna de rótulo dinâmica: um valor fixo (a versão anterior usava 92px)
  // corta nomes mais longos como "Gabinete da Presidência" pela esquerda —
  // o texto é right-aligned terminando na borda da barra, então se ele
  // precisar de mais espaço do que a coluna reserva, a ponta esquerda cai
  // fora do viewBox e o SVG simplesmente corta (comportamento padrão de
  // overflow). Em vez de um número fixo, mede o nome mais longo (estimativa
  // por caractere, já que é SVG gerado no servidor sem medição real de
  // fonte) e reserva o espaço necessário, com teto pra não sacrificar a
  // área do gráfico quando um nome for exageradamente longo — nesse caso,
  // trunca com reticências.
  const FONTE_LABEL = 9.5;
  const LARGURA_MEDIA_CHAR = FONTE_LABEL * 0.56; // estimativa pra essa família de fonte/tamanho
  const MARGEM_LABEL_MIN = 60;
  const MARGEM_LABEL_MAX = 150;
  const maiorNome = itens.reduce((max, i) => Math.max(max, i.nome.length), 0);
  const margemEsquerdaIdeal = 16 + maiorNome * LARGURA_MEDIA_CHAR;
  const margemEsquerda = Math.min(MARGEM_LABEL_MAX, Math.max(MARGEM_LABEL_MIN, margemEsquerdaIdeal));
  // Quantos caracteres cabem de fato na coluna escolhida — nomes maiores que
  // isso (só acontece quando o teto acima entrou em ação) são truncados.
  const maxCharsLabel = Math.max(3, Math.floor((margemEsquerda - 16) / LARGURA_MEDIA_CHAR));
  const truncar = (nome) => (nome.length > maxCharsLabel ? `${nome.slice(0, maxCharsLabel - 1)}…` : nome);
  const margemDireita = 10;
  const margemLabel = 56; // coluna reservada pro texto "138 (16.7%)", fora da área da barra
  const margemTopo = 22; // espaço pros rótulos do eixo X
  const alturaLinha = 30;
  const altura = margemTopo + itens.length * alturaLinha + 6;
  const larguraUtil = largura - margemEsquerda - margemDireita - margemLabel;

  const valorMax = Math.max(1, ...itens.map((i) => i.total));
  // Escala com passo "redondo" (1, 2, 5, 10, 20, 25, 50, 100...), igual ao
  // critério de eixo de qualquer ferramenta de BI — evita marcas tortas tipo
  // "0, 1, 3, 4, 5" quando os valores são pequenos.
  const PASSOS_CANDIDATOS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const passo = PASSOS_CANDIDATOS.find((p) => valorMax / p <= 4) || Math.ceil(valorMax / 4);
  const eixoMax = Math.ceil(valorMax / passo) * passo;
  const escalaX = (v) => margemEsquerda + (v / eixoMax) * larguraUtil;

  let grade = '';
  for (let valor = 0; valor <= eixoMax; valor += passo) {
    const x = escalaX(valor).toFixed(1);
    grade += `<line x1="${x}" y1="${margemTopo - 2}" x2="${x}" y2="${(altura - 4).toFixed(1)}" stroke="#212A3E" stroke-width="1" />`;
    grade += `<text x="${x}" y="${margemTopo - 8}" text-anchor="middle" font-size="8.5" fill="#8891A6">${valor}</text>`;
  }

  const barras = itens.map((item, i) => {
    const y = margemTopo + i * alturaLinha;
    const barY = y + 7;
    const barH = alturaLinha - 15;
    const barW = Math.max(2, escalaX(item.total) - margemEsquerda);
    const rotuloValor = `${item.total} (${item.percentual}%)`;
    return `
      <text x="${margemEsquerda - 8}" y="${(y + alturaLinha / 2 + 3).toFixed(1)}" text-anchor="end" font-size="${FONTE_LABEL}" fill="#EAEDF5">${truncar(item.nome)}</text>
      <rect x="${margemEsquerda}" y="${barY.toFixed(1)}" width="${barW.toFixed(1)}" height="${barH}" rx="4" fill="#3B82F6" />
      <text x="${(largura - margemDireita).toFixed(1)}" y="${(y + alturaLinha / 2 + 3).toFixed(1)}" text-anchor="end" font-size="9" fill="#8891A6">${rotuloValor}</text>
    `;
  }).join('');

  return `<svg class="barras-svg" viewBox="0 0 ${largura} ${altura}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" font-family="'Segoe UI', -apple-system, Arial, sans-serif">
    ${grade}
    ${barras}
  </svg>`;
}

// ---------------------------------------------------------------------------
// Gauge de SLA por prioridade: 3 anéis concêntricos, um por prioridade. O
// preenchimento de CADA anel é o próprio % de SLA daquela prioridade (o mesmo
// número exibido na legenda abaixo) — não o volume de chamados. Assim a cor
// e o tamanho do arco significam exatamente a mesma coisa que o texto embaixo,
// em vez de duas métricas diferentes disputando a mesma representação visual.
// O número central é o SLA geral (agregado, não é a soma dos 3 anéis).
// ---------------------------------------------------------------------------
const CORES_PRIORIDADE_GAUGE = { alta: '#EF4444', media: '#F59E0B', baixa: '#22C55E' };
// Do mais externo pro mais interno — ordem "de fora pra dentro" acompanha a
// leitura da legenda abaixo (Alta / Média / Baixa).
const ANEIS_PRIORIDADE_GAUGE = [
  { prioridade: 'alta', raio: 82 },
  { prioridade: 'media', raio: 64 },
  { prioridade: 'baixa', raio: 46 },
];
const ESPESSURA_ANEL = 13;

function gerarGaugeSla(pct, slaPorPrioridade = []) {
  const tamanho = 200;
  const centro = tamanho / 2;

  const aneis = ANEIS_PRIORIDADE_GAUGE.map(({ prioridade, raio }) => {
    const dado = slaPorPrioridade.find((s) => s.prioridade === prioridade);
    const cor = CORES_PRIORIDADE_GAUGE[prioridade];
    const circunferencia = 2 * Math.PI * raio;
    if (!dado || dado.total === 0 || dado.pct === null || dado.pct === undefined) {
      // Sem chamados dessa prioridade no período: mostra só a trilha, sem arco.
      return `<circle cx="${centro}" cy="${centro}" r="${raio}" fill="none" stroke="#1B2338" stroke-width="${ESPESSURA_ANEL}" />`;
    }
    const pctSeguro = Math.max(0, Math.min(100, dado.pct));
    const comprimento = (pctSeguro / 100) * circunferencia;
    return `
      <circle cx="${centro}" cy="${centro}" r="${raio}" fill="none" stroke="#1B2338" stroke-width="${ESPESSURA_ANEL}" />
      <circle cx="${centro}" cy="${centro}" r="${raio}" fill="none" stroke="${cor}" stroke-width="${ESPESSURA_ANEL}" stroke-linecap="round" stroke-dasharray="${comprimento.toFixed(2)} ${(circunferencia - comprimento).toFixed(2)}" transform="rotate(-90 ${centro} ${centro})" />
    `;
  }).join('');

  return `<svg viewBox="0 0 ${tamanho} ${tamanho}" xmlns="http://www.w3.org/2000/svg" font-family="'Segoe UI', -apple-system, Arial, sans-serif">
    ${aneis}
    <text x="${centro}" y="${centro - 3}" text-anchor="middle" font-size="24" font-weight="700" fill="#EAEDF5">${pct !== null && pct !== undefined ? `${pct}%` : '—'}</text>
    <text x="${centro}" y="${centro + 16}" text-anchor="middle" font-size="8.5" fill="#8891A6">SLA geral</text>
  </svg>`;
}

module.exports = {
  gerarGraficoLinha,
  gerarHeatmap,
  gerarDonut,
  gerarBarrasHorizontais,
  gerarGaugeSla,
  formatarDataCurta,
  formatarDataLonga,
};
