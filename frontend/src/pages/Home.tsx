import { useAuth } from '../context/AuthContext';
import { Dashboard } from './Dashboard';
import { UserHome } from './UserHome';

/**
 * A rota "/" mostra telas bem diferentes dependendo do perfil: o admin
 * vê o Dashboard gerencial (gráficos, fila sem responsável, etc.), e o
 * usuário comum vê um painel mais simples com os próprios chamados e
 * atalhos (base de conhecimento, comunicados, horário de atendimento).
 */
export function Home() {
  const { usuario } = useAuth();
  return usuario?.perfil === 'admin' ? <Dashboard /> : <UserHome />;
}
