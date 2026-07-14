import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Power,
  Trash2,
  Monitor,
  Activity,
  Ticket,
  TriangleAlert,
} from 'lucide-react';
import { AppLayout } from '../components/Layout/AppLayout';
import { StatCard } from '../components/StatCard';
import { SlideOver } from '../components/SlideOver';
import { CategoriaIconPicker } from '../components/CategoriaIconPicker';
import { Toggle } from '../components/Toggle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getCategoriaIcone } from '../utils/categoriaIcones';
import { tempoRelativoDias } from '../utils/tempoRelativo';
import { pushToast } from '../components/Toast';
import { api } from '../api/client';
import type { Categoria, CategoriasPaginadas, CategoriasStats, Prioridade } from '../api/types';

const PAGE_SIZE = 6;

const PRIORIDADE_OPCOES: { valor: Prioridade; label: string }[] = [
  { valor: 'baixa', label: 'Baixa' },
  { valor: 'media', label: 'Média' },
  { valor: 'alta', label: 'Alta' },
];

const PRIORIDADE_BADGE: Record<Prioridade, string> = {
  alta: 'badge--prioridade-alta',
  media: 'badge--prioridade-media',
  baixa: 'badge--prioridade-baixa',
};

const PRIORIDADE_SETA: Record<Prioridade, string> = { alta: '↑', media: '–', baixa: '↓' };

interface FormCategoria {
  nome: string;
  descricao: string;
  prioridade_padrao: Prioridade | '';
  icone: string;
  ativa: boolean;
}

const FORM_VAZIO: FormCategoria = { nome: '', descricao: '', prioridade_padrao: '', icone: 'monitor', ativa: true };

export function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [stats, setStats] = useState<CategoriasStats>({ total: 0, ativas: 0, chamados_vinculados: 0 });
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);

  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');

  const [painelAberto, setPainelAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState<Categoria | null>(null);
  const [form, setForm] = useState<FormCategoria>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [menuAbertoId, setMenuAbertoId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [excluindo, setExcluindo] = useState<Categoria | null>(null);
  const [excluindoCarregando, setExcluindoCarregando] = useState(false);

  async function carregar() {
    const { data } = await api.get<CategoriasPaginadas>('/categorias/admin', {
      params: { busca: busca || undefined, page, page_size: PAGE_SIZE },
    });
    setCategorias(data.dados);
    setStats(data.stats);
    setTotal(data.total);
    setTotalPaginas(data.total_paginas);
  }

  // Busca com debounce — evita disparar uma requisição a cada tecla digitada.
  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setBusca(buscaInput.trim());
    }, 350);
    return () => clearTimeout(timeout);
  }, [buscaInput]);

  useEffect(() => {
    setCarregando(true);
    carregar().finally(() => setCarregando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, busca]);

  useEffect(() => {
    function aoClicarFora(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbertoId(null);
      }
    }
    if (menuAbertoId !== null) document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, [menuAbertoId]);

  function abrirCriacao() {
    setModoEdicao(null);
    setForm(FORM_VAZIO);
    setErroForm(null);
    setPainelAberto(true);
  }

  function abrirEdicao(categoria: Categoria) {
    setMenuAbertoId(null);
    setModoEdicao(categoria);
    setForm({
      nome: categoria.nome,
      descricao: categoria.descricao ?? '',
      prioridade_padrao: categoria.prioridade_padrao,
      icone: categoria.icone || 'monitor',
      ativa: categoria.ativa,
    });
    setErroForm(null);
    setPainelAberto(true);
  }

  function fecharPainel() {
    if (salvando) return;
    setPainelAberto(false);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.prioridade_padrao) return;
    setSalvando(true);
    setErroForm(null);
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao.trim() || null,
      prioridade_padrao: form.prioridade_padrao,
      icone: form.icone,
      ativa: form.ativa,
    };
    try {
      if (modoEdicao) {
        await api.patch(`/categorias/${modoEdicao.id}`, payload);
      } else {
        await api.post('/categorias', payload);
      }
      await carregar();
      setPainelAberto(false);
    } catch (err: any) {
      setErroForm(err?.response?.data?.erro || 'Não foi possível salvar a categoria. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtiva(categoria: Categoria) {
    setMenuAbertoId(null);
    try {
      await api.patch(`/categorias/${categoria.id}`, { ativa: !categoria.ativa });
      await carregar();
    } catch (err: any) {
      pushToast({
        titulo: 'Não foi possível atualizar',
        descricao: err?.response?.data?.erro || 'Tente novamente.',
        cor: '#EF4444',
        icone: TriangleAlert,
      });
    }
  }

  async function confirmarExclusao() {
    if (!excluindo) return;
    setExcluindoCarregando(true);
    try {
      await api.delete(`/categorias/${excluindo.id}`);
      setExcluindo(null);
      await carregar();
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

  const primeiraLinha = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const ultimaLinha = Math.min(page * PAGE_SIZE, total);
  const paginas = Array.from({ length: totalPaginas }, (_, i) => i + 1);

  return (
    <AppLayout titulo="Categorias" subtitulo="Gerencie as categorias utilizadas na abertura dos chamados.">
      <div className="stat-grid stat-grid--3">
        <StatCard
          icon={<Monitor size={20} strokeWidth={2} />}
          iconBg="var(--accent-blue)"
          accent="var(--accent-blue)"
          label="Categorias"
          value={stats.total}
          footer={<p className="text-muted" style={{ fontSize: 12, margin: '2px 0 0' }}>Total cadastradas</p>}
        />
        <StatCard
          icon={<Activity size={20} strokeWidth={2} />}
          iconBg="var(--accent-green)"
          accent="var(--accent-green)"
          label="Ativas"
          value={stats.ativas}
          footer={<p className="text-muted" style={{ fontSize: 12, margin: '2px 0 0' }}>Categorias ativas</p>}
        />
        <StatCard
          icon={<Ticket size={20} strokeWidth={2} />}
          iconBg="var(--accent-purple)"
          accent="var(--accent-purple)"
          label="Chamados vinculados"
          value={stats.chamados_vinculados.toLocaleString('pt-BR')}
          footer={<p className="text-muted" style={{ fontSize: 12, margin: '2px 0 0' }}>Total em todas categorias</p>}
        />
      </div>

      <div className="card">
        <div className="categorias-toolbar" style={{ padding: '20px 20px 0' }}>
          <div className="search-box">
            <Search size={15} strokeWidth={2} />
            <input
              placeholder="Pesquisar categoria..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
            />
          </div>
          <button className="btn btn--primary" onClick={abrirCriacao}>
            <Plus size={16} strokeWidth={2} />
            Nova categoria
          </button>
        </div>

        <table className="table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Categoria</th>
              <th>Prioridade</th>
              <th>Status</th>
              <th>Chamados</th>
              <th>Última atualização</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr><td colSpan={6} className="empty-state">Carregando...</td></tr>
            )}
            {!carregando && categorias.length === 0 && (
              <tr><td colSpan={6} className="empty-state">Nenhuma categoria encontrada.</td></tr>
            )}
            {!carregando && categorias.map((categoria) => {
              const { Icon, cor } = getCategoriaIcone(categoria.icone);
              return (
                <tr key={categoria.id}>
                  <td>
                    <div className="categoria-cell">
                      <div className="categoria-cell__icon" style={{ background: `${cor}26`, color: cor }}>
                        <Icon size={17} strokeWidth={2} />
                      </div>
                      <div>
                        <p className="categoria-cell__nome">{categoria.nome}</p>
                        {categoria.descricao && <p className="categoria-cell__desc">{categoria.descricao}</p>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${PRIORIDADE_BADGE[categoria.prioridade_padrao]}`}>
                      <span className="badge__icone" aria-hidden="true">{PRIORIDADE_SETA[categoria.prioridade_padrao]}</span>
                      {PRIORIDADE_OPCOES.find((o) => o.valor === categoria.prioridade_padrao)?.label}
                    </span>
                  </td>
                  <td>
                    <span className="status-dot-label" style={{ color: categoria.ativa ? 'var(--accent-green)' : 'var(--color-text-muted)' }}>
                      <span
                        className="status-dot"
                        style={{ background: categoria.ativa ? 'var(--accent-green)' : 'var(--color-text-muted)' }}
                      />
                      {categoria.ativa ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td>{(categoria.chamados_vinculados ?? 0).toLocaleString('pt-BR')}</td>
                  <td className="text-muted">
                    {categoria.atualizado_em ? tempoRelativoDias(categoria.atualizado_em) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="dropdown" ref={menuAbertoId === categoria.id ? menuRef : undefined}>
                      <button
                        className="icon-btn"
                        aria-label="Mais ações"
                        onClick={() => setMenuAbertoId(menuAbertoId === categoria.id ? null : categoria.id)}
                      >
                        <MoreVertical size={15} strokeWidth={2} />
                      </button>
                      {menuAbertoId === categoria.id && (
                        <div className="dropdown__menu dropdown__menu--acoes">
                          <button className="dropdown__item" onClick={() => abrirEdicao(categoria)}>
                            <Pencil size={14} strokeWidth={2} />
                            Editar
                          </button>
                          <button className="dropdown__item" onClick={() => alternarAtiva(categoria)}>
                            <Power size={14} strokeWidth={2} />
                            {categoria.ativa ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            className="dropdown__item dropdown__item--perigo"
                            onClick={() => { setMenuAbertoId(null); setExcluindo(categoria); }}
                          >
                            <Trash2 size={14} strokeWidth={2} />
                            Excluir
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="pagination">
          <span className="text-muted" style={{ fontSize: 13 }}>
            {total === 0 ? 'Nenhuma categoria' : `Mostrando ${primeiraLinha} a ${ultimaLinha} de ${total} categorias`}
          </span>
          <div className="pagination__pages">
            <button className="pagination__nav-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft size={15} strokeWidth={2} />
            </button>
            {paginas.map((p) => (
              <button
                key={p}
                className={`pagination__page-btn ${p === page ? 'pagination__page-btn--ativo' : ''}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ))}
            <button className="pagination__nav-btn" disabled={page >= totalPaginas} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight size={15} strokeWidth={2} />
            </button>
          </div>
        </div>
      </div>

      <SlideOver
        titulo={modoEdicao ? 'Editar categoria' : 'Nova categoria'}
        subtitulo={modoEdicao ? 'Atualize as informações desta categoria.' : 'Preencha as informações para criar uma nova categoria.'}
        aberto={painelAberto}
        onFechar={fecharPainel}
        footer={
          <>
            <button type="button" className="btn btn--secondary" disabled={salvando} onClick={fecharPainel}>
              Cancelar
            </button>
            <button
              type="submit"
              form="form-categoria"
              className="btn btn--primary"
              disabled={salvando || !form.nome.trim() || !form.prioridade_padrao}
            >
              {salvando ? 'Salvando...' : 'Salvar categoria'}
            </button>
          </>
        }
      >
        <form id="form-categoria" onSubmit={salvar}>
          <div className="form-field">
            <label>Ícone *</label>
            <p className="text-muted" style={{ fontSize: 12, margin: '-2px 0 6px' }}>Escolha um ícone para esta categoria</p>
            <CategoriaIconPicker selecionado={form.icone} onSelecionar={(icone) => setForm({ ...form, icone })} />
          </div>

          <div className="form-field">
            <label>Nome da categoria *</label>
            <input
              placeholder="Ex.: Hardware"
              value={form.nome}
              disabled={salvando}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              autoFocus
            />
          </div>

          <div className="form-field">
            <label>Prioridade *</label>
            <select
              value={form.prioridade_padrao}
              disabled={salvando}
              onChange={(e) => setForm({ ...form, prioridade_padrao: e.target.value as Prioridade })}
            >
              <option value="">Selecione a prioridade</option>
              {PRIORIDADE_OPCOES.map((o) => (
                <option key={o.valor} value={o.valor}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label>Descrição (opcional)</label>
            <textarea
              placeholder="Descreva o propósito desta categoria..."
              value={form.descricao}
              disabled={salvando}
              maxLength={300}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            />
            <span className="char-counter">{form.descricao.length}/300</span>
          </div>

          <div className="toggle-field">
            <div>
              <p className="toggle-field__label">Categoria ativa</p>
              <p className="toggle-field__desc">Categoria disponível para uso</p>
            </div>
            <Toggle ativo={form.ativa} onChange={(ativa) => setForm({ ...form, ativa })} disabled={salvando} />
          </div>

          {erroForm && <p className="modal__text" style={{ color: '#F87171' }}>{erroForm}</p>}
        </form>
      </SlideOver>

      <ConfirmDialog
        aberto={excluindo !== null}
        titulo="Excluir categoria"
        descricao={`Excluir a categoria "${excluindo?.nome}" permanentemente? Isso só é possível se ela não estiver vinculada a nenhum chamado.`}
        confirmarLabel="Excluir"
        perigo
        carregando={excluindoCarregando}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </AppLayout>
  );
}
