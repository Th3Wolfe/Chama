import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  Pencil,
  Check,
  ChevronDown,
  Trash2,
  X,
  FileText,
  FolderTree,
  Target,
  Building2,
  Wrench,
  User,
  Monitor,
  CheckCircle2,
  ExternalLink,
  Printer,
  Globe,
  Laptop,
  Puzzle,
  RefreshCw,
  Mail,
} from 'lucide-react';
import { StatusBadge, PrioridadeBadge } from './Badge';
import { api, API_URL } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { POLLING_MS } from '../config/polling';
import type { Categoria, ChamadoDetalhe, Equipamento, StatusChamado, Usuario } from '../api/types';

type AbaEsquerda = 'detalhes' | 'comentarios' | 'anexos' | 'historico';

const EXTENSOES_IMAGEM = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function ehImagem(nomeArquivo: string): boolean {
  const nome = nomeArquivo.toLowerCase();
  return EXTENSOES_IMAGEM.some((ext) => nome.endsWith(ext));
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Ícone só decorativo, mesmo critério usado na página de detalhe do chamado.
function iconeCategoria(nomeCategoria?: string): LucideIcon {
  const nome = (nomeCategoria || '').toLowerCase();
  if (nome.includes('impressora')) return Printer;
  if (nome.includes('internet') || nome.includes('rede') || nome.includes('wifi')) return Globe;
  if (nome.includes('hardware') || nome.includes('computador') || nome.includes('notebook') || nome.includes('máquina')) return Laptop;
  if (nome.includes('software') || nome.includes('sistema')) return Puzzle;
  if (nome.includes('reposi')) return RefreshCw;
  if (nome.includes('e-mail') || nome.includes('email')) return Mail;
  return FolderTree;
}

interface ChamadoModalProps {
  chamadoId: number;
  onFechar: () => void;
  onMudou?: () => void;
}

/**
 * Modal de alta fidelidade para abrir um chamado (usado tanto no Dashboard
 * quanto na tela "Chamados"): cabeçalho com ações e abas — Detalhes,
 * Comentários (chat, com bolhas e as próprias mensagens à direita), Anexos
 * (imagens em miniatura, abrem em lightbox ao clicar) e Histórico — cada uma
 * ocupando o corpo inteiro do modal.
 */
export function ChamadoModal({ chamadoId, onFechar, onMudou }: ChamadoModalProps) {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';

  const [chamado, setChamado] = useState<ChamadoDetalhe | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [aba, setAba] = useState<AbaEsquerda>('detalhes');
  const [editandoChamado, setEditandoChamado] = useState(false);
  const [tituloRascunho, setTituloRascunho] = useState('');
  const [descricaoRascunho, setDescricaoRascunho] = useState('');
  const [erroEdicaoChamado, setErroEdicaoChamado] = useState<string | null>(null);

  const [novoComentario, setNovoComentario] = useState('');
  const [novoAnexo, setNovoAnexo] = useState<File | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);

  const [menuAcoesAberto, setMenuAcoesAberto] = useState(false);
  const menuAcoesRef = useRef<HTMLDivElement>(null);

  const [imagemAmpliada, setImagemAmpliada] = useState<{ url: string; nome: string } | null>(null);

  async function recarregar() {
    const { data } = await api.get<ChamadoDetalhe>(`/chamados/${chamadoId}`);
    setChamado(data);
  }

  useEffect(() => {
    setCarregando(true);
    const requests: Promise<any>[] = [recarregar(), api.get<Categoria[]>('/categorias').then((r) => setCategorias(r.data))];
    if (isAdmin) {
      requests.push(api.get<Usuario[]>('/usuarios?perfil=admin').then((r) => setTecnicos(r.data)));
      requests.push(api.get<Equipamento[]>('/equipamentos').then((r) => setEquipamentos(r.data)));
    }
    Promise.all(requests).finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamadoId]);

  // Comentários, anexos e histórico se atualizam sozinhos, igual à página cheia.
  useEffect(() => {
    const intervalo = setInterval(() => {
      recarregar().catch(() => {});
    }, POLLING_MS);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chamadoId]);

  // Fecha com ESC (fecha a imagem ampliada primeiro, se estiver aberta)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      setImagemAmpliada((atual) => {
        if (atual) return null;
        onFechar();
        return atual;
      });
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onFechar]);

  // Fecha o menu "Mais ações" ao clicar fora
  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (menuAcoesRef.current && !menuAcoesRef.current.contains(e.target as Node)) {
        setMenuAcoesAberto(false);
      }
    }
    if (menuAcoesAberto) document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [menuAcoesAberto]);

  async function avisarMudanca() {
    await recarregar();
    onMudou?.();
  }

  async function handleAtualizar(campo: string, valor: string) {
    setSalvando(true);
    try {
      const campoNumerico = campo === 'categoria_id' || campo === 'responsavel_id' || campo === 'equipamento_id';
      await api.patch(`/chamados/${chamadoId}`, { [campo]: campoNumerico ? Number(valor) || null : valor });
      await avisarMudanca();
    } finally {
      setSalvando(false);
    }
  }

  async function handleResolver() {
    setSalvando(true);
    try {
      await api.post(`/chamados/${chamadoId}/resolver`);
      await avisarMudanca();
    } finally {
      setSalvando(false);
    }
  }

  function iniciarEdicaoChamado() {
    if (!chamado) return;
    setTituloRascunho(chamado.titulo);
    setDescricaoRascunho(chamado.descricao);
    setErroEdicaoChamado(null);
    setEditandoChamado(true);
    setAba('detalhes');
  }

  function cancelarEdicaoChamado() {
    setEditandoChamado(false);
    setErroEdicaoChamado(null);
  }

  async function handleSalvarEdicaoChamado(e: FormEvent) {
    e.preventDefault();
    if (!tituloRascunho.trim() || !descricaoRascunho.trim()) return;
    setSalvando(true);
    setErroEdicaoChamado(null);
    try {
      await api.patch(`/chamados/${chamadoId}`, { titulo: tituloRascunho.trim(), descricao: descricaoRascunho.trim() });
      await avisarMudanca();
      setEditandoChamado(false);
    } catch (err: any) {
      setErroEdicaoChamado(err?.response?.data?.erro || 'Não foi possível salvar as alterações.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleComentar(e: FormEvent) {
    e.preventDefault();
    if (!novoComentario.trim()) return;
    setSalvando(true);
    try {
      await api.post(`/chamados/${chamadoId}/comentarios`, { texto: novoComentario });
      setNovoComentario('');
      await avisarMudanca();
    } finally {
      setSalvando(false);
    }
  }

  async function handleEnviarAnexo(e: FormEvent) {
    e.preventDefault();
    if (!novoAnexo) return;
    setErroAnexo(null);
    setEnviandoAnexo(true);
    try {
      const form = new FormData();
      form.append('arquivo', novoAnexo);
      await api.post(`/chamados/${chamadoId}/anexos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNovoAnexo(null);
      const input = document.getElementById('novo-anexo-modal') as HTMLInputElement | null;
      if (input) input.value = '';
      await avisarMudanca();
    } catch (err: any) {
      setErroAnexo(err?.response?.data?.erro || 'Não foi possível enviar o anexo.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function handleExcluirAnexo(anexoId: number) {
    const confirmado = window.confirm('Excluir este anexo permanentemente?');
    if (!confirmado) return;
    await api.delete(`/chamados/${chamadoId}/anexos/${anexoId}`);
    await avisarMudanca();
  }

  async function handleExcluir() {
    const confirmado = window.confirm(
      `Excluir o chamado #${chamado?.id} permanentemente? Essa ação não pode ser desfeita — histórico, comentários e anexos serão apagados junto.`
    );
    if (!confirmado) return;
    setSalvando(true);
    try {
      await api.delete(`/chamados/${chamadoId}`);
      onMudou?.();
      onFechar();
    } finally {
      setSalvando(false);
    }
  }

  const podeComentar = !!chamado && (isAdmin || chamado.aberto_por === usuario?.id);

  function abrirPaginaCompleta() {
    onFechar();
    navigate(`/chamados/${chamadoId}`);
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="modal chamado-modal" role="dialog" aria-modal="true">
        {carregando || !chamado ? (
          <div className="modal__body">
            <p className="text-muted">Carregando...</p>
          </div>
        ) : (
          <>
            <div className="chamado-modal__topbar">
              <div className="chamado-header__id">
                <span className="chamado-header__icon">
                  {(() => { const Icone = iconeCategoria(chamado.categoria_nome); return <Icone size={20} strokeWidth={2} />; })()}
                </span>
                <div>
                  <div className="chamado-header__titulo">
                    {isAdmin && `#${chamado.id} `}{chamado.titulo}{' '}
                    <span style={{ marginLeft: 6, verticalAlign: 'middle', display: 'inline-block' }}>
                      <StatusBadge status={chamado.status} />
                    </span>
                  </div>
                  <div className="chamado-header__meta">
                    {formatarDataHora(chamado.criado_em)} · {chamado.aberto_por_nome} · {chamado.setor_nome}
                  </div>
                </div>
              </div>

              <div className="chamado-modal__actions">
                {(isAdmin || chamado.aberto_por === usuario?.id) && !editandoChamado && (
                  <button className="btn btn--secondary" disabled={salvando} onClick={iniciarEdicaoChamado}>
                    <Pencil size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Editar
                  </button>
                )}
                {chamado.aberto_por === usuario?.id && chamado.status !== 'resolvido' && (
                  <button className="btn btn--primary" disabled={salvando} onClick={handleResolver}>
                    <Check size={14} strokeWidth={2.5} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Resolver
                  </button>
                )}
                {isAdmin && (
                  <div className="dropdown" ref={menuAcoesRef}>
                    <button className="btn btn--secondary" onClick={() => setMenuAcoesAberto((v) => !v)}>
                      Mais ações <ChevronDown size={14} strokeWidth={2} style={{ verticalAlign: '-2px' }} />
                    </button>
                    {menuAcoesAberto && (
                      <div className="dropdown__menu">
                        <div className="form-field">
                          <label>Status</label>
                          <select value={chamado.status} disabled={salvando} onChange={(e) => handleAtualizar('status', e.target.value as StatusChamado)}>
                            <option value="aberto">Aberto</option>
                            <option value="em_andamento">Em andamento</option>
                            <option value="resolvido">Resolvido</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Categoria</label>
                          <select value={chamado.categoria_id} disabled={salvando} onChange={(e) => handleAtualizar('categoria_id', e.target.value)}>
                            {categorias.map((c) => (
                              <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Prioridade</label>
                          <select value={chamado.prioridade_atual} disabled={salvando} onChange={(e) => handleAtualizar('prioridade_atual', e.target.value)}>
                            <option value="baixa">Baixa</option>
                            <option value="media">Média</option>
                            <option value="alta">Alta</option>
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Responsável</label>
                          <select value={chamado.responsavel_id ?? ''} disabled={salvando} onChange={(e) => handleAtualizar('responsavel_id', e.target.value)}>
                            <option value="">Sem responsável</option>
                            {tecnicos.map((t) => (
                              <option key={t.id} value={t.id}>{t.nome}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Equipamento</label>
                          <select value={chamado.equipamento_id ?? ''} disabled={salvando} onChange={(e) => handleAtualizar('equipamento_id', e.target.value)}>
                            <option value="">Nenhum</option>
                            {/* Só equipamentos vinculados a quem abriu o chamado — mesma regra do backend. */}
                            {equipamentos.filter((eq) => eq.usuario_id === chamado.aberto_por).map((eq) => (
                              <option key={eq.id} value={eq.id}>{eq.nome}{eq.numero_serie ? ` — nº ${eq.numero_serie}` : ''}</option>
                            ))}
                          </select>
                          {equipamentos.filter((eq) => eq.usuario_id === chamado.aberto_por).length === 0 && (
                            <p className="form-field__hint">{chamado.aberto_por_nome} não tem equipamentos vinculados.</p>
                          )}
                        </div>
                        <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12 }}>
                          <button className="btn btn--danger btn--block" disabled={salvando} onClick={handleExcluir}>
                            <Trash2 size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginRight: 4 }} /> Excluir chamado
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button className="modal__close" onClick={onFechar} aria-label="Fechar"><X size={16} /></button>
              </div>
            </div>

            <div style={{ padding: '14px 20px 0' }}>
              <div className="chamado-tabs">
                <button
                  className={`chamado-tabs__item${aba === 'detalhes' ? ' chamado-tabs__item--ativo' : ''}`}
                  onClick={() => setAba('detalhes')}
                >
                  Detalhes
                </button>
                <button
                  className={`chamado-tabs__item${aba === 'comentarios' ? ' chamado-tabs__item--ativo' : ''}`}
                  onClick={() => setAba('comentarios')}
                >
                  Comentários<span className="chamado-tabs__count">{chamado.comentarios.length}</span>
                </button>
                <button
                  className={`chamado-tabs__item${aba === 'anexos' ? ' chamado-tabs__item--ativo' : ''}`}
                  onClick={() => setAba('anexos')}
                >
                  Anexos<span className="chamado-tabs__count">{chamado.anexos.length}</span>
                </button>
                <button
                  className={`chamado-tabs__item${aba === 'historico' ? ' chamado-tabs__item--ativo' : ''}`}
                  onClick={() => setAba('historico')}
                >
                  Histórico
                </button>
              </div>
            </div>

            <div className="chamado-modal__body">
              <div className="chamado-modal__left">
                {aba === 'detalhes' && (
                  editandoChamado ? (
                    <form onSubmit={handleSalvarEdicaoChamado} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div className="form-field">
                        <label>Título</label>
                        <input value={tituloRascunho} onChange={(e) => setTituloRascunho(e.target.value)} />
                      </div>
                      <div className="form-field">
                        <label>Descrição</label>
                        <textarea
                          rows={4}
                          style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, resize: 'vertical', background: 'var(--color-input-bg)', color: 'var(--color-text)' }}
                          value={descricaoRascunho}
                          onChange={(e) => setDescricaoRascunho(e.target.value)}
                        />
                      </div>
                      {erroEdicaoChamado && <p style={{ color: '#F87171', fontSize: 13 }}>{erroEdicaoChamado}</p>}
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn--primary" type="submit" disabled={salvando || !tituloRascunho.trim() || !descricaoRascunho.trim()}>
                          Salvar
                        </button>
                        <button className="btn btn--secondary" type="button" disabled={salvando} onClick={cancelarEdicaoChamado}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="chamado-detalhes-grid">
                      <div className="chamado-detalhes-item">
                        <span className="chamado-detalhes-item__label"><FileText size={13} strokeWidth={2} /> Descrição</span>
                        <p className="chamado-detalhes-item__valor">{chamado.descricao}</p>
                      </div>
                      <div className="chamado-detalhes-item">
                        <span className="chamado-detalhes-item__label"><FolderTree size={13} strokeWidth={2} /> Categoria</span>
                        <p className="chamado-detalhes-item__valor">{chamado.categoria_nome}</p>
                      </div>
                      <div className="chamado-detalhes-item">
                        <span className="chamado-detalhes-item__label"><Target size={13} strokeWidth={2} /> Prioridade</span>
                        <p className="chamado-detalhes-item__valor"><PrioridadeBadge prioridade={chamado.prioridade_atual} /></p>
                      </div>
                      <div className="chamado-detalhes-item">
                        <span className="chamado-detalhes-item__label"><Building2 size={13} strokeWidth={2} /> Setor</span>
                        <p className="chamado-detalhes-item__valor">{chamado.setor_nome}</p>
                      </div>
                      <div className="chamado-detalhes-item">
                        <span className="chamado-detalhes-item__label"><Wrench size={13} strokeWidth={2} /> Responsável</span>
                        <p className="chamado-detalhes-item__valor">{chamado.responsavel_nome ?? '—'}</p>
                      </div>
                      <div className="chamado-detalhes-item">
                        <span className="chamado-detalhes-item__label"><User size={13} strokeWidth={2} /> Aberto por</span>
                        <p className="chamado-detalhes-item__valor">{chamado.aberto_por_nome}</p>
                      </div>
                      {chamado.equipamento_nome && (
                        <div className="chamado-detalhes-item">
                          <span className="chamado-detalhes-item__label"><Monitor size={13} strokeWidth={2} /> Equipamento</span>
                          <p className="chamado-detalhes-item__valor">{chamado.equipamento_nome}</p>
                        </div>
                      )}
                      {chamado.status === 'resolvido' && (
                        <div className="chamado-detalhes-item">
                          <span className="chamado-detalhes-item__label"><CheckCircle2 size={13} strokeWidth={2} /> Resolvido em</span>
                          <p className="chamado-detalhes-item__valor">{chamado.resolvido_em ? formatarDataHora(chamado.resolvido_em) : '—'}</p>
                        </div>
                      )}
                    </div>
                  )
                )}

                {aba === 'comentarios' && (
                  <div className="chamado-chat">
                    <div className="chamado-chat__messages">
                      {chamado.comentarios.length === 0 && <p className="text-muted">Nenhum comentário ainda. Comece a conversa!</p>}
                      {chamado.comentarios.map((c) => {
                        const souAutor = c.autor_nome === usuario?.nome;
                        return (
                          <div key={c.id} className={`chamado-chat__row${souAutor ? ' chamado-chat__row--own' : ''}`}>
                            <div className="chamado-chat__bubble">
                              {!souAutor && <strong className="chamado-chat__autor">{c.autor_nome}</strong>}
                              <p className="chamado-chat__texto">{c.texto}</p>
                              <span className="chamado-chat__hora">{formatarDataHora(c.criado_em)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {podeComentar ? (
                      <form onSubmit={handleComentar} className="chamado-chat__form">
                        <input
                          placeholder="Escreva uma mensagem..."
                          value={novoComentario}
                          onChange={(e) => setNovoComentario(e.target.value)}
                        />
                        <button className="btn btn--primary" type="submit" disabled={salvando || !novoComentario.trim()}>Enviar</button>
                      </form>
                    ) : (
                      <p className="text-muted" style={{ padding: '10px 4px 0', fontSize: 13 }}>
                        Só o autor do chamado e técnicos podem comentar.
                      </p>
                    )}
                  </div>
                )}

                {aba === 'anexos' && (
                  <div>
                    <div className="anexos-grid" style={{ marginBottom: 16 }}>
                      {chamado.anexos.length === 0 && <p className="text-muted">Nenhum anexo ainda.</p>}
                      {chamado.anexos.map((a) => {
                        const podeExcluir = isAdmin || a.enviado_por === usuario?.id;
                        const url = `${API_URL}/chamados/${chamado.id}/anexos/${a.id}`;
                        const imagem = ehImagem(a.nome_arquivo);
                        return (
                          <div key={a.id} className="anexo-card">
                            {imagem ? (
                              <button
                                type="button"
                                className="anexo-thumb"
                                onClick={() => setImagemAmpliada({ url, nome: a.nome_arquivo })}
                                aria-label={`Ampliar ${a.nome_arquivo}`}
                              >
                                <img src={url} alt={a.nome_arquivo} loading="lazy" />
                              </button>
                            ) : (
                              <a className="anexo-thumb anexo-thumb--arquivo" href={url} target="_blank" rel="noreferrer">
                                <FileText size={22} strokeWidth={1.75} />
                              </a>
                            )}
                            <div className="anexo-card__info">
                              <a href={url} target="_blank" rel="noreferrer" className="anexo-card__nome" title={a.nome_arquivo}>
                                {a.nome_arquivo}
                              </a>
                              <span className="text-muted" style={{ fontSize: 11 }}>{formatarTamanho(a.tamanho_bytes)}</span>
                            </div>
                            {podeExcluir && (
                              <button className="anexo-card__excluir" onClick={() => handleExcluirAnexo(a.id)} aria-label="Excluir anexo">
                                <X size={13} strokeWidth={2.5} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {podeComentar && (
                      <form onSubmit={handleEnviarAnexo} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input
                          id="novo-anexo-modal"
                          type="file"
                          accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                          onChange={(e) => setNovoAnexo(e.target.files?.[0] ?? null)}
                        />
                        <button className="btn btn--primary" type="submit" disabled={!novoAnexo || enviandoAnexo}>
                          {enviandoAnexo ? 'Enviando...' : 'Anexar'}
                        </button>
                      </form>

                    )}
                    {erroAnexo && <p style={{ color: '#F87171', fontSize: 13, marginTop: 8 }}>{erroAnexo}</p>}
                  </div>
                )}

                {aba === 'historico' && (
                  <div className="chamado-modal__historico-list chamado-modal__historico-list--tab">
                    {chamado.historico.length === 0 && <p className="text-muted">Sem histórico ainda.</p>}
                    {chamado.historico.map((h) => (
                      <div key={h.id} style={{ fontSize: 13 }}>
                        <span className="text-muted">{formatarDataHora(h.alterado_em)}</span>{' — '}
                        {h.status_anterior ? `${h.status_anterior} → ${h.status_novo}` : `Chamado criado (${h.status_novo})`}
                        {' por '}{h.alterado_por_nome}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="chamado-modal__footer">
              <button className="btn btn--secondary" onClick={abrirPaginaCompleta}>
                Abrir página completa <ExternalLink size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginLeft: 2 }} />
              </button>
              <button className="btn btn--primary" onClick={onFechar}>Fechar</button>
            </div>
          </>
        )}
      </div>

      {imagemAmpliada && (
        <div
          className="lightbox-backdrop"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setImagemAmpliada(null); }}
        >
          <div className="lightbox">
            <div className="lightbox__header">
              <span className="lightbox__nome">{imagemAmpliada.nome}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <a className="btn btn--secondary" href={imagemAmpliada.url} target="_blank" rel="noreferrer">Baixar</a>
                <button className="modal__close" onClick={() => setImagemAmpliada(null)} aria-label="Fechar imagem"><X size={16} /></button>
              </div>
            </div>
            <img className="lightbox__img" src={imagemAmpliada.url} alt={imagemAmpliada.nome} />
          </div>
        </div>
      )}
    </div>
  );
}
