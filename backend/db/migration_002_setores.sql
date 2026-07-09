-- ============================================================
-- Migração 002: tabela de Setores (gerenciáveis pelo admin, igual Categorias)
-- Rode isso no banco chamados_ti que você já criou com o schema.sql original.
-- ============================================================

BEGIN;

-- 1) Tabela de setores, no mesmo padrão de categorias
CREATE TABLE IF NOT EXISTS setores (
    id      SERIAL PRIMARY KEY,
    nome    VARCHAR(100) NOT NULL UNIQUE,
    ativo   BOOLEAN NOT NULL DEFAULT TRUE
);

-- 2) Setores iniciais, com base nos setores mais comuns de uma câmara municipal
--    (edite/complete pela tela de Setores depois de logar como admin)
INSERT INTO setores (nome) VALUES
    ('Gabinete da Presidência'),
    ('Recursos Humanos'),
    ('Financeiro'),
    ('Jurídico'),
    ('Comunicação'),
    ('Protocolo'),
    ('TI')
ON CONFLICT (nome) DO NOTHING;

-- 3) Nova coluna setor_id em chamados (substitui o texto livre antigo)
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS setor_id INTEGER REFERENCES setores(id);

-- 4) Migra os chamados que já existem: cria um setor a partir do texto livre
--    já usado (se ainda não existir) e associa o chamado a ele.
INSERT INTO setores (nome)
SELECT DISTINCT setor FROM chamados
WHERE setor IS NOT NULL
ON CONFLICT (nome) DO NOTHING;

UPDATE chamados c
SET setor_id = s.id
FROM setores s
WHERE c.setor_id IS NULL AND s.nome = c.setor;

-- 5) A coluna antiga "setor" (texto) fica preservada, apenas sem uso pelo
--    código novo — nada é apagado. Se quiser removê-la futuramente, depois
--    de confirmar que setor_id está 100% populado, rode:
--    ALTER TABLE chamados DROP COLUMN setor;

-- 6) Depois que setor_id estiver populado para todos os chamados existentes,
--    torna a coluna obrigatória para os próximos chamados
ALTER TABLE chamados ALTER COLUMN setor_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chamados_setor ON chamados(setor_id);

COMMIT;
