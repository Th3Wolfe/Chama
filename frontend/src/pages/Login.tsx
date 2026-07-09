import { useAuth } from '../context/AuthContext';

function IconDoc() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M9 13h6" />
      <path d="M9 17h6" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function IconBook() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

function IconGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.1 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 7.1 29.6 5 24 5c-7.7 0-14.4 4.4-17.7 10.8z" />
      <path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4c-2 1.4-4.6 2.3-7.6 2.3-5.3 0-9.7-3.4-11.3-8.1l-6.6 5.1C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.5l6.6 5.4C41.6 35.6 44 30.2 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </svg>
  );
}

export function Login() {
  const { loginUrl } = useAuth();

  return (
    <div className="login-page">
      <header className="login-header">
        <div className="login-header__brand">
          <img src="/assets/flame-icon.png" alt="Chama" className="login-header__brand-logo" />
          <div>
            <div className="login-header__brand-name">Chama</div>
            <div className="login-header__brand-sub">Câmara Municipal de Itajubá</div>
          </div>
        </div>
        <nav className="login-header__nav">
          <a href="#recursos">Recursos</a>
          <a href="#base-conhecimento">Base de conhecimento</a>
          <a href="#comunicados">Comunicados</a>
          <a href="#suporte">Suporte</a>
        </nav>
      </header>

      <div className="login-hero">
        <div>
          <h1 className="login-hero__title">
            Suporte de TI<br />
            <span>simples, rápido</span><br />
            e eficiente.
          </h1>
          <p className="login-hero__subtitle">
            Abra chamados, acompanhe o andamento e encontre soluções com a
            equipe de TI da Câmara Municipal de Itajubá.
          </p>
          <div className="login-hero__features">
            <div className="login-feature">
              <div className="login-feature__icon login-feature__icon--blue"><IconDoc /></div>
              <p className="login-feature__title">Acompanhe</p>
              <p className="login-feature__desc">Veja o status dos seus chamados em tempo real.</p>
            </div>
            <div className="login-feature">
              <div className="login-feature__icon login-feature__icon--green"><IconChat /></div>
              <p className="login-feature__title">Comunique</p>
              <p className="login-feature__desc">Converse com a equipe e receba atualizações.</p>
            </div>
            <div className="login-feature">
              <div className="login-feature__icon login-feature__icon--purple"><IconBook /></div>
              <p className="login-feature__title">Resolva</p>
              <p className="login-feature__desc">Encontre respostas na nossa base de conhecimento.</p>
            </div>
          </div>
        </div>

        <div className="login-card">
          <img src="/assets/flame-icon.png" alt="Chama" className="login-card__logo" />
          <h2 className="login-card__title">Bem-vindo ao Chama</h2>
          <p className="login-card__subtitle">
            Faça login para acessar o sistema de suporte de TI
          </p>
          <a href={loginUrl} className="login-google-btn">
            <IconGoogle />
            Entrar com Google
          </a>
          <p className="login-card__terms">
            Ao entrar, você concorda com nossos{' '}
            <a href="#termos">Termos de uso</a> e{' '}
            <a href="#privacidade">Política de privacidade</a>
          </p>
        </div>
      </div>

      <div className="login-stats">
        <div className="login-stat">
          <div className="login-stat__icon login-stat__icon--blue"><IconShield /></div>
          <div>
            <div className="login-stat__value">Seus dados estão protegidos</div>
            <div className="login-stat__label">Seguimos as melhores práticas de segurança</div>
          </div>
        </div>
        <div className="login-stat">
          <div className="login-stat__icon login-stat__icon--green"><IconCheck /></div>
          <div>
            <div className="login-stat__value">+1.200</div>
            <div className="login-stat__label">Chamados resolvidos</div>
          </div>
        </div>
        <div className="login-stat">
          <div className="login-stat__icon login-stat__icon--blue"><IconUsers /></div>
          <div>
            <div className="login-stat__value">98%</div>
            <div className="login-stat__label">Satisfação dos usuários</div>
          </div>
        </div>
        <div className="login-stat">
          <div className="login-stat__icon login-stat__icon--purple"><IconClock /></div>
          <div>
            <div className="login-stat__value">2h 18m</div>
            <div className="login-stat__label">Tempo médio de resposta</div>
          </div>
        </div>
        <div className="login-stat">
          <div className="login-stat__icon login-stat__icon--amber"><IconShield /></div>
          <div>
            <div className="login-stat__value">24/7</div>
            <div className="login-stat__label">Monitoramento ativo</div>
          </div>
        </div>
      </div>
    </div>
  );
}
