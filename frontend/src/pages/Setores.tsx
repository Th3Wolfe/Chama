import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { api } from '../api/client';
import type { Setor } from '../api/types';

export function Setores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const { data } = await api.get<Setor[]>('/setores?todas=1');
    setSetores(data);
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false));
  }, []);

  async function handleCriar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    await api.post('/setores', { nome });
    setNome('');
    await carregar();
  }

  async function toggleAtivo(setor: Setor) {
    await api.patch(`/setores/${setor.id}`, { ativo: !setor.ativo });
    await carregar();
  }

  return (
    <AppLayout titulo="Setores" subtitulo="Setores usados na abertura de chamados">
      <div className="grid-2">
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={3} className="empty-state">Carregando...</td></tr>}
              {!carregando && setores.map((s) => (
                <tr key={s.id}>
                  <td>{s.nome}</td>
                  <td>{s.ativo ? 'Ativo' : 'Inativo'}</td>
                  <td>
                    <button className="btn btn--secondary" onClick={() => toggleAtivo(s)}>
                      {s.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 20, height: 'fit-content' }}>
          <h3 className="card__title" style={{ marginBottom: 16 }}>Novo setor</h3>
          <form onSubmit={handleCriar}>
            <div className="form-field">
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Ouvidoria" />
            </div>
            <button className="btn btn--primary btn--block" type="submit">Criar setor</button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
