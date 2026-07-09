import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { Login } from '../pages/Login';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { usuario, carregando } = useAuth();

  if (carregando) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Carregando...
      </div>
    );
  }

  if (!usuario) return <Login />;

  return <>{children}</>;
}
