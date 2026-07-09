import { useEffect, useState, type FormEvent } from 'react';
import { AppLayout } from '../components/Layout/AppLayout';
import { api } from '../api/client';
import type { Equipamento, Usuario } from '../api/types';

export function Equipamentos() {
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [modelo, setModelo] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [carregando, setCarregando] = useState(true);

  async function carregar() {
    const { data } = await api.get<Equipamento[]>('/equipamentos');
    setEquipamentos(data);
  }

  useEffect(() => {
    Promise.all([carregar(), api.get<Usuario[]>('/usuarios').then((r) => setUsuarios(r.data))])
      .finally(() => setCarregando(false));
  }, []);

  async function handleCriar(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) return;
    await api.post('/equipamentos', {
      nome, marca: marca || null, modelo: modelo || null,
      numero_serie: numeroSerie || null, usuario_id: usuarioId ? Number(usuarioId) : null,
    });
    setNome(''); setMarca(''); setModelo(''); setNumeroSerie(''); setUsuarioId('');
    await carregar();
  }

  return (
    <AppLayout titulo="Equipamentos" subtitulo="Inventário de TI e vínculo com usuários">
      <div className="grid-2">
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>Nome</th><th>Marca/Modelo</th><th>Nº série</th><th>Usuário</th><th>Status</th></tr>
            </thead>
            <tbody>
              {carregando && <tr><td colSpan={5} className="empty-state">Carregando...</td></tr>}
              {!carregando && equipamentos.length === 0 && (
                <tr><td colSpan={5} className="empty-state">Nenhum equipamento cadastrado.</td></tr>
              )}
              {equipamentos.map((e) => (
                <tr key={e.id}>
                  <td>{e.nome}</td>
                  <td>{[e.marca, e.modelo].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{e.numero_serie || '—'}</td>
                  <td>{e.usuario_nome || '—'}</td>
                  <td>{e.status}</td>
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
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Notebook Dell 3420" />
            </div>
            <div className="form-field">
              <label>Marca</label>
              <input value={marca} onChange={(e) => setMarca(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Modelo</label>
              <input value={modelo} onChange={(e) => setModelo(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Número de série</label>
              <input value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Vincular a usuário</label>
              <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
                <option value="">Nenhum</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <button className="btn btn--primary btn--block" type="submit">Cadastrar</button>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
