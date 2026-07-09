/**
 * Apaga SOMENTE os dados criados por seed-demo.js, usando o arquivo
 * .demo-seed-state.json como lista exata de IDs a remover.
 *
 * Não faz TRUNCATE nem DELETE genérico — então é seguro mesmo que o banco
 * já tenha dado real (de você mesmo testando manualmente, por exemplo).
 *
 * Uso:
 *   cd backend
 *   node scripts/clean-demo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const STATE_FILE = path.join(__dirname, '.demo-seed-state.json');

async function clean() {
  if (!fs.existsSync(STATE_FILE)) {
    console.log('Nenhum estado de demo encontrado (.demo-seed-state.json não existe). Nada a fazer.');
    return;
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ordem que respeita as foreign keys: filhos antes dos pais.
    await del(client, 'notificacoes', state.notificacoes);
    await del(client, 'comentarios', state.comentarios);
    await del(client, 'historico_status', state.historico_status);
    await del(client, 'chamados', state.chamados);
    await del(client, 'equipamentos', state.equipamentos);
    await del(client, 'usuarios', state.usuarios);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  fs.unlinkSync(STATE_FILE);
  console.log('Dados de demo removidos com sucesso. Banco voltou ao estado anterior ao seed.');
}

async function del(client, table, ids) {
  if (!ids || ids.length === 0) return;
  await client.query(`DELETE FROM ${table} WHERE id = ANY($1)`, [ids]);
  console.log(`  ${table}: ${ids.length} linha(s) removida(s)`);
}

clean()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Erro ao limpar dados de demo:', err);
    pool.end();
    process.exit(1);
  });
