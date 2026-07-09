export type Perfil = 'usuario' | 'admin';
export type Prioridade = 'baixa' | 'media' | 'alta';
export type StatusChamado = 'aberto' | 'em_andamento' | 'resolvido';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: Perfil;
  setor?: string | null;
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
  criado_em: string;
  atualizado_em: string;
  resolvido_em: string | null;
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

export interface DashboardData {
  por_status: Record<StatusChamado, { total: number; sem_responsavel: number }>;
  tempo_medio_segundos: number | null;
  resolvidos_hoje: number;
  fila_sem_responsavel: Chamado[];
  chamados_abertos: Chamado[];
  chamados_em_andamento: Chamado[];
  por_categoria: { nome: string; total: number }[];
  serie_diaria: { dia: string; abertos: number; em_andamento: number; resolvidos: number }[];
}
