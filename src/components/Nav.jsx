import { X } from 'lucide-react';
import Logo from './Logo';
import { initials } from '../lib/utils';

export default function Nav({ user, profile, view, go, links, onLogout, onLogin, onPublish, menuOpen, setMenuOpen }) {
  return (
    <>
      <header className="nav">
        <div className="wrap nav-in">
          <button className="brand" onClick={() => go('home')} aria-label="LaburamosApp, ir al inicio">
            <Logo variant="horizontal" size={34} />
          </button>

          <nav className="nav-links" aria-label="Principal">
            {links.map((l) => (
              <button key={l.id} className={`nav-link${view === l.id ? ' on' : ''}`} onClick={() => go(l.id)}>
                {l.label}
              </button>
            ))}
          </nav>

          <div className="nav-right">
            {user ? (
              <>
                <button className="btn btn-sun btn-sm hide-m" onClick={onPublish}>
                  Publicar
                </button>
                <span className="who hide-m">
                  <span className="avatar" aria-hidden="true">
                    {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : initials(user.name)}
                  </span>
                  <span>{user.name}</span>
                </span>
                <button className="btn btn-line btn-sm hide-m" onClick={onLogout}>
                  Salir
                </button>
              </>
            ) : (
              <>
                <button className="btn btn-line btn-sm hide-m" onClick={() => onLogin('login')}>
                  Ingresar
                </button>
                <button className="btn btn-ink btn-sm hide-m" onClick={() => onLogin('register')}>
                  Crear cuenta
                </button>
              </>
            )}
            <button className="burger" aria-label="Abrir menú" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      <div className={`menu${menuOpen ? ' open' : ''}`} aria-hidden={!menuOpen}>
        <div className="menu-top">
          <span className="brand">
            <Logo variant="claro" size={38} />
          </span>
          <button className="x-menu" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú">
            <X size={26} />
          </button>
        </div>
        <nav aria-label="Menú">
          {links.map((l) => (
            <button key={l.id} className={`menu-link${view === l.id ? ' on' : ''}`} onClick={() => go(l.id)}>
              {l.label}
            </button>
          ))}
        </nav>
        <div className="menu-foot">
          {user ? (
            <>
              <span className="who">
                <span className="avatar" aria-hidden="true">
                  {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : initials(user.name)}
                </span>
                <span>{user.name}</span>
              </span>
              <button className="btn btn-sun" onClick={onLogout}>
                Salir
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-sun" onClick={() => onLogin('register')}>
                Crear cuenta
              </button>
              <button className="btn btn-paper" onClick={() => onLogin('login')}>
                Ingresar
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
