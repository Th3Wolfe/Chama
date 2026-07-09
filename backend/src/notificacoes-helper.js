const pool = require('./db');

/**
 * Cria uma notificação in-app para um usuário.
 * tipo: 'novo_chamado' | 'novo_comentario' | 'mudanca_status' | 'chamado_atribuido'
 */
async function notificar(usuarioId, chamadoId, tipo) {
  await pool.query(
    `INSERT INTO notificacoes (usuario_id, chamado_id, tipo) VALUES ($1, $2, $3)`,
    [usuarioId, chamadoId, tipo]
  );
}

/** Notifica todos os administradores ativos (usado ao abrir um novo chamado) */
async function notificarAdmins(chamadoId, tipo) {
  const { rows } = await pool.query(
    `SELECT id FROM usuarios WHERE perfil = 'admin' AND ativo = TRUE`
  );
  await Promise.all(rows.map((admin) => notificar(admin.id, chamadoId, tipo)));
}

module.exports = { notificar, notificarAdmins };
