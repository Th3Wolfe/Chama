/**
 * Apaga SOMENTE os dados criados por seed-demo.js, usando o arquivo
 * .demo-seed-state.json como lista exata de IDs (e arquivos) a remover.
 *
 * Não faz TRUNCATE nem DELETE genérico — então é seguro mesmo que o banco
 * já tenha dado real (de você mesmo testando manualmente, por exemplo).
 * Também remove do disco os arquivos de anexo que o seed criou em uploads/.
 *
 * Ordem de remoção respeita as foreign keys (filhos antes dos pais):
 *   notificacoes -> anexos (banco + arquivo) -> comentarios ->
 *   historico_status -> chamados -> equipamentos -> usuarios
 *
 * Uso:
 *   cd backend
 *   node scripts/clean-demo.js
 *   (ou: npm run clean:demo)
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

    await del(client, 'notificacoes', state.notificacoes);
    await del(client, 'anexos', state.anexos);
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

  // Arquivos de anexo em disco (fora da transação do banco de propósito:
  // se o banco falhar e der rollback, não queremos ter apagado arquivo à toa).
  let arquivosRemovidos = 0;
  for (const caminho of state.anexos_arquivos || []) {
    try {
      fs.unlinkSync(caminho);
      arquivosRemovidos++;
    } catch (e) {
      // Já pode ter sido removido manualmente antes; não interrompe a limpeza.
      console.warn(`  aviso: não foi possível remover ${caminho} (${e.code || e.message})`);
    }
  }
  console.log(`  arquivos de anexo: ${arquivosRemovidos} removido(s) do disco`);

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
