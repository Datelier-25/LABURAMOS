import { useState } from 'react';
import { CheckCircle2, Download, X } from 'lucide-react';
import Logo from './Logo';
import { initials } from '../lib/utils';
import { useInstallPrompt } from '../lib/install';

export default function Nav({ user, profile, view, go, links, onLogout, onLogin, onPublish, menuOpen, setMenuOpen }) {
  const { installed, ios, promptInstall } = useInstallPrompt();
  const [installHint, setInstallHint] = useState('');

  const handleInstall = async () => {
    setInstallHint('');
    const opened = await promptInstall();
    if (!opened) {
      setInstallHint(
        ios
          ? 'En Safari tocá Compartir y elegí “Agregar a inicio”.'
          : 'Abrí el menú del navegador y elegí “Instalar app” o “Agregar a pantalla de inicio”.'
      );
    }
  };

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
        <div className="menu-install">
          {installed ? (
            <p className="menu-install-ok">
              <CheckCircle2 size={17} aria-hidden="true" /> La app ya está en la pantalla de inicio.
            </p>
          ) : (
            <>
              <button type="button" className="btn btn-sun menu-install-btn" onClick={handleInstall}>
                <Download size={18} aria-hidden="true" /> Descargar la app
              </button>
              <small>Se agrega a la pantalla del celular y se abre como una app.</small>
              {installHint && (
                <p className="menu-install-hint" role="status">
                  {installHint}
                </p>
              )}
            </>
          )}
        </div>
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
