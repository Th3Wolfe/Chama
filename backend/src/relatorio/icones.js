// Ícones SVG desenhados à mão (stroke-based, viewBox 24x24, no estilo do
// lucide-react usado no frontend) para uso no backend, onde não dá pra
// importar a lib de componentes React — o Puppeteer só renderiza o HTML/SVG
// que a gente montar aqui como string.
//
// Cada função devolve um <svg> pronto, com `stroke="currentColor"` — quem
// chama controla a cor via `color` no elemento pai ou passando `cor` direto.

const CAMINHOS = {
  'grid': '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  'message-circle': '<path d="M12 3a9 9 0 1 0 4.9 16.5L21 21l-1.2-3.9A9 9 0 0 0 12 3z"/>',
  'monitor': '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  'alert-triangle': '<path d="M12 4l9.5 16H2.5L12 4z"/><path d="M12 10v4"/><circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none"/>',
  'trending-up': '<path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/>',
  'building': '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1"/>',
  'printer': '<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="8" rx="1.5"/><path d="M7 16h10v5H7z"/>',
  'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  'calendar': '<rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M8 3v3M16 3v3"/>',
  'lightbulb': '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.45 1 1.15 1 1.9v.2h5v-.2c0-.75.4-1.45 1-1.9A6 6 0 0 0 12 3z"/>',
  'clipboard-search': '<rect x="5" y="4" width="14" height="17" rx="1.5"/><path d="M9 3h6a1 1 0 0 1 1 1v1H8V4a1 1 0 0 1 1-1z"/><path d="M8 11h5M8 14h3"/><circle cx="15" cy="15.5" r="2.2"/><path d="M16.7 17.2L18.5 19"/>',
};

function icone(nome, { cor = 'currentColor', tamanho = 18, largura = 2 } = {}) {
  const miolo = CAMINHOS[nome];
  if (!miolo) return '';
  return `<svg width="${tamanho}" height="${tamanho}" viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="${largura}" stroke-linecap="round" stroke-linejoin="round">${miolo}</svg>`;
}

module.exports = { icone };
