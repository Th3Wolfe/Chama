import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AppLayout } from '../../components/Layout/AppLayout';
import { StatusBadge, PrioridadeBadge } from '../../components/Badge';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { Chamado, StatusChamado } from '../../api/types';

const ABAS: { label: string; status?: StatusChamado }[] = [
  { label: 'Todos' },
  { label: 'Abertos', status: 'aberto' },
  { label: 'Em andamento', status: 'em_andamento' },
  { label: 'Resolvidos', status: 'resolvido' },
];

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ChamadosList() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [params, setParams] = useSearchParams();
  const statusAtivo = params.get('status') as StatusChamado | null;

  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCarregando(true);
    const query = statusAtivo ? `?status=${statusAtivo}` : '';
    api
      .get<Chamado[]>(`/chamados${query}`)
      .then((res) => setChamados(res.data))
      .finally(() => setCarregando(false));
  }, [statusAtivo]);

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
                onClick={() => setParams(aba.status ? { status: aba.status } : {})}
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
      </div>
    </AppLayout>
  );
}
