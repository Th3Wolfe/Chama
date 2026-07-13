import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, CalendarCheck, Clock3, CheckCircle2, BookOpen, Megaphone } from 'lucide-react';
import { AppLayout } from '../components/Layout/AppLayout';
import { StatCard } from '../components/StatCard';
import { StatusBadge, PrioridadeBadge } from '../components/Badge';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { POLLING_MS } from '../config/polling';
import type { Chamado, ChamadosPaginados, StatusChamado } from '../api/types';

const ABAS: { label: string; status?: StatusChamado }[] = [
  { label: 'Todos' },
  { label: 'Abertos', status: 'aberto' },
  { label: 'Em andamento', status: 'em_andamento' },
  { label: 'Resolvidos', status: 'resolvido' },
];

const PREVIEW_TAMANHO = 5;

function formatarData(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] || nomeCompleto;
}

export function UserHome() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [aba, setAba] = useState<StatusChamado | undefined>(undefined);
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let cancelado = false;

    function carregar(mostrarCarregando: boolean) {
      if (mostrarCarregando) setCarregando(true);
      // Um usuário comum tem poucos chamados — trazemos até 100 numa
      // página só e derivamos as estatísticas no front, sem precisar
      // de um endpoint dedicado.
      api
        .get<ChamadosPaginados>('/chamados?page=1&page_size=100')
        .then((res) => {
          if (cancelado) return;
          setChamados(res.data.dados);
        })
        .finally(() => {
          if (!cancelado) setCarregando(false);
        });
    }

    carregar(true);
    const intervalo = setInterval(() => carregar(false), POLLING_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
  }, []);

  const total = chamados.length;
  const abertos = chamados.filter((c) => c.status === 'aberto').length;
  const emAndamento = chamados.filter((c) => c.status === 'em_andamento').length;
  const resolvidos = chamados.filter((c) => c.status === 'resolvido').length;

  const listaFiltrada = aba ? chamados.filter((c) => c.status === aba) : chamados;
  const listaPreview = listaFiltrada.slice(0, PREVIEW_TAMANHO);

  return (
    <AppLayout
      titulo={`Olá, ${usuario ? primeiroNome(usuario.nome) : ''}! 👋`}
      subtitulo="Acompanhe seus chamados e solicitações de suporte"
    >
      <div className="flex-between" style={{ marginBottom: 20 }}>
        <div />
        <button className="btn btn--primary" onClick={() => navigate('/chamados/novo')}>
          <Plus size={15} strokeWidth={2.25} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Novo chamado
        </button>
      </div>

      <div className="stat-grid">
        <StatCard icon={<FileText size={20} strokeWidth={2} />} iconBg="var(--accent-blue)" accent="var(--accent-blue)" label="Total de chamados" value={total} />
        <StatCard icon={<CalendarCheck size={20} strokeWidth={2} />} iconBg="var(--accent-blue)" accent="var(--accent-blue)" label="Abertos" value={abertos} />
        <StatCard icon={<Clock3 size={20} strokeWidth={2} />} iconBg="var(--accent-amber)" accent="var(--accent-amber)" label="Em andamento" value={emAndamento} />
        <StatCard icon={<CheckCircle2 size={20} strokeWidth={2} />} iconBg="var(--accent-green)" accent="var(--accent-green)" label="Resolvidos" value={resolvidos} />
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card__header" style={{ paddingBottom: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {ABAS.map((item) => {
              const ativa = (item.status ?? undefined) === aba;
              return (
                <button
                  key={item.label}
                  className={ativa ? 'btn btn--primary' : 'btn btn--secondary'}
                  onClick={() => setAba(item.status)}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>ID</th><th>Título</th><th>Categoria</th><th>Prioridade</th><th>Status</th><th>Atualizado em</th>
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr><td colSpan={6} className="empty-state">Carregando...</td></tr>
            )}
            {!carregando && listaPreview.length === 0 && (
              <tr><td colSpan={6} className="empty-state">Nenhum chamado encontrado.</td></tr>
            )}
            {listaPreview.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => navigate(`/chamados/${c.id}`)}>
                <td className={`td--prioridade-${c.prioridade_atual}`}>#{c.id}</td>
                <td>{c.titulo}</td>
                <td>{c.categoria_nome}</td>
                <td><PrioridadeBadge prioridade={c.prioridade_atual} /></td>
                <td><StatusBadge status={c.status} /></td>
                <td>{formatarData(c.atualizado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!carregando && listaFiltrada.length > 0 && (
          <button
            className="btn btn--secondary"
            style={{ width: '100%', justifyContent: 'center', borderRadius: 0, borderTop: '1px solid var(--color-border)' }}
            onClick={() => navigate('/chamados')}
          >
            Ver todos os chamados
          </button>
        )}
      </div>

      <div className="userhome-cards">
        <div className="card userhome-card">
          <div>
            <h3 className="userhome-card__title">Base de conhecimento</h3>
            <p className="userhome-card__desc">Encontre respostas rápidas para problemas comuns.</p>
          </div>
          <div className="userhome-card__footer">
            <span className="userhome-card__icon userhome-card__icon--blue"><BookOpen size={20} strokeWidth={2} /></span>
            <button className="btn btn--secondary" onClick={() => navigate('/base-conhecimento')}>Acessar</button>
          </div>
        </div>

        <div className="card userhome-card">
          <div>
            <h3 className="userhome-card__title">Comunicados</h3>
            <p className="userhome-card__desc">Fique por dentro das novidades e manutenções programadas.</p>
          </div>
          <div className="userhome-card__footer">
            <span className="userhome-card__icon userhome-card__icon--purple"><Megaphone size={20} strokeWidth={2} /></span>
            <button className="btn btn--secondary" onClick={() => navigate('/comunicados')}>Ver comunicados</button>
          </div>
        </div>

        <div className="card userhome-card">
          <div>
            <h3 className="userhome-card__title">Horário de atendimento</h3>
            <p className="userhome-card__desc">Segunda a Sexta<br />08:00 – 18:00</p>
          </div>
          <div className="userhome-card__footer">
            <span className="userhome-card__icon userhome-card__icon--green"><Clock3 size={20} strokeWidth={2} /></span>
            <span className="badge badge--ativo">● Atendimento online</span>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
