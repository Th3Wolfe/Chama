const fs = require('fs');
const path = require('path');
const { icone } = require('./icones');
const { gerarDestaques } = require('./destaques');
const { gerarGraficoLinha, gerarHeatmap } = require('./graficos-svg');

// Ícone embutido como base64: o Puppeteer renderiza esse HTML isoladamente
// (sem o frontend rodando do lado), então não dá pra apontar pra
// "/assets/flame-icon.png" como o app faz — precisa estar embutido no HTML.
const FLAME_ICON_BASE64 = fs.readFileSync(
  path.join(__dirname, 'assets', 'flame-icon.png')
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

  /* Faixa superior: capa lateral ao lado do resumo executivo, KPIs e
     destaques — só essa faixa tem a coluna da capa; o restante do relatório
     (visão geral em diante) ocupa a largura inteira da página abaixo dela. */
  .topo {
    display: grid;
    grid-template-columns: 220px 1fr;
    border-bottom: 1px solid var(--color-border);
  }

  .topo__conteudo {
    padding: 32px 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  /* ---------- Capa lateral (seção 1) ---------- */
  .capa {
    background: var(--color-bg);
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

  .capa__onda {
    position: absolute;
    left: -10px;
    right: -10px;
    bottom: 70px;
    opacity: 0.55;
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
  }

  .placeholder-secoes {
    color: var(--color-text-muted);
    font-size: 12px;
    padding: 20px;
    border: 1px dashed var(--color-border);
    border-radius: var(--radius-md);
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
    font-size: 13px;
    color: var(--color-text);
    max-width: 900px;
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
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .kpi-card__valor {
    font-size: 21px;
    font-weight: 700;
    color: var(--color-text);
  }

  .kpi-card__delta {
    font-size: 10.5px;
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
    font-size: 11.5px;
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

// Converte segundos em algo como "4h 12m" (ou "18m" se < 1h, ou "2d 3h" se
// passar de 24h) — mesma ideia usada nos KPIs de tempo médio do protótipo.
function formatarDuracao(segundos) {
  if (segundos === null || segundos === undefined) return '—';
  const totalMinutos = Math.round(segundos / 60);
  const dias = Math.floor(totalMinutos / (60 * 24));
  const horas = Math.floor((totalMinutos % (60 * 24)) / 60);
  const minutos = totalMinutos % 60;
  if (dias > 0) return `${dias}d ${horas}h`;
  if (horas > 0) return `${minutos > 0 ? `${horas}h ${minutos}m` : `${horas}h`}`;
  return `${minutos}m`;
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
    return `<span class="kpi-card__delta-vs">Sem dado do mês anterior</span>`;
  }
  const positivo = delta > 0;
  const negativo = delta < 0;
  const aumentouOuIgual = delta >= 0;
  const ehBom = config.bomSe === 'aumento' ? aumentouOuIgual : !aumentouOuIgual || delta === 0;
  const classeCor = delta === 0 ? '' : (ehBom ? 'kpi-card__delta-seta--positivo' : 'kpi-card__delta-seta--negativo');
  const seta = positivo ? '↑' : negativo ? '↓' : '→';
  const sufixo = config.tipoDelta === 'pontos' ? 'p.p.' : '%';
  return `<span class="${classeCor}">${seta} ${Math.abs(delta)}${config.tipoDelta === 'pontos' ? ' ' : ''}${sufixo}</span> <span class="kpi-card__delta-vs">vs. mês anterior</span>`;
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
      ${icone(d.icone, { cor: '#3B82F6', tamanho: 18 })}
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

      <svg class="capa__onda" viewBox="0 0 240 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M0,60 C30,20 60,90 90,50 C120,10 150,80 180,45 C200,25 220,55 240,40"
          stroke="#3B82F6" stroke-width="1.5" fill="none" opacity="0.7" />
        <path d="M0,75 C30,45 60,95 90,65 C120,35 150,90 180,60 C200,45 220,65 240,55"
          stroke="#3B82F6" stroke-width="1.5" fill="none" opacity="0.4" />
      </svg>

      <div class="capa__rodape">
        <div class="capa__rodape-label">Relatório gerado em</div>
        <div>${geradoEm.data} às ${geradoEm.hora}</div>
      </div>
    </aside>
  `;
}

// Sprints 4 a 7 vão substituir esse placeholder restante, concatenando o
// HTML das seções que faltam (gráficos de visão geral, distribuição,
// indicadores operacionais, resumo inteligente, comparativo) dentro de
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
      <div class="placeholder-secoes">
        Conteúdo restante do relatório (Distribuição, Indicadores
        Operacionais, Resumo Inteligente, Comparativos) — implementado nas
        Sprints 5 a 7.
      </div>
    </main>
  `;
}

function gerarHtmlRelatorio(dados) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>Relatório Executivo Operacional — ${dados.periodo.mes_extenso}</title>
  <style>${CSS_BASE}</style>
</head>
<body>
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
