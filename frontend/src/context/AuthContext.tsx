import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, API_URL } from '../api/client';
import type { Usuario } from '../api/types';

interface AuthContextValue {
  usuario: Usuario | null;
  carregando: boolean;
  logout: () => Promise<void>;
  loginUrl: string;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    api
      .get<Usuario>('/auth/me')
      .then((res) => setUsuario(res.data))
      .catch(() => setUsuario(null))
      .finally(() => setCarregando(false));
  }, []);

  async function logout() {
    await api.post('/auth/logout');
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, logout, loginUrl: `${API_URL}/auth/google` }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return ctx;
}
