-- ============================================================
-- Migração 004: vincula chamado a um equipamento específico (RF27)
-- ============================================================

BEGIN;

ALTER TABLE chamados ADD COLUMN IF NOT EXISTS equipamento_id INTEGER REFERENCES equipamentos(id);
CREATE INDEX IF NOT EXISTS idx_chamados_equipamento ON chamados(equipamento_id);

COMMIT;
