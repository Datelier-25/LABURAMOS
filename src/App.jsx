import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { supabase } from './supabaseClient';
import useSaved from './lib/useSaved';
import { useZone } from './lib/geo';
import { useSettings } from './lib/settings';
import AuthScreen from './components/AuthScreen';
import ResetPassword from './components/ResetPassword';
import Nav from './components/Nav';
import Home from './components/Home';
import JobList from './components/JobList';
import ServiceList from './components/ServiceList';
import MyResume from './components/MyResume';
import Candidates from './components/Candidates';
import MyPosts from './components/MyPosts';
import PublishModal from './components/PublishModal';
import Admin from './components/Admin';
import Safety from './components/Safety';
import Contacto from './components/Contacto';
import { Footer } from './components/ui';

const VIEWS = ['home', 'laburos', 'oficios', 'cv', 'candidatos', 'avisos', 'admin', 'seguridad', 'contacto'];
// Vuelta de Mercado Pago después de pagar la descarga del CV: /?pago=cv&status=approved...
const PAY_RETURN = (() => {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('pago') !== 'cv') return null;
  const status = q.get('status') || q.get('collection_status') || 'pending';
  window.history.replaceState(null, '', '/cv');
  return status;
})();
// Si la persona llega desde el enlace de "Olvidé mi contraseña", Supabase lo marca en la dirección
const STARTED_IN_RECOVERY = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

// Rutas sin #: /laburos, /oficios, /seguridad… (los enlaces viejos con #/ siguen andando)
const readView = () => {
  if (typeof window === 'undefined') return 'home';
  const h = window.location.hash.replace(/^#\/?/, '');
  if (VIEWS.includes(h)) return h;
  const p = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return VIEWS.includes(p) ? p : 'home';
};

const pathFor = (id) => (id === 'home' ? '/' : `/${id}`);

// Dominio público del sitio. Se configura por entorno (Netlify, Cloudflare Pages…) con
// VITE_SITE_URL; herramientas/postbuild.mjs usa el mismo valor para el sitemap y robots.
const SITE_URL = (import.meta.env?.VITE_SITE_URL || 'https://laburamosapp.netlify.app').replace(/\/+$/, '');

const TITLES = {
  home: 'LaburamosApp · Laburos, oficios y changas cerca tuyo',
  laburos: 'Laburos y ofertas de trabajo cerca tuyo · LaburamosApp',
  oficios: 'Oficios y servicios cerca tuyo · LaburamosApp',
  cv: 'Mi CV online · LaburamosApp',
  candidatos: 'Postulantes · LaburamosApp',
  avisos: 'Mis avisos · LaburamosApp',
  admin: 'Administración · LaburamosApp',
  seguridad: 'Consejos para operar seguro · LaburamosApp',
  contacto: 'Sugerencias y denuncias · LaburamosApp',
};
const DESCRIPTIONS = {
  home: 'Laburos, oficios y changas cerca tuyo. Comercios y vecinos publican avisos y el contacto es directo por WhatsApp.',
  laburos: 'Ofertas de trabajo de comercios y vecinos, por rubro y localidad. Postulate y que vean tu CV.',
  oficios: 'Plomeros, electricistas, clases, limpieza y más. Encontrá a quién te haga el trabajo o anunciá tu oficio.',
  cv: 'Armá tu CV online con tus oficios y habilidades, y compartilo con los comercios que buscan gente.',
  candidatos: 'Personas que se postularon a tus avisos, con su CV y contacto directo por WhatsApp.',
  avisos: 'Tus publicaciones y tus postulaciones en LaburamosApp.',
  admin: 'Panel de administración de LaburamosApp.',
  seguridad: 'Cómo cuidarte al buscar o publicar un trabajo: señales de alerta, pagos y referencias.',
  contacto: 'Enviá sugerencias, recomendaciones o denuncias sobre avisos y conductas a LaburamosApp.',
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [guest, setGuest] = useState(false);
  const [recovery, setRecovery] = useState(STARTED_IN_RECOVERY);
  const [rawView, setRawView] = useState(readView);
  const [zone, setZone, suggestZone] = useZone();
  const [settings, reloadSettings] = useSettings();
  const [modal, setModal] = useState(null); // 'job' | 'service' | null
  const [modalIntent, setModalIntent] = useState(null); // servicios: 'ofrece' | 'busca' | null (que elija)
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState({ text: '', show: false });
  const [saved, toggleSaved, pruneSaved] = useSaved();
  const toastTimer = useRef(null);

  const notify = useCallback((text) => {
    setToast({ text, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }, []);

  // Sesión de Supabase (se mantiene al recargar)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Navegación por ruta (/laburos, /oficios…) con el botón "atrás" del navegador
  useEffect(() => {
    const onPop = () => {
      setRawView(readView());
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    // Enlaces viejos con #/laburos: se normalizan a /laburos
    const h = window.location.hash.replace(/^#\/?/, '');
    if (VIEWS.includes(h)) window.history.replaceState(null, '', pathFor(h));
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const userId = session?.user?.id;

  // Perfil (rol y ciudad). El trigger lo crea al registrarse; reintentamos por si tarda.
  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return undefined;
    }
    let off = false;
    (async () => {
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (off) return;
        if (data) {
          setProfile(data);
          // La zona del perfil se usa solo si en este dispositivo todavía no se eligió otra
          if (data.city) suggestZone({ city: data.city, province: data.province || null });
          return;
        }
        await new Promise((r) => setTimeout(r, 700));
      }
    })();
    return () => {
      off = true;
    };
  }, [userId, suggestZone]);

  const meta = session?.user?.user_metadata || {};
  const user = session
    ? {
        id: session.user.id,
        email: session.user.email,
        name: profile?.full_name || meta.full_name || session.user.email.split('@')[0],
        role: profile?.role || (meta.role === 'company' ? 'company' : 'worker'),
        phone: profile?.phone || '',
        isAdmin: !!profile?.is_admin,
        isBlocked: !!profile?.is_blocked,
        isVerified: !!profile?.is_verified,
        verificationRequested: !!profile?.verification_requested,
        city: profile?.city || meta.city || null,
        province: profile?.province || meta.province || null,
      }
    : null;

  // Solo se muestran las secciones que le corresponden a cada tipo de usuario
  const links = [
    { id: 'home', label: 'Inicio' },
    { id: 'laburos', label: 'Laburos' },
    { id: 'oficios', label: 'Oficios' },
  ];
  if (user?.role === 'worker') links.push({ id: 'cv', label: 'Mi CV' });
  if (user?.role === 'company') links.push({ id: 'candidatos', label: 'Postulantes' });
  if (user) links.push({ id: 'avisos', label: 'Mis avisos' });
  if (user?.isAdmin) links.push({ id: 'admin', label: 'Admin' });

  const allowed = (id) => {
    if (id === 'cv') return user?.role === 'worker';
    if (id === 'candidatos') return user?.role === 'company';
    if (id === 'avisos') return !!user;
    if (id === 'admin') return !!user?.isAdmin;
    return true;
  };
  const view = VIEWS.includes(rawView) && allowed(rawView) ? rawView : 'home';

  // Título y descripción por vista (Google y las vistas previas de WhatsApp)
  useEffect(() => {
    document.title = TITLES[view] || TITLES.home;
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', DESCRIPTIONS[view] || DESCRIPTIONS.home);
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = `${SITE_URL}${pathFor(view)}`;
  }, [view]);

  const go = (id) => {
    setMenuOpen(false);
    if (id === view) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.history.pushState(null, '', pathFor(id));
    setRawView(id);
    window.scrollTo(0, 0);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    setGuest(false);
    window.history.replaceState(null, '', '/');
    setRawView('home');
  };

  // Un invitado que quiere postularse o publicar vuelve a la pantalla de ingreso
  const requireLogin = () => {
    setMenuOpen(false);
    setGuest(false);
  };

  const openPublish = (type, intent = null) => {
    if (!user) return requireLogin();
    setMenuOpen(false);
    setModalIntent(intent);
    return setModal(type);
  };

  // "Postularme": primero queda registrada la postulación (así la empresa ve el CV)
  // y recién después se abre WhatsApp. Si el registro falla no se abre nada, para
  // que nadie crea que se postuló cuando en realidad no quedó anotado.
  const applyTo = async (job, waUrl) => {
    if (!user || !job?.id) return;
    if (job.company_id === user.id) {
      notify('No podés postularte a un aviso propio.');
      return;
    }
    // La ventana se abre dentro del clic (si esperamos al insert, el navegador
    // puede bloquear la pestaña nueva). Si el insert falla de verdad, se cierra.
    const win = window.open('', '_blank');
    const openWhatsApp = () => {
      if (win && !win.closed) win.location.href = waUrl;
      else window.location.href = waUrl;
    };

    // email: para que la empresa pueda mandar el CV por Gmail. cv_contact: por qué canal se entregó.
    const { error } = await supabase.from('applications').insert({ job_id: job.id, email: user?.email || null, cv_contact: 'whatsapp' });

    if (!error) {
      notify('Postulación enviada. Tu CV ya está en Postulantes.');
      openWhatsApp();
      return;
    }
    if (error.code === '23505') {
      // Ya estaba postulado: la empresa ya tiene su CV, así que igual abrimos WhatsApp.
      notify('Ya te habías postulado a este aviso.');
      openWhatsApp();
      return;
    }

    if (win && !win.closed) win.close();
    if ((error.message || '').includes('aviso_no_disponible')) {
      notify('Este aviso ya no está disponible.');
      return;
    }
    notify('No pudimos registrar tu postulación. Probá de nuevo en un rato.');
  };

  const handleCreated = () => {
    setModal(null);
    setRefreshKey((k) => k + 1);
    notify('Publicado');
    go('avisos');
  };

  if (booting) return <div style={{ minHeight: '100svh', display: 'grid', placeItems: 'center' }}>Cargando…</div>;
  if (recovery)
    return (
      <ResetPassword
        onDone={() => {
          setRecovery(false);
          window.history.replaceState(null, '', '/');
          setRawView('home');
        }}
      />
    );
  if (!session && !guest) {
    // La página de consejos de seguridad y la de sugerencias son informativas:
    // se leen sin cuenta.
    if (view !== 'seguridad' && view !== 'contacto') return <AuthScreen onGuest={() => setGuest(true)} />;
  }

  // Cuenta bloqueada por el administrador: puede ver el sitio, pero no operar
  if (user?.isBlocked) {
    return (
      <section className="wrap page">
        <div className="blocked">
          <h1 className="page-title">Tu cuenta está bloqueada</h1>
          <p className="lede">
            Un administrador bloqueó esta cuenta, así que no puede publicar avisos ni postularse. Si creés que es un error, escribinos y lo revisamos.
          </p>
          <button className="btn btn-ink" onClick={handleLogout}>
            Salir
          </button>
        </div>
      </section>
    );
  }

  const defaultPublish = user?.role === 'company' ? 'job' : 'service';
  const common = { user, zone, setZone, settings, onPublish: openPublish, onLogin: requireLogin, onApply: applyTo, saved, onSave: toggleSaved, onPrune: pruneSaved };
  const zoneKey = `${zone.city}|${zone.province}`;

  return (
    <>
      <Nav
        user={user}
        view={view}
        go={go}
        links={links}
        onLogout={handleLogout}
        onLogin={requireLogin}
        onPublish={() => openPublish(defaultPublish)}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />

      <main>
        {view === 'home' && <Home key={refreshKey} {...common} go={go} />}
        {view === 'laburos' && <JobList key={`${refreshKey}-${zoneKey}`} {...common} />}
        {view === 'oficios' && <ServiceList key={`${refreshKey}-${zoneKey}`} {...common} />}
        {view === 'cv' && user && <MyResume user={user} zone={zone} notify={notify} payReturn={PAY_RETURN} />}
        {view === 'candidatos' && user && <Candidates user={user} notify={notify} />}
        {view === 'admin' && user?.isAdmin && <Admin notify={notify} onSettingsSaved={reloadSettings} />}
        {view === 'avisos' && user && <MyPosts key={refreshKey} user={user} settings={settings} onPublish={openPublish} notify={notify} />}
        {view === 'seguridad' && <Safety go={go} />}
        {view === 'contacto' && <Contacto settings={settings} notify={notify} />}
      </main>

      <Footer go={go} links={[...links, { id: 'seguridad', label: 'Consejos de seguridad' }, { id: 'contacto', label: 'Sugerencias / Denuncias' }]} />

      {!modal && (
        <button className="fab" onClick={() => openPublish(defaultPublish)} aria-label="Publicar un aviso">
          <Plus size={22} /> Publicar
        </button>
      )}

      {modal && <PublishModal type={modal} intent={modalIntent} user={user} zone={zone} settings={settings} onClose={() => setModal(null)} onCreated={handleCreated} onSafety={() => { setModal(null); go('seguridad'); }} />}

      <div className={`toast${toast.show ? ' show' : ''}`} role="status" aria-live="polite">
        <i aria-hidden="true" />
        {toast.text}
      </div>
    </>
  );
}
