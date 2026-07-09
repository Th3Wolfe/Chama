import { useState } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { api } from '../api/client';

const RELATORIOS = [
  { titulo: 'Relatório mensal', desc: 'Totais, resolvidos, pendentes e distribuição por categoria do mês atual.', endpoint: '/relatorios/mensal', arquivo: 'relatorio-mensal.pdf' },
  { titulo: 'Relatório por técnico', desc: 'Quantidade de chamados e tempo médio por técnico responsável.', endpoint: '/relatorios/tecnico', arquivo: 'relatorio-por-tecnico.pdf' },
  { titulo: 'Relatório por setor', desc: 'Quantidade de chamados abertos por setor da Câmara.', endpoint: '/relatorios/setor', arquivo: 'relatorio-por-setor.pdf' },
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
    <AppLayout titulo="Relatórios" subtitulo="Exportação em PDF para prestação de contas">
      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {RELATORIOS.map((r) => (
          <div key={r.endpoint} className="card" style={{ padding: 20 }}>
            <h3 className="card__title" style={{ marginBottom: 8 }}>{r.titulo}</h3>
            <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>{r.desc}</p>
            <button
              className="btn btn--primary"
              disabled={baixando === r.endpoint}
              onClick={() => baixar(r.endpoint, r.arquivo)}
            >
              {baixando === r.endpoint ? 'Gerando...' : 'Baixar PDF'}
            </button>
          </div>
        ))}
      </div>
    </AppLayout>
  );
}
