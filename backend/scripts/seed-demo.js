/**
 * Popula o banco com dados FICTÍCIOS para demonstração / testes manuais e,
 * principalmente, para o Relatório Executivo Operacional (que precisa de
 * pelo menos dois meses de dados — mês atual e mês anterior — para calcular
 * os deltas dos KPIs).
 *
 * Atualizado para o schema atual (esta versão substitui a anterior, que era
 * de antes das migrations 002–008):
 *   - usa setor_id / categoria_id (não mais o texto livre "setor" em chamados)
 *   - preenche chamados.equipamento_id (RF27)
 *   - preenche chamados.primeira_resposta_em e chamados.atualizado_em
 *     (colunas usadas pelo Relatório Executivo e pelo dashboard; como o
 *     script insere direto via SQL, o trigger de atualizado_em — que só
 *     dispara em UPDATE — não seria suficiente sozinho)
 *   - cria anexos com arquivo real em disco (uploads/), pra o download
 *     funcionar de verdade na demonstração
 *
 * Como pensa os horários:
 *   - chamados são abertos majoritariamente em horário comercial
 *     (8h–18h, dias úteis), com pico em torno de 9h–11h e 14h–17h;
 *     poucos chamados fora disso (plantão/urgência) e quase nenhum em
 *     fim de semana.
 *   - a distribuição entre o mês atual e o mês anterior é proporcional aos
 *     dias "disponíveis" de cada um (o mês atual pode estar em andamento),
 *     pra a taxa diária de abertura ficar parecida entre os dois meses.
 *   - 1ª resposta e resolução acontecem depois da abertura, com um atraso
 *     em horas sorteado por prioridade (a maioria dentro do SLA da
 *     categoria, uma fração fora dele — pra o relatório mostrar SLA
 *     cumprido perto de 80-90%, não 100%) e sempre "empurrados" para o
 *     próximo horário comercial caso caiam fora do expediente.
 *   - chamados muito recentes tendem a estar "aberto"/"em_andamento";
 *     chamados mais antigos tendem a já estar "resolvido" — como um
 *     backlog de verdade.
 *
 * Tudo que é criado (linhas e arquivos) é registrado em
 * scripts/.demo-seed-state.json, para o clean-demo.js remover só isso depois.
 *
 * Uso:
 *   cd backend
 *   node scripts/seed-demo.js
 *   (ou: npm run seed:demo)
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const pool = require('../src/db');

const STATE_FILE = path.join(__dirname, '.demo-seed-state.json');
const PASTA_UPLOADS = path.join(__dirname, '..', 'uploads');

// Marca todo mundo criado por este script com um domínio bem distinto,
// pra ficar óbvio visualmente em qualquer tela quem é fake.
const DEMO_EMAIL_DOMAIN = 'demo.chamados.local';

const NOMES = [
  'Ana Beatriz Souza', 'Carlos Eduardo Lima', 'Fernanda Oliveira', 'João Pedro Alves',
  'Mariana Costa', 'Rafael Nogueira', 'Juliana Ferreira', 'Bruno Martins',
  'Camila Rodrigues', 'Diego Santos', 'Larissa Pereira', 'Thiago Almeida',
  'Patrícia Gomes', 'Vinícius Cardoso', 'Renata Barbosa', 'Eduardo Ribeiro',
  'Gustavo Henrique Silva', 'Letícia Fontes', 'Marcelo Teixeira', 'Priscila Andrade',
];

// Quantos dos NOMES viram "técnicos" (perfil admin, atendem chamados).
const NUM_TECNICOS = 3;
const NUM_USUARIOS_COMUNS = 12;

// Título/descrição por categoria (chave = nome da categoria como costuma vir
// no schema.sql/seed padrão). Se a categoria do banco tiver outro nome
// (admin renomeou/criou uma nova), cai no fallback GENERICO — o script nunca
// assume que a categoria existe, só lê o que já está no banco.
const CHAMADOS_POR_CATEGORIA = {
  'Hardware': {
    titulos: [
      'Impressora não puxa papel da bandeja 2',
      'Monitor com tela piscando',
      'Teclado sem funcionar corretamente',
      'Notebook não liga mais',
      'Necessário trocar cabo de rede da sala 12',
      'Solicitação de novo mouse, o atual está com defeito',
      'Solicitação de segundo monitor para o setor',
    ],
    descricoes: [
      'O problema começou hoje de manhã e está impactando o andamento do trabalho no setor.',
      'Já tentei reiniciar o equipamento algumas vezes, mas o problema persiste.',
      'Um colega do setor relatou o mesmo problema ontem à tarde.',
    ],
  },
  'Rede': {
    titulos: [
      'Sem acesso à rede Wi-Fi do plenário',
      'Internet extremamente lenta no setor',
      'Sistema fora do ar desde a manhã',
      'Não consigo acessar a pasta compartilhada da rede',
      'Conexão cai a cada poucos minutos',
    ],
    descricoes: [
      'Ocorre de forma intermitente, às vezes funciona normalmente.',
      'Preciso urgente pois tenho uma apresentação ainda esta semana.',
      'Já reiniciei o roteador local e o problema continua.',
    ],
  },
  'Software': {
    titulos: [
      'Solicitação de instalação do pacote Office',
      'Erro ao gerar relatório em PDF',
      'Sistema de protocolo travando ao salvar',
      'Erro 500 ao tentar abrir chamado pelo celular',
      'Chamado sobre atualização do antivírus',
    ],
    descricoes: [
      'Aparece uma mensagem de erro genérica e o sistema fecha sozinho.',
      'Não é urgente, mas gostaria de resolver assim que possível.',
      'Acontece só nesse computador, em outro funciona normalmente.',
    ],
  },
  'Acesso e Senhas': {
    titulos: [
      'Esqueci minha senha do sistema interno',
      'Preciso de acesso à pasta compartilhada do RH',
      'Caixa de e-mail cheia, não recebe mensagens novas',
      'Conta bloqueada após várias tentativas de login',
    ],
    descricoes: [
      'Preciso urgente pois tenho uma apresentação ainda esta semana.',
      'Já tentei redefinir pelo próprio sistema e não funcionou.',
      'Um colega do setor relatou o mesmo problema ontem à tarde.',
    ],
  },
};
const GENERICO = {
  titulos: [
    'Computador travando ao abrir o sistema',
    'Preciso de suporte para configurar equipamento novo',
    'Chamado duplicado, favor desconsiderar',
    'Dúvida sobre uso do sistema interno',
  ],
  descricoes: [
    'O problema começou hoje de manhã e está impactando o andamento do trabalho no setor.',
    'Não é urgente, mas gostaria de resolver assim que possível.',
  ],
};

const COMENTARIOS_TECNICO = [
  'Já estou verificando, vou até o setor em instantes.',
  'Conseguimos reproduzir o problema aqui, buscando solução.',
  'Foi necessário reiniciar o serviço, deve normalizar em alguns minutos.',
  'Peça já foi solicitada, aguardando chegada para concluir o reparo.',
  'Testado e funcionando normalmente após o ajuste.',
  'Pode confirmar se já normalizou aí do seu lado?',
];

const COMENTARIOS_USUARIO = [
  'Obrigado pelo retorno rápido!',
  'Confirmando que voltou a funcionar, pode encerrar.',
  'Ainda está acontecendo o mesmo problema aqui.',
  'Fico no aguardo, obrigado.',
  'Aconteceu de novo agora há pouco.',
];

const MARCAS_EQUIP = ['Dell', 'HP', 'Lenovo', 'Positivo', 'Samsung'];
const TIPOS_EQUIP = ['Notebook', 'Desktop', 'Notebook Ultrafino', 'All-in-One'];

// Conteúdo/nome dos anexos fictícios (arquivos .txt reais gravados em uploads/,
// pra o download funcionar de verdade na demonstração — não é só uma linha no banco).
const ANEXOS = [
  { nome: 'print-tela-erro.txt', texto: 'Print da tela no momento em que o erro aparece.\nMensagem: "Falha ao processar a solicitação."\n' },
  { nome: 'log-evento.txt', texto: 'Trecho do log do sistema no horário relatado pelo usuário.\n[ERRO] Timeout ao conectar ao serviço interno.\n' },
  { nome: 'foto-equipamento.txt', texto: '(descrição textual, no lugar de uma foto real) Cabo de energia do equipamento aparentemente danificado na base do conector.\n' },
  { nome: 'observacoes-adicionais.txt', texto: 'Segue mais contexto sobre o problema relatado, conforme conversamos por telefone.\n' },
];

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

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function conteudoPara(categoriaNome) {
  return CHAMADOS_POR_CATEGORIA[categoriaNome] || GENERICO;
}

// --- Modelagem de horário comercial ---------------------------------------

// Hora do dia (0-23) com pico em 9-11h e 14-17h, cauda rara fora do
// expediente (chamado aberto de madrugada/muito cedo acontece, mas é raro).
function horaComercialAleatoria() {
  const r = Math.random();
  if (r < 0.03) return 7;
  if (r < 0.13) return 8;
  if (r < 0.28) return 9;
  if (r < 0.41) return 10;
  if (r < 0.51) return 11;
  if (r < 0.57) return 12;
  if (r < 0.67) return 13;
  if (r < 0.80) return 14;
  if (r < 0.91) return 15;
  if (r < 0.97) return 16;
  return 17;
}

function ehFimDeSemana(data) {
  const dia = data.getDay();
  return dia === 0 || dia === 6;
}

// SLA (em horas) por prioridade — mesmos valores usados no relatório
// executivo (src/relatorio/dados.js) e no dashboard.
const SLA_HORAS = { alta: 4, media: 24, baixa: 72 };

// Tempo TOTAL (criação -> resolução) para um chamado resolvido, pensado em
// função do próprio SLA da prioridade: a maioria fica dentro do SLA (dando
// um "SLA cumprido" realista no relatório, por volta de 80%), uma fração
// menor estoura de propósito. Importante: o relatório mede esse SLA como
// tempo corrido de criado_em até resolvido_em (não é "horário comercial"),
// então o cálculo aqui também é em tempo corrido — nada de "empurrar pro
// próximo expediente" aqui, isso só se aplica ao horário de abertura do
// chamado (heatmap), que é o que de fato varia por hora do dia.
function horasResolucaoTotal(prioridade) {
  const sla = SLA_HORAS[prioridade];
  const dentroDoSla = Math.random() < 0.82;
  return dentroDoSla ? rand(sla * 0.15, sla * 0.85) : rand(sla * 1.15, sla * 2.4);
}

// Divide o tempo total entre "até a 1ª resposta" e "da resposta até a
// resolução" — a 1ª resposta consome uma fração menor do tempo total.
function dividirRespostaEResolucao(totalHoras) {
  const fracaoResposta = rand(0.15, 0.5);
  return { resposta: totalHoras * fracaoResposta, resolucao: totalHoras * (1 - fracaoResposta) };
}

// Tempo (em horas) até a 1ª resposta de um chamado que AINDA não foi
// resolvido (só em_andamento) — não tem SLA de resolução pra respeitar,
// só precisa ter uma magnitude plausível pra prioridade.
function horasAteRespostaIsolada(prioridade) {
  const sla = SLA_HORAS[prioridade];
  return rand(sla * 0.05, sla * 0.6);
}

async function seed() {
  const state = {
    criado_em: new Date().toISOString(),
    usuarios: [],
    equipamentos: [],
    chamados: [],
    historico_status: [],
    comentarios: [],
    anexos: [],
    anexos_arquivos: [], // caminhos em disco, pra apagar no clean-demo.js
    notificacoes: [],
  };

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // --- Setores e categorias já existentes no banco (não criamos nada aqui) ---
    const { rows: setores } = await client.query('SELECT id FROM setores WHERE ativo = TRUE');
    const { rows: categorias } = await client.query('SELECT id, nome, prioridade_padrao FROM categorias WHERE ativa = TRUE');
    if (setores.length === 0 || categorias.length === 0) {
      throw new Error(
        'Não há setores/categorias ativos no banco. Rode schema.sql e as migrations antes de gerar dados de demo.'
      );
    }
    const { rows: adminsReais } = await client.query(`SELECT id FROM usuarios WHERE perfil = 'admin' AND ativo = TRUE`);

    // --- Usuários fake: alguns "técnicos" (perfil admin) + o resto usuário comum ---
    const nomesEscolhidos = pickSome(NOMES, NUM_TECNICOS + NUM_USUARIOS_COMUNS);
    const tecnicosIds = [];
    const usuariosIds = [];
    for (let i = 0; i < nomesEscolhidos.length; i++) {
      const nome = nomesEscolhidos[i];
      const email = `${nome.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '')}@${DEMO_EMAIL_DOMAIN}`;
      const perfil = i < NUM_TECNICOS ? 'admin' : 'usuario';
      const setor = pick(setores);
      const { rows } = await client.query(
        `INSERT INTO usuarios (nome, email, perfil, setor, ativo)
         VALUES ($1, $2, $3, (SELECT nome FROM setores WHERE id = $4), TRUE)
         RETURNING id`,
        [nome, email, perfil, setor.id]
      );
      state.usuarios.push(rows[0].id);
      (perfil === 'admin' ? tecnicosIds : usuariosIds).push(rows[0].id);
    }
    // técnicos que vão atender chamados: os fake + os admins reais já existentes
    // no banco (se houver), pra distribuir também pra quem já loga de verdade.
    const atendentesIds = [...tecnicosIds, ...adminsReais.map((a) => a.id)];

    // --- Equipamentos fake, atribuídos à maioria dos usuários comuns ---
    const equipamentosPorUsuario = new Map(); // usuario_id -> [equipamento_id, ...]
    for (const uid of usuariosIds) {
      if (Math.random() < 0.75) {
        const { rows } = await client.query(
          `INSERT INTO equipamentos (nome, marca, modelo, numero_serie, status, usuario_id)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [
            pick(TIPOS_EQUIP),
            pick(MARCAS_EQUIP),
            `Modelo-${Math.floor(Math.random() * 900 + 100)}`,
            `SN${Math.floor(Math.random() * 900000 + 100000)}`,
            Math.random() < 0.9 ? 'ativo' : 'manutencao',
            uid,
          ]
        );
        state.equipamentos.push(rows[0].id);
        equipamentosPorUsuario.set(uid, [...(equipamentosPorUsuario.get(uid) || []), rows[0].id]);
      }
    }

    // --- Janela de tempo: mês atual (parcial, até hoje) + mês anterior (completo) ---
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtualIdx = hoje.getMonth(); // 0-based
    const anoAnterior = mesAtualIdx === 0 ? anoAtual - 1 : anoAtual;
    const mesAnteriorIdx = mesAtualIdx === 0 ? 11 : mesAtualIdx - 1;
    const diasNoMesAnterior = new Date(anoAnterior, mesAnteriorIdx + 1, 0).getDate();
    const diaAtualDoMes = hoje.getDate();

    function dataAleatoriaDoPeriodo() {
      const pesoAnterior = diasNoMesAnterior;
      const pesoAtual = diaAtualDoMes;
      const noMesAtual = Math.random() * (pesoAnterior + pesoAtual) >= pesoAnterior;
      const ano = noMesAtual ? anoAtual : anoAnterior;
      const mesIdx = noMesAtual ? mesAtualIdx : mesAnteriorIdx;
      const diaMax = noMesAtual ? diaAtualDoMes : diasNoMesAnterior;

      for (let tentativa = 0; tentativa < 8; tentativa++) {
        const dia = 1 + Math.floor(Math.random() * diaMax);
        const data = new Date(ano, mesIdx, dia);
        if (!ehFimDeSemana(data) || Math.random() < 0.06) {
          data.setHours(horaComercialAleatoria(), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
          if (data > hoje) continue; // não pode "abrir" chamado no futuro
          return data;
        }
      }
      // fallback: hoje mesmo, em horário comercial já passado
      const fallback = new Date(hoje);
      fallback.setHours(Math.min(horaComercialAleatoria(), Math.max(hoje.getHours() - 1, 8)), 0, 0, 0);
      return fallback > hoje ? hoje : fallback;
    }

    // --- Chamados fake, com histórico, comentários, anexos e notificações coerentes ---
    const NUM_CHAMADOS = 160;

    for (let i = 0; i < NUM_CHAMADOS; i++) {
      const abertoPor = pick(usuariosIds);
      const categoria = pick(categorias);
      const setor = pick(setores);
      const conteudo = conteudoPara(categoria.nome);
      const criadoEm = dataAleatoriaDoPeriodo();
      const diasDesdeAbertura = (hoje - criadoEm) / (1000 * 60 * 60 * 24);

      // Chamados recentes tendem a ainda estar em aberto/andamento; mais
      // antigos tendem a já estar resolvidos — como um backlog real.
      let status;
      const r = Math.random();
      if (diasDesdeAbertura < 1) status = r < 0.65 ? 'aberto' : 'em_andamento';
      else if (diasDesdeAbertura < 3) status = r < 0.25 ? 'aberto' : r < 0.60 ? 'em_andamento' : 'resolvido';
      else status = r < 0.06 ? 'aberto' : r < 0.18 ? 'em_andamento' : 'resolvido';

      const responsavel = status === 'aberto' ? null : pick(atendentesIds);

      let primeiraRespostaEm = null;
      let resolvidoEm = null;
      if (responsavel && status === 'resolvido') {
        const totalHoras = horasResolucaoTotal(categoria.prioridade_padrao);
        const { resposta, resolucao } = dividirRespostaEResolucao(totalHoras);
        let t = new Date(criadoEm.getTime() + resposta * 3600 * 1000);
        let t2 = new Date(criadoEm.getTime() + (resposta + resolucao) * 3600 * 1000);
        if (t > hoje) t = hoje;
        if (t2 > hoje) t2 = hoje;
        if (t2 < t) t2 = t; // segurança: nunca resolve antes de responder
        primeiraRespostaEm = t;
        resolvidoEm = t2;
      } else if (responsavel) {
        // em_andamento: só há 1ª resposta, ainda sem resolução.
        let t = new Date(criadoEm.getTime() + horasAteRespostaIsolada(categoria.prioridade_padrao) * 3600 * 1000);
        if (t > hoje) t = hoje;
        primeiraRespostaEm = t;
      }
      const atualizadoEm = resolvidoEm || primeiraRespostaEm || criadoEm;

      // Equipamento: só se o usuário que abriu tem algum vinculado a ele; mais
      // provável quando a categoria é "Hardware".
      const equipsDoUsuario = equipamentosPorUsuario.get(abertoPor);
      const chanceEquip = categoria.nome === 'Hardware' ? 0.7 : 0.3;
      const equipamentoId = equipsDoUsuario && Math.random() < chanceEquip ? pick(equipsDoUsuario) : null;

      const { rows: chamadoRows } = await client.query(
        `INSERT INTO chamados
           (titulo, descricao, setor_id, categoria_id, prioridade_atual, status,
            aberto_por, responsavel_id, equipamento_id,
            criado_em, atualizado_em, primeira_resposta_em, resolvido_em)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          pick(conteudo.titulos),
          pick(conteudo.descricoes),
          setor.id,
          categoria.id,
          categoria.prioridade_padrao,
          status,
          abertoPor,
          responsavel,
          equipamentoId,
          criadoEm,
          atualizadoEm,
          primeiraRespostaEm,
          resolvidoEm,
        ]
      );
      const chamadoId = chamadoRows[0].id;
      state.chamados.push(chamadoId);

      // --- histórico de status, coerente com o que foi decidido acima ---
      const passos = [{ statusNovo: 'aberto', em: criadoEm, por: abertoPor }];
      if (primeiraRespostaEm) passos.push({ statusNovo: 'em_andamento', em: primeiraRespostaEm, por: responsavel });
      if (resolvidoEm) passos.push({ statusNovo: 'resolvido', em: resolvidoEm, por: responsavel });

      let statusAnterior = null;
      for (const passo of passos) {
        const { rows } = await client.query(
          `INSERT INTO historico_status (chamado_id, status_anterior, status_novo, alterado_por, alterado_em)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [chamadoId, statusAnterior, passo.statusNovo, passo.por, passo.em]
        );
        state.historico_status.push(rows[0].id);
        statusAnterior = passo.statusNovo;
      }

      // --- comentários (0 a 3), espaçados entre a abertura e o último evento ---
      const limiteSuperior = status === 'aberto' ? hoje : atualizadoEm;
      const janelaMs = Math.max(limiteSuperior.getTime() - criadoEm.getTime(), 60 * 1000);
      const numComentarios = Math.floor(Math.random() * 4);
      for (let c = 0; c < numComentarios; c++) {
        const doTecnico = !!responsavel && Math.random() < 0.5;
        const autor = doTecnico ? responsavel : abertoPor;
        const texto = doTecnico ? pick(COMENTARIOS_TECNICO) : pick(COMENTARIOS_USUARIO);
        const fracao = (c + 1) / (numComentarios + 1);
        const comentarioEm = new Date(criadoEm.getTime() + fracao * janelaMs);
        const { rows } = await client.query(
          `INSERT INTO comentarios (chamado_id, autor_id, texto, criado_em)
           VALUES ($1,$2,$3,$4) RETURNING id`,
          [chamadoId, autor, texto, comentarioEm]
        );
        state.comentarios.push(rows[0].id);

        const destinatario = autor === abertoPor ? responsavel : abertoPor;
        if (destinatario) {
          const { rows: notifRows } = await client.query(
            `INSERT INTO notificacoes (usuario_id, chamado_id, tipo, lida, criado_em)
             VALUES ($1,$2,'novo_comentario',$3,$4) RETURNING id`,
            [destinatario, chamadoId, comentarioEm < new Date(hoje.getTime() - 86400000) && Math.random() < 0.75, comentarioEm]
          );
          state.notificacoes.push(notifRows[0].id);
        }
      }

      // --- anexo real em disco (~30% dos chamados) ---
      if (Math.random() < 0.3) {
        const anexo = pick(ANEXOS);
        const sufixo = crypto.randomBytes(8).toString('hex');
        const nomeNoDisco = `${Date.now()}-${sufixo}.txt`;
        const caminho = path.join(PASTA_UPLOADS, nomeNoDisco);
        fs.writeFileSync(caminho, anexo.texto, 'utf-8');
        const tamanhoBytes = Buffer.byteLength(anexo.texto, 'utf-8');
        let anexoEm = new Date(criadoEm.getTime() + rand(1, 120) * 60 * 1000);
        if (anexoEm > hoje) anexoEm = hoje;
        const enviadoPor = Math.random() < 0.85 ? abertoPor : (responsavel || abertoPor);
        const { rows: anexoRows } = await client.query(
          `INSERT INTO anexos (chamado_id, nome_arquivo, caminho, tamanho_bytes, enviado_por, criado_em)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [chamadoId, anexo.nome, caminho, tamanhoBytes, enviadoPor, anexoEm]
        );
        state.anexos.push(anexoRows[0].id);
        state.anexos_arquivos.push(caminho);
      }

      // --- notificações do fluxo principal (novo chamado / atribuição / status) ---
      const antigoODiaAnterior = (data) => data < new Date(hoje.getTime() - 86400000);
      const { rows: admins } = await client.query(`SELECT id FROM usuarios WHERE perfil = 'admin' AND ativo = TRUE`);
      for (const admin of admins) {
        const { rows: notifRows } = await client.query(
          `INSERT INTO notificacoes (usuario_id, chamado_id, tipo, lida, criado_em)
           VALUES ($1,$2,'novo_chamado',$3,$4) RETURNING id`,
          [admin.id, chamadoId, antigoODiaAnterior(criadoEm) && Math.random() < 0.75, criadoEm]
        );
        state.notificacoes.push(notifRows[0].id);
      }
      if (primeiraRespostaEm) {
        const { rows: n1 } = await client.query(
          `INSERT INTO notificacoes (usuario_id, chamado_id, tipo, lida, criado_em)
           VALUES ($1,$2,'chamado_atribuido',$3,$4) RETURNING id`,
          [responsavel, chamadoId, antigoODiaAnterior(primeiraRespostaEm) && Math.random() < 0.75, primeiraRespostaEm]
        );
        state.notificacoes.push(n1[0].id);
        const { rows: n2 } = await client.query(
          `INSERT INTO notificacoes (usuario_id, chamado_id, tipo, lida, criado_em)
           VALUES ($1,$2,'mudanca_status',$3,$4) RETURNING id`,
          [abertoPor, chamadoId, antigoODiaAnterior(primeiraRespostaEm) && Math.random() < 0.75, primeiraRespostaEm]
        );
        state.notificacoes.push(n2[0].id);
      }
      if (resolvidoEm) {
        const { rows: n3 } = await client.query(
          `INSERT INTO notificacoes (usuario_id, chamado_id, tipo, lida, criado_em)
           VALUES ($1,$2,'mudanca_status',$3,$4) RETURNING id`,
          [abertoPor, chamadoId, antigoODiaAnterior(resolvidoEm) && Math.random() < 0.75, resolvidoEm]
        );
        state.notificacoes.push(n3[0].id);
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    // Remove eventuais anexos já gravados em disco antes do erro, já que o
    // rollback desfaz o banco mas não os arquivos.
    for (const caminho of state.anexos_arquivos) {
      fs.unlink(caminho, () => {});
    }
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
  console.log(`  anexos: ${state.anexos.length}`);
  console.log(`  notificacoes: ${state.notificacoes.length}`);
  console.log(`\nEstado salvo em ${STATE_FILE}`);
  console.log('Quando terminar, rode: node scripts/clean-demo.js (ou npm run clean:demo)');
}

seed()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Erro ao gerar dados de demo:', err);
    pool.end();
    process.exit(1);
  });
