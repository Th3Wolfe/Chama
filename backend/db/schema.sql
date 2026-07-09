-- Schema do Sistema de Chamados de TI (Câmara Municipal de Itajubá)
-- Reconstruído a partir das queries usadas em src/routes/*.js,
-- já que o schema.sql original citado no README não veio no pacote entregue.
-- Rode este arquivo uma vez no banco antes de iniciar o backend.

-- Multi-tenant "preparado, não ativo": cada tabela relevante tem organizacao_id,
-- mas o backend atual não filtra por ele. Uma organização padrão é suficiente.
CREATE TABLE IF NOT EXISTS organizacoes (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL DEFAULT 'Câmara Municipal de Itajubá'
);
INSERT INTO organizacoes (id, nome) VALUES (1, 'Câmara Municipal de Itajubá')
  ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  organizacao_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizacoes(id),
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  google_sub TEXT,
  perfil TEXT NOT NULL DEFAULT 'usuario' CHECK (perfil IN ('usuario', 'admin')),
  setor TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS categorias (
  id SERIAL PRIMARY KEY,
  organizacao_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizacoes(id),
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  prioridade_padrao TEXT NOT NULL DEFAULT 'media' CHECK (prioridade_padrao IN ('baixa', 'media', 'alta')),
  ativa BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS chamados (
  id SERIAL PRIMARY KEY,
  organizacao_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizacoes(id),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  setor TEXT NOT NULL,
  categoria_id INTEGER NOT NULL REFERENCES categorias(id),
  prioridade_atual TEXT NOT NULL DEFAULT 'media' CHECK (prioridade_atual IN ('baixa', 'media', 'alta')),
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_andamento', 'resolvido')),
  aberto_por INTEGER NOT NULL REFERENCES usuarios(id),
  responsavel_id INTEGER REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolvido_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS historico_status (
  id SERIAL PRIMARY KEY,
  chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  alterado_por INTEGER NOT NULL REFERENCES usuarios(id),
  alterado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comentarios (
  id SERIAL PRIMARY KEY,
  chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  autor_id INTEGER NOT NULL REFERENCES usuarios(id),
  texto TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anexos (
  id SERIAL PRIMARY KEY,
  chamado_id INTEGER NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
  comentario_id INTEGER REFERENCES comentarios(id) ON DELETE CASCADE,
  nome_arquivo TEXT NOT NULL,
  caminho TEXT NOT NULL,
  tamanho_bytes BIGINT NOT NULL CHECK (tamanho_bytes <= 52428800), -- 50MB, mesmo limite do multer
  enviado_por INTEGER NOT NULL REFERENCES usuarios(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS equipamentos (
  id SERIAL PRIMARY KEY,
  organizacao_id INTEGER NOT NULL DEFAULT 1 REFERENCES organizacoes(id),
  nome TEXT NOT NULL,
  marca TEXT,
  modelo TEXT,
  numero_serie TEXT,
  status TEXT NOT NULL DEFAULT 'ativo',
  usuario_id INTEGER REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS notificacoes (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  chamado_id INTEGER REFERENCES chamados(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('novo_chamado', 'novo_comentario', 'mudanca_status', 'chamado_atribuido')),
  lida BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- View usada em GET /dashboard: contagem de chamados por status,
-- incluindo quantos ainda não têm responsável.
CREATE OR REPLACE VIEW vw_dashboard_admin AS
SELECT
  status,
  COUNT(*)::int AS total,
  COUNT(*) FILTER (WHERE responsavel_id IS NULL)::int AS sem_responsavel
FROM chamados
GROUP BY status;

-- Índices básicos para as consultas mais frequentes
CREATE INDEX IF NOT EXISTS idx_chamados_status ON chamados(status);
CREATE INDEX IF NOT EXISTS idx_chamados_aberto_por ON chamados(aberto_por);
CREATE INDEX IF NOT EXISTS idx_chamados_responsavel ON chamados(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON notificacoes(usuario_id, lida);

-- Categorias iniciais (opcional, mas útil para testar a abertura de chamados)
INSERT INTO categorias (nome, descricao, prioridade_padrao) VALUES
  ('Hardware', 'Problemas com computadores, impressoras e periféricos', 'media'),
  ('Rede', 'Conectividade, Wi-Fi e internet', 'alta'),
  ('Software', 'Instalação, erros e dúvidas de uso de programas', 'baixa'),
  ('Acesso e Senhas', 'Redefinição de senha e liberação de acesso', 'alta')
ON CONFLICT (nome) DO NOTHING;
