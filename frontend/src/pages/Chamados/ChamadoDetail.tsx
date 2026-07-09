import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '../../components/Layout/AppLayout';
import { StatusBadge, PrioridadeBadge } from '../../components/Badge';
import { api, API_URL } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { POLLING_MS } from '../../config/polling';
import type { Categoria, ChamadoDetalhe, Equipamento, StatusChamado, Usuario } from '../../api/types';

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChamadoDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';

  const [chamado, setChamado] = useState<ChamadoDetalhe | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [tecnicos, setTecnicos] = useState<Usuario[]>([]);
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [novoAnexo, setNovoAnexo] = useState<File | null>(null);
  const [enviandoAnexo, setEnviandoAnexo] = useState(false);
  const [erroAnexo, setErroAnexo] = useState<string | null>(null);
  const [editandoChamado, setEditandoChamado] = useState(false);
  const [tituloRascunho, setTituloRascunho] = useState('');
  const [descricaoRascunho, setDescricaoRascunho] = useState('');
  const [erroEdicaoChamado, setErroEdicaoChamado] = useState<string | null>(null);

  async function recarregar() {
    const { data } = await api.get<ChamadoDetalhe>(`/chamados/${id}`);
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
  }, [id]);

  // Conversa, histórico e anexos se atualizam sozinhos a cada 1s — sem precisar
  // de F5 para ver o comentário/anexo que outra pessoa acabou de enviar.
  useEffect(() => {
    if (!id) return;
    const intervalo = setInterval(() => {
      recarregar().catch(() => {
        // silencioso: uma falha pontual de polling não deve interromper a tela
      });
    }, POLLING_MS);

    function aoFocar() {
      if (document.visibilityState === 'visible') recarregar().catch(() => {});
    }
    document.addEventListener('visibilitychange', aoFocar);
    window.addEventListener('focus', aoFocar);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener('visibilitychange', aoFocar);
      window.removeEventListener('focus', aoFocar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAtualizar(campo: string, valor: string) {
    setSalvando(true);
    try {
      const campoNumerico = campo === 'categoria_id' || campo === 'responsavel_id' || campo === 'equipamento_id';
      await api.patch(`/chamados/${id}`, { [campo]: campoNumerico ? Number(valor) || null : valor });
      await recarregar();
    } finally {
      setSalvando(false);
    }
  }

  async function handleResolver() {
    setSalvando(true);
    try {
      await api.post(`/chamados/${id}/resolver`);
      await recarregar();
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
      await api.patch(`/chamados/${id}`, { titulo: tituloRascunho.trim(), descricao: descricaoRascunho.trim() });
      await recarregar();
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
      await api.post(`/chamados/${id}/comentarios`, { texto: novoComentario });
      setNovoComentario('');
      await recarregar();
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
      await api.post(`/chamados/${id}/anexos`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setNovoAnexo(null);
      (document.getElementById('novo-anexo') as HTMLInputElement | null)?.value && ((document.getElementById('novo-anexo') as HTMLInputElement).value = '');
      await recarregar();
    } catch (err: any) {
      setErroAnexo(err?.response?.data?.erro || 'Não foi possível enviar o anexo.');
    } finally {
      setEnviandoAnexo(false);
    }
  }

  async function handleExcluirAnexo(anexoId: number) {
    const confirmado = window.confirm('Excluir este anexo permanentemente?');
    if (!confirmado) return;
    await api.delete(`/chamados/${id}/anexos/${anexoId}`);
    await recarregar();
  }

  async function handleExcluir() {
    const confirmado = window.confirm(
      `Excluir o chamado #${chamado?.id} permanentemente? Essa ação não pode ser desfeita — histórico, comentários e anexos serão apagados junto.`
    );
    if (!confirmado) return;
    setSalvando(true);
    try {
      await api.delete(`/chamados/${id}`);
      navigate('/chamados');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando || !chamado) {
    return (
      <AppLayout titulo="Chamado" subtitulo="Carregando...">
        <p className="text-muted">Carregando...</p>
      </AppLayout>
    );
  }

  const souDono = chamado.aberto_por === usuario?.id;
  const podeComentar = isAdmin || souDono;

  return (
    <AppLayout titulo={`#${chamado.id} — ${chamado.titulo}`} subtitulo={`Setor: ${chamado.setor_nome} · Aberto por ${chamado.aberto_por_nome}`}>
      <button className="btn btn--secondary" style={{ marginBottom: 16 }} onClick={() => navigate('/chamados')}>
        ← Voltar
      </button>

      <div className="grid-2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 20 }}>
            <div className="flex-between" style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <StatusBadge status={chamado.status} />
                <PrioridadeBadge prioridade={chamado.prioridade_atual} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {podeComentar && !editandoChamado && (
                  <button className="btn btn--secondary" disabled={salvando} onClick={iniciarEdicaoChamado}>
                    ✏️ Editar
                  </button>
                )}
                {souDono && chamado.status !== 'resolvido' && (
                  <button className="btn btn--primary" disabled={salvando} onClick={handleResolver}>
                    Marcar como resolvido
                  </button>
                )}
              </div>
            </div>

            {editandoChamado ? (
              <form onSubmit={handleSalvarEdicaoChamado} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-field">
                  <label>Título</label>
                  <input value={tituloRascunho} onChange={(e) => setTituloRascunho(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Descrição</label>
                  <textarea
                    rows={4}
                    style={{ width: '100%', border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px', fontFamily: 'inherit', fontSize: 14, resize: 'vertical' }}
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
              <>
                <p>{chamado.descricao}</p>
                {chamado.equipamento_nome && (
                  <p className="text-muted" style={{ fontSize: 13, marginTop: 10 }}>
                    🖥️ Equipamento: {chamado.equipamento_nome}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 className="card__title" style={{ marginBottom: 12 }}>Conversa</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
              {chamado.comentarios.length === 0 && <p className="text-muted">Nenhum comentário ainda.</p>}
              {chamado.comentarios.map((c) => (
                <div key={c.id} style={{ borderBottom: '1px solid var(--color-border)', paddingBottom: 10 }}>
                  <div className="flex-between">
                    <strong style={{ fontSize: 13 }}>{c.autor_nome}</strong>
                    <span className="text-muted" style={{ fontSize: 12 }}>{formatarDataHora(c.criado_em)}</span>
                  </div>
                  <p style={{ fontSize: 14, margin: '4px 0 0' }}>{c.texto}</p>
                </div>
              ))}
            </div>
            {podeComentar && (
              <form onSubmit={handleComentar} style={{ display: 'flex', gap: 8 }}>
                <input
                  style={{ flex: 1, border: '1px solid var(--color-border)', borderRadius: 10, padding: '10px 12px' }}
                  placeholder="Escreva um comentário..."
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                />
                <button className="btn btn--primary" type="submit" disabled={salvando}>Enviar</button>
              </form>
            )}
          </div>

          <div className="card" style={{ padding: 20 }}>
            <h3 className="card__title" style={{ marginBottom: 12 }}>Anexos</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {chamado.anexos.length === 0 && <p className="text-muted">Nenhum anexo ainda.</p>}
              {chamado.anexos.map((a) => {
                const podeExcluir = isAdmin || a.enviado_por === usuario?.id;
                return (
                  <div key={a.id} className="flex-between" style={{ fontSize: 14 }}>
                    <a
                      href={`${API_URL}/chamados/${chamado.id}/anexos/${a.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      📎 {a.nome_arquivo} <span className="text-muted">({formatarTamanho(a.tamanho_bytes)})</span>
                    </a>
                    {podeExcluir && (
                      <button
                        className="btn btn--secondary"
                        style={{ padding: '2px 10px', fontSize: 12 }}
                        onClick={() => handleExcluirAnexo(a.id)}
                      >
                        Excluir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {podeComentar && (
              <form onSubmit={handleEnviarAnexo} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  id="novo-anexo"
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

          <div className="card" style={{ padding: 20 }}>
            <h3 className="card__title" style={{ marginBottom: 12 }}>Histórico</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {chamado.historico.map((h) => (
                <div key={h.id} style={{ fontSize: 13 }}>
                  <span className="text-muted">{formatarDataHora(h.alterado_em)}</span>{' — '}
                  {h.status_anterior ? `${h.status_anterior} → ${h.status_novo}` : `Chamado criado (${h.status_novo})`}
                  {' por '}{h.alterado_por_nome}
                </div>
              ))}
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="card" style={{ padding: 20, height: 'fit-content' }}>
            <h3 className="card__title" style={{ marginBottom: 16 }}>Gerenciar chamado</h3>

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
                {equipamentos.map((eq) => (
                  <option key={eq.id} value={eq.id}>{eq.nome}{eq.numero_serie ? ` — nº ${eq.numero_serie}` : ''}</option>
                ))}
              </select>
            </div>

            <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 16, paddingTop: 16 }}>
              <button className="btn btn--danger btn--block" disabled={salvando} onClick={handleExcluir}>
                🗑️ Excluir chamado
              </button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
