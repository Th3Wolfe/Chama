import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { api } from '../api/client';
import type { Categoria, Prioridade } from '../api/types';

export function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('media');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const { data } = await api.get<Categoria[]>('/categorias?todas=1');
    setCategorias(data);
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false));
  }, []);

  async function handleCriar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    await api.post('/categorias', { nome, prioridade_padrao: prioridade });
    setNome('');
    setPrioridade('media');
    await carregar();
  }

  async function toggleAtiva(categoria: Categoria) {
    await api.patch(`/categorias/${categoria.id}`, { ativa: !categoria.ativa });
    await carregar();
  }

  return (
    <AppLayout titulo="Categorias" subtitulo="Categorias usadas na abertura de chamados">
      <div className="grid-2">
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Prioridade padrão</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={4} className="empty-state">Carregando...</td></tr>}
              {!carregando && categorias.map((c) => (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td style={{ textTransform: 'capitalize' }}>{c.prioridade_padrao}</td>
                  <td>{c.ativa ? 'Ativa' : 'Inativa'}</td>
                  <td>
                    <button className="btn btn--secondary" onClick={() => toggleAtiva(c)}>
                      {c.ativa ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ padding: 20, height: 'fit-content' }}>
          <h3 className="card__title" style={{ marginBottom: 16 }}>Nova categoria</h3>
          <form onSubmit={handleCriar}>
            <div className="form-field">
              <label>Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: VPN" />
            </div>
            <div className="form-field">
              <label>Prioridade padrão</label>
              <select value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
                <option value="baixa">Baixa</option>
                <option value="media">Média</option>
                <option value="alta">Alta</option>
              </select>
            </div>
            <button className="btn btn--primary btn--block" type="submit">Criar categoria</button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
