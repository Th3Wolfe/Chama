import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { POLLING_MS } from '../config/polling';
import { pushToast } from '../components/Toast';
import type { Usuario } from '../api/types';

export function Usuarios() {
  const { usuario: eu } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  // Edição em modal: só existe um rascunho por vez (o usuário sendo editado
  // no momento), então não há risco de digitar num campo e acabar alterando
  // a linha errada, nem de mudanças "vazarem" pra tabela antes de salvar.
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [rascunhoNome, setRascunhoNome] = useState('');
  const [rascunhoSetor, setRascunhoSetor] = useState('');

  // Ação pendente de confirmação (excluir ou ativar/desativar).
  const [acaoPendente, setAcaoPendente] = useState<{ tipo: 'excluir' | 'ativo'; usuario: Usuario } | null>(null);

  async function carregar() {
    const { data } = await api.get<Usuario[]>('/usuarios?todos=1');
    setUsuarios(data);
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false));
    // Lista se atualiza sozinha a cada 1s.
    const intervalo = setInterval(() => {
      carregar().catch(() => {});
    }, POLLING_MS);
    return () => clearInterval(intervalo);
  }, []);

  async function alterarPerfil(u: Usuario, perfil: 'usuario' | 'admin') {
    setSalvandoId(u.id);
    try {
      await api.patch(`/usuarios/${u.id}`, { perfil });
      await carregar();
    } catch (err: any) {
      pushToast({
        titulo: 'Não foi possível alterar o perfil',
        descricao: err?.response?.data?.erro || 'Tente novamente.',
        cor: '#EF4444',
        icone: '⚠️',
      });
    } finally {
      setSalvandoId(null);
    }
  }

  function abrirEdicao(u: Usuario) {
    setEditando(u);
    setRascunhoNome(u.nome);
    setRascunhoSetor(u.setor ?? '');
  }

  function fecharEdicao() {
    setEditando(null);
  }

  async function salvarEdicao(e: FormEvent) {
    e.preventDefault();
    if (!editando || !rascunhoNome.trim()) return;
    setSalvandoId(editando.id);
    try {
      await api.patch(`/usuarios/${editando.id}`, { nome: rascunhoNome.trim(), setor: rascunhoSetor.trim() });
      await carregar();
      setEditando(null);
    } catch (err: any) {
      pushToast({
        titulo: 'Não foi possível salvar',
        descricao: err?.response?.data?.erro || 'Tente novamente.',
        cor: '#EF4444',
        icone: '⚠️',
      });
    } finally {
      setSalvandoId(null);
    }
  }

  async function confirmarAcaoPendente() {
    if (!acaoPendente) return;
    const { tipo, usuario: u } = acaoPendente;
    setSalvandoId(u.id);
    try {
      if (tipo === 'excluir') {
        await api.delete(`/usuarios/${u.id}`);
      } else {
        await api.patch(`/usuarios/${u.id}`, { ativo: !u.ativo });
      }
      await carregar();
      setAcaoPendente(null);
    } catch (err: any) {
      pushToast({
        titulo: tipo === 'excluir' ? 'Não foi possível excluir' : 'Não foi possível alterar o status',
        descricao: err?.response?.data?.erro || 'Tente novamente.',
        cor: '#EF4444',
        icone: '⚠️',
      });
      setAcaoPendente(null);
    } finally {
      setSalvandoId(null);
    }
  }

  return (
    <AppLayout titulo="Usuários" subtitulo="Promova técnicos a administrador ou desative acessos">
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>Setor</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={6} className="empty-state">Carregando...</td></tr>}
            {!carregando && usuarios.map((u) => {
              const souEu = u.id === eu?.id;
              return (
                <tr key={u.id}>
                  <td>
                    {u.nome}
                    {souEu && <span className="text-muted"> (você)</span>}
                  </td>
                  <td>{u.setor || <span className="text-muted">—</span>}</td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      className="select-compact"
                      value={u.perfil}
                      disabled={souEu || salvandoId === u.id}
                      onChange={(e) => alterarPerfil(u, e.target.value as 'usuario' | 'admin')}
                    >
                      <option value="usuario">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.ativo ? 'badge--ativo' : 'badge--inativo'}`}>
                      {u.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="icon-btn icon-btn--edit"
                        title="Editar nome e setor"
                        aria-label="Editar"
                        disabled={salvandoId === u.id}
                        onClick={() => abrirEdicao(u)}
                      >
                        ✏️
                      </button>
                      <button
                        className={`icon-btn icon-btn--toggle ${u.ativo ? 'icon-btn--toggle-on' : ''}`}
                        title={u.ativo ? 'Desativar acesso' : 'Reativar acesso'}
                        aria-label={u.ativo ? 'Desativar' : 'Reativar'}
                        disabled={souEu || salvandoId === u.id}
                        onClick={() => setAcaoPendente({ tipo: 'ativo', usuario: u })}
                      >
                        ⏻
                      </button>
                      <button
                        className="icon-btn icon-btn--danger"
                        title="Excluir usuário"
                        aria-label="Excluir"
                        disabled={souEu || salvandoId === u.id}
                        onClick={() => setAcaoPendente({ tipo: 'excluir', usuario: u })}
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        titulo="Editar usuário"
        subtitulo={editando?.email}
        aberto={editando !== null}
        onFechar={fecharEdicao}
      >
        <form onSubmit={salvarEdicao}>
          <div className="form-field">
            <label>Nome</label>
            <input
              value={rascunhoNome}
              disabled={salvandoId === editando?.id}
              onChange={(e) => setRascunhoNome(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Setor</label>
            <input
              value={rascunhoSetor}
              placeholder="Ex: Ouvidoria"
              disabled={salvandoId === editando?.id}
              onChange={(e) => setRascunhoSetor(e.target.value)}
            />
          </div>
          <div className="modal__actions">
            <button type="button" className="btn btn--secondary" onClick={fecharEdicao}>
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!rascunhoNome.trim() || salvandoId === editando?.id}
            >
              {salvandoId === editando?.id ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        aberto={acaoPendente !== null}
        titulo={acaoPendente?.tipo === 'excluir' ? 'Excluir usuário' : (acaoPendente?.usuario.ativo ? 'Desativar acesso' : 'Reativar acesso')}
        descricao={
          acaoPendente?.tipo === 'excluir'
            ? `Excluir o usuário "${acaoPendente.usuario.nome}" permanentemente? Isso só é possível se ele nunca abriu chamados, comentários ou tiver equipamentos vinculados.`
            : acaoPendente?.usuario.ativo
              ? `O usuário "${acaoPendente?.usuario.nome}" não vai mais conseguir acessar o sistema. Deseja continuar?`
              : `O usuário "${acaoPendente?.usuario.nome}" volta a ter acesso ao sistema. Deseja continuar?`
        }
        confirmarLabel={acaoPendente?.tipo === 'excluir' ? 'Excluir' : (acaoPendente?.usuario.ativo ? 'Desativar' : 'Reativar')}
        perigo={acaoPendente?.tipo === 'excluir'}
        carregando={acaoPendente !== null && salvandoId === acaoPendente.usuario.id}
        onConfirmar={confirmarAcaoPendente}
        onCancelar={() => setAcaoPendente(null)}
      />
    </AppLayout>
  );
}
