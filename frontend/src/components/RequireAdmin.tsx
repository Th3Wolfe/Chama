import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Protege rotas que só fazem sentido para administradores (Dashboard,
 * Categorias, Setores, Equipamentos, Relatórios). Usuários comuns que
 * caírem numa dessas rotas (ex: link direto, favorito antigo) são
 * redirecionados para a lista de chamados em vez de ver uma tela quebrada
 * com erro 403 do backend.
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();

  if (usuario && usuario.perfil !== 'admin') {
    return <Navigate to="/chamados" replace />;
  }

  return <>{children}</>;
}
