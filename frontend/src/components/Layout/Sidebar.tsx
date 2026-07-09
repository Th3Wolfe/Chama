import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true, adminOnly: true },
  { to: '/chamados', label: 'Chamados', icon: '📋', adminOnly: false },
  { to: '/categorias', label: 'Categorias', icon: '🗂️', adminOnly: true },
  { to: '/setores', label: 'Setores', icon: '🏢', adminOnly: true },
  { to: '/equipamentos', label: 'Equipamentos', icon: '🖥️', adminOnly: true },
  { to: '/usuarios', label: 'Usuários', icon: '👤', adminOnly: true },
  { to: '/relatorios', label: 'Relatórios', icon: '📊', adminOnly: true },
];

export function Sidebar() {
  const { usuario, logout } = useAuth();
  const isAdmin = usuario?.perfil === 'admin';
  const links = LINKS.filter((link) => isAdmin || !link.adminOnly);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-crest">🏛️</div>
        <div className="sidebar__brand-text">
          Câmara Municipal
          <br />
          de Itajubá
        </div>
      </div>

      <nav className="sidebar__nav">
        <div className="sidebar__section-label">Principal</div>
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `sidebar__link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar__link-icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      {usuario && (
        <div className="sidebar__footer">
          <div className="sidebar__avatar">{usuario.nome.slice(0, 2).toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar__user-name">{usuario.nome}</div>
            <div className="sidebar__user-email" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {usuario.email}
            </div>
          </div>
          <button
            onClick={logout}
            title="Sair"
            style={{ background: 'none', border: 'none', color: '#8493AC', fontSize: 16 }}
          >
            ⏻
          </button>
        </div>
      )}
    </aside>
  );
}
