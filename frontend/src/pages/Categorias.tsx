import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { api } from '../api/client';
import { POLLING_MS } from '../config/polling';
import { pushToast } from '../components/Toast';
import type { Categoria, Prioridade } from '../api/types';
import { TriangleAlert } from 'lucide-react';

export function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nome, setNome] = useState('');
  const [prioridade, setPrioridade] = useState<Prioridade>('media');
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [edicaoId, setEdicaoId] = useState<number | null>(null);
  const [edicaoNome, setEdicaoNome] = useState('');
  const [edicaoPrioridade, setEdicaoPrioridade] = useState<Prioridade>('media');

  async function carregar() {
    const { data } = await api.get<Categoria[]>('/categorias?todas=1');
    setCategorias(data);
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
    await api.post('/categorias', { nome, prioridade_padrao: prioridade });
    setNome('');
    setPrioridade('media');
    await carregar();
  }

  async function toggleAtiva(categoria: Categoria) {
    await api.patch(`/categorias/${categoria.id}`, { ativa: !categoria.ativa });
    await carregar();
  }

  function iniciarEdicao(categoria: Categoria) {
    setEdicaoId(categoria.id);
    setEdicaoNome(categoria.nome);
    setEdicaoPrioridade(categoria.prioridade_padrao);
  }

  function cancelarEdicao() {
    setEdicaoId(null);
  }

  async function salvarEdicao(categoria: Categoria) {
    if (!edicaoNome.trim()) return;
    setSalvando(true);
    try {
      await api.patch(`/categorias/${categoria.id}`, { nome: edicaoNome.trim(), prioridade_padrao: edicaoPrioridade });
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

  async function handleExcluir(categoria: Categoria) {
    const confirmado = window.confirm(`Excluir a categoria "${categoria.nome}" permanentemente?`);
    if (!confirmado) return;
    try {
      await api.delete(`/categorias/${categoria.id}`);
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
                edicaoId === c.id ? (
                  <tr key={c.id}>
                    <td>
                      <input value={edicaoNome} onChange={(e) => setEdicaoNome(e.target.value)} style={{ width: '100%' }} />
                    </td>
                    <td>
                      <select value={edicaoPrioridade} onChange={(e) => setEdicaoPrioridade(e.target.value as Prioridade)}>
                        <option value="baixa">Baixa</option>
                        <option value="media">Média</option>
                        <option value="alta">Alta</option>
                      </select>
                    </td>
                    <td>{c.ativa ? 'Ativa' : 'Inativa'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn--primary" disabled={salvando || !edicaoNome.trim()} onClick={() => salvarEdicao(c)}>
                        Salvar
                      </button>
                      <button className="btn btn--secondary" disabled={salvando} onClick={cancelarEdicao}>
                        Cancelar
                      </button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id}>
                    <td>{c.nome}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.prioridade_padrao}</td>
                    <td>{c.ativa ? 'Ativa' : 'Inativa'}</td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn--secondary" onClick={() => iniciarEdicao(c)}>Editar</button>
                      <button className="btn btn--secondary" onClick={() => toggleAtiva(c)}>
                        {c.ativa ? 'Desativar' : 'Ativar'}
                      </button>
                      <button className="btn btn--danger" onClick={() => handleExcluir(c)}>Excluir</button>
                    </td>
                  </tr>
                )
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
