import { useState } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { api } from '../api/client';

const RELATORIOS = [
  {
    titulo: 'Relatório mensal',
    desc: 'Totais, resolvidos, pendentes e distribuição por categoria do mês atual.',
    pdf: { endpoint: '/relatorios/mensal', arquivo: 'relatorio-mensal.pdf' },
    excel: { endpoint: '/relatorios/mensal/excel', arquivo: 'relatorio-mensal.xlsx' },
  },
  {
    titulo: 'Relatório por técnico',
    desc: 'Quantidade de chamados e tempo médio por técnico responsável.',
    pdf: { endpoint: '/relatorios/tecnico', arquivo: 'relatorio-por-tecnico.pdf' },
    excel: { endpoint: '/relatorios/tecnico/excel', arquivo: 'relatorio-por-tecnico.xlsx' },
  },
  {
    titulo: 'Relatório por setor',
    desc: 'Quantidade de chamados abertos por setor da Câmara.',
    pdf: { endpoint: '/relatorios/setor', arquivo: 'relatorio-por-setor.pdf' },
    excel: { endpoint: '/relatorios/setor/excel', arquivo: 'relatorio-por-setor.xlsx' },
  },
];

export function Relatorios() {
  const [baixando, setBaixando] = useState<string | null>(null);

  async function baixar(endpoint: string, arquivo: string) {
    setBaixando(endpoint);
    try {
      const res = await api.get(endpoint, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = arquivo;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setBaixando(null);
    }
  }

  return (
    <AppLayout titulo="Relatórios" subtitulo="Exportação em PDF ou Excel para prestação de contas">
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {RELATORIOS.map((r) => (
          <div key={r.pdf.endpoint} className="card" style={{ padding: 20 }}>
            <h3 className="card__title" style={{ marginBottom: 8 }}>{r.titulo}</h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>{r.desc}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn--primary"
                disabled={baixando === r.pdf.endpoint}
                onClick={() => baixar(r.pdf.endpoint, r.pdf.arquivo)}
              >
                {baixando === r.pdf.endpoint ? 'Gerando...' : 'Baixar PDF'}
              </button>
              <button
                className="btn btn--secondary"
                disabled={baixando === r.excel.endpoint}
                onClick={() => baixar(r.excel.endpoint, r.excel.arquivo)}
              >
                {baixando === r.excel.endpoint ? 'Gerando...' : 'Baixar Excel'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
