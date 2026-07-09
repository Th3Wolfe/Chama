import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '../../components/Layout/AppLayout';
import { api } from '../../api/client';
import type { Categoria, EquipamentoResumo, Setor } from '../../api/types';

export function NovoChamado() {
  const navigate = useNavigate();
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [meusEquipamentos, setMeusEquipamentos] = useState<EquipamentoResumo[]>([]);
  const [titulo, setTitulo] = useState('');
  const [setorId, setSetorId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [equipamentoId, setEquipamentoId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get<Categoria[]>('/categorias').then((res) => setCategorias(res.data));
    api.get<Setor[]>('/setores').then((res) => setSetores(res.data));
    api.get<EquipamentoResumo[]>('/equipamentos/meus').then((res) => setMeusEquipamentos(res.data));
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (!titulo || !setorId || !categoriaId || !descricao) {
      setErro('Preencha todos os campos obrigatórios.');
      return;
    }

    setEnviando(true);
    try {
      const { data: chamado } = await api.post('/chamados', {
        titulo,
        setor_id: Number(setorId),
        categoria_id: Number(categoriaId),
        descricao,
        equipamento_id: equipamentoId ? Number(equipamentoId) : undefined,
      });

      if (arquivo) {
        const form = new FormData();
        form.append('arquivo', arquivo);
        await api.post(`/chamados/${chamado.id}/anexos`, form, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      navigate(`/chamados/${chamado.id}`);
    } catch (err: any) {
      setErro(err?.response?.data?.erro || 'Não foi possível abrir o chamado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AppLayout titulo="Novo chamado" subtitulo="Descreva o problema que você está enfrentando">
      <div className="card" style={{ padding: 28, maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="titulo">Título</label>
            <input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex: Impressora da sala 03 com erro" />
          </div>

          <div className="form-field">
            <label htmlFor="setor">Setor</label>
            <select id="setor" value={setorId} onChange={(e) => setSetorId(e.target.value)}>
              <option value="">Selecione...</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="categoria">Categoria</label>
            <select id="categoria" value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Selecione...</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          {meusEquipamentos.length > 0 && (
            <div className="form-field">
              <label htmlFor="equipamento">Equipamento (opcional)</label>
              <select id="equipamento" value={equipamentoId} onChange={(e) => setEquipamentoId(e.target.value)}>
                <option value="">Não sei / não se aplica</option>
                {meusEquipamentos.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.nome}{eq.numero_serie ? ` — nº ${eq.numero_serie}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="descricao">Descrição</label>
            <textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o problema com o máximo de detalhes possível"
            />
          </div>

          <div className="form-field">
            <label htmlFor="anexo">Anexo (opcional, imagem/PDF/Word/Excel/texto — até 50MB)</label>
            <input
              id="anexo"
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
          </div>

          {erro && <p style={{ color: '#F87171', fontSize: 13, marginBottom: 12 }}>{erro}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="submit" className="btn btn--primary" disabled={enviando}>
              {enviando ? 'Enviando...' : 'Abrir chamado'}
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => navigate(-1)}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
}
