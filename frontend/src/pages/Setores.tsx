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
  Building2,
  Activity,
  Ticket,
  TriangleAlert,
} from 'lucide-react';
import { AppLayout } from '../components/Layout/AppLayout';
import { StatCard } from '../components/StatCard';
import { SlideOver } from '../components/SlideOver';
import { SetorIconPicker } from '../components/SetorIconPicker';
import { Toggle } from '../components/Toggle';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getSetorIcone } from '../utils/setorIcones';
import { tempoRelativoDias } from '../utils/tempoRelativo';
import { pushToast } from '../components/Toast';
import { api } from '../api/client';
import type { Setor, SetoresPaginados, SetoresStats } from '../api/types';

const PAGE_SIZE = 6;

interface FormSetor {
  nome: string;
  icone: string;
  ativo: boolean;
}

const FORM_VAZIO: FormSetor = { nome: '', icone: 'building-2', ativo: true };

export function Setores() {
  const [setores, setSetores] = useState<Setor[]>([]);
  const [stats, setStats] = useState<SetoresStats>({ total: 0, ativos: 0, chamados_vinculados: 0 });
  const [total, setTotal] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [page, setPage] = useState(1);
  const [carregando, setCarregando] = useState(true);

  const [buscaInput, setBuscaInput] = useState('');
  const [busca, setBusca] = useState('');

  const [painelAberto, setPainelAberto] = useState(false);
  const [modoEdicao, setModoEdicao] = useState<Setor | null>(null);
  const [form, setForm] = useState<FormSetor>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const [menuAbertoId, setMenuAbertoId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [excluindo, setExcluindo] = useState<Setor | null>(null);
  const [excluindoCarregando, setExcluindoCarregando] = useState(false);

  async function carregar() {
    const { data } = await api.get<SetoresPaginados>('/setores/admin', {
      params: { busca: busca || undefined, page, page_size: PAGE_SIZE },
    });
    setSetores(data.dados);
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

  function abrirEdicao(setor: Setor) {
    setMenuAbertoId(null);
    setModoEdicao(setor);
    setForm({ nome: setor.nome, icone: setor.icone || 'building-2', ativo: setor.ativo });
    setErroForm(null);
    setPainelAberto(true);
  }

  function fecharPainel() {
    if (salvando) return;
    setPainelAberto(false);
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSalvando(true);
    setErroForm(null);
    const payload = { nome: form.nome.trim(), icone: form.icone, ativo: form.ativo };
    try {
      if (modoEdicao) {
        await api.patch(`/setores/${modoEdicao.id}`, payload);
      } else {
        await api.post('/setores', payload);
      }
      await carregar();
      setPainelAberto(false);
    } catch (err: any) {
      setErroForm(err?.response?.data?.erro || 'Não foi possível salvar o setor. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(setor: Setor) {
    setMenuAbertoId(null);
    try {
      await api.patch(`/setores/${setor.id}`, { ativo: !setor.ativo });
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
      await api.delete(`/setores/${excluindo.id}`);
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
    <AppLayout titulo="Setores" subtitulo="Gerencie os setores utilizados na abertura dos chamados.">
      <div className="stat-grid stat-grid--3">
        <StatCard
          icon={<Building2 size={20} strokeWidth={2} />}
          iconBg="var(--accent-blue)"
          accent="var(--accent-blue)"
          label="Setores"
          value={stats.total}
          footer={<p className="text-muted" style={{ fontSize: 12, margin: '2px 0 0' }}>Total cadastrados</p>}
        />
        <StatCard
          icon={<Activity size={20} strokeWidth={2} />}
          iconBg="var(--accent-green)"
          accent="var(--accent-green)"
          label="Ativos"
          value={stats.ativos}
          footer={<p className="text-muted" style={{ fontSize: 12, margin: '2px 0 0' }}>Setores ativos</p>}
        />
        <StatCard
          icon={<Ticket size={20} strokeWidth={2} />}
          iconBg="var(--accent-purple)"
          accent="var(--accent-purple)"
          label="Chamados vinculados"
          value={stats.chamados_vinculados.toLocaleString('pt-BR')}
          footer={<p className="text-muted" style={{ fontSize: 12, margin: '2px 0 0' }}>Total em todos setores</p>}
        />
      </div>

      <div className="card">
        <div className="categorias-toolbar" style={{ padding: '20px 20px 0' }}>
          <div className="search-box">
            <Search size={15} strokeWidth={2} />
            <input
              placeholder="Pesquisar setor..."
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
            />
          </div>
          <button className="btn btn--primary" onClick={abrirCriacao}>
            <Plus size={16} strokeWidth={2} />
            Novo setor
          </button>
        </div>

        <table className="table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>Setor</th>
              <th>Status</th>
              <th>Chamados</th>
              <th>Última atualização</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {carregando && (
              <tr><td colSpan={5} className="empty-state">Carregando...</td></tr>
            )}
            {!carregando && setores.length === 0 && (
              <tr><td colSpan={5} className="empty-state">Nenhum setor encontrado.</td></tr>
            )}
            {!carregando && setores.map((setor) => {
              const { Icon, cor } = getSetorIcone(setor.icone);
              return (
                <tr key={setor.id}>
                  <td>
                    <div className="categoria-cell">
                      <div className="categoria-cell__icon" style={{ background: `${cor}26`, color: cor }}>
                        <Icon size={17} strokeWidth={2} />
                      </div>
                      <p className="categoria-cell__nome">{setor.nome}</p>
                    </div>
                  </td>
                  <td>
                    <span className="status-dot-label" style={{ color: setor.ativo ? 'var(--accent-green)' : 'var(--color-text-muted)' }}>
                      <span
                        className="status-dot"
                        style={{ background: setor.ativo ? 'var(--accent-green)' : 'var(--color-text-muted)' }}
                      />
                      {setor.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td>{(setor.chamados_vinculados ?? 0).toLocaleString('pt-BR')}</td>
                  <td className="text-muted">
                    {setor.atualizado_em ? tempoRelativoDias(setor.atualizado_em) : '—'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="dropdown" ref={menuAbertoId === setor.id ? menuRef : undefined}>
                      <button
                        className="icon-btn"
                        aria-label="Mais ações"
                        onClick={() => setMenuAbertoId(menuAbertoId === setor.id ? null : setor.id)}
                      >
                        <MoreVertical size={15} strokeWidth={2} />
                      </button>
                      {menuAbertoId === setor.id && (
                        <div className="dropdown__menu dropdown__menu--acoes">
                          <button className="dropdown__item" onClick={() => abrirEdicao(setor)}>
                            <Pencil size={14} strokeWidth={2} />
                            Editar
                          </button>
                          <button className="dropdown__item" onClick={() => alternarAtivo(setor)}>
                            <Power size={14} strokeWidth={2} />
                            {setor.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                          <button
                            className="dropdown__item dropdown__item--perigo"
                            onClick={() => { setMenuAbertoId(null); setExcluindo(setor); }}
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
            {total === 0 ? 'Nenhum setor' : `Mostrando ${primeiraLinha} a ${ultimaLinha} de ${total} setores`}
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
        titulo={modoEdicao ? 'Editar setor' : 'Novo setor'}
        subtitulo={modoEdicao ? 'Atualize as informações deste setor.' : 'Preencha as informações para criar um novo setor.'}
        aberto={painelAberto}
        onFechar={fecharPainel}
        footer={
          <>
            <button type="button" className="btn btn--secondary" disabled={salvando} onClick={fecharPainel}>
              Cancelar
            </button>
            <button
              type="submit"
              form="form-setor"
              className="btn btn--primary"
              disabled={salvando || !form.nome.trim()}
            >
              {salvando ? 'Salvando...' : 'Salvar setor'}
            </button>
          </>
        }
      >
        <form id="form-setor" onSubmit={salvar}>
          <div className="form-field">
            <label>Ícone *</label>
            <p className="text-muted" style={{ fontSize: 12, margin: '-2px 0 6px' }}>Escolha um ícone para este setor</p>
            <SetorIconPicker selecionado={form.icone} onSelecionar={(icone) => setForm({ ...form, icone })} />
          </div>

          <div className="form-field">
            <label>Nome do setor *</label>
            <input
              placeholder="Ex.: Recursos Humanos"
              value={form.nome}
              disabled={salvando}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              autoFocus
            />
          </div>

          <div className="toggle-field">
            <div>
              <p className="toggle-field__label">Setor ativo</p>
              <p className="toggle-field__desc">Setor disponível para uso</p>
            </div>
            <Toggle ativo={form.ativo} onChange={(ativo) => setForm({ ...form, ativo })} disabled={salvando} />
          </div>

          {erroForm && <p className="modal__text" style={{ color: '#F87171' }}>{erroForm}</p>}
        </form>
      </SlideOver>

      <ConfirmDialog
        aberto={excluindo !== null}
        titulo="Excluir setor"
        descricao={`Excluir o setor "${excluindo?.nome}" permanentemente? Isso só é possível se ele não estiver vinculado a nenhum chamado.`}
        confirmarLabel="Excluir"
        perigo
        carregando={excluindoCarregando}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluindo(null)}
      />
    </AppLayout>
  );
}
