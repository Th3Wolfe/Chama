import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../api/client';
import { POLLING_MS } from '../config/polling';
import { pushToast } from '../components/Toast';
import type { Equipamento, Usuario } from '../api/types';
import { TriangleAlert, Pencil, Trash2 } from 'lucide-react';

const STATUS_OPCOES = [
  { valor: 'ativo', label: 'Ativo' },
  { valor: 'manutencao', label: 'Em manutenção' },
  { valor: 'inativo', label: 'Inativo' },
];

const STATUS_LABEL: Record<string, string> = Object.fromEntries(STATUS_OPCOES.map((o) => [o.valor, o.label]));
const STATUS_BADGE: Record<string, string> = {
  ativo: 'badge--ativo',
  manutencao: 'badge--status-andamento',
  inativo: 'badge--inativo',
};

interface FormEquipamento {
  nome: string;
  marca: string;
  modelo: string;
  numeroSerie: string;
  usuarioId: string;
  status: string;
}

const FORM_VAZIO: FormEquipamento = { nome: '', marca: '', modelo: '', numeroSerie: '', usuarioId: '', status: 'ativo' };

export function Equipamentos() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [novo, setNovo] = useState<FormEquipamento>(FORM_VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  // Edição em modal, com formulário próprio — mesmo padrão usado em Usuários,
  // evita editar direto na tabela e disparar troca sem querer.
  const [editando, setEditando] = useState<Equipamento | null>(null);
  const [rascunho, setRascunho] = useState<FormEquipamento>(FORM_VAZIO);

  const [excluindo, setExcluindo] = useState<Equipamento | null>(null);
  const [excluindoCarregando, setExcluindoCarregando] = useState(false);

  async function carregar() {
    const { data } = await api.get<Equipamento[]>('/equipamentos');
    setEquipamentos(data);
  }

  useEffect(() => {
    Promise.all([carregar(), api.get<Usuario[]>('/usuarios').then((r) => setUsuarios(r.data))])
      .finally(() => setCarregando(false));

    // Lista se atualiza sozinha a cada 1s.
    const intervalo = setInterval(() => {
      carregar().catch(() => {});
    }, POLLING_MS);
    return () => clearInterval(intervalo);
  }, []);

  async function handleCriar(e: FormEvent) {
    e.preventDefault();
    if (!novo.nome.trim()) return;
    await api.post('/equipamentos', {
      nome: novo.nome,
      marca: novo.marca || null,
      modelo: novo.modelo || null,
      numero_serie: novo.numeroSerie || null,
      status: novo.status,
      usuario_id: novo.usuarioId ? Number(novo.usuarioId) : null,
    });
    setNovo(FORM_VAZIO);
    await carregar();
  }

  function abrirEdicao(e: Equipamento) {
    setEditando(e);
    setRascunho({
      nome: e.nome,
      marca: e.marca ?? '',
      modelo: e.modelo ?? '',
      numeroSerie: e.numero_serie ?? '',
      usuarioId: e.usuario_id ? String(e.usuario_id) : '',
      status: e.status,
    });
  }

  function fecharEdicao() {
    setEditando(null);
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!editando || !rascunho.nome.trim()) return;
    setSalvando(true);
    try {
      await api.patch(`/equipamentos/${editando.id}`, {
        nome: rascunho.nome.trim(),
        marca: rascunho.marca || null,
        modelo: rascunho.modelo || null,
        numero_serie: rascunho.numeroSerie || null,
        status: rascunho.status,
        usuario_id: rascunho.usuarioId ? Number(rascunho.usuarioId) : null,
      });
      await carregar();
      setEditando(null);
    } catch (err: any) {
      pushToast({
        titulo: 'Não foi possível salvar',
        descricao: err?.response?.data?.erro || 'Tente novamente.',
        cor: '#EF4444',
        icone: TriangleAlert,
      });
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setExcluindoCarregando(true);
    try {
      await api.delete(`/equipamentos/${excluindo.id}`);
      await carregar();
      setExcluindo(null);
    } catch (err: any) {
      pushToast({
        titulo: 'Não foi possível excluir',
        descricao: err?.response?.data?.erro || 'Tente novamente.',
        cor: '#EF4444',
        icone: TriangleAlert,
      });
    } finally {
      setExcluindoCarregando(false);
    }
  }

  return (
    <AppLayout titulo="Equipamentos" subtitulo="Inventário de TI e vínculo com usuários">
      <div className="grid-2">
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Marca/Modelo</th><th>Nº série</th><th>Usuário</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={6} className="empty-state">Carregando...</td></tr>}
              {!carregando && equipamentos.length === 0 && (
                <tr><td colSpan={6} className="empty-state">Nenhum equipamento cadastrado.</td></tr>
              )}
              {equipamentos.map((e) => (
                <tr key={e.id}>
                  <td>{e.nome}</td>
                  <td>{[e.marca, e.modelo].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{e.numero_serie || '—'}</td>
                  <td>{e.usuario_nome || '—'}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[e.status] || 'badge--inativo'}`}>
                      {STATUS_LABEL[e.status] || e.status}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn icon-btn--edit"
                        title="Editar equipamento"
                        aria-label="Editar"
                        onClick={() => abrirEdicao(e)}
                      >
                        <Pencil size={14} strokeWidth={2} />
                      </button>
                      <button
                        className="icon-btn icon-btn--danger"
                        title="Excluir equipamento"
                        aria-label="Excluir"
                        onClick={() => setExcluindo(e)}
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 20, height: 'fit-content' }}>
          <h3 className="card__title" style={{ marginBottom: 16 }}>Novo equipamento</h3>
          <form onSubmit={handleCriar}>
            <div className="form-field">
              <label>Nome</label>
              <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Ex: Notebook Dell 3420" />
            </div>
            <div className="form-field">
              <label>Marca</label>
              <input value={novo.marca} onChange={(e) => setNovo({ ...novo, marca: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Modelo</label>
              <input value={novo.modelo} onChange={(e) => setNovo({ ...novo, modelo: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Número de série</label>
              <input value={novo.numeroSerie} onChange={(e) => setNovo({ ...novo, numeroSerie: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Status</label>
              <select value={novo.status} onChange={(e) => setNovo({ ...novo, status: e.target.value })}>
                {STATUS_OPCOES.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Vincular a usuário</label>
              <select value={novo.usuarioId} onChange={(e) => setNovo({ ...novo, usuarioId: e.target.value })}>
                <option value="">Nenhum</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <button className="btn btn--primary btn--block" type="submit">Cadastrar</button>
          </form>
        </div>
      </div>

      <Modal
        titulo="Editar equipamento"
        subtitulo={editando?.numero_serie ? `Nº série: ${editando.numero_serie}` : undefined}
        aberto={editando !== null}
        onFechar={fecharEdicao}
      >
        <form onSubmit={salvarEdicao}>
          <div className="form-field">
            <label>Nome</label>
            <input
              value={rascunho.nome}
              disabled={salvando}
              onChange={(e) => setRascunho({ ...rascunho, nome: e.target.value })}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Marca</label>
            <input value={rascunho.marca} disabled={salvando} onChange={(e) => setRascunho({ ...rascunho, marca: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Modelo</label>
            <input value={rascunho.modelo} disabled={salvando} onChange={(e) => setRascunho({ ...rascunho, modelo: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Número de série</label>
            <input value={rascunho.numeroSerie} disabled={salvando} onChange={(e) => setRascunho({ ...rascunho, numeroSerie: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Status</label>
            <select value={rascunho.status} disabled={salvando} onChange={(e) => setRascunho({ ...rascunho, status: e.target.value })}>
              {STATUS_OPCOES.map((o) => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>Vincular a usuário</label>
            <select value={rascunho.usuarioId} disabled={salvando} onChange={(e) => setRascunho({ ...rascunho, usuarioId: e.target.value })}>
              <option value="">Nenhum</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={fecharEdicao}>
              Cancelar
            </button>
            <button type="submit" className="btn btn--primary" disabled={!rascunho.nome.trim() || salvando}>
              {salvando ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        aberto={excluindo !== null}
        titulo="Excluir equipamento"
        descricao={`Excluir o equipamento "${excluindo?.nome}" permanentemente? Isso só é possível se ele não estiver vinculado a nenhum chamado.`}
        confirmarLabel="Excluir"
        perigo
        carregando={excluindoCarregando}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </AppLayout>
  );
}
