/**
 * Popula o banco com dados FAKE para gravar demonstrações.
 *
 * - Não mexe em organizacoes/categorias/setores já existentes (reaproveita).
 * - Cria usuários, chamados, histórico de status, comentários, notificações
 *   e equipamentos fictícios.
 * - Grava os IDs de tudo que criou em scripts/.demo-seed-state.json, para
 *   que `clean-demo.js` consiga apagar SÓ isso depois, sem risco de tocar
 *   em dado real que já esteja no banco.
 *
 * Uso:
 *   cd backend
 *   node scripts/seed-demo.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const STATE_FILE = path.join(__dirname, '.demo-seed-state.json');

// Marca todo mundo criado por este script com um domínio bem distinto,
// pra ficar óbvio visualmente em qualquer tela quem é fake.
const DEMO_EMAIL_DOMAIN = 'demo.chamados.local';

const NOMES = [
  'Ana Beatriz Souza', 'Carlos Eduardo Lima', 'Fernanda Oliveira', 'João Pedro Alves',
  'Mariana Costa', 'Rafael Nogueira', 'Juliana Ferreira', 'Bruno Martins',
  'Camila Rodrigues', 'Diego Santos', 'Larissa Pereira', 'Thiago Almeida',
  'Patrícia Gomes', 'Vinícius Cardoso', 'Renata Barbosa', 'Eduardo Ribeiro',
];

const TITULOS_CHAMADO = [
  'Impressora não puxa papel da bandeja 2',
  'Computador travando ao abrir o sistema de protocolo',
  'Sem acesso à rede Wi-Fi do plenário',
  'Solicitação de instalação do pacote Office',
  'Monitor com tela piscando',
  'Esqueci minha senha do sistema interno',
  'Erro ao gerar relatório em PDF',
  'Teclado sem funcionar corretamente',
  'Lentidão no computador do setor',
  'Preciso de acesso à pasta compartilhada do RH',
  'Caixa de e-mail cheia, não recebe mensagens novas',
  'Projetor da sala de reuniões não liga',
  'Sistema fora do ar desde a manhã',
  'Solicitação de novo mouse, o atual está com defeito',
  'Chamado duplicado sobre atualização do antivírus',
  'Necessário trocar cabo de rede da sala 12',
  'Erro 500 ao tentar abrir chamado pelo celular',
  'Solicitação de segundo monitor para o setor financeiro',
];

const DESCRICOES = [
  'O problema começou hoje de manhã e está impactando o andamento do trabalho no setor.',
  'Já tentei reiniciar o equipamento algumas vezes, mas o problema persiste.',
  'Um colega do setor relatou o mesmo problema ontem à tarde.',
  'Preciso urgente pois tenho uma apresentação ainda esta semana.',
  'Não é urgente, mas gostaria de resolver assim que possível.',
  'Ocorre de forma intermitente, às vezes funciona normalmente.',
];

const COMENTARIOS_TECNICO = [
  'Já estou verificando, vou até o setor em instantes.',
  'Conseguimos reproduzir o problema aqui, buscando solução.',
  'Foi necessário reiniciar o serviço, deve normalizar em alguns minutos.',
  'Peça já foi solicitada, aguardando chegada para concluir o reparo.',
  'Testado e funcionando normalmente após o ajuste.',
];

const COMENTARIOS_USUARIO = [
  'Obrigado pelo retorno rápido!',
  'Confirmando que voltou a funcionar, pode encerrar.',
  'Ainda está acontecendo o mesmo problema aqui.',
  'Fico no aguardo, obrigado.',
];

const MARCAS_EQUIP = ['Dell', 'HP', 'Lenovo', 'Positivo', 'Samsung'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickSome(arr, n) {
  const copy = [...arr];
  const out = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

// Data aleatória nos últimos `dias` dias
function dataRecente(dias) {
  const ms = Date.now() - Math.floor(Math.random() * dias * 24 * 60 * 60 * 1000);
  return new Date(ms);
}

async function seed() {
  const state = {
    usuarios: [],
    chamados: [],
    historico_status: [],
    comentarios: [],
    notificacoes: [],
    equipamentos: [],
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Setores e categorias já existentes no banco (não criamos nada aqui) ---
    const { rows: setores } = await client.query('SELECT id FROM setores WHERE ativo = TRUE');
    const { rows: categorias } = await client.query('SELECT id, prioridade_padrao FROM categorias WHERE ativa = TRUE');
    if (setores.length === 0 || categorias.length === 0) {
      throw new Error(
        'Não há setores/categorias ativos no banco. Rode schema.sql e as migrations antes de gerar dados de demo.'
      );
    }

    // --- Usuários fake (2 admins/técnicos + o resto usuário comum) ---
    const usuariosFake = pickSome(NOMES, 10);
    for (let i = 0; i < usuariosFake.length; i++) {
      const nome = usuariosFake[i];
      const email = `${nome.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@${DEMO_EMAIL_DOMAIN}`;
      const perfil = i < 2 ? 'admin' : 'usuario';
      const setor = pick(setores);
      const { rows } = await client.query(
        `INSERT INTO usuarios (nome, email, perfil, setor, ativo)
         VALUES ($1, $2, $3, (SELECT nome FROM setores WHERE id = $4), TRUE)
         RETURNING id`,
        [nome, email, perfil, setor.id]
      );
      state.usuarios.push(rows[0].id);
    }

    const adminsIds = [];
    const usuariosIds = [];
    {
      const { rows } = await client.query(
        `SELECT id, perfil FROM usuarios WHERE id = ANY($1)`,
        [state.usuarios]
      );
      rows.forEach((r) => (r.perfil === 'admin' ? adminsIds : usuariosIds).push(r.id));
    }

    // --- Equipamentos fake, atribuídos a usuários comuns ---
    for (const uid of usuariosIds) {
      if (Math.random() < 0.7) {
        const { rows } = await client.query(
          `INSERT INTO equipamentos (nome, marca, modelo, numero_serie, status, usuario_id)
           VALUES ($1, $2, $3, $4, 'ativo', $5) RETURNING id`,
          [
            'Notebook',
            pick(MARCAS_EQUIP),
            `Modelo-${Math.floor(Math.random() * 900 + 100)}`,
            `SN${Math.floor(Math.random() * 900000 + 100000)}`,
            uid,
          ]
        );
        state.equipamentos.push(rows[0].id);
      }
    }

    // --- Chamados fake, com histórico, comentários e notificações coerentes ---
    const STATUS_FLOW = ['aberto', 'em_andamento', 'resolvido'];
    const NUM_CHAMADOS = 28;

    for (let i = 0; i < NUM_CHAMADOS; i++) {
      const abertoPor = pick(usuariosIds);
      const categoria = pick(categorias);
      const setor = pick(setores);
      const criadoEm = dataRecente(21);
      // distribuição: ~35% aberto, ~30% em_andamento, ~35% resolvido
      const roll = Math.random();
      const statusFinal = roll < 0.35 ? 'aberto' : roll < 0.65 ? 'em_andamento' : 'resolvido';
      const responsavel = statusFinal === 'aberto' ? null : pick(adminsIds);
      const resolvidoEm = statusFinal === 'resolvido' ? new Date(criadoEm.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000) : null;

      const { rows: chamadoRows } = await client.query(
        `INSERT INTO chamados
           (titulo, descricao, setor_id, categoria_id, prioridade_atual, status,
            aberto_por, responsavel_id, criado_em, resolvido_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING id`,
        [
          pick(TITULOS_CHAMADO),
          pick(DESCRICOES),
          setor.id,
          categoria.id,
          categoria.prioridade_padrao,
          statusFinal,
          abertoPor,
          responsavel,
          criadoEm,
          resolvidoEm,
        ]
      );
      const chamadoId = chamadoRows[0].id;
      state.chamados.push(chamadoId);

      // histórico de status coerente com o status final
      const passos = STATUS_FLOW.slice(0, STATUS_FLOW.indexOf(statusFinal) + 1);
      let statusAnterior = null;
      for (let p = 0; p < passos.length; p++) {
        const alteradoPor = p === 0 ? abertoPor : responsavel || abertoPor;
        const { rows } = await client.query(
          `INSERT INTO historico_status (chamado_id, status_anterior, status_novo, alterado_por, alterado_em)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [chamadoId, statusAnterior, passos[p], alteradoPor, new Date(criadoEm.getTime() + p * 1000 * 60 * 60)]
        );
        state.historico_status.push(rows[0].id);
        statusAnterior = passos[p];
      }

      // comentários (0 a 3)
      const numComentarios = Math.floor(Math.random() * 4);
      for (let c = 0; c < numComentarios; c++) {
        const doTecnico = responsavel && Math.random() < 0.5;
        const autor = doTecnico ? responsavel : abertoPor;
        const texto = doTecnico ? pick(COMENTARIOS_TECNICO) : pick(COMENTARIOS_USUARIO);
        const { rows } = await client.query(
          `INSERT INTO comentarios (chamado_id, autor_id, texto, criado_em)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [chamadoId, autor, texto, new Date(criadoEm.getTime() + (c + 1) * 1000 * 60 * 60 * 3)]
        );
        state.comentarios.push(rows[0].id);
      }

      // notificações (simulando os eventos naturais do fluxo)
      const notifTargets = [];
      if (statusFinal !== 'aberto' && responsavel) notifTargets.push([responsavel, 'chamado_atribuido']);
      notifTargets.push([abertoPor, 'mudanca_status']);
      for (const [uid, tipo] of notifTargets) {
        const { rows } = await client.query(
          `INSERT INTO notificacoes (usuario_id, chamado_id, tipo, lida, criado_em)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [uid, chamadoId, tipo, Math.random() < 0.5, criadoEm]
        );
        state.notificacoes.push(rows[0].id);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('Dados de demo criados com sucesso:');
  console.log(`  usuarios: ${state.usuarios.length}`);
  console.log(`  equipamentos: ${state.equipamentos.length}`);
  console.log(`  chamados: ${state.chamados.length}`);
  console.log(`  historico_status: ${state.historico_status.length}`);
  console.log(`  comentarios: ${state.comentarios.length}`);
  console.log(`  notificacoes: ${state.notificacoes.length}`);
  console.log(`\nEstado salvo em ${STATE_FILE}`);
  console.log('Quando terminar a gravação, rode: node scripts/clean-demo.js');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Erro ao gerar dados de demo:', err);
    pool.end();
    process.exit(1);
  });
