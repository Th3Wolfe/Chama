import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, HelpCircle, Monitor, User, PlusCircle, MessageSquare, RefreshCw, Target, LogOut } from 'lucide-react';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { NotificationsPanel } from '../NotificationsPanel';
import { pushToast } from '../Toast';
import { POLLING_MS } from '../../config/polling';
import type { Notificacao, ResultadoBusca } from '../../api/types';

const INTERVALO_POLLING_MS = POLLING_MS;
const TITULO_BASE = 'Sistema de Chamados de TI';
const DEBOUNCE_BUSCA_MS = 300;

const TIPO_INFO: Record<Notificacao['tipo'], { titulo: string; cor: string; icone: typeof PlusCircle }> = {
  novo_chamado: { titulo: 'Novo chamado aberto', cor: '#3B82F6', icone: PlusCircle },
  novo_comentario: { titulo: 'Novo comentário', cor: '#F5A623', icone: MessageSquare },
  mudanca_status: { titulo: 'Status alterado', cor: '#A78BFA', icone: RefreshCw },
  chamado_atribuido: { titulo: 'Chamado atribuído a você', cor: '#22C55E', icone: Target },
};

export function Topbar({ titulo, subtitulo }: { titulo: string; subtitulo?: string }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [aberto, setAberto] = useState(false);
  const [sinoAceso, setSinoAceso] = useState(false);
  const painelRef = useRef<HTMLDivElement>(null);
  const idsConhecidos = useRef<Set<number> | null>(null); // null = ainda não fez a primeira busca

  const [termoBusca, setTermoBusca] = useState('');
  const [resultadoBusca, setResultadoBusca] = useState<ResultadoBusca | null>(null);
  const [buscaAberta, setBuscaAberta] = useState(false);
  const buscaRef = useRef<HTMLDivElement>(null);
  const inputBuscaRef = useRef<HTMLInputElement>(null);

  const [perfilAberto, setPerfilAberto] = useState(false);
  const perfilRef = useRef<HTMLDivElement>(null);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  // Busca com debounce: só dispara 300ms depois que a pessoa para de digitar,
  // e só a partir de 2 caracteres (evita martelar o backend a cada tecla).
  useEffect(() => {
    if (termoBusca.trim().length < 2) {
      setResultadoBusca(null);
      return;
    }
    const timeout = setTimeout(() => {
      api
        .get<ResultadoBusca>('/busca', { params: { q: termoBusca.trim() } })
        .then((res) => setResultadoBusca(res.data))
        .catch(() => setResultadoBusca(null));
    }, DEBOUNCE_BUSCA_MS);
    return () => clearTimeout(timeout);
  }, [termoBusca]);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (buscaRef.current && !buscaRef.current.contains(e.target as Node)) {
        setBuscaAberta(false);
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  // Atalho ⌘K / Ctrl+K: foca a busca de qualquer lugar da tela.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputBuscaRef.current?.focus();
        setBuscaAberta(true);
      }
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);

  function irPara(destino: string) {
    setBuscaAberta(false);
    setTermoBusca('');
    navigate(destino);
  }

  const temResultados = !!resultadoBusca && (
    resultadoBusca.chamados.length > 0 || resultadoBusca.equipamentos.length > 0 || resultadoBusca.usuarios.length > 0
  );

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

  // Fecha o menu de perfil ao clicar fora dele
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (perfilRef.current && !perfilRef.current.contains(e.target as Node)) {
        setPerfilAberto(false);
      }
    }
    if (perfilAberto) document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [perfilAberto]);

  async function handleSair() {
    setPerfilAberto(false);
    await logout();
  }

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

  async function handleMarcarTodasLidas() {
    const anteriores = notificacoes;
    setNotificacoes((atual) => atual.map((x) => ({ ...x, lida: true })));
    try {
      await api.patch('/notificacoes/lidas');
    } catch {
      setNotificacoes(anteriores);
    }
  }

  return (
    <header className="topbar">
      <div>
        <h1 className="topbar__title">{titulo}</h1>
        {subtitulo && <p className="topbar__subtitle">{subtitulo}</p>}
      </div>

      <div className="topbar__actions">
        <div className="topbar__search" ref={buscaRef} style={{ position: 'relative' }}>
          <Search size={16} strokeWidth={2} />
          <input
            ref={inputBuscaRef}
            placeholder="Buscar chamado, usuário ou equipamento..."
            value={termoBusca}
            onChange={(e) => {
              setTermoBusca(e.target.value);
              setBuscaAberta(true);
            }}
            onFocus={() => setBuscaAberta(true)}
          />
          {!buscaAberta && !termoBusca && <span className="topbar__kbd">⌘K</span>}
          {buscaAberta && termoBusca.trim().length >= 2 && (
            <div className="search-dropdown">
              {!resultadoBusca && <div className="search-dropdown__empty">Buscando...</div>}
              {resultadoBusca && !temResultados && (
                <div className="search-dropdown__empty">Nenhum resultado para "{termoBusca}".</div>
              )}
              {resultadoBusca && resultadoBusca.chamados.length > 0 && (
                <div className="search-dropdown__group">
                  <span className="search-dropdown__label">Chamados</span>
                  {resultadoBusca.chamados.map((c) => (
                    <button key={c.id} className="search-dropdown__item" onClick={() => irPara(`/chamados/${c.id}`)}>
                      #{c.id} — {c.titulo}
                    </button>
                  ))}
                </div>
              )}
              {resultadoBusca && resultadoBusca.equipamentos.length > 0 && (
                <div className="search-dropdown__group">
                  <span className="search-dropdown__label">Equipamentos</span>
                  {resultadoBusca.equipamentos.map((eq) => (
                    <button key={eq.id} className="search-dropdown__item" onClick={() => irPara('/equipamentos')}>
                      <Monitor size={14} strokeWidth={2} /> {eq.nome}{eq.numero_serie ? ` — nº ${eq.numero_serie}` : ''}
                    </button>
                  ))}
                </div>
              )}
              {resultadoBusca && resultadoBusca.usuarios.length > 0 && (
                <div className="search-dropdown__group">
                  <span className="search-dropdown__label">Usuários</span>
                  {resultadoBusca.usuarios.map((u) => (
                    <button key={u.id} className="search-dropdown__item" onClick={() => irPara('/usuarios')}>
                      <User size={14} strokeWidth={2} /> {u.nome} <span className="text-muted">— {u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ position: 'relative' }} ref={painelRef}>
          <button
            className={`topbar__icon-btn${sinoAceso ? ' topbar__icon-btn--aceso' : ''}`}
            aria-label="Notificações"
            onClick={() => setAberto((v) => !v)}
          >
            <Bell size={18} strokeWidth={2} />
            {naoLidas > 0 && <span className="topbar__icon-badge">{naoLidas}</span>}
          </button>
          {aberto && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: 340, zIndex: 50 }}>
              <NotificationsPanel notificacoes={notificacoes} onSelecionar={handleSelecionar} onMarcarTodasLidas={handleMarcarTodasLidas} />
            </div>
          )}
        </div>

        <button
          className="topbar__help-btn"
          aria-label="Ajuda"
          title="Ajuda"
          onClick={() => pushToast({ titulo: 'Central de ajuda', descricao: 'Em breve. Por enquanto, fale com a equipe de TI.', cor: '#3B82F6', icone: HelpCircle })}
        >
          <HelpCircle size={18} strokeWidth={2} />
        </button>

        {usuario && (
          <div className="topbar__user-wrapper" ref={perfilRef}>
            <button
              className="topbar__user"
              onClick={() => setPerfilAberto((v) => !v)}
              aria-haspopup="true"
              aria-expanded={perfilAberto}
            >
              <div className="topbar__user-avatar">
                {usuario.nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
              </div>
              <div className="topbar__user-info">
                <p className="topbar__user-nome">{usuario.nome}</p>
                <p className="topbar__user-papel">{usuario.perfil === 'admin' ? 'Administrador' : 'Usuário'}</p>
              </div>
            </button>

            {perfilAberto && (
              <div className="perfil-dropdown">
                <div className="perfil-dropdown__header">
                  <div className="topbar__user-avatar">
                    {usuario.nome.split(' ').slice(0, 2).map((p) => p[0]).join('').toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p className="perfil-dropdown__nome">{usuario.nome}</p>
                    <p className="perfil-dropdown__email">{usuario.email}</p>
                  </div>
                </div>
                <div className="perfil-dropdown__divisor" />
                <button className="perfil-dropdown__item perfil-dropdown__item--sair" onClick={handleSair}>
                  <LogOut size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} /> Sair
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
