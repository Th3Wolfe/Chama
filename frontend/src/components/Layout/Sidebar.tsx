import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LINKS_ADMIN = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/chamados', label: 'Chamados', icon: '📋' },
  { to: '/categorias', label: 'Categorias', icon: '🗂️' },
  { to: '/setores', label: 'Setores', icon: '🏢' },
  { to: '/equipamentos', label: 'Equipamentos', icon: '🖥️' },
  { to: '/usuarios', label: 'Usuários', icon: '👤' },
  { to: '/relatorios', label: 'Relatórios', icon: '📊' },
];

const LINKS_USUARIO = [
  { to: '/', label: 'Meus chamados', icon: '📋', end: true },
  { to: '/chamados/novo', label: 'Novo chamado', icon: '➕' },
  { to: '/base-conhecimento', label: 'Base de conhecimento', icon: '📖' },
  { to: '/comunicados', label: 'Comunicados', icon: '📣' },
];

export function Sidebar() {
  const { usuario, logout } = useAuth();
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
