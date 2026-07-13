import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { FilePlus2, X, Building2, Tag, Monitor, UploadCloud, Lightbulb, FileText, Send } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { pushToast } from './Toast';
import type { Categoria, EquipamentoResumo, Setor } from '../api/types';

const EXTENSOES_ACEITAS = '.jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt';
const TAMANHO_MAXIMO_BYTES = 50 * 1024 * 1024;

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface NovoChamadoModalProps {
  onFechar: () => void;
  /** Chamado por padrão navega pro detalhe; quem usa o modal decide o que fazer com o id criado. */
  onCriado: (chamadoId: number) => void;
}

/**
 * Modal de alta fidelidade para abertura de chamado — reflete o layout desenhado
 * pelo Iago: título, Setor + Categoria lado a lado, Equipamento (vinculado ao
 * próprio usuário), Descrição, anexo em dropzone e uma dica no rodapé.
 */
export function NovoChamadoModal({ onFechar, onCriado }: NovoChamadoModalProps) {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [meusEquipamentos, setMeusEquipamentos] = useState<EquipamentoResumo[]>([]);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(true);

  const [titulo, setTitulo] = useState('');
  const [setorId, setSetorId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [equipamentoId, setEquipamentoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCarregandoOpcoes(true);
    Promise.all([
      api.get<Categoria[]>('/categorias').then((res) => setCategorias(res.data.filter((c) => c.ativa))),
      api.get<Setor[]>('/setores').then((res) => setSetores(res.data.filter((s) => s.ativo))),
      api.get<EquipamentoResumo[]>('/equipamentos/meus').then((res) => setMeusEquipamentos(res.data)),
    ]).finally(() => setCarregandoOpcoes(false));
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onFechar();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function escolherArquivo(file: File | null | undefined) {
    if (!file) return;
    if (file.size > TAMANHO_MAXIMO_BYTES) {
      setErro('O arquivo excede o limite de 50MB.');
      return;
    }
    setErro(null);
    setArquivo(file);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setArrastando(false);
    escolherArquivo(e.dataTransfer.files?.[0]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!titulo.trim() || !setorId || !categoriaId || !descricao.trim()) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }

    setEnviando(true);
    try {
      const { data: chamado } = await api.post('/chamados', {
        titulo: titulo.trim(),
        setor_id: Number(setorId),
        categoria_id: Number(categoriaId),
        descricao: descricao.trim(),
        equipamento_id: equipamentoId ? Number(equipamentoId) : undefined,
      });

      if (arquivo) {
        const form = new FormData();
        form.append('arquivo', arquivo);
        await api.post(`/chamados/${chamado.id}/anexos`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      pushToast({
        titulo: 'Chamado aberto',
        descricao: isAdmin ? `#${chamado.id} — ${chamado.titulo}` : chamado.titulo,
        cor: 'var(--accent-green)',
        icone: FilePlus2,
      });

      onCriado(chamado.id);
    } catch (err: any) {
      setErro(err?.response?.data?.erro || 'Não foi possível abrir o chamado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onFechar(); }}>
      <div className="modal novo-chamado-modal" role="dialog" aria-modal="true">
        <div className="novo-chamado-modal__header">
          <div style={{ display: 'flex', gap: 12 }}>
            <span className="novo-chamado-modal__icon"><FilePlus2 size={22} strokeWidth={2} /></span>
            <div>
              <h3 className="modal__title">Novo chamado</h3>
              <p className="modal__subtitle">Descreva o problema que você está enfrentando.</p>
            </div>
          </div>
          <button className="modal__close" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="novo-chamado-modal__body">
            <div className="form-field">
              <label htmlFor="nc-titulo">Título <span className="campo-obrigatorio">*</span></label>
              <input
                id="nc-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex: Impressora da sala 03 com erro"
                autoFocus
              />
            </div>

            <div className="form-grid-2">
              <div className="form-field">
                <label htmlFor="nc-setor">Setor <span className="campo-obrigatorio">*</span></label>
                <div className="select-icon-wrap">
                  <Building2 size={16} strokeWidth={2} className="select-icon" />
                  <select id="nc-setor" value={setorId} onChange={(e) => setSetorId(e.target.value)} disabled={carregandoOpcoes}>
                    <option value="">Selecione um setor</option>
                    {setores.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="nc-categoria">Categoria <span className="campo-obrigatorio">*</span></label>
                <div className="select-icon-wrap">
                  <Tag size={16} strokeWidth={2} className="select-icon" />
                  <select id="nc-categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} disabled={carregandoOpcoes}>
                    <option value="">Selecione uma categoria</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="nc-equipamento">Equipamento (opcional)</label>
              <div className="select-icon-wrap">
                <Monitor size={16} strokeWidth={2} className="select-icon" />
                <select
                  id="nc-equipamento"
                  value={equipamentoId}
                  onChange={(e) => setEquipamentoId(e.target.value)}
                  disabled={carregandoOpcoes || meusEquipamentos.length === 0}
                >
                  <option value="">
                    {meusEquipamentos.length === 0 ? 'Nenhum equipamento vinculado a você' : 'Selecione ou informe o equipamento'}
                  </option>
                  {meusEquipamentos.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.nome}{eq.numero_serie ? ` — nº ${eq.numero_serie}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <p className="form-field__hint">Se o problema não estiver relacionado a um equipamento, deixe em branco.</p>
            </div>

            <div className="form-field">
              <label htmlFor="nc-descricao">Descrição <span className="campo-obrigatorio">*</span></label>
              <textarea
                id="nc-descricao"
                rows={4}
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Descreva o problema com o máximo de detalhes possível..."
              />
              <p className="form-field__hint">Inclua informações como: o que aconteceu, quando começou, mensagens de erro, etc.</p>
            </div>

            <div className="form-field" style={{ marginBottom: 0 }}>
              <label>Anexo (opcional)</label>
              <div
                className={`dropzone${arrastando ? ' dropzone--dragging' : ''}`}
                onClick={() => inputArquivoRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
                onDragLeave={() => setArrastando(false)}
                onDrop={onDrop}
              >
                <UploadCloud size={22} strokeWidth={1.75} className="dropzone__icon" />
                <p className="dropzone__text">Clique para anexar ou arraste o arquivo aqui</p>
                <p className="dropzone__hint">Imagens, PDF, Word, Excel, texto — até 50MB</p>
                <input
                  ref={inputArquivoRef}
                  type="file"
                  accept={EXTENSOES_ACEITAS}
                  style={{ display: 'none' }}
                  onChange={(e) => escolherArquivo(e.target.files?.[0])}
                />
              </div>
              {arquivo && (
                <div className="dropzone__file">
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <FileText size={15} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--color-text-muted)' }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{arquivo.name}</span>
                    <span className="text-muted" style={{ flexShrink: 0, fontSize: 11 }}>{formatarTamanho(arquivo.size)}</span>
                  </span>
                  <button
                    type="button"
                    className="modal__close"
                    onClick={() => { setArquivo(null); if (inputArquivoRef.current) inputArquivoRef.current.value = ''; }}
                    aria-label="Remover anexo"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>

            {erro && <p style={{ color: '#F87171', fontSize: 13, marginTop: 14 }}>{erro}</p>}
          </div>

          <div className="novo-chamado-modal__footer">
            <div className="tip-box">
              <Lightbulb size={16} strokeWidth={2} style={{ flexShrink: 0, color: 'var(--accent-amber)' }} />
              <p style={{ margin: 0 }}>
                <strong>Dica</strong><br />
                Quanto mais detalhes você informar, mais rápido será o atendimento.
              </p>
            </div>
            <div className="novo-chamado-modal__footer-actions">
              <button type="button" className="btn btn--secondary" onClick={onFechar} disabled={enviando}>
                Cancelar
              </button>
              <button type="submit" className="btn btn--primary" disabled={enviando}>
                {enviando ? 'Enviando...' : (
                  <>Abrir chamado <Send size={14} strokeWidth={2} style={{ verticalAlign: '-2px', marginLeft: 4 }} /></>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
