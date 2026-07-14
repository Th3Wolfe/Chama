import { NavLink } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ClipboardList,
  FolderTree,
  Building2,
  Monitor,
  Users,
  BarChart3,
  BookOpen,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const LINKS_ADMIN: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/chamados', label: 'Chamados', icon: ClipboardList },
  { to: '/categorias', label: 'Categorias', icon: FolderTree },
  { to: '/setores', label: 'Setores', icon: Building2 },
  { to: '/equipamentos', label: 'Equipamentos', icon: Monitor },
  { to: '/usuarios', label: 'Usuários', icon: Users },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3 },
  { to: '/base-conhecimento', label: 'Base de conhecimento', icon: BookOpen },
];

const LINKS_USUARIO: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/', label: 'Meus chamados', icon: ClipboardList, end: true },
  { to: '/base-conhecimento', label: 'Base de conhecimento', icon: BookOpen },
  { to: '/comunicados', label: 'Comunicados', icon: Megaphone },
];

export function Sidebar() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';
  const links = isAdmin ? LINKS_ADMIN : LINKS_USUARIO;

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <img src="/assets/flame-icon.png" alt="Chama" className="sidebar__brand-logo" />
        <div className="sidebar__brand-text">
          Chama
          <br />
          <span>Câmara Municipal de Itajubá</span>
        </div>
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__section-label">{isAdmin ? 'Principal' : 'Menu'}</div>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `sidebar__link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar__link-icon">
              <link.icon size={18} strokeWidth={2} />
            </span>
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
