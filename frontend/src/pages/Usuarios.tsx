import { useEffect, useState } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import type { Usuario } from '../api/types';

export function Usuarios() {
  const { usuario: eu } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  async function carregar() {
    const { data } = await api.get<Usuario[]>('/usuarios?todos=1');
    setUsuarios(data);
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false));
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

  return (
    <AppLayout titulo="Usuários" subtitulo="Promova técnicos a administrador ou desative acessos">
      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {carregando && <tr><td colSpan={5} className="empty-state">Carregando...</td></tr>}
            {!carregando && usuarios.map((u) => {
              const souEu = u.id === eu?.id;
              return (
                <tr key={u.id}>
                  <td>{u.nome}{souEu && <span className="text-muted"> (você)</span>}</td>
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
                  <td>
                    <button
                      className="btn btn--secondary"
                      disabled={souEu || salvandoId === u.id}
                      onClick={() => alternarAtivo(u)}
                    >
                      {u.ativo ? 'Desativar' : 'Reativar'}
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
