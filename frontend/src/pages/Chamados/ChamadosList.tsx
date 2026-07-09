import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/Layout/AppLayout';
import { StatusBadge, PrioridadeBadge } from '../../components/Badge';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { Chamado, ChamadosPaginados, StatusChamado } from '../../api/types';

const ABAS: { label: string; status?: StatusChamado }[] = [
  { label: 'Todos' },
  { label: 'Abertos', status: 'aberto' },
  { label: 'Em andamento', status: 'em_andamento' },
  { label: 'Resolvidos', status: 'resolvido' },
];

const TAMANHO_PAGINA = 15;

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ChamadosList() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const statusAtivo = params.get('status') as StatusChamado | null;
  const pagina = Math.max(parseInt(params.get('page') || '1', 10), 1);

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    const query = new URLSearchParams({ page: String(pagina), page_size: String(TAMANHO_PAGINA) });
    if (statusAtivo) query.set('status', statusAtivo);
    api
      .get<ChamadosPaginados>(`/chamados?${query.toString()}`)
      .then((res) => {
        setChamados(res.data.dados);
        setTotalPaginas(res.data.total_paginas);
        setTotal(res.data.total);
      })
      .finally(() => setCarregando(false));
  }, [statusAtivo, pagina]);

  function mudarAba(status?: StatusChamado) {
    setParams(status ? { status, page: '1' } : { page: '1' });
  }

  function irParaPagina(novaPagina: number) {
    const proximo = new URLSearchParams(params);
    proximo.set('page', String(novaPagina));
    setParams(proximo);
  }

  const isAdmin = usuario?.perfil === 'admin';

  return (
    <AppLayout
      titulo="Chamados"
      subtitulo={isAdmin ? 'Todos os chamados da Câmara' : 'Seus chamados'}
    >
      <div className="flex-between" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {ABAS.map((aba) => {
            const ativa = (aba.status ?? null) === statusAtivo;
            return (
              <button
                key={aba.label}
                className={ativa ? 'btn btn--primary' : 'btn btn--secondary'}
                onClick={() => mudarAba(aba.status)}
              >
                {aba.label}
              </button>
            );
          })}
        </div>
        <button className="btn btn--primary" onClick={() => navigate('/chamados/novo')}>
          + Novo chamado
        </button>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Título</th><th>Setor</th><th>Categoria</th>
              <th>Prioridade</th>
              {isAdmin && <th>Aberto por</th>}
              {isAdmin && <th>Responsável</th>}
              <th>Status</th><th>Criado em</th>
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr><td colSpan={9} className="empty-state">Carregando...</td></tr>
            )}
            {!carregando && chamados.length === 0 && (
              <tr><td colSpan={9} className="empty-state">Nenhum chamado encontrado.</td></tr>
            )}
            {chamados.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/chamados/${c.id}`)}>
                <td className={`td--prioridade-${c.prioridade_atual}`}>#{c.id}</td>
                <td>{c.titulo}</td>
                <td>{c.setor_nome}</td>
                <td>{c.categoria_nome}</td>
                <td><PrioridadeBadge prioridade={c.prioridade_atual} /></td>
                {isAdmin && <td>{c.aberto_por_nome}</td>}
                {isAdmin && <td>{c.responsavel_nome ?? '—'}</td>}
                <td><StatusBadge status={c.status} /></td>
                <td>{formatarData(c.criado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!carregando && total > 0 && (
          <div className="flex-between" style={{ padding: '14px 16px', borderTop: '1px solid var(--color-border)' }}>
            <span className="text-muted" style={{ fontSize: 13 }}>
              Mostrando {(pagina - 1) * TAMANHO_PAGINA + 1}–{Math.min(pagina * TAMANHO_PAGINA, total)} de {total} chamados
            </span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn btn--secondary" disabled={pagina <= 1} onClick={() => irParaPagina(pagina - 1)}>
                ‹
              </button>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPaginas || Math.abs(p - pagina) <= 1)
                .map((p, i, arr) => (
                  <span key={p} style={{ display: 'flex', gap: 6 }}>
                    {i > 0 && arr[i - 1] !== p - 1 && <span className="text-muted" style={{ padding: '0 4px' }}>…</span>}
                    <button
                      className={p === pagina ? 'btn btn--primary' : 'btn btn--secondary'}
                      onClick={() => irParaPagina(p)}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button className="btn btn--secondary" disabled={pagina >= totalPaginas} onClick={() => irParaPagina(pagina + 1)}>
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
