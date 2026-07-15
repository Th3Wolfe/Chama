-- ============================================================
-- Migração 008: campos necessários para o Relatório Executivo Operacional.
--
-- 1) usuarios.foto_url — foto de perfil do Google, salva no login OAuth
--    (usada na tabela "Desempenho dos técnicos" do relatório).
-- 2) chamados.primeira_resposta_em — timestamp de quando o chamado passou
--    para 'em_andamento' pela primeira vez (usada no KPI "Tempo médio da
--    primeira resposta"). Gravado a partir de agora pelo próprio backend
--    (routes/chamados.js); aqui fazemos apenas o backfill do histórico já
--    existente, lendo o primeiro registro de historico_status com
--    status_novo = 'em_andamento' de cada chamado.
-- ============================================================

BEGIN;

ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS foto_url TEXT;

ALTER TABLE chamados
  ADD COLUMN IF NOT EXISTS primeira_resposta_em TIMESTAMPTZ;

-- Backfill: só roda para chamados que já têm o campo vazio, então a
-- migração é segura de rodar mais de uma vez.
UPDATE chamados c
SET primeira_resposta_em = primeira.alterado_em
FROM (
  SELECT DISTINCT ON (h.chamado_id) h.chamado_id, h.alterado_em
  FROM historico_status h
  WHERE h.status_novo = 'em_andamento'
  ORDER BY h.chamado_id, h.alterado_em ASC
) AS primeira
WHERE primeira.chamado_id = c.id
  AND c.primeira_resposta_em IS NULL;

COMMIT;
