const express = require('express');
const fs = require('fs');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware');
const { upload } = require('../upload');
const { notificar, notificarAdmins } = require('../notificacoes-helper');
const router = express.Router();

/** Verifica se o chamado pertence ao usuário logado (usado para bloquear acesso cruzado) */
async function buscarChamadoOuFalhar(id, res) {
  const { rows } = await pool.query(
    `SELECT c.*, cat.nome AS categoria_nome, s.nome AS setor_nome, u.nome AS aberto_por_nome, r.nome AS responsavel_nome,
            eq.nome AS equipamento_nome
     FROM chamados c
     JOIN categorias cat ON cat.id = c.categoria_id
     JOIN setores s ON s.id = c.setor_id
     JOIN usuarios u ON u.id = c.aberto_por
     LEFT JOIN usuarios r ON r.id = c.responsavel_id
     LEFT JOIN equipamentos eq ON eq.id = c.equipamento_id
     WHERE c.id = $1`,
    [id]
  );
  if (rows.length === 0) {
    res.status(404).json({ erro: 'Chamado não encontrado.' });
    return null;
  }
  return rows[0];
}

// --- Criar chamado (RF04) ---
router.post('/', requireAuth, async (req, res) => {
  const { titulo, descricao, setor_id, categoria_id, equipamento_id } = req.body;
  if (!titulo || !descricao || !setor_id || !categoria_id) {
    return res.status(400).json({ erro: 'titulo, descricao, setor_id e categoria_id são obrigatórios.' });
  }

  const categoria = await pool.query('SELECT prioridade_padrao FROM categorias WHERE id = $1 AND ativa = TRUE', [categoria_id]);
  if (categoria.rows.length === 0) return res.status(400).json({ erro: 'Categoria inválida ou inativa.' });

  const setor = await pool.query('SELECT id FROM setores WHERE id = $1 AND ativo = TRUE', [setor_id]);
  if (setor.rows.length === 0) return res.status(400).json({ erro: 'Setor inválido ou inativo.' });

  // Se informado, o equipamento precisa existir e estar vinculado ao próprio usuário
  // (evita abrir chamado "no nome" do notebook de outra pessoa por engano).
  if (equipamento_id) {
    const equipamento = await pool.query(
      'SELECT id FROM equipamentos WHERE id = $1 AND usuario_id = $2',
      [equipamento_id, req.user.id]
    );
    if (equipamento.rows.length === 0) {
      return res.status(400).json({ erro: 'Equipamento inválido ou não vinculado a você.' });
    }
  }

  const { rows } = await pool.query(
    `INSERT INTO chamados (titulo, descricao, setor_id, categoria_id, prioridade_atual, aberto_por, equipamento_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [titulo, descricao, setor_id, categoria_id, categoria.rows[0].prioridade_padrao, req.user.id, equipamento_id || null]
  );
  const chamado = rows[0];

  await pool.query(
    `INSERT INTO historico_status (chamado_id, status_anterior, status_novo, alterado_por)
     VALUES ($1, NULL, 'aberto', $2)`,
    [chamado.id, req.user.id]
  );

  await notificarAdmins(chamado.id, 'novo_chamado');

  res.status(201).json(chamado);
});

// --- Listar chamados (RF06 / RF09), paginado ---
router.get('/', requireAuth, async (req, res) => {
  const isAdmin = req.user.perfil === 'admin';
  const { status, categoria_id, responsavel_id, sem_responsavel } = req.query;

  const pageSize = Math.min(Math.max(parseInt(req.query.page_size, 10) || 20, 1), 100);
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const offset = (page - 1) * pageSize;

  const condicoes = [];
  const valores = [];

  if (!isAdmin) {
    valores.push(req.user.id);
    condicoes.push(`c.aberto_por = $${valores.length}`);
  }
  if (status) {
    valores.push(status);
    condicoes.push(`c.status = $${valores.length}`);
  }
  if (categoria_id) {
    valores.push(categoria_id);
    condicoes.push(`c.categoria_id = $${valores.length}`);
  }
  if (isAdmin && responsavel_id) {
    valores.push(responsavel_id);
    condicoes.push(`c.responsavel_id = $${valores.length}`);
  }
  if (isAdmin && sem_responsavel === '1') {
    condicoes.push('c.responsavel_id IS NULL');
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

  // COUNT(*) OVER() traz o total de linhas (antes do LIMIT) na mesma consulta,
  // evitando um segundo round-trip só para saber quantas páginas existem.
  valores.push(pageSize, offset);
  const { rows } = await pool.query(
    `SELECT c.*, cat.nome AS categoria_nome, s.nome AS setor_nome, u.nome AS aberto_por_nome, r.nome AS responsavel_nome,
            eq.nome AS equipamento_nome, COUNT(*) OVER() AS total_geral
     FROM chamados c
     JOIN categorias cat ON cat.id = c.categoria_id
     JOIN setores s ON s.id = c.setor_id
     JOIN usuarios u ON u.id = c.aberto_por
     LEFT JOIN usuarios r ON r.id = c.responsavel_id
     LEFT JOIN equipamentos eq ON eq.id = c.equipamento_id
     ${where}
     ORDER BY c.criado_em DESC
     LIMIT $${valores.length - 1} OFFSET $${valores.length}`,
    valores
  );

  const total = rows.length > 0 ? Number(rows[0].total_geral) : 0;
  const dados = rows.map(({ total_geral, ...resto }) => resto);

  res.json({ dados, total, page, page_size: pageSize, total_paginas: Math.max(Math.ceil(total / pageSize), 1) });
});

// --- Detalhe do chamado (com histórico, comentários e anexos) ---
router.get('/:id', requireAuth, async (req, res) => {
  const chamado = await buscarChamadoOuFalhar(req.params.id, res);
  if (!chamado) return;
  if (req.user.perfil !== 'admin' && chamado.aberto_por !== req.user.id) {
    return res.status(403).json({ erro: 'Você não tem acesso a este chamado.' });
  }

  const [historico, comentarios, anexos] = await Promise.all([
    pool.query(
      `SELECT h.*, u.nome AS alterado_por_nome FROM historico_status h
       JOIN usuarios u ON u.id = h.alterado_por
       WHERE chamado_id = $1 ORDER BY alterado_em ASC`,
      [chamado.id]
    ),
    pool.query(
      `SELECT co.*, u.nome AS autor_nome FROM comentarios co
       JOIN usuarios u ON u.id = co.autor_id
       WHERE chamado_id = $1 ORDER BY criado_em ASC`,
      [chamado.id]
    ),
    pool.query(`SELECT * FROM anexos WHERE chamado_id = $1 ORDER BY criado_em ASC`, [chamado.id]),
  ]);

  res.json({
    ...chamado,
    historico: historico.rows,
    comentarios: comentarios.rows,
    anexos: anexos.rows,
  });
});

// --- Atualizar chamado: status, categoria, responsável, prioridade (admin - RF10/RF11/RF12)
//     título e descrição (admin OU dono do chamado, para corrigir erros de digitação) ---
router.patch('/:id', requireAuth, async (req, res) => {
  const chamado = await buscarChamadoOuFalhar(req.params.id, res);
  if (!chamado) return;

  const isAdmin = req.user.perfil === 'admin';
  const souDono = chamado.aberto_por === req.user.id;
  if (!isAdmin && !souDono) {
    return res.status(403).json({ erro: 'Você não tem acesso a este chamado.' });
  }

  const { status, categoria_id, responsavel_id, prioridade_atual, equipamento_id, titulo, descricao } = req.body;

  // Campos de gestão (status, categoria, prioridade, responsável, equipamento)
  // continuam exclusivos do admin — só título/descrição também podem ser
  // corrigidos por quem abriu o chamado.
  const tentouCampoDeGestao = [status, categoria_id, responsavel_id, prioridade_atual, equipamento_id]
    .some((v) => v !== undefined);
  if (!isAdmin && tentouCampoDeGestao) {
    return res.status(403).json({ erro: 'Somente um administrador pode alterar esses campos.' });
  }

  // Mesmo o admin só pode atribuir um equipamento que esteja vinculado ao
  // usuário que abriu o chamado (evita atribuir o notebook de outra pessoa).
  if (equipamento_id !== undefined && equipamento_id !== null) {
    const equipamento = await pool.query(
      'SELECT id FROM equipamentos WHERE id = $1 AND usuario_id = $2',
      [equipamento_id, chamado.aberto_por]
    );
    if (equipamento.rows.length === 0) {
      return res.status(400).json({ erro: 'Equipamento inválido ou não vinculado ao usuário que abriu o chamado.' });
    }
  }

  const campos = [];
  const valores = [];
  let i = 1;

  if (categoria_id !== undefined) { campos.push(`categoria_id = $${i++}`); valores.push(categoria_id); }
  if (responsavel_id !== undefined) { campos.push(`responsavel_id = $${i++}`); valores.push(responsavel_id); }
  if (prioridade_atual !== undefined) { campos.push(`prioridade_atual = $${i++}`); valores.push(prioridade_atual); }
  if (equipamento_id !== undefined) { campos.push(`equipamento_id = $${i++}`); valores.push(equipamento_id); }
  if (titulo !== undefined) {
    if (!titulo.trim()) return res.status(400).json({ erro: 'Título não pode ficar em branco.' });
    campos.push(`titulo = $${i++}`); valores.push(titulo.trim());
  }
  if (descricao !== undefined) {
    if (!descricao.trim()) return res.status(400).json({ erro: 'Descrição não pode ficar em branco.' });
    campos.push(`descricao = $${i++}`); valores.push(descricao.trim());
  }
  if (status !== undefined) {
    campos.push(`status = $${i++}`);
    valores.push(status);
    if (status === 'resolvido') { campos.push(`resolvido_em = now()`); }
  }

  if (campos.length === 0) return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });

  valores.push(chamado.id);
  const { rows } = await pool.query(
    `UPDATE chamados SET ${campos.join(', ')} WHERE id = $${i} RETURNING *`,
    valores
  );
  const atualizado = rows[0];

  if (status && status !== chamado.status) {
    await pool.query(
      `INSERT INTO historico_status (chamado_id, status_anterior, status_novo, alterado_por)
       VALUES ($1, $2, $3, $4)`,
      [chamado.id, chamado.status, status, req.user.id]
    );
    await notificar(chamado.aberto_por, chamado.id, 'mudanca_status');
  }
  if (responsavel_id !== undefined && responsavel_id !== chamado.responsavel_id) {
    await notificar(responsavel_id, chamado.id, 'chamado_atribuido');
  }

  res.json(atualizado);
});

// --- Usuário marca como resolvido e encerra (RF07/RF08) ---
router.post('/:id/resolver', requireAuth, async (req, res) => {
  const chamado = await buscarChamadoOuFalhar(req.params.id, res);
  if (!chamado) return;
  if (chamado.aberto_por !== req.user.id) {
    return res.status(403).json({ erro: 'Somente quem abriu o chamado pode encerrá-lo.' });
  }
  if (chamado.status === 'resolvido') {
    return res.status(400).json({ erro: 'Chamado já está resolvido.' });
  }

  const { rows } = await pool.query(
    `UPDATE chamados SET status = 'resolvido', resolvido_em = now() WHERE id = $1 RETURNING *`,
    [chamado.id]
  );
  await pool.query(
    `INSERT INTO historico_status (chamado_id, status_anterior, status_novo, alterado_por)
     VALUES ($1, $2, 'resolvido', $3)`,
    [chamado.id, chamado.status, req.user.id]
  );
  res.json(rows[0]);
});

// --- Comentários (RF19) ---
router.post('/:id/comentarios', requireAuth, async (req, res) => {
  const chamado = await buscarChamadoOuFalhar(req.params.id, res);
  if (!chamado) return;
  if (req.user.perfil !== 'admin' && chamado.aberto_por !== req.user.id) {
    return res.status(403).json({ erro: 'Você não tem acesso a este chamado.' });
  }
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ erro: 'Texto do comentário é obrigatório.' });

  const { rows } = await pool.query(
    `INSERT INTO comentarios (chamado_id, autor_id, texto) VALUES ($1, $2, $3) RETURNING *`,
    [chamado.id, req.user.id, texto]
  );

  // notifica a outra parte da conversa
  const destinatario = req.user.id === chamado.aberto_por ? chamado.responsavel_id : chamado.aberto_por;
  if (destinatario) await notificar(destinatario, chamado.id, 'novo_comentario');

  res.status(201).json(rows[0]);
});

// --- Anexos (RF05) ---
router.post('/:id/anexos', requireAuth, upload.single('arquivo'), async (req, res) => {
  const chamado = await buscarChamadoOuFalhar(req.params.id, res);
  if (!chamado) return;
  if (req.user.perfil !== 'admin' && chamado.aberto_por !== req.user.id) {
    return res.status(403).json({ erro: 'Você não tem acesso a este chamado.' });
  }
  if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado.' });

  const { comentario_id } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO anexos (chamado_id, comentario_id, nome_arquivo, caminho, tamanho_bytes, enviado_por)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [chamado.id, comentario_id || null, req.file.originalname, req.file.path, req.file.size, req.user.id]
  );
  res.status(201).json(rows[0]);
});

// --- Baixar anexo (RF05) ---
// Rota protegida em vez de `express.static`: precisa checar se quem está
// pedindo é o dono do chamado ou admin, senão qualquer usuário logado
// poderia baixar anexo de chamado de outra pessoa só sabendo o id.
router.get('/:id/anexos/:anexoId', requireAuth, async (req, res) => {
  const chamado = await buscarChamadoOuFalhar(req.params.id, res);
  if (!chamado) return;
  if (req.user.perfil !== 'admin' && chamado.aberto_por !== req.user.id) {
    return res.status(403).json({ erro: 'Você não tem acesso a este chamado.' });
  }

  const { rows } = await pool.query(
    'SELECT * FROM anexos WHERE id = $1 AND chamado_id = $2',
    [req.params.anexoId, chamado.id]
  );
  if (rows.length === 0) return res.status(404).json({ erro: 'Anexo não encontrado.' });
  const anexo = rows[0];

  if (!fs.existsSync(anexo.caminho)) {
    return res.status(404).json({ erro: 'Arquivo não encontrado no servidor (pode ter sido removido).' });
  }

  // res.download define o Content-Disposition com o nome original do
  // arquivo, então o navegador salva com o nome certo em vez do nome
  // aleatório usado no disco.
  res.download(anexo.caminho, anexo.nome_arquivo);
});

// --- Excluir um anexo específico (admin ou quem enviou) ---
router.delete('/:id/anexos/:anexoId', requireAuth, async (req, res) => {
  const chamado = await buscarChamadoOuFalhar(req.params.id, res);
  if (!chamado) return;

  const { rows } = await pool.query(
    'SELECT * FROM anexos WHERE id = $1 AND chamado_id = $2',
    [req.params.anexoId, chamado.id]
  );
  if (rows.length === 0) return res.status(404).json({ erro: 'Anexo não encontrado.' });
  const anexo = rows[0];

  const podeExcluir = req.user.perfil === 'admin' || anexo.enviado_por === req.user.id;
  if (!podeExcluir) {
    return res.status(403).json({ erro: 'Você só pode excluir anexos que você mesmo enviou.' });
  }

  await pool.query('DELETE FROM anexos WHERE id = $1', [anexo.id]);
  fs.unlink(anexo.caminho, () => {}); // best-effort

  res.status(204).send();
});

// --- Excluir chamado (admin) ---
// Remove o chamado e, em cascata (via FK ON DELETE CASCADE), seu histórico,
// comentários e anexos. Os arquivos físicos dos anexos são apagados do disco
// depois que o banco confirma a exclusão, pra não sobrar lixo em /uploads.
router.delete('/:id', requireAdmin, async (req, res) => {
  const chamado = await buscarChamadoOuFalhar(req.params.id, res);
  if (!chamado) return;

  const anexos = await pool.query('SELECT caminho FROM anexos WHERE chamado_id = $1', [chamado.id]);
  await pool.query('DELETE FROM chamados WHERE id = $1', [chamado.id]);

  for (const anexo of anexos.rows) {
    fs.unlink(anexo.caminho, () => {}); // best-effort; não bloqueia a resposta
  }

  res.status(204).send();
});

module.exports = router;
