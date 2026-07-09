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

// Promove/rebaixa perfil, ativa/desativa, e agora também permite corrigir
// nome e setor (útil quando alguém muda de setor na Câmara ou o nome veio
// errado do Google). Um admin não pode alterar a própria conta por aqui —
// evita se auto-rebaixar ou se auto-desativar por engano e ficar trancado
// pra fora do sistema.
router.patch('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { perfil, ativo, nome, setor } = req.body;

  if (Number(id) === req.user.id) {
    return res.status(400).json({ erro: 'Você não pode alterar seu próprio perfil ou status por aqui.' });
  }
  if (perfil && !['usuario', 'admin'].includes(perfil)) {
    return res.status(400).json({ erro: 'Perfil inválido.' });
  }
  if (nome !== undefined && !nome.trim()) {
    return res.status(400).json({ erro: 'Nome não pode ficar em branco.' });
  }

  const { rows } = await pool.query(
    `UPDATE usuarios SET
       perfil = COALESCE($1, perfil),
       ativo = COALESCE($2, ativo),
       nome = COALESCE($3, nome),
       setor = COALESCE($4, setor)
     WHERE id = $5 RETURNING id, nome, email, perfil, setor, ativo`,
    [perfil, ativo, nome, setor, id]
  );
  if (rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json(rows[0]);
});

// Exclui usuário (admin). Um admin não pode excluir a própria conta por aqui.
// Se o usuário já tiver chamados, comentários, anexos ou equipamentos vinculados,
// o banco bloqueia a exclusão (FK) — nesse caso orientamos a desativar em vez de excluir.
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ erro: 'Você não pode excluir sua própria conta por aqui.' });
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.status(204).send();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        erro: 'Este usuário já tem chamados, comentários ou equipamentos vinculados e não pode ser excluído. Desative-o em vez disso.',
      });
    }
    throw err;
  }
});

module.exports = router;
