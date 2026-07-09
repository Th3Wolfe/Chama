-- ============================================================
-- Migração 003: remove a coluna de texto livre "setor" de chamados,
-- que ainda tinha NOT NULL da criação original e por isso quebrava
-- a abertura de chamados depois da migração para setor_id.
-- ============================================================

BEGIN;

-- confirma que todo mundo já tem setor_id preenchido antes de descartar a coluna antiga
DO $$
DECLARE
  faltando INT;
BEGIN
  SELECT COUNT(*) INTO faltando FROM chamados WHERE setor_id IS NULL;
  IF faltando > 0 THEN
    RAISE EXCEPTION 'Existem % chamados sem setor_id. Rode a migration_002_setores.sql antes desta.', faltando;
  END IF;
END $$;

ALTER TABLE chamados DROP COLUMN IF EXISTS setor;

COMMIT;
