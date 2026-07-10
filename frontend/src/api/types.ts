export type Perfil = 'usuario' | 'admin';
export type Prioridade = 'baixa' | 'media' | 'alta';
export type StatusChamado = 'aberto' | 'em_andamento' | 'resolvido';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  setor?: string | null;
  ativo?: boolean;
}

export interface EquipamentoResumo {
  id: number;
  nome: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
}

export interface ResultadoBusca {
  chamados: { id: number; titulo: string; status: StatusChamado }[];
  equipamentos: { id: number; nome: string; numero_serie: string | null }[];
  usuarios: { id: number; nome: string; email: string }[];
}

export interface Categoria {
  id: number;
  nome: string;
  descricao: string | null;
  prioridade_padrao: Prioridade;
  ativa: boolean;
}

export interface Setor {
  id: number;
  nome: string;
  ativo: boolean;
}

export interface Chamado {
  id: number;
  titulo: string;
  descricao: string;
  setor_id: number;
  setor_nome?: string;
  categoria_id: number;
  categoria_nome?: string;
  prioridade_atual: Prioridade;
  status: StatusChamado;
  aberto_por: number;
  aberto_por_nome?: string;
  responsavel_id: number | null;
  responsavel_nome?: string | null;
  equipamento_id: number | null;
  equipamento_nome?: string | null;
  criado_em: string;
  atualizado_em: string;
  resolvido_em: string | null;
}

export interface ChamadosPaginados {
  dados: Chamado[];
  total: number;
  page: number;
  page_size: number;
  total_paginas: number;
}

export interface HistoricoStatus {
  id: number;
  status_anterior: StatusChamado | null;
  status_novo: StatusChamado;
  alterado_por_nome: string;
  alterado_em: string;
}

export interface Comentario {
  id: number;
  autor_nome: string;
  texto: string;
  criado_em: string;
}

export interface Anexo {
  id: number;
  nome_arquivo: string;
  tamanho_bytes: number;
  enviado_por: number;
  criado_em: string;
}

export interface ChamadoDetalhe extends Chamado {
  historico: HistoricoStatus[];
  comentarios: Comentario[];
  anexos: Anexo[];
}

export interface Equipamento {
  id: number;
  nome: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  status: string;
  usuario_id: number | null;
  usuario_nome?: string | null;
}

export interface Notificacao {
  id: number;
  chamado_id: number;
  chamado_titulo?: string;
  tipo: 'novo_chamado' | 'novo_comentario' | 'mudanca_status' | 'chamado_atribuido';
  lida: boolean;
  criado_em: string;
}

export interface ChamadoComSla extends Chamado {
  sla_segundos_restantes: number | null;
}

export interface AtividadeRecente {
  tipo: 'novo_chamado' | 'comentario' | 'mudanca_status';
  chamado_id: number;
  chamado_titulo: string;
  autor_nome: string;
  detalhe: string | null;
  quando: string;
}

export interface MinhaFila {
  aguardando_meu_atendimento: ChamadoComSla[];
  cliente_respondeu: ChamadoComSla[];
  sla_vencendo: ChamadoComSla[];
  sem_responsavel: ChamadoComSla[];
}

export interface DashboardData {
  por_status: Record<StatusChamado, { total: number; sem_responsavel: number }>;
  tempo_medio_segundos: number | null;
  tempo_medio_delta_pct: number | null;
  resolvidos_hoje: number;
  resolvidos_hoje_delta_pct: number | null;
  sla_dentro_prazo_pct: number | null;
  sla_dentro_prazo_delta_pct: number | null;
  fila_sem_responsavel: Chamado[];
  chamados_abertos: Chamado[];
  chamados_em_andamento: Chamado[];
  por_categoria: { nome: string; total: number }[];
  serie_diaria: { dia: string; abertos: number; em_andamento: number; resolvidos: number }[];
  prioridade_agora: ChamadoComSla | null;
  minha_fila: MinhaFila;
  atividade_recente: AtividadeRecente[];
}
