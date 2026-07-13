-- ============================================================
-- Migração 006: adiciona categorias.icone (ícone escolhido na tela de
-- Categorias) e categorias.atualizado_em (exibido como "Última atualização"
-- na listagem), com trigger para manter esse campo em dia automaticamente —
-- mesmo padrão já usado em chamados na migração 005.
-- ============================================================

BEGIN;

ALTER TABLE categorias
  ADD COLUMN IF NOT EXISTS icone TEXT NOT NULL DEFAULT 'monitor',
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION set_categorias_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_categorias_atualizado_em ON categorias;
CREATE TRIGGER trg_categorias_atualizado_em
  BEFORE UPDATE ON categorias
  FOR EACH ROW
  EXECUTE FUNCTION set_categorias_atualizado_em();

COMMIT;
