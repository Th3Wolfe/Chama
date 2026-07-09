import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protege rotas que só fazem sentido para administradores (Categorias,
 * Setores, Equipamentos, Usuários, Relatórios). A home ("/") não usa esse
 * guard: ela decide sozinha (em Home.tsx) se mostra o Dashboard do admin
 * ou a tela do usuário comum. Quem cair numa rota admin-only sem ser
 * admin (ex: link direto, favorito antigo) é redirecionado para a lista
 * de chamados em vez de ver uma tela quebrada com erro 403 do backend.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();

  if (usuario && usuario.perfil !== 'admin') {
    return <Navigate to="/chamados" replace />;
  }

  return <>{children}</>;
}
