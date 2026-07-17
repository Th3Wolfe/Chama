const fs = require('fs');
const path = require('path');
const { icone } = require('./icones');
const { gerarDestaques } = require('./destaques');
const { gerarGraficoLinha, gerarHeatmap, gerarDonut, gerarBarrasHorizontais, gerarGaugeSla } = require('./graficos-svg');
const { gerarResumoInteligente } = require('./resumo-inteligente');
const { formatarDuracao } = require('./formatadores');

// Ícone embutido como base64: o Puppeteer renderiza esse HTML isoladamente
// (sem o frontend rodando do lado), então não dá pra apontar pra
// "/assets/flame-icon.png" como o app faz — precisa estar embutido no HTML.
const FLAME_ICON_BASE64 = fs.readFileSync(
  path.join(__dirname, 'assets', 'flame-icon.png')
).toString('base64');

// Fundo decorativo da capa lateral (substitui as ondas em SVG desenhadas à
// mão): imagem gerada, convertida pra JPEG pra manter o HTML embutido leve
// (o original em PNG passava de 1MB; em JPEG fica na casa dos 70KB sem perda
// perceptível, já que é um fundo com gradiente suave, sem transparência).
const CAPA_FUNDO_BASE64 = fs.readFileSync(
  path.join(__dirname, 'assets', 'capa-fundo.jpg')
).toString('base64');

// Mesmos tokens de cor de frontend/src/styles/global.css — duplicados aqui de
// propósito. O template roda isolado no backend (Puppeteer não tem acesso ao
// CSS do frontend), então herdar variáveis de lá não é uma opção; manter os
// valores em sincronia manualmente sempre que a paleta do app mudar.
const CSS_BASE = `
  :root {
    --color-bg: #0A0E18;
    --color-card-bg: #10162A;
    --color-border: #212A3E;
    --color-text: #EAEDF5;
    --color-text-muted: #8891A6;
    --color-primary: #3B82F6;
    --color-success: #22C55E;
    --color-warning: #F59E0B;
    --color-purple: #8B5CF6;
    --color-danger: #EF4444;
    --radius-md: 10px;
    --radius-lg: 14px;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  html, body {
    background: var(--color-bg);
    color: var(--color-text);
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.4;
  }

  .relatorio {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* No modo "página única" (gerarPdfRelatorioUmaPagina em pdf.js) a altura
     da página do PDF é calculada a partir da altura real do conteúdo — não
     faz sentido a caixa também tentar preencher 100vh (altura do viewport
     do Puppeteer, que não tem relação com o tamanho final da página nesse
     modo). Sem esse "min-height: 100vh" aqui, é exatamente isso que sobrava
     como espaço em branco no fim da página. */
  .pagina-unica .relatorio {
    min-height: 0;
  }

  /* Faixa superior: capa lateral ao lado do resumo executivo, KPIs e
     destaques — só essa faixa tem a coluna da capa; o restante do relatório
     (visão geral em diante) ocupa a largura inteira da página abaixo dela. */
  .topo {
    display: grid;
    grid-template-columns: 220px 1fr;
    border-bottom: 1px solid var(--color-border);
    break-inside: avoid;
  }

  .topo__conteudo {
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ---------- Capa lateral (seção 1) ---------- */
  .capa {
    background: var(--color-bg) url('data:image/jpeg;base64,${CAPA_FUNDO_BASE64}') no-repeat center bottom / cover;
    border-right: 1px solid var(--color-border);
    padding: 32px 24px;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
  }

  .capa__marca {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 44px;
  }

  .capa__marca-logo {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    object-fit: cover;
  }

  .capa__marca-nome {
    font-size: 15px;
    font-weight: 700;
    color: var(--color-text);
  }

  .capa__marca-instituicao {
    font-size: 9px;
    color: var(--color-text-muted);
  }

  .capa__etiqueta {
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    text-transform: uppercase;
    margin-bottom: 6px;
  }

  .capa__titulo {
    font-size: 26px;
    font-weight: 800;
    color: var(--color-text);
    line-height: 1.15;
  }

  .capa__titulo-destaque {
    color: var(--color-primary);
  }

  .capa__periodo {
    margin-top: 32px;
  }

  .capa__periodo-label {
    font-size: 10px;
    color: var(--color-text-muted);
    margin-bottom: 6px;
  }

  .capa__periodo-datas {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-text);
  }

  .capa__rodape {
    margin-top: auto;
    font-size: 9px;
    color: var(--color-text-muted);
    position: relative;
    z-index: 1;
  }

  .capa__rodape-label {
    margin-bottom: 2px;
  }

  /* ---------- Conteúdo principal (abaixo da faixa superior, largura cheia) ---------- */
  .conteudo {
    padding: 24px 28px 32px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .card {
    background: var(--color-card-bg);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    break-inside: avoid;
  }

  /* ---------- Resumo executivo (seção 2, texto introdutório) ---------- */
  .resumo-intro__titulo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    margin-bottom: 8px;
  }

  .resumo-intro__texto {
    font-size: 16px;
    color: var(--color-text);
    line-height: 1.55;
  }

  /* ---------- Grade de KPIs (seção 2) ---------- */
  .grade-kpis {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 14px;
  }

  .kpi-card {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    break-inside: avoid;
  }

  .kpi-card__icone {
    width: 34px;
    height: 34px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .kpi-card__label {
    font-size: 14.5px;
    color: var(--color-text-muted);
  }

  .kpi-card__valor {
    font-size: 21px;
    font-weight: 700;
    color: var(--color-text);
  }

  .kpi-card__delta {
    font-size: 14.5px;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .kpi-card__delta-seta--positivo { color: var(--color-success); }
  .kpi-card__delta-seta--negativo { color: var(--color-danger); }
  .kpi-card__delta-vs { color: var(--color-text-muted); }

  /* ---------- Destaques automáticos (seção 3) ---------- */
  .destaques {
    padding: 18px 20px;
  }

  .destaques__titulo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    margin-bottom: 14px;
  }

  .destaques__grade {
    display: flex;
    align-items: stretch;
  }

  .destaque-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    flex: 1 1 0;
    min-width: 0;
    padding: 0 14px;
    break-inside: avoid;
  }

  /* Separador real entre os destaques (não um pseudo-elemento colado num dos
     lados) — como é um item do próprio flex com largura fixa (não participa
     da distribuição de "flex: 1" dos itens), ele sempre cai exatamente no
     meio do vão entre as duas divs vizinhas, e os itens ao redor continuam
     dividindo o espaço restante igualmente entre si, não importa quantos
     destaques existam. Leve brilho via box-shadow pra imitar o "glow" branco
     do protótipo. */
  .destaque-divisor {
    flex: 0 0 auto;
    width: 1px;
    align-self: stretch;
    background: rgba(255, 255, 255, 0.55);
    box-shadow: 0 0 6px 0 rgba(255, 255, 255, 0.55);
  }

  .destaque-item__texto {
    font-size: 14.5px;
    color: var(--color-text);
    line-height: 1.4;
    text-align: center;
  }

  /* ---------- Visão geral: linha do tempo + heatmap (seção 5) ---------- */
  .secao-visao-geral {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 20px;
    align-items: stretch;
  }

  .grafico-card {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
  }

  /* Corpo do card (o gráfico/heatmap em si) cresce pra ocupar o espaço
     vertical restante e centraliza o SVG nesse espaço — assim, quando os
     dois cards da seção têm alturas de conteúdo diferentes (o heatmap é
     naturalmente mais baixo que o gráfico de linha), o grid estica os dois
     cards pra mesma altura e o conteúdo mais curto fica centralizado em vez
     de "sobrar" espaço em branco só embaixo. */
  .grafico-card__corpo {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .grafico-card__cabecalho {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .grafico-card__titulo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--color-text);
  }

  .grafico-card__filtro {
    font-size: 9.5px;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 3px 8px;
  }

  .grafico-card__legenda {
    display: flex;
    gap: 16px;
    margin-bottom: 8px;
  }

  .grafico-card__legenda-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .legenda-marca {
    width: 12px;
    height: 0;
    border-top: 2px solid;
  }

  .legenda-marca--solida { border-top-style: solid; border-color: var(--color-primary); }
  .legenda-marca--tracejada { border-top-style: dashed; border-color: var(--color-text-muted); }

  .grafico-card svg {
    display: block;
    width: 100%;
    height: auto;
  }

  /* O heatmap, diferente do gráfico de linha, deve ocupar 100% da altura do
     card (não só da largura) — sem sobrar espaço em branco quando o card
     estica pra acompanhar a altura do card vizinho. */
  .grafico-card__corpo svg.heatmap-svg {
    height: 100%;
  }

  /* ---------- Distribuição: categoria / setor / prioridade (seção 6) ---------- */
  .secao-distribuicao {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .distrib-card {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .distrib-card__cabecalho {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .distrib-card__titulo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--color-text);
  }

  .distrib-card__filtro {
    font-size: 9.5px;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 3px 8px;
  }

  /* Cresce pra ocupar a altura que sobrar no card (o card em si estica pra
     acompanhar a altura dos vizinhos — ver .secao-distribuicao) e centraliza
     o conteúdo verticalmente nesse espaço, em vez de deixar tudo grudado no
     topo com uma sobra de espaço em branco embaixo. */
  .distrib-card__corpo-donut {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  /* Diâmetro do anel acompanha a altura disponível (até um teto, pra não
     ficar gigante em cards muito altos com poucos itens na legenda). O
     max-width é igualmente necessário: sem ele, em cards altos (ex.: ao
     lado do card de setor com 5 linhas) o donut cresce livre pela altura e,
     por causa do aspect-ratio 1:1, engole quase toda a largura do card,
     deixando a legenda espremida a ponto de truncar até o primeiro caractere. */
  .distrib-card__donut {
    flex: 0 0 auto;
    height: 100%;
    max-height: 180px;
    max-width: 42%;
    aspect-ratio: 1 / 1;
  }

  .distrib-card__donut svg {
    display: block;
    height: 100%;
    width: auto;
  }

  .distrib-card__legenda {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 10px;
    flex: 1;
    min-width: 96px;
  }

  .distrib-legenda-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 15.5px;
    color: var(--color-text-muted);
  }

  .distrib-legenda-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .distrib-legenda-nome {
    color: var(--color-text);
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .distrib-legenda-valor {
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  /* Mesma lógica do heatmap: o SVG das barras estica pra preencher a altura
     do card (linhas mais altas quando sobra espaço, mais compactas quando
     tem mais setores) em vez de ficar com um bloco fixo colado no topo. */
  .distrib-card__corpo-barras {
    flex: 1;
    min-height: 0;
  }

  .distrib-card__corpo-barras svg.barras-svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* ---------- Indicadores operacionais: equipamentos / técnicos / SLA (seção 7) ---------- */
  .secao-indicadores {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: minmax(200px, auto);
    gap: 20px;
  }

  .indic-card {
    padding: 16px 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .indic-card__cabecalho {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .indic-card__titulo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--color-text);
  }

  .indic-card__filtro {
    font-size: 9.5px;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 3px 8px;
  }

  /* Corpo das tabelas cresce e distribui as linhas uniformemente pela altura
     disponível — mesmo princípio dos cards de distribuição. */
  .indic-card__linhas {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
  }

  .indic-linha {
    display: flex;
    align-items: center;
    gap: calc(10px * var(--escala-itens, 1));
  }

  .indic-linha__badge {
    width: calc(28px * var(--escala-itens, 1));
    height: calc(28px * var(--escala-itens, 1));
    border-radius: 8px;
    background: #1B2338;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .indic-linha__avatar {
    width: calc(28px * var(--escala-itens, 1));
    height: calc(28px * var(--escala-itens, 1));
    border-radius: 50%;
    flex-shrink: 0;
    object-fit: cover;
    background: #1B2338;
  }

  .indic-linha__avatar-iniciais {
    width: calc(28px * var(--escala-itens, 1));
    height: calc(28px * var(--escala-itens, 1));
    border-radius: 50%;
    flex-shrink: 0;
    background: #1B2338;
    color: var(--color-text-muted);
    font-size: calc(10px * var(--escala-itens, 1));
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .indic-linha__nome {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .indic-linha__nome-principal {
    font-size: calc(10.5px * var(--escala-itens, 1));
    color: var(--color-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .indic-linha__nome-secundario {
    font-size: calc(9px * var(--escala-itens, 1));
    color: var(--color-text-muted);
  }

  .indic-linha__metrica {
    text-align: right;
    flex-shrink: 0;
  }

  .indic-linha__valor {
    font-size: calc(10.5px * var(--escala-itens, 1));
    color: var(--color-text);
    font-weight: 600;
  }

  .indic-linha__legenda {
    font-size: calc(9px * var(--escala-itens, 1));
    color: var(--color-text-muted);
  }

  .indic-card__gauge {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
  }

  .indic-card__gauge-anel {
    flex: 0 0 auto;
    width: min(100%, 200px);
    aspect-ratio: 1 / 1;
  }

  .indic-card__gauge-anel svg {
    display: block;
    width: 100%;
    height: 100%;
  }

  /* Linha de badges compactos abaixo do gauge (uma coluna por prioridade),
     em vez de lista vertical — usa a largura cheia do card, que é bem mais
     espaço do que a sobra ao lado de um gauge de 150px. */
  .sla-prioridade-lista {
    display: flex;
    width: 100%;
    gap: 6px;
  }

  .sla-prioridade-item {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    font-size: 9.5px;
    color: var(--color-text-muted);
    text-align: center;
  }

  .sla-prioridade-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .sla-prioridade-nome {
    color: var(--color-text);
    font-weight: 600;
    white-space: nowrap;
    font-size: medium;
  }

  .sla-prioridade-fracao {
    color: var(--color-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    font-size: medium;
  }

  /* ---------- Resumo Executivo Inteligente + Comparativo (seções 8 e 9) ---------- */
  .secao-final {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 20px;
    align-items: stretch;
    min-height: 260px;
  }

  .resumo-inteligente {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
  }

  .resumo-inteligente__titulo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
    margin-bottom: 14px;
  }

  .resumo-inteligente__titulo svg {
    flex-shrink: 0;
  }

  .resumo-inteligente__lista {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    gap: 10px;
  }

  .resumo-inteligente__item {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .resumo-inteligente__item svg {
    flex-shrink: 0;
    margin-top: 1px;
  }

  .resumo-inteligente__item-texto {
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--color-text);
  }

  .comparativo-card {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .comparativo-card__cabecalho {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .comparativo-card__titulo {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .comparativo-card__filtro {
    font-size: 9.5px;
    color: var(--color-text-muted);
    border: 1px solid var(--color-border);
    border-radius: 6px;
    padding: 3px 8px;
  }

  .comparativo-tabela {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .comparativo-tabela th {
    text-align: left;
    font-weight: 600;
    color: var(--color-text-muted);
    font-size: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--color-border);
  }

  .comparativo-tabela th:not(:first-child),
  .comparativo-tabela td:not(:first-child) {
    text-align: right;
  }

  .comparativo-tabela td {
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border);
    color: var(--color-text);
  }

  .comparativo-tabela tr:last-child td {
    border-bottom: none;
  }

  .comparativo-tabela__variacao--positivo { color: var(--color-success); }
  .comparativo-tabela__variacao--negativo { color: var(--color-danger); }

  /* ---------- Rodapé ---------- */
  .rodape-relatorio {
    text-align: center;
    font-size: 9.5px;
    color: var(--color-text-muted);
    padding-top: 12px;
  }

  /* Rodapé único, no fim do documento — não repete por página. Até aqui
     (Sprint 8) o PDF multi-página tinha um footerTemplate nativo do
     Puppeteer repetido em toda página, e por isso esse rodapé estático
     ficava escondido no media "print" pra não duplicar; removido a pedido
     (o fundo escuro repetido embaixo de toda página não agradou
     visualmente). Agora aparece normalmente também no PDF, só uma vez, no
     fim do conteúdo — igual já acontecia no HTML aberto direto no
     navegador. */
`;

function formatarData(isoDate) {
  const [ano, mes, dia] = isoDate.split('-');
  return `${dia}/${mes}/${ano}`;
}

function ultimoDiaDoMes(inicioIso) {
  const [ano, mes] = inicioIso.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return `${String(ultimoDia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function formatarGeradoEm(isoDateTime) {
  const d = new Date(isoDateTime);
  const data = d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const hora = d.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
  return { data, hora };
}

// Config de cada card de KPI: de onde tirar o valor, como formatá-lo, ícone/
// cor do badge, e em que sentido a variação é "boa" (define a cor do delta).
const CONFIG_KPIS = [
  { chave: 'total_chamados', label: 'Total de chamados', icone: 'grid', cor: '#3B82F6', bomSe: 'aumento', tipoDelta: 'pct', formatar: (v) => v ?? '—' },
  { chave: 'sla_cumprido_pct', label: 'SLA cumprido', icone: 'check-circle', cor: '#22C55E', bomSe: 'aumento', tipoDelta: 'pontos', formatar: (v) => (v !== null ? `${v}%` : '—') },
  { chave: 'tempo_medio_resolucao_seg', label: 'Tempo médio de resolução', icone: 'clock', cor: '#F59E0B', bomSe: 'diminuicao', tipoDelta: 'pct', formatar: formatarDuracao },
  { chave: 'tempo_medio_1a_resposta_seg', label: 'Tempo médio 1ª resposta', icone: 'message-circle', cor: '#8B5CF6', bomSe: 'diminuicao', tipoDelta: 'pct', formatar: formatarDuracao },
  { chave: 'resolvidos', label: 'Resolvidos', icone: 'monitor', cor: '#3B82F6', bomSe: 'aumento', tipoDelta: 'pct', formatar: (v) => v ?? '—' },
  { chave: 'backlog', label: 'Backlog', icone: 'alert-triangle', cor: '#EF4444', bomSe: 'diminuicao', tipoDelta: 'pct', formatar: (v) => v ?? '—' },
];

// Monta o texto + cor da variação de um KPI, considerando se aumento ou
// diminuição é o sentido "bom" para aquela métrica em particular (ex.:
// backlog subir é ruim, resolvidos subir é bom).
function formatarDeltaKpi(config, kpi) {
  const delta = config.tipoDelta === 'pontos' ? kpi.delta_pontos : kpi.delta_pct;
  if (delta === null || delta === undefined) {
    // Texto curto de propósito: com 6 cards numa grid "stretch", uma frase
    // longa aqui (ex.: "Sem dado do mês anterior") quebra em várias linhas
    // e infla a altura de TODOS os cards da fileira — em meses sem mês
    // anterior pra comparar (caso comum de "poucos dados"), isso empurrava
    // a faixa do topo inteira pra perto do limite da página e disparava um
    // bug de paginação do Chromium (fragmento duplicado na página seguinte).
    // Mesmo símbolo "—" já usado no resto do relatório pra ausência de dado
    // (gauge de SLA, tabela de comparativo).
    return `<span class="kpi-card__delta-vs">— sem comparativo</span>`;
  }
  const positivo = delta > 0;
  const negativo = delta < 0;
  const aumentouOuIgual = delta >= 0;
  const ehBom = config.bomSe === 'aumento' ? aumentouOuIgual : !aumentouOuIgual || delta === 0;
  const classeCor = delta === 0 ? '' : (ehBom ? 'kpi-card__delta-seta--positivo' : 'kpi-card__delta-seta--negativo');
  const seta = positivo ? '↑' : negativo ? '↓' : '→';
  return `<span class="${classeCor}">${seta} ${Math.abs(delta)}%</span> <span class="kpi-card__delta-vs">vs. mês anterior</span>`;
}

function gerarResumoExecutivoIntro(dados) {
  return `
    <section class="card resumo-intro" style="padding: 18px 20px;">
      <div class="resumo-intro__titulo">RESUMO EXECUTIVO</div>
      <p class="resumo-intro__texto">
        Este relatório apresenta uma análise completa da operação de chamados durante o
        mês de ${dados.periodo.mes_extenso}. Os indicadores mostram a saúde da operação,
        principais tendências e oportunidades de melhoria.
      </p>
    </section>
  `;
}

function gerarGradeKpis(dados) {
  const cards = CONFIG_KPIS.map((config) => {
    const kpi = dados.kpis[config.chave];
    return `
      <div class="card kpi-card">
        <div class="kpi-card__icone" style="background: ${config.cor}26;">
          ${icone(config.icone, { cor: config.cor, tamanho: 18 })}
        </div>
        <div class="kpi-card__label">${config.label}</div>
        <div class="kpi-card__valor">${config.formatar(kpi.valor)}</div>
        <div class="kpi-card__delta">${formatarDeltaKpi(config, kpi)}</div>
      </div>
    `;
  }).join('');

  return `<section class="grade-kpis">${cards}</section>`;
}

function gerarSecaoDestaques(dados) {
  const destaques = gerarDestaques(dados);
  const itensHtml = destaques.map((d) => `
    <div class="destaque-item">
      ${icone(d.icone, { cor: '#3B82F6', tamanho: 25 })}
      <div class="destaque-item__texto">${d.texto}</div>
    </div>
  `);
  // Junta os itens intercalando o separador real (não é antes do primeiro
  // nem depois do último — só entre cada par de itens vizinhos).
  const conteudo = itensHtml.join('<div class="destaque-divisor"></div>');

  return `
    <section class="card destaques">
      <div class="destaques__titulo">DESTAQUES DO PERÍODO</div>
      <div class="destaques__grade">${conteudo}</div>
    </section>
  `;
}

function gerarSecaoVisaoGeral(dados) {
  const svgLinha = gerarGraficoLinha(dados.serie_diaria);
  const svgHeatmap = gerarHeatmap(dados.heatmap);

  return `
    <section class="secao-visao-geral">
      <div class="card grafico-card">
        <div class="grafico-card__cabecalho">
          <div class="grafico-card__titulo">VISÃO GERAL DA OPERAÇÃO</div>
          <div class="grafico-card__filtro">Diário</div>
        </div>
        <div class="grafico-card__legenda">
          <div class="grafico-card__legenda-item"><span class="legenda-marca legenda-marca--solida"></span> Chamados</div>
          <div class="grafico-card__legenda-item"><span class="legenda-marca legenda-marca--tracejada"></span> Média móvel (7 dias)</div>
        </div>
        <div class="grafico-card__corpo">${svgLinha}</div>
      </div>

      <div class="card grafico-card">
        <div class="grafico-card__cabecalho">
          <div class="grafico-card__titulo">HEATMAP DE CHAMADOS</div>
          <div class="grafico-card__filtro">Horário</div>
        </div>
        <div class="grafico-card__corpo">${svgHeatmap}</div>
      </div>
    </section>
  `;
}

function gerarCapaLateral(dados) {
  const { periodo } = dados;
  const [mesNome, , ano] = periodo.mes_extenso.split(' ');
  const geradoEm = formatarGeradoEm(periodo.gerado_em);

  return `
    <aside class="capa">
      <div class="capa__marca">
        <img class="capa__marca-logo" src="data:image/png;base64,${FLAME_ICON_BASE64}" alt="Chama" />
        <div>
          <div class="capa__marca-nome">Chama</div>
          <div class="capa__marca-instituicao">${periodo.instituicao}</div>
        </div>
      </div>

      <div class="capa__etiqueta">Relatório Operacional</div>
      <div class="capa__titulo">${mesNome}<br /><span class="capa__titulo-destaque">${ano}</span></div>

      <div class="capa__periodo">
        <div class="capa__periodo-label">Período analisado</div>
        <div class="capa__periodo-datas">${formatarData(periodo.inicio)}</div>
        <div class="capa__periodo-datas">${ultimoDiaDoMes(periodo.inicio)}</div>
      </div>

      <div class="capa__rodape">
        <div class="capa__rodape-label">Relatório gerado em</div>
        <div>${geradoEm.data} às ${geradoEm.hora}</div>
      </div>
    </aside>
  `;
}

// Paleta cíclica pras categorias (a mesma cor precisa aparecer no anel do
// donut — gerarDonut, em graficos-svg.js — e na bolinha da legenda em HTML
// aqui do lado, por isso a cor é decidida uma vez só, aqui).
const PALETA_CATEGORIAS = ['#3B82F6', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#8891A6'];

// Cores e rótulos de prioridade — só 3 níveis (o sistema não tem "crítica",
// mesma observação já feita sobre SLA_INTERVALO no topo de dados.js).
const CORES_PRIORIDADE = { baixa: '#22C55E', media: '#F59E0B', alta: '#EF4444' };
const LABELS_PRIORIDADE = { baixa: 'Baixa', media: 'Média', alta: 'Alta' };

function gerarLegendaDistribuicao(itens) {
  return itens.map((item) => `
    <div class="distrib-legenda-item">
      <span class="distrib-legenda-dot" style="background: ${item.cor};"></span>
      <span class="distrib-legenda-nome">${item.nome}</span>
      <span class="distrib-legenda-valor">${item.total} (${item.percentual}%)</span>
    </div>
  `).join('');
}

function gerarSecaoDistribuicao(dados) {
  // Top 5 de verdade: o cabeçalho do card já promete "Top 5", então o
  // restante das categorias (se houver) entra agrupado em "Outros" — em vez
  // de simplesmente sumir ou, pior, encher a legenda/o donut com fatias
  // demais (a paleta cíclica só tem 6 cores, então 7+ categorias sem esse
  // corte já repetiriam cor entre fatias diferentes).
  const categoriaOrdenada = [...dados.por_categoria].sort((a, b) => b.total - a.total);
  const categoriaTop5 = categoriaOrdenada.slice(0, 5);
  const categoriaResto = categoriaOrdenada.slice(5);
  const totalResto = categoriaResto.reduce((s, c) => s + c.total, 0);
  const categoriaFonte = totalResto > 0
    ? [...categoriaTop5, { nome: 'Outros', total: totalResto, percentual: categoriaResto.reduce((s, c) => s + (c.percentual || 0), 0) }]
    : categoriaTop5;

  const categoriaItens = categoriaFonte.map((c, i) => ({
    nome: c.nome,
    total: c.total,
    percentual: c.percentual,
    cor: PALETA_CATEGORIAS[i % PALETA_CATEGORIAS.length],
  }));
  const totalCategoria = categoriaItens.reduce((s, c) => s + c.total, 0);

  const prioridadeItens = dados.por_prioridade.map((p) => ({
    nome: LABELS_PRIORIDADE[p.nome] || p.nome,
    total: p.total,
    percentual: p.percentual,
    cor: CORES_PRIORIDADE[p.nome] || '#8891A6',
  }));
  const totalPrioridade = prioridadeItens.reduce((s, p) => s + p.total, 0);

  const setorTop5 = dados.por_setor.slice(0, 5).map((s) => ({ nome: s.nome, total: s.total, percentual: s.percentual }));

  return `
    <section class="secao-distribuicao">
      <div class="card distrib-card">
        <div class="distrib-card__cabecalho">
          <div class="distrib-card__titulo">CHAMADOS POR CATEGORIA</div>
          <div class="distrib-card__filtro">Top 5</div>
        </div>
        <div class="distrib-card__corpo-donut">
          <div class="distrib-card__donut">${gerarDonut(categoriaItens, totalCategoria)}</div>
          <div class="distrib-card__legenda">${gerarLegendaDistribuicao(categoriaItens)}</div>
        </div>
      </div>

      <div class="card distrib-card">
        <div class="distrib-card__cabecalho">
          <div class="distrib-card__titulo">CHAMADOS POR SETOR</div>
          <div class="distrib-card__filtro">Top 5</div>
        </div>
        <div class="distrib-card__corpo-barras">${gerarBarrasHorizontais(setorTop5)}</div>
      </div>

      <div class="card distrib-card">
        <div class="distrib-card__cabecalho">
          <div class="distrib-card__titulo">CHAMADOS POR PRIORIDADE</div>
        </div>
        <div class="distrib-card__corpo-donut">
          <div class="distrib-card__donut">${gerarDonut(prioridadeItens, totalPrioridade)}</div>
          <div class="distrib-card__legenda">${gerarLegendaDistribuicao(prioridadeItens)}</div>
        </div>
      </div>
    </section>
  `;
}

// Iniciais do nome pra usar como avatar de fallback quando o técnico não tem
// foto_url (ex.: login não-Google, ou foto removida da conta).
function iniciais(nomeCompleto) {
  const partes = nomeCompleto.trim().split(/\s+/);
  const primeira = partes[0]?.[0] || '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (primeira + ultima).toUpperCase();
}

// Cor da variação de chamados por equipamento: pra equipamento problemático,
// aumento é ruim (mesmo sentido do backlog) — mais chamados = mais problema.
function formatarDeltaEquipamento(deltaPct) {
  if (deltaPct === null || deltaPct === undefined) return '';
  const seta = deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '→';
  const classeCor = deltaPct === 0 ? '' : (deltaPct > 0 ? 'kpi-card__delta-seta--negativo' : 'kpi-card__delta-seta--positivo');
  return `<span class="${classeCor}">${seta} ${Math.abs(deltaPct)}%</span>`;
}

// Quando a lista Top 5 vem incompleta (poucos dados no mês), as linhas não
// devem só se espalhar pela altura garantida do card — o conteúdo em si
// (ícone/avatar, fontes) precisa crescer, senão sobra espaço e o card parece
// vazio mesmo depois do min-height. A escala cresce conforme a lista fica
// mais incompleta, com teto em 1.6x pra não ficar desproporcional com 1 item só.
function escalaPorQuantidade(qtd, maxItens = 5) {
  const q = Math.max(qtd, 1);
  const escala = Math.sqrt(maxItens / q);
  return Math.min(1.6, Math.max(1.3, escala));
}

function gerarLinhasEquipamentos(equipamentos) {
  const escala = escalaPorQuantidade(equipamentos.length);
  return equipamentos.map((eq) => {
    const nomeIcone = /impressora/i.test(eq.nome) ? 'printer' : 'monitor';
    return `
      <div class="indic-linha">
        <div class="indic-linha__badge">${icone(nomeIcone, { cor: '#8891A6', tamanho: Math.round(15 * escala) })}</div>
        <div class="indic-linha__nome">
          <div class="indic-linha__nome-principal">${eq.nome}</div>
          <div class="indic-linha__nome-secundario">${eq.marca || ''}</div>
        </div>
        <div class="indic-linha__metrica">
          <div class="indic-linha__valor">${eq.total}</div>
          <div class="indic-linha__legenda">${formatarDeltaEquipamento(eq.delta_pct)}</div>
        </div>
      </div>
    `;
  }).join('');
}

function gerarLinhasTecnicos(tecnicos) {
  const escala = escalaPorQuantidade(tecnicos.length);
  return tecnicos.map((t) => {
    const avatar = t.foto_url
      ? `<img class="indic-linha__avatar" src="${t.foto_url}" alt="" />`
      : `<div class="indic-linha__avatar-iniciais">${iniciais(t.nome)}</div>`;
    return `
      <div class="indic-linha">
        ${avatar}
        <div class="indic-linha__nome">
          <div class="indic-linha__nome-principal">${t.nome}</div>
          <div class="indic-linha__nome-secundario">${t.resolvidos} resolvidos</div>
        </div>
        <div class="indic-linha__metrica">
          <div class="indic-linha__valor">${t.sla_pct !== null ? `${t.sla_pct}%` : '—'}</div>
          <div class="indic-linha__legenda">SLA</div>
        </div>
      </div>
    `;
  }).join('');
}

function gerarListaSlaPrioridade(slaPorPrioridade) {
  return `
    <div class="sla-prioridade-lista">
      ${slaPorPrioridade.map((s) => `
        <div class="sla-prioridade-item">
          <span class="sla-prioridade-nome">
            <span class="sla-prioridade-dot" style="background: ${CORES_PRIORIDADE[s.prioridade] || '#8891A6'}; display:inline-block; margin-right:4px; vertical-align:middle;"></span>${LABELS_PRIORIDADE[s.prioridade] || s.prioridade}
          </span>
          <span class="sla-prioridade-fracao">${s.pct !== null ? `${s.pct}%` : '—'} (${s.dentro_sla}/${s.total})</span>
        </div>
      `).join('')}
    </div>
  `;
}

function gerarSecaoIndicadores(dados) {
  return `
    <section class="secao-indicadores">
      <div class="card indic-card">
        <div class="indic-card__cabecalho">
          <div class="indic-card__titulo">EQUIPAMENTOS MAIS PROBLEMÁTICOS</div>
          <div class="indic-card__filtro">Top 5</div>
        </div>
        <div class="indic-card__linhas" style="--escala-itens: ${escalaPorQuantidade(dados.equipamentos.length)}">${gerarLinhasEquipamentos(dados.equipamentos)}</div>
      </div>

      <div class="card indic-card">
        <div class="indic-card__cabecalho">
          <div class="indic-card__titulo">TÉCNICOS — DESEMPENHO</div>
          <div class="indic-card__filtro">Top 5</div>
        </div>
        <div class="indic-card__linhas" style="--escala-itens: ${escalaPorQuantidade(dados.tecnicos.length)}">${gerarLinhasTecnicos(dados.tecnicos)}</div>
      </div>

      <div class="card indic-card">
        <div class="indic-card__cabecalho">
          <div class="indic-card__titulo">SLA POR PRIORIDADE</div>
        </div>
        <div class="indic-card__gauge">
          <div class="indic-card__gauge-anel">${gerarGaugeSla(dados.sla_geral_pct, dados.sla_por_prioridade)}</div>
          ${gerarListaSlaPrioridade(dados.sla_por_prioridade)}
        </div>
      </div>
    </section>
  `;
}

// Config de cada linha da tabela de comparativo: reaproveita as mesmas chaves
// de dados.kpis já usadas na grade de KPIs (seção 2), mas exibindo o valor
// bruto do mês anterior lado a lado — não só o delta.
const CONFIG_COMPARATIVO = [
  { chave: 'total_chamados', label: 'Total de chamados', tipoDelta: 'pct', formatar: (v) => v ?? '—' },
  { chave: 'resolvidos', label: 'Resolvidos', tipoDelta: 'pct', formatar: (v) => v ?? '—' },
  { chave: 'tempo_medio_resolucao_seg', label: 'Tempo médio de resolução', tipoDelta: 'pct', formatar: formatarDuracao },
  { chave: 'tempo_medio_1a_resposta_seg', label: 'Tempo médio 1ª resposta', tipoDelta: 'pct', formatar: formatarDuracao },
  { chave: 'sla_cumprido_pct', label: 'SLA cumprido', tipoDelta: 'pontos', formatar: (v) => (v !== null && v !== undefined ? `${v}%` : '—') },
  { chave: 'backlog', label: 'Backlog', tipoDelta: 'pct', formatar: (v) => v ?? '—' },
];

function gerarSecaoResumoInteligente(dados) {
  const itens = gerarResumoInteligente(dados);
  const itensHtml = itens.map((item) => `
    <div class="resumo-inteligente__item">
      ${icone(item.icone, { cor: '#3B82F6', tamanho: 15 })}
      <div class="resumo-inteligente__item-texto">${item.texto}</div>
    </div>
  `).join('');

  return `
    <section class="card resumo-inteligente">
      <div class="resumo-inteligente__titulo">${icone('clipboard-search', { cor: '#3B82F6', tamanho: 16 })} RESUMO EXECUTIVO (ANÁLISE AUTOMÁTICA)</div>
      <div class="resumo-inteligente__lista">${itensHtml}</div>
    </section>
  `;
}

// Formata a variação de uma linha do comparativo — mesma ideia de
// formatarDeltaKpi (seta + cor conforme sentido bom/ruim), mas sem o "vs. mês
// anterior" (já é óbvio pelo contexto da tabela) e com o valor sempre visível
// mesmo quando não há dado (mostra "—" em vez de esconder a célula).
function formatarVariacaoComparativo(config, kpi) {
  const delta = config.tipoDelta === 'pontos' ? kpi.delta_pontos : kpi.delta_pct;
  if (delta === null || delta === undefined) return '—';
  const positivo = delta > 0;
  const negativo = delta < 0;
  // Mesmo critério de "bom" usado na grade de KPIs (ver CONFIG_KPIS/bomSe).
  const configKpi = CONFIG_KPIS.find((c) => c.chave === config.chave);
  const aumentouOuIgual = delta >= 0;
  const ehBom = configKpi.bomSe === 'aumento' ? aumentouOuIgual : !aumentouOuIgual || delta === 0;
  const classeCor = delta === 0 ? '' : (ehBom ? 'comparativo-tabela__variacao--positivo' : 'comparativo-tabela__variacao--negativo');
  const seta = positivo ? '↑' : negativo ? '↓' : '→';
  return `<span class="${classeCor}">${seta} ${Math.abs(delta)}%</span>`;
}

function gerarSecaoComparativo(dados) {
  const linhas = CONFIG_COMPARATIVO.map((config) => {
    const kpi = dados.kpis[config.chave];
    return `
      <tr>
        <td>${config.label}</td>
        <td>${config.formatar(kpi.valor)}</td>
        <td>${config.formatar(kpi.valor_anterior)}</td>
        <td>${formatarVariacaoComparativo(config, kpi)}</td>
      </tr>
    `;
  }).join('');

  return `
    <section class="card comparativo-card">
      <div class="comparativo-card__cabecalho">
        <div class="comparativo-card__titulo">COMPARATIVOS</div>
        <div class="comparativo-card__filtro">Mês</div>
      </div>
      <table class="comparativo-tabela">
        <thead>
          <tr>
            <th>Métrica</th>
            <th>${dados.periodo.mes_curto_atual}</th>
            <th>${dados.periodo.mes_curto_anterior}</th>
            <th>Variação</th>
          </tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </section>
  `;
}

function gerarRodape() {
  // Só a versão "estática" do rodapé, útil pra conferir visualmente o HTML
  // isolado no navegador. No PDF de verdade (Sprint 8), a repetição em toda
  // página fica a cargo do footerTemplate nativo do Puppeteer — mais
  // confiável do que tentar repetir isso via CSS de impressão.
  return `
    <footer class="rodape-relatorio">
      Relatório gerado pelo sistema Chama · Câmara Municipal de Itajubá
    </footer>
  `;
}

// Sprint 7 vai substituir esse placeholder restante, concatenando o HTML das
// seções que faltam (resumo inteligente, comparativo) dentro de
// <main class="conteudo">, junto com as seções já implementadas acima.
function gerarConteudoTopo(dados) {
  return `
    <div class="topo__conteudo">
      ${gerarResumoExecutivoIntro(dados)}
      ${gerarGradeKpis(dados)}
      ${gerarSecaoDestaques(dados)}
    </div>
  `;
}

function gerarConteudo(dados) {
  return `
    <main class="conteudo">
      ${gerarSecaoVisaoGeral(dados)}
      ${gerarSecaoDistribuicao(dados)}
      ${gerarSecaoIndicadores(dados)}
      <section class="secao-final">
        ${gerarSecaoResumoInteligente(dados)}
        ${gerarSecaoComparativo(dados)}
      </section>
      ${gerarRodape()}
    </main>
  `;
}

function gerarHtmlRelatorio(dados, opcoes = {}) {
  const classeBody = opcoes.paginaUnica ? 'pagina-unica' : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Executivo Operacional — ${dados.periodo.mes_extenso}</title>
  <style>${CSS_BASE}</style>
</head>
<body class="${classeBody}">
  <div class="relatorio">
    <div class="topo">
      ${gerarCapaLateral(dados)}
      ${gerarConteudoTopo(dados)}
    </div>
    ${gerarConteudo(dados)}
  </div>
</body>
</html>`;
}

module.exports = { gerarHtmlRelatorio };
