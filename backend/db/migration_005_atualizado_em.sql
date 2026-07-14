-- ============================================================
-- Migração 005: adiciona chamados.atualizado_em (usada no dashboard e
-- nas listagens — coluna "Atualizado em" / ordenação de "Últimos chamados
-- ativos"). Essa coluna já era usada pelo código mas nunca tinha sido
-- adicionada via migração — só existia manualmente em algum ambiente.
-- ============================================================

BEGIN;

ALTER TABLE chamados
  ADD COLUMN IF NOT EXISTS atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now();

-- Mantém atualizado_em em dia automaticamente a cada UPDATE na linha,
-- já que nenhuma rota do backend seta esse campo manualmente.
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chamados_atualizado_em ON chamados;
CREATE TRIGGER trg_chamados_atualizado_em
  BEFORE UPDATE ON chamados
  FOR EACH ROW
  EXECUTE FUNCTION set_atualizado_em();

COMMIT;
