import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { NotificationsPanel } from '../NotificationsPanel';
import { pushToast } from '../Toast';
import type { Notificacao } from '../../api/types';

const INTERVALO_POLLING_MS = 15000;
const TITULO_BASE = 'Sistema de Chamados de TI';

const TIPO_INFO: Record<Notificacao['tipo'], { titulo: string; cor: string; icone: string }> = {
  novo_chamado: { titulo: 'Novo chamado aberto', cor: '#3B82F6', icone: '🆕' },
  novo_comentario: { titulo: 'Novo comentário', cor: '#F5A623', icone: '💬' },
  mudanca_status: { titulo: 'Status alterado', cor: '#A78BFA', icone: '🔄' },
  chamado_atribuido: { titulo: 'Chamado atribuído a você', cor: '#22C55E', icone: '🎯' },
};

export function Topbar({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [sinoAceso, setSinoAceso] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const idsConhecidos = useRef<Set<number> | null>(null); // null = ainda não fez a primeira busca

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  useEffect(() => {
    if (!usuario) return;

    let cancelado = false;
    async function buscarNotificacoes() {
      try {
        const { data } = await api.get<Notificacao[]>('/notificacoes');
        if (cancelado) return;

        // Descobre quais chegaram desde a última busca pra avisar o usuário.
        if (idsConhecidos.current) {
          const novas = data.filter((n) => !n.lida && !idsConhecidos.current!.has(n.id));
          for (const n of novas.slice(0, 3)) {
            const info = TIPO_INFO[n.tipo];
            pushToast({
              titulo: info.titulo,
              descricao: n.chamado_titulo ? `#${n.chamado_id} — ${n.chamado_titulo}` : `Chamado #${n.chamado_id}`,
              cor: info.cor,
              icone: info.icone,
              onClick: () => {
                navigate(`/chamados/${n.chamado_id}`);
              },
            });
          }
          if (novas.length > 0) {
            setSinoAceso(true);
            setTimeout(() => setSinoAceso(false), 1800);
          }
        }
        idsConhecidos.current = new Set(data.map((n) => n.id));
        setNotificacoes(data);
      } catch {
        // silencioso: notificação não é crítica para o uso da página
      }
    }
    buscarNotificacoes();
    const id = setInterval(buscarNotificacoes, INTERVALO_POLLING_MS);
    return () => {
      cancelado = true;
      clearInterval(id);
    };
  }, [usuario, navigate]);

  // Título da aba do navegador avisa mesmo se o usuário estiver em outra aba
  useEffect(() => {
    document.title = naoLidas > 0 ? `(${naoLidas}) ${TITULO_BASE}` : TITULO_BASE;
    return () => {
      document.title = TITULO_BASE;
    };
  }, [naoLidas]);

  // Fecha o painel ao clicar fora dele
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (painelRef.current && !painelRef.current.contains(e.target as Node)) {
        setAberto(false);
      }
    }
    if (aberto) document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [aberto]);

  async function handleSelecionar(n: Notificacao) {
    setAberto(false);
    try {
      if (!n.lida) {
        await api.patch(`/notificacoes/${n.id}/lida`);
        setNotificacoes((atual) => atual.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
      }
    } finally {
      navigate(`/chamados/${n.chamado_id}`);
    }
  }

  return (
    <header className="topbar">
      <div>
        <h1 className="topbar__title">{titulo}</h1>
        {subtitulo && <p className="topbar__subtitle">{subtitulo}</p>}
      </div>

      <div className="topbar__actions">
        <div className="topbar__search">
          🔍
          <input placeholder="Buscar chamado, usuário ou equipamento..." />
        </div>
        <div style={{ position: 'relative' }} ref={painelRef}>
          <button
            className={`topbar__icon-btn${sinoAceso ? ' topbar__icon-btn--aceso' : ''}`}
            aria-label="Notificações"
            onClick={() => setAberto((v) => !v)}
          >
            🔔
            {naoLidas > 0 && <span className="topbar__icon-badge">{naoLidas}</span>}
          </button>
          {aberto && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, zIndex: 50 }}>
              <NotificationsPanel notificacoes={notificacoes} onSelecionar={handleSelecionar} />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
