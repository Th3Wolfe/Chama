-- ============================================================
-- Migração 007: adiciona setores.icone (ícone escolhido na tela de Setores)
-- e setores.atualizado_em (exibido como "Última atualização" na listagem),
-- com trigger para manter esse campo em dia automaticamente — mesmo padrão
-- já usado em categorias na migração 006.
-- ============================================================

BEGIN;

ALTER TABLE setores
  ADD COLUMN IF NOT EXISTS icone TEXT NOT NULL DEFAULT 'building-2',
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_setores_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_setores_atualizado_em ON setores;
CREATE TRIGGER trg_setores_atualizado_em
  BEFORE UPDATE ON setores
  FOR EACH ROW
  EXECUTE FUNCTION set_setores_atualizado_em();

COMMIT;
