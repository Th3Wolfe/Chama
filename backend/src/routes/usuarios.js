const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware');
const router = express.Router();

// Lista usuários — usado pelo admin para atribuir responsáveis a chamados
// (só admins/técnicos, via ?perfil=admin), donos de equipamentos, e pela tela
// de gestão de usuários (?todos=1 inclui os inativos, pra dar pra reativar).
router.get('/', requireAdmin, async (req, res) => {
  const { perfil, todos } = req.query;
  const condicoes = [];
  const valores = [];

  if (!todos) condicoes.push('ativo = TRUE');
  if (perfil) {
    valores.push(perfil);
    condicoes.push(`perfil = $${valores.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT id, nome, email, perfil, setor, ativo FROM usuarios ${where} ORDER BY nome`,
    valores
  );
  res.json(rows);
});

// Promove/rebaixa perfil e ativa/desativa usuário. Um admin não pode alterar
// a própria conta por aqui — evita se auto-rebaixar ou se auto-desativar por
// engano e ficar trancado pra fora do sistema.
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { perfil, ativo } = req.body;

  if (Number(id) === req.user.id) {
    return res.status(400).json({ erro: 'Você não pode alterar seu próprio perfil ou status por aqui.' });
  }
  if (perfil && !['usuario', 'admin'].includes(perfil)) {
    return res.status(400).json({ erro: 'Perfil inválido.' });
  }

  const { rows } = await pool.query(
    `UPDATE usuarios SET
       perfil = COALESCE($1, perfil),
       ativo = COALESCE($2, ativo)
     WHERE id = $3 RETURNING id, nome, email, perfil, setor, ativo`,
    [perfil, ativo, id]
  );
  if (rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json(rows[0]);
});

module.exports = router;
