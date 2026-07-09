import { useEffect, useState } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
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
  // Edição de nome/setor é feita em um campo de texto separado, então
  // guardamos o rascunho por usuário até o admin clicar em "Salvar".
  const [edicoes, setEdicoes] = useState<Record<number, { nome: string; setor: string }>>({});

  async function carregar() {
    const { data } = await api.get<Usuario[]>('/usuarios?todos=1');
    setUsuarios(data);
    // Mantém o rascunho de quem já está sendo editado — só preenche o rascunho
    // padrão pra usuários que ainda não têm um (evita apagar o que o admin
    // está digitando quando a lista se atualiza sozinha em segundo plano).
    setEdicoes((atual) => {
      const novo = { ...atual };
      for (const u of data) {
        if (!(u.id in novo)) novo[u.id] = { nome: u.nome, setor: u.setor ?? '' };
      }
      return novo;
    });
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
    } finally {
      setSalvandoId(null);
    }
  }

  async function alternarAtivo(u: Usuario) {
    setSalvandoId(u.id);
    try {
      await api.patch(`/usuarios/${u.id}`, { ativo: !u.ativo });
      await carregar();
    } finally {
      setSalvandoId(null);
    }
  }

  function houveMudanca(u: Usuario) {
    const rascunho = edicoes[u.id];
    if (!rascunho) return false;
    return rascunho.nome.trim() !== u.nome || rascunho.setor.trim() !== (u.setor ?? '');
  }

  async function salvarNomeSetor(u: Usuario) {
    const rascunho = edicoes[u.id];
    if (!rascunho || !rascunho.nome.trim()) return;
    setSalvandoId(u.id);
    try {
      await api.patch(`/usuarios/${u.id}`, { nome: rascunho.nome.trim(), setor: rascunho.setor.trim() });
      await carregar();
    } finally {
      setSalvandoId(null);
    }
  }

  async function handleExcluir(u: Usuario) {
    const confirmado = window.confirm(
      `Excluir o usuário "${u.nome}" permanentemente? Isso só é possível se ele nunca abriu chamados, comentários ou tiver equipamentos vinculados.`
    );
    if (!confirmado) return;
    setSalvandoId(u.id);
    try {
      await api.delete(`/usuarios/${u.id}`);
      await carregar();
    } catch (err: any) {
      pushToast({
        titulo: 'Não foi possível excluir',
        descricao: err?.response?.data?.erro || 'Tente novamente.',
        cor: '#EF4444',
        icone: '⚠️',
      });
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
              const rascunho = edicoes[u.id] ?? { nome: u.nome, setor: u.setor ?? '' };
              return (
                <tr key={u.id}>
                  <td>
                    <input
                      style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 8px', width: 160 }}
                      value={rascunho.nome}
                      disabled={salvandoId === u.id}
                      onChange={(e) => setEdicoes((prev) => ({ ...prev, [u.id]: { ...rascunho, nome: e.target.value } }))}
                    />
                    {souEu && <span className="text-muted"> (você)</span>}
                  </td>
                  <td>
                    <input
                      style={{ border: '1px solid var(--color-border)', borderRadius: 8, padding: '6px 8px', width: 140 }}
                      placeholder="Setor"
                      value={rascunho.setor}
                      disabled={salvandoId === u.id}
                      onChange={(e) => setEdicoes((prev) => ({ ...prev, [u.id]: { ...rascunho, setor: e.target.value } }))}
                    />
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <select
                      value={u.perfil}
                      disabled={souEu || salvandoId === u.id}
                      onChange={(e) => alterarPerfil(u, e.target.value as 'usuario' | 'admin')}
                    >
                      <option value="usuario">Usuário</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td>{u.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {houveMudanca(u) && (
                      <button
                        className="btn btn--primary"
                        disabled={salvandoId === u.id}
                        onClick={() => salvarNomeSetor(u)}
                      >
                        Salvar
                      </button>
                    )}
                    <button
                      className="btn btn--secondary"
                      disabled={souEu || salvandoId === u.id}
                      onClick={() => alternarAtivo(u)}
                    >
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </button>
                    <button
                      className="btn btn--danger"
                      disabled={souEu || salvandoId === u.id}
                      onClick={() => handleExcluir(u)}
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}
