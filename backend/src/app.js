require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const passport = require('./passport-config');

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

// Tratamento de erro genérico (evita vazar stack trace ao usuário)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

module.exports = app;
