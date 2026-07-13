import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Plus,
  PlayCircle,
  Headphones,
  PartyPopper,
  CalendarCheck,
  Clock3,
  CheckCircle2,
  BookOpen,
  Megaphone,
  MessageSquare,
  ChevronRight,
  ArrowRight,
  Lightbulb,
  ShieldCheck,
  MessageCircle,
  Wrench,
  Printer,
  Wifi,
  Server,
  Mail,
  Laptop,
  CalendarDays,
  Search,
} from 'lucide-react';
import { AppLayout } from '../components/Layout/AppLayout';
import { StatCard } from '../components/StatCard';
import { NovoChamadoModal } from '../components/NovoChamadoModal';
import { pushToast } from '../components/Toast';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { POLLING_MS } from '../config/polling';
import type { Chamado, ChamadoDetalhe, ChamadosPaginados } from '../api/types';

const PREVIEW_DETALHES = 3; // quantos chamados ativos recebem lookup de comentários/histórico

function primeiroNome(nomeCompleto: string): string {
  return nomeCompleto.trim().split(/\s+/)[0] || nomeCompleto;
}

function saudacao(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatarRelativoCurto(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'agora mesmo';
  if (min < 60) return `${min} min atrás`;
  const horas = Math.floor(min / 60);
  if (horas < 24) return `${horas}h atrás`;
  const dias = Math.floor(horas / 24);
  return `${dias}d atrás`;
}

// Ícone decorativo por categoria — mesmo critério usado no Hero do dashboard e no ChamadoModal.
const ICONES_CATEGORIA: { termos: string[]; icone: LucideIcon }[] = [
  { termos: ['impressora', 'toner'], icone: Printer },
  { termos: ['internet', 'rede', 'wi-fi', 'wifi'], icone: Wifi },
  { termos: ['servidor', 'backup'], icone: Server },
  { termos: ['e-mail', 'email', 'outlook'], icone: Mail },
  { termos: ['sistema', 'software', 'erp'], icone: Laptop },
];

function iconePorCategoria(nomeCategoria?: string): LucideIcon {
  const alvo = (nomeCategoria || '').toLowerCase();
  const achado = ICONES_CATEGORIA.find((c) => c.termos.some((t) => alvo.includes(t)));
  return achado?.icone ?? Wrench;
}

type EstadoPasso = 'done' | 'current' | 'pending';

interface PassoLinhaDoTempo {
  chave: string;
  titulo: string;
  data?: string | null;
  estado: EstadoPasso;
  mostrarResponder?: boolean;
}

/**
 * Monta a linha do tempo de um chamado a partir do histórico de status e do
 * último comentário. Não existe (ainda) um campo dedicado de "aguardando
 * resposta" no backend — é derivado comparando o autor do último comentário
 * com o nome do usuário logado, que é a melhor informação disponível hoje.
 */
function construirLinhaDoTempo(detalhe: ChamadoDetalhe, nomeUsuario?: string): PassoLinhaDoTempo[] {
  const entradaAndamento = detalhe.historico.find((h) => h.status_novo === 'em_andamento');
  const entradaResolvido = detalhe.historico.find((h) => h.status_novo === 'resolvido');
  const ultimoComentario = detalhe.comentarios.length > 0 ? detalhe.comentarios[detalhe.comentarios.length - 1] : null;
  const respostaDoTecnico = !!ultimoComentario && ultimoComentario.autor_nome !== nomeUsuario;

  const passos: PassoLinhaDoTempo[] = [
    { chave: 'criado', titulo: 'Chamado criado', data: detalhe.criado_em, estado: 'done' },
    {
      chave: 'atendimento',
      titulo: 'Em atendimento',
      data: entradaAndamento?.alterado_em,
      estado: entradaAndamento || detalhe.status !== 'aberto' ? 'done' : 'pending',
    },
  ];

  if (detalhe.status === 'resolvido') {
    if (ultimoComentario) {
      passos.push({ chave: 'tecnico', titulo: 'Técnico respondeu', data: ultimoComentario.criado_em, estado: 'done' });
    }
    passos.push({ chave: 'resolvido', titulo: 'Resolvido', data: detalhe.resolvido_em ?? entradaResolvido?.alterado_em, estado: 'done' });
    return passos;
  }

  passos.push({
    chave: 'tecnico',
    titulo: 'Técnico respondeu',
    data: respostaDoTecnico ? ultimoComentario!.criado_em : undefined,
    estado: respostaDoTecnico ? 'done' : 'pending',
  });
  passos.push({
    chave: 'aguardando',
    titulo: 'Aguardando você',
    estado: respostaDoTecnico ? 'current' : 'pending',
    mostrarResponder: respostaDoTecnico,
  });
  passos.push({ chave: 'resolvido', titulo: 'Resolvido', estado: 'pending' });

  return passos;
}

// ---------- Conteúdo estático ilustrativo (Comunicados e Base de conhecimento ainda
// não têm dados dinâmicos no backend — as duas telas seguem "em construção"). ----------
const COMUNICADOS = [
  { titulo: 'Manutenção da rede interna', tempo: 'Hoje, 08:00', desc: 'Manutenção preventiva programada para hoje das 18h às 20h.', icone: Wrench, cor: 'var(--accent-blue)' },
  { titulo: 'Atualização do sistema', tempo: 'Ontem, 14:30', desc: 'Novo módulo de chamados disponível com melhorias na comunicação.', icone: ArrowRight, cor: 'var(--accent-amber)' },
  { titulo: 'Feriado municipal', tempo: '07/07/2026', desc: 'Não haverá expediente na próxima segunda-feira (14/07).', icone: CalendarDays, cor: 'var(--accent-green)' },
];

const BASE_CONHECIMENTO_ITENS = [
  { titulo: 'Impressora offline', desc: 'Como resolver problemas de impressão', icone: Printer, cor: 'var(--accent-blue)' },
  { titulo: 'Como redefinir senha', desc: 'Passo a passo para trocar sua senha', icone: ShieldCheck, cor: 'var(--accent-green)' },
  { titulo: 'Acesso VPN', desc: 'Como conectar à rede da Câmara', icone: Wifi, cor: '#F472B6' },
  { titulo: 'Outlook não sincroniza', desc: 'Soluções para problemas comuns', icone: Mail, cor: 'var(--accent-red)' },
];

const DICAS = [
  {
    titulo: 'Dica da semana',
    novidade: true,
    desc: 'Aprenda a conectar sua impressora de rede em menos de 2 minutos.',
    link: 'Ver tutorial',
    icone: Lightbulb,
    cor: 'var(--accent-amber)',
  },
  {
    titulo: 'Segurança em primeiro lugar',
    novidade: false,
    desc: 'Mantenha sua senha segura e proteja suas informações.',
    link: 'Saiba mais',
    icone: ShieldCheck,
    cor: 'var(--accent-green)',
  },
  {
    titulo: 'Você pode conversar com o técnico',
    novidade: false,
    desc: 'Responda mensagens e envie arquivos diretamente pelo chamado.',
    link: 'Entenda como',
    icone: MessageCircle,
    cor: 'var(--accent-purple)',
  },
];

function verEmConstrucao(nome: string) {
  pushToast({ titulo: nome, descricao: 'Em breve. Por enquanto, fale com a equipe de TI.', cor: '#3B82F6', icone: Megaphone });
}

export function UserHome() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoChamadoAberto, setNovoChamadoAberto] = useState(false);
  const [detalhes, setDetalhes] = useState<Record<number, ChamadoDetalhe>>({});

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
  const emAndamento = chamados.filter((c) => c.status === 'em_andamento').length;
  const resolvidosUltimos30Dias = chamados.filter((c) => {
    if (c.status !== 'resolvido' || !c.resolvido_em) return false;
    const dias = (Date.now() - new Date(c.resolvido_em).getTime()) / 86400000;
    return dias <= 30;
  }).length;

  // Chamados ainda não resolvidos, do mais recente pro mais antigo — candidatos
  // a aparecer em destaque ("Acompanhe seu chamado") e no painel de alerta.
  const ativos = useMemo(
    () =>
      [...chamados]
        .filter((c) => c.status !== 'resolvido')
        .sort((a, b) => new Date(b.atualizado_em).getTime() - new Date(a.atualizado_em).getTime()),
    [chamados],
  );

  const idsParaDetalhar = useMemo(() => ativos.slice(0, PREVIEW_DETALHES).map((c) => c.id), [ativos]);
  const chaveIds = idsParaDetalhar.join(',');

  useEffect(() => {
    if (idsParaDetalhar.length === 0) return;
    let cancelado = false;
    Promise.all(
      idsParaDetalhar.map((id) =>
        api
          .get<ChamadoDetalhe>(`/chamados/${id}`)
          .then((res) => [id, res.data] as const)
          .catch(() => null),
      ),
    ).then((resultados) => {
      if (cancelado) return;
      setDetalhes((atual) => {
        const novo = { ...atual };
        for (const item of resultados) {
          if (item) novo[item[0]] = item[1];
        }
        return novo;
      });
    });
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveIds]);

  // Entre os chamados com detalhe já carregado, marca quais estão aguardando
  // resposta do usuário (o técnico comentou por último).
  const infosAtivos = ativos
    .map((chamado) => {
      const detalhe = detalhes[chamado.id];
      if (!detalhe) return null;
      const ultimoComentario = detalhe.comentarios.length > 0 ? detalhe.comentarios[detalhe.comentarios.length - 1] : null;
      const aguardandoResposta = !!ultimoComentario && ultimoComentario.autor_nome !== usuario?.nome;
      return { chamado, detalhe, aguardandoResposta };
    })
    .filter((v): v is { chamado: Chamado; detalhe: ChamadoDetalhe; aguardandoResposta: boolean } => v !== null);

  const aguardandoLista = infosAtivos.filter((i) => i.aguardandoResposta);

  const destacado = aguardandoLista[0] ?? infosAtivos[0] ?? null;
  const semDetalheAindaCarregando = ativos.length > 0 && !destacado;

  const estadoVazio = total === 0;

  function abrirChamado(id: number) {
    navigate(`/chamados/${id}`);
  }

  return (
    <AppLayout
      titulo={estadoVazio ? '' : `${saudacao()}, ${usuario ? primeiroNome(usuario.nome) : ''}! 👋`}
      subtitulo={estadoVazio ? undefined : 'Como podemos ajudar hoje?'}
    >
      {carregando ? (
        <div className="empty-state" style={{ padding: '60px 0' }}>Carregando...</div>
      ) : estadoVazio ? (
        // ---------------------------------------------------------------
        // ESTADO 1 — sem chamados nem histórico
        // ---------------------------------------------------------------
        <>
          <div className="card uh-hero uh-hero--vazio">
            <div>
              <h2 className="uh-hero__title">Tudo funcionando perfeitamente! 🎉</h2>
              <p className="uh-hero__desc">
                Nenhum chamado em andamento.
                <br />
                Caso precise de ajuda, nossa equipe está pronta para te atender.
              </p>
              <div className="uh-hero__actions">
                <button className="btn btn--primary" onClick={() => setNovoChamadoAberto(true)}>
                  <Plus size={15} strokeWidth={2.25} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Abrir chamado
                </button>
                <button className="uh-hero__link" onClick={() => verEmConstrucao('Como funciona')}>
                  <PlayCircle size={15} strokeWidth={2} /> Como funciona?
                </button>
              </div>
            </div>
            <div className="uh-hero__illustration" aria-hidden="true">
              <PartyPopper size={40} strokeWidth={1.5} />
            </div>
          </div>

          <QuickActionsGrid onAbrirChamado={() => setNovoChamadoAberto(true)} navigate={navigate} />

          <div className="uh-grid">
            <div className="uh-col">
              <div className="card">
                <div className="card__header" style={{ paddingBottom: 0 }}>
                  <h3 className="card__title">Destaques para você</h3>
                </div>
                <div style={{ padding: '4px 20px 18px' }}>
                  {DICAS.map((dica) => (
                    <div key={dica.titulo} className="uh-dica-item">
                      <span className="uh-dica-item__icon" style={{ background: `color-mix(in srgb, ${dica.cor} 16%, transparent)`, color: dica.cor }}>
                        <dica.icone size={17} strokeWidth={2} />
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div className="uh-dica-item__titulo-row">
                          <p className="uh-dica-item__titulo">{dica.titulo}</p>
                          {dica.novidade && <span className="uh-dica-item__badge">Novidade</span>}
                        </div>
                        <p className="uh-dica-item__desc">{dica.desc}</p>
                        <button className="uh-dica-item__link" onClick={() => verEmConstrucao(dica.titulo)}>{dica.link}</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <ComunicadosCard onVerTodos={() => navigate('/comunicados')} />
            </div>

            <div className="uh-col">
              <BaseConhecimentoCard onNavegar={() => navigate('/base-conhecimento')} />

              <div className="card uh-cta-card">
                <span className="uh-cta-card__icon"><Headphones size={26} strokeWidth={1.75} /></span>
                <h3 className="uh-cta-card__titulo">Não encontrou sua solução?</h3>
                <p className="uh-cta-card__desc">Nossa equipe está pronta para te ajudar!</p>
                <button className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setNovoChamadoAberto(true)}>
                  <Plus size={15} strokeWidth={2.25} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Criar chamado agora
                </button>
              </div>
            </div>
          </div>

          <div className="card uh-thanks">
            <div>
              <p className="uh-thanks__titulo">Obrigado por fazer parte do Chama! 💙</p>
              <p className="uh-thanks__desc">Sua colaboração ajuda a melhorar nossos serviços cada dia mais.</p>
            </div>
          </div>
        </>
      ) : (
        // ---------------------------------------------------------------
        // ESTADO 2 — com chamados abertos e/ou histórico
        // ---------------------------------------------------------------
        <>
          <div className="uh-grid">
            <div className="uh-col">
              <div className="card uh-hero uh-hero--ativo" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                  <span className="uh-hero__illustration" style={{ width: 52, height: 52 }} aria-hidden="true">
                    <Headphones size={24} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h2 className="uh-hero__title" style={{ fontSize: 18, marginBottom: 2 }}>Precisa de ajuda?</h2>
                    <p className="uh-hero__desc">Abra um novo chamado — nossa equipe está pronta para te atender.</p>
                  </div>
                </div>
                <button className="btn" style={{ background: '#0B1220', color: '#fff', flexShrink: 0 }} onClick={() => setNovoChamadoAberto(true)}>
                  <Plus size={15} strokeWidth={2.25} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Abrir novo chamado
                </button>
              </div>

              <div className="stat-grid">
                <StatCard icon={<CalendarCheck size={20} strokeWidth={2} />} iconBg="var(--accent-blue)" accent="var(--accent-blue)" label="Meus chamados" value={total} footer={<p className="stat-card__delta stat-card__delta--neutral">Total</p>} />
                <StatCard icon={<Clock3 size={20} strokeWidth={2} />} iconBg="var(--accent-amber)" accent="var(--accent-amber)" label="Em andamento" value={emAndamento} footer={<p className="stat-card__delta stat-card__delta--neutral">Aguardando solução</p>} />
                <StatCard icon={<MessageSquare size={20} strokeWidth={2} />} iconBg="var(--accent-purple)" accent="var(--accent-purple)" label="Aguardando você" value={aguardandoLista.length} footer={<p className="stat-card__delta stat-card__delta--neutral">Respostas pendentes</p>} />
                <StatCard icon={<CheckCircle2 size={20} strokeWidth={2} />} iconBg="var(--accent-green)" accent="var(--accent-green)" label="Resolvidos" value={resolvidosUltimos30Dias} footer={<p className="stat-card__delta stat-card__delta--neutral">Últimos 30 dias</p>} />
              </div>

              {destacado ? (
                <FeaturedChamadoCard info={destacado} onAbrir={abrirChamado} />
              ) : semDetalheAindaCarregando ? (
                <div className="card empty-state" style={{ marginBottom: 20 }}>Carregando chamado...</div>
              ) : (
                <div className="card" style={{ marginBottom: 20, padding: '24px 20px', textAlign: 'center' }}>
                  <p className="empty-state" style={{ margin: 0 }}>Nenhum chamado em andamento no momento.</p>
                </div>
              )}

              <QuickActionsGrid onAbrirChamado={() => setNovoChamadoAberto(true)} navigate={navigate} />

              <div className="card flex-between" style={{ padding: '16px 20px' }}>
                <div>
                  <p className="uh-thanks__titulo" style={{ marginBottom: 2 }}>Dica rápida</p>
                  <p className="uh-thanks__desc">Antes de abrir um chamado, consulte nossa base de conhecimento. Você pode encontrar a solução em poucos minutos!</p>
                </div>
                <button className="btn btn--secondary" style={{ flexShrink: 0 }} onClick={() => navigate('/base-conhecimento')}>
                  <Search size={15} strokeWidth={2} style={{ verticalAlign: '-3px', marginRight: 4 }} /> Buscar soluções
                </button>
              </div>
            </div>

            <div className="uh-col">
              {aguardandoLista.length > 0 && (
                <div className="card uh-alert-panel">
                  <div className="uh-alert-panel__header">
                    <MessageSquare size={16} strokeWidth={2.25} color="#FCA5A5" />
                    <h3 className="uh-alert-panel__titulo">Aguardando sua resposta</h3>
                  </div>
                  <p className="uh-alert-panel__desc">
                    {aguardandoLista.length === 1
                      ? 'O técnico respondeu 1 chamado e está aguardando seu retorno.'
                      : `O técnico respondeu ${aguardandoLista.length} chamados e está aguardando seu retorno.`}
                  </p>
                  {aguardandoLista.map(({ chamado, detalhe }) => {
                    const ultimo = detalhe.comentarios[detalhe.comentarios.length - 1];
                    return (
                      <button key={chamado.id} className="uh-alert-item" onClick={() => abrirChamado(chamado.id)}>
                        <p className="uh-alert-item__titulo">#{chamado.id} · {chamado.titulo}</p>
                        <p className="uh-alert-item__meta">
                          Técnico: {chamado.responsavel_nome ?? ultimo?.autor_nome ?? '—'} · {formatarRelativoCurto(ultimo.criado_em)}
                        </p>
                        <span className="btn btn--danger-solid" style={{ padding: '6px 14px', fontSize: 12 }}>Responder agora</span>
                      </button>
                    );
                  })}
                </div>
              )}

              <ComunicadosCard onVerTodos={() => navigate('/comunicados')} />
              <BaseConhecimentoCard onNavegar={() => navigate('/base-conhecimento')} />
            </div>
          </div>
        </>
      )}

      {novoChamadoAberto && (
        <NovoChamadoModal
          onFechar={() => setNovoChamadoAberto(false)}
          onCriado={(id) => {
            setNovoChamadoAberto(false);
            navigate(`/chamados/${id}`);
          }}
        />
      )}
    </AppLayout>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes locais — usados nos dois estados da home, então ficam aqui
// pra não duplicar marcação entre o estado vazio e o estado ativo.
// ---------------------------------------------------------------------------

function QuickActionsGrid({ onAbrirChamado, navigate }: { onAbrirChamado: () => void; navigate: (to: string) => void }) {
  const acoes: { titulo: string; desc: string; icone: LucideIcon; cor: string; onClick: () => void }[] = [
    { titulo: 'Abrir chamado', desc: 'Descreva o problema e nossa equipe te ajuda.', icone: Plus, cor: 'var(--accent-blue)', onClick: onAbrirChamado },
    { titulo: 'Base de conhecimento', desc: 'Encontre soluções rápidas para problemas comuns.', icone: BookOpen, cor: 'var(--accent-purple)', onClick: () => navigate('/base-conhecimento') },
    { titulo: 'Comunicados', desc: 'Fique por dentro de avisos e manutenções.', icone: Megaphone, cor: 'var(--accent-green)', onClick: () => navigate('/comunicados') },
    { titulo: 'Meus chamados', desc: 'Acompanhe todos os seus chamados e interações.', icone: MessageSquare, cor: 'var(--accent-amber)', onClick: () => navigate('/chamados') },
  ];

  return (
    <div className="uh-quick-grid">
      {acoes.map((acao) => (
        <button key={acao.titulo} className="card uh-quick-tile" onClick={acao.onClick}>
          <span className="uh-quick-tile__icon" style={{ background: `color-mix(in srgb, ${acao.cor} 16%, transparent)`, color: acao.cor }}>
            <acao.icone size={18} strokeWidth={2} />
          </span>
          <div>
            <p className="uh-quick-tile__title">{acao.titulo}</p>
            <p className="uh-quick-tile__desc">{acao.desc}</p>
          </div>
          <span className="uh-quick-tile__arrow"><ArrowRight size={14} strokeWidth={2} /></span>
        </button>
      ))}
    </div>
  );
}

function ComunicadosCard({ onVerTodos }: { onVerTodos: () => void }) {
  return (
    <div className="card">
      <div className="card__header flex-between">
        <h3 className="card__title">Comunicados recentes</h3>
        <button className="uh-hero__link" style={{ fontSize: 12 }} onClick={onVerTodos}>Ver todos</button>
      </div>
      <div>
        {COMUNICADOS.map((c) => (
          <button key={c.titulo} className="uh-list-item" onClick={onVerTodos}>
            <span className="uh-list-item__icon" style={{ background: `color-mix(in srgb, ${c.cor} 16%, transparent)`, color: c.cor }}>
              <c.icone size={16} strokeWidth={2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="uh-list-item__titulo">{c.titulo}</p>
              <p className="uh-list-item__tempo">{c.tempo}</p>
              <p className="uh-list-item__desc">{c.desc}</p>
            </div>
            <ChevronRight size={15} strokeWidth={2} className="uh-list-item__chevron" />
          </button>
        ))}
      </div>
    </div>
  );
}

function BaseConhecimentoCard({ onNavegar }: { onNavegar: () => void }) {
  return (
    <div className="card">
      <div className="card__header">
        <h3 className="card__title">Base de conhecimento</h3>
      </div>
      <div>
        {BASE_CONHECIMENTO_ITENS.map((item) => (
          <button key={item.titulo} className="uh-list-item" onClick={onNavegar}>
            <span className="uh-list-item__icon" style={{ background: `color-mix(in srgb, ${item.cor} 16%, transparent)`, color: item.cor }}>
              <item.icone size={16} strokeWidth={2} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p className="uh-list-item__titulo">{item.titulo}</p>
              <p className="uh-list-item__desc">{item.desc}</p>
            </div>
            <ChevronRight size={15} strokeWidth={2} className="uh-list-item__chevron" />
          </button>
        ))}
      </div>
      <button className="btn btn--secondary" style={{ width: '100%', justifyContent: 'center', borderRadius: 0, borderTop: '1px solid var(--color-border)' }} onClick={onNavegar}>
        <Search size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 6 }} /> Buscar mais soluções
      </button>
    </div>
  );
}

function FeaturedChamadoCard({
  info,
  onAbrir,
}: {
  info: { chamado: Chamado; detalhe: ChamadoDetalhe; aguardandoResposta: boolean };
  onAbrir: (id: number) => void;
}) {
  const { chamado, detalhe } = info;
  const Icone = iconePorCategoria(chamado.categoria_nome);
  const passos = construirLinhaDoTempo(detalhe, undefined);

  return (
    <div className="card uh-featured">
      <div>
        <div className="card__header" style={{ padding: 0, marginBottom: 10 }}>
          <h3 className="card__title" style={{ fontSize: 13 }}>Acompanhe seu chamado</h3>
        </div>

        <div className="uh-featured__header">
          <span className="uh-list-item__icon" style={{ background: 'var(--color-input-bg)', color: 'var(--color-text-muted)' }}>
            <Icone size={16} strokeWidth={2} />
          </span>
          <div style={{ minWidth: 0 }}>
            <p className="uh-featured__titulo">#{chamado.id} · {chamado.titulo}</p>
          </div>
        </div>
        <p className="uh-featured__meta">Atualizado {formatarRelativoCurto(chamado.atualizado_em)}</p>

        <div className="uh-featured__info-grid">
          <div>
            <p className="uh-featured__info-label">Técnico responsável</p>
            <p className="uh-featured__info-value">{chamado.responsavel_nome ?? 'Sem responsável'}</p>
          </div>
          <div>
            <p className="uh-featured__info-label">Categoria</p>
            <p className="uh-featured__info-value">{chamado.categoria_nome ?? '—'}</p>
          </div>
        </div>

        <button className="btn btn--secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onAbrir(chamado.id)}>
          Ver detalhes do chamado <ChevronRight size={15} strokeWidth={2} />
        </button>
      </div>

      <div>
        <p className="uh-timeline__label">Linha do tempo</p>
        {passos.map((passo) => (
          <div key={passo.chave} className={`uh-timeline__step${passo.estado === 'pending' ? ' uh-timeline__step--pending' : ''}`}>
            <span className={`uh-timeline__dot uh-timeline__dot--${passo.estado}`}>
              {passo.estado === 'done' && <CheckCircle2 size={11} strokeWidth={3} />}
            </span>
            <div className="uh-timeline__content">
              <p className="uh-timeline__titulo">{passo.titulo}</p>
              {passo.data && <p className="uh-timeline__data">{formatarDataHora(passo.data)}</p>}
              {passo.mostrarResponder && (
                <button className="btn btn--primary uh-timeline__responder" onClick={() => onAbrir(chamado.id)}>Responder</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
