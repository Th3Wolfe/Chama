const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./db');

// Serialização mínima: guardamos só o id do usuário na sessão
passport.serializeUser((usuario, done) => {
  done(null, usuario.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const { rows } = await pool.query('SELECT * FROM usuarios WHERE id = $1', [id]);
    done(null, rows[0] || null);
  } catch (err) {
    done(err);
  }
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        const nome = profile.displayName || email;
        const googleSub = profile.id;

        if (!email) {
          return done(null, false, { message: 'Não foi possível obter o e-mail da conta Google.' });
        }

        // Restringe por domínio, se configurado
        const dominioPermitido = process.env.DOMINIO_PERMITIDO;
        if (dominioPermitido && !email.endsWith('@' + dominioPermitido)) {
          return done(null, false, { message: 'E-mail fora do domínio autorizado.' });
        }

        // Busca usuário existente por e-mail; cria se não existir (perfil padrão: usuario)
        const existente = await pool.query('SELECT * FROM usuarios WHERE email = $1', [email]);

        if (existente.rows.length > 0) {
          // Atualiza o google_sub caso ainda não tenha sido gravado
          if (!existente.rows[0].google_sub) {
            await pool.query('UPDATE usuarios SET google_sub = $1 WHERE id = $2', [googleSub, existente.rows[0].id]);
          }
          return done(null, existente.rows[0]);
        }

        const inserido = await pool.query(
          `INSERT INTO usuarios (nome, email, google_sub, perfil)
           VALUES ($1, $2, $3, 'usuario') RETURNING *`,
          [nome, email, googleSub]
        );
        return done(null, inserido.rows[0]);
      } catch (err) {
        return done(err);
      }
    }
  )
);

module.exports = passport;
