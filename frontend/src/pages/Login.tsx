import { useAuth } from '../context/AuthContext';

export function Login() {
  const { loginUrl } = useAuth();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--color-sidebar)',
      }}
    >
      <div className="card" style={{ padding: 40, width: 380, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>🏛️</div>
        <h1 style={{ fontSize: 20, marginBottom: 4 }}>Câmara Municipal de Itajubá</h1>
        <p className="text-muted" style={{ marginBottom: 24 }}>Sistema de Chamados de TI</p>
        <a href={loginUrl} className="btn btn--primary" style={{ width: '100%', justifyContent: 'center' }}>
          Entrar com Google Workspace
        </a>
      </div>
    </div>
  );
}
