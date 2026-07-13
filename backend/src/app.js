require('dotenv').config();
const express = require('express');
// Faz com que erros/rejeições dentro de rotas `async` cheguem automaticamente
// ao middleware de erro abaixo. Sem isso, no Express 4, um `throw` (ou uma
// query do pg que rejeita) dentro de uma rota async vira uma promise
// rejeitada sem handler: a requisição nunca recebe resposta e fica pendurada
// no cliente. Precisa ser importado logo após o `express`, antes das rotas.
require('express-async-errors');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const passport = require('./passport-config');
const pool = require('./db');

const authRoutes = require('./routes/auth');
const categoriasRoutes = require('./routes/categorias');
const setoresRoutes = require('./routes/setores');
const chamadosRoutes = require('./routes/chamados');
const equipamentosRoutes = require('./routes/equipamentos');
const usuariosRoutes = require('./routes/usuarios');
const buscaRoutes = require('./routes/busca');
const notificacoesRoutes = require('./routes/notificacoes');
const dashboardRoutes = require('./routes/dashboard');
const relatoriosRoutes = require('./routes/relatorios');

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(
  session({
    // Sessão persistida no Postgres em vez do MemoryStore padrão do
    // express-session. O MemoryStore some inteira toda vez que o processo
    // reinicia (deploy, crash, ou até o `node --watch` do modo dev) — isso
    // desloga todo mundo de repente, mesmo com o cookie do navegador intacto.
    // `createTableIfMissing` cria a tabela "session" sozinho no primeiro boot.
    store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      // Rede local, sem HTTPS na V1 -> secure: false.
      // Se o servidor passar a rodar atrás de HTTPS, mudar para true.
      secure: false,
      maxAge: 1000 * 60 * 60 * 8, // 8 horas
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/categorias', categoriasRoutes);
app.use('/setores', setoresRoutes);
app.use('/chamados', chamadosRoutes);
app.use('/equipamentos', equipamentosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/busca', buscaRoutes);
app.use('/notificacoes', notificacoesRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/relatorios', relatoriosRoutes);

// Tratamento de erro genérico (evita vazar stack trace ao usuário).
// Antes disso, os erros só chegavam aqui em pontos que faziam try/catch
// manual (poucos). Com `express-async-errors` (require no topo do arquivo),
// qualquer rejeição dentro de uma rota `async` também cai aqui agora.
app.use((err, req, res, next) => {
  console.error(err);

  // Erros de validação do multer (arquivo grande demais) ou do nosso
  // fileFilter (extensão não permitida) já vêm com uma mensagem amigável.
  if (err.name === 'MulterError' || err.status === 400) {
    return res.status(400).json({ erro: err.message });
  }

  // Códigos de erro do PostgreSQL que representam entrada inválida do
  // cliente (não bug do servidor) — devolvemos 400 com mensagem específica
  // em vez do genérico 500.
  const ERROS_PG = {
    '23503': 'Referência inválida: um dos IDs enviados não existe (ex: categoria, setor ou responsável).',
    '23505': 'Já existe um registro com esse valor único.',
    '22P02': 'Um dos valores enviados está em formato inválido.',
    '23514': 'Um dos valores enviados não é permitido (viola uma regra do campo).',
  };
  if (err.code && ERROS_PG[err.code]) {
    return res.status(400).json({ erro: ERROS_PG[err.code] });
  }

  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

module.exports = app;
