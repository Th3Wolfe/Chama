import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { api } from '../api/client';
import { POLLING_MS } from '../config/polling';
import { pushToast } from '../components/Toast';
import type { Setor } from '../api/types';
import { TriangleAlert } from 'lucide-react';

export function Setores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [nome, setNome] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [edicaoId, setEdicaoId] = useState<number | null>(null);
  const [edicaoNome, setEdicaoNome] = useState('');

  async function carregar() {
    const { data } = await api.get<Setor[]>('/setores?todas=1');
    setSetores(data);
  }

  useEffect(() => {
    carregar().finally(() => setCarregando(false));
    // Lista se atualiza sozinha a cada 1s.
    const intervalo = setInterval(() => {
      carregar().catch(() => {});
    }, POLLING_MS);
    return () => clearInterval(intervalo);
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

  function iniciarEdicao(setor: Setor) {
    setEdicaoId(setor.id);
    setEdicaoNome(setor.nome);
  }

  function cancelarEdicao() {
    setEdicaoId(null);
  }

  async function salvarEdicao(setor: Setor) {
    if (!edicaoNome.trim()) return;
    setSalvando(true);
    try {
      await api.patch(`/setores/${setor.id}`, { nome: edicaoNome.trim() });
      await carregar();
      setEdicaoId(null);
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

  async function handleExcluir(setor: Setor) {
    const confirmado = window.confirm(`Excluir o setor "${setor.nome}" permanentemente?`);
    if (!confirmado) return;
    try {
      await api.delete(`/setores/${setor.id}`);
      await carregar();
    } catch (err: any) {
      pushToast({
        titulo: 'Não foi possível excluir',
        descricao: err?.response?.data?.erro || 'Tente novamente.',
        cor: '#EF4444',
        icone: TriangleAlert,
      });
    }
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
                edicaoId === s.id ? (
                  <tr key={s.id}>
                    <td>
                      <input value={edicaoNome} onChange={(e) => setEdicaoNome(e.target.value)} style={{ width: '100%' }} />
                    </td>
                    <td>{s.ativo ? 'Ativo' : 'Inativo'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn--primary" disabled={salvando || !edicaoNome.trim()} onClick={() => salvarEdicao(s)}>
                        Salvar
                      </button>
                      <button className="btn btn--secondary" disabled={salvando} onClick={cancelarEdicao}>
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={s.id}>
                    <td>{s.nome}</td>
                    <td>{s.ativo ? 'Ativo' : 'Inativo'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn--secondary" onClick={() => iniciarEdicao(s)}>Editar</button>
                      <button className="btn btn--secondary" onClick={() => toggleAtivo(s)}>
                        {s.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button className="btn btn--danger" onClick={() => handleExcluir(s)}>Excluir</button>
                    </td>
                  </tr>
                )
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
