import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
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
import Profile from './components/Profile';
import PublishModal from './components/PublishModal';
import ApplyModal from './components/ApplyModal';
import Admin from './components/Admin';
import Safety from './components/Safety';
import Contacto from './components/Contacto';
import ZoneWelcome from './components/ZoneWelcome';
import ReportModal from './components/ReportModal';
import { Footer } from './components/ui';

const VIEWS = ['home', 'laburos', 'oficios', 'cv', 'candidatos', 'avisos', 'perfil', 'admin', 'seguridad', 'contacto'];
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
  const parts = h.split('/');
  const deepHit = parts[0] === 'aviso' && parts[1] && parts[2];
  if (deepHit) return parts[1] === 'svc' ? 'oficios' : 'laburos';
  if (VIEWS.includes(h)) return h;
  const p = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return VIEWS.includes(p) ? p : 'home';
};

// Enlace profundo a un aviso: /#/aviso/<job|svc>/<uuid> → { kind, id, view }
const readDeep = () => {
  if (typeof window === 'undefined') return null;
  const parts = window.location.hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'aviso' && parts[1] && parts[2]) {
    const kind = parts[1] === 'svc' ? 'service' : 'job';
    const id = parts[2];
    return { kind, id, view: kind === 'service' ? 'oficios' : 'laburos' };
  }
  return null;
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
  perfil: 'Mi perfil · LaburamosApp',
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
  perfil: 'Tus datos, tu foto y tu verificación en LaburamosApp.',
  admin: 'Panel de administración de LaburamosApp.',
  seguridad: 'Cómo cuidarte al buscar o publicar un trabajo: señales de alerta, pagos y referencias.',
  contacto: 'Enviá sugerencias, recomendaciones o denuncias sobre avisos y conductas a LaburamosApp.',
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [zoneOpen, setZoneOpen] = useState(false);
  const [reportFor, setReportFor] = useState(null);
  const [recovery, setRecovery] = useState(STARTED_IN_RECOVERY);
  const [rawView, setRawView] = useState(readView);
  const [deep, setDeep] = useState(readDeep);
  const [zone, setZone, suggestZone, zoneChosen] = useZone();
  const [settings, reloadSettings] = useSettings();
  const [modal, setModal] = useState(null); // 'job' | 'service' | null
  const [modalIntent, setModalIntent] = useState(null); // servicios: 'ofrece' | 'busca' | null (que elija)
  const [applyFor, setApplyFor] = useState(null); // { job, waUrl } mientras elige el CV
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState({ text: '', show: false });
  const [saved, toggleSaved, pruneSaved] = useSaved();
  const [savedSvc, toggleSavedSvc] = useSaved('tb_saved_services');
  const toastTimer = useRef(null);

  const notify = useCallback((text) => {
    setToast({ text, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }, []);

  // Si abrimos el ingreso (modal), bloqueamos el scroll del fondo
  useEffect(() => {
    if (!authOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [authOpen]);

  // La sesión de Supabase cierra el ingreso después de loguearse
  useEffect(() => {
    if (session) setAuthOpen(false);
  }, [session]);

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
      setDeep(readDeep());
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('popstate', onPop);
    // Enlaces viejos con #/laburos: se normalizan a /laburos
    const h = window.location.hash.replace(/^#\/?/, '');
    if (VIEWS.includes(h)) window.history.replaceState(null, '', pathFor(h));
    const onDeep = () => setDeep(readDeep());
    onDeep();
    window.addEventListener('hashchange', onDeep);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('hashchange', onDeep);
    };
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
  if (user) links.push({ id: 'perfil', label: 'Mi perfil' });
  if (user) links.push({ id: 'avisos', label: 'Mis avisos' });
  if (user?.isAdmin) links.push({ id: 'admin', label: 'Admin' });

  const allowed = (id) => {
    if (id === 'cv') return user?.role === 'worker';
    if (id === 'candidatos') return user?.role === 'company';
    if (id === 'avisos') return !!user;
    if (id === 'perfil') return !!user;
    if (id === 'admin') return !!user?.isAdmin;
    return true;
  };
  const allowedRaw = VIEWS.includes(rawView) && allowed(rawView) ? rawView : 'home';
  // Un enlace compartido (/#/aviso/<job|svc>/<uuid>) manda: lleva a la lista correcta y al aviso puntual.
  const view = deep && deep.id ? deep.view : allowedRaw;

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
    // Enlaces profundos a un aviso: aviso:job:<uuid> | aviso:svc:<uuid> → /#/aviso/<kind>/<uuid>
    if (typeof id === 'string' && id.startsWith('aviso:')) {
      const parts = id.split(':');
      const kind = parts[1] === 'svc' ? 'service' : 'job';
      const base = kind === 'service' ? 'oficios' : 'laburos';
      window.history.pushState(null, '', `/${base}#/aviso/${kind === 'service' ? 'svc' : 'job'}/${parts[2]}`);
      setRawView(base);
      setDeep({ kind, id: parts[2], view: base });
      window.scrollTo(0, 0);
      return;
    }
    window.history.pushState(null, '', pathFor(id));
    setRawView(id);
    setDeep(null);
    window.scrollTo(0, 0);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    window.history.replaceState(null, '', '/');
    setRawView('home');
    setDeep(null);
  };

  // Ingreso como ventana (no reemplaza la experiencia pública): se cierra para
  // seguir mirando o seguir navegando. Al loguearse se cierra solo.
  const requireLogin = (mode) => {
    setMenuOpen(false);
    setAuthMode(mode === 'register' ? 'register' : 'login');
    setAuthOpen(true);
  };

  const toggleSavedGated = (id) => {
    // Guardar avisos también requiere cuenta: abre el ingreso, no reemplaza la experiencia.
    if (!user) return requireLogin();
    toggleSaved(id);
  };

  const toggleSavedSvcGated = (id) => {
    // Guardar servicios pide cuenta igual que los avisos de trabajo.
    if (!user) return requireLogin();
    toggleSavedSvc(id);
  };

  const openPublish = (type, intent = null) => {
    if (!user) return requireLogin();
    setMenuOpen(false);
    setModalIntent(intent);
    return setModal(type);
  };

  // "Postularme": abre el paso donde se elige el CV (el de la app o un PDF).
  // El envío y la apertura de WhatsApp se hacen en ApplyModal.
  const openApply = (job, waUrl) => {
    if (!user) return requireLogin();
    if (!job?.id) return;
    if (job.company_id === user.id) {
      notify('No podés postularte a un aviso propio.');
      return;
    }
    setApplyFor({ job, waUrl });
  };

  const handleCreated = () => {
    setModal(null);
    setRefreshKey((k) => k + 1);
    notify('Publicado');
    go('avisos');
  };

  // Pregunta la zona en la primera visita pública. Quien no vaya a elegir (o
  // elige "ver todo") se queda con toda la Argentina. Las vistas informativas
  // no la preguntan.
  useEffect(() => {
    const informational = view === 'seguridad' || view === 'contacto';
    if (booting || user || zoneChosen || authOpen || modal || applyFor || informational) return undefined;
    // Si la zona ya fue elegida o el usuario está navegando, no abrimos el modal
    if (zoneChosen || zone?.city || zone?.province) return undefined;
    const t = setTimeout(() => setZoneOpen(true), 900);
    return () => clearTimeout(t);
  }, [booting, user, zoneChosen, authOpen, modal, applyFor, view, zone?.city, zone?.province]);

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
  const common = { user, zone, setZone, settings, onPublish: openPublish, onLogin: requireLogin, onApply: openApply, saved, onSave: toggleSavedGated, savedSvc, onSaveSvc: toggleSavedSvcGated, onPrune: pruneSaved, deep: deep && deep.id ? deep : null, onReport: (jobOrService) => setReportFor(jobOrService) };
  const zoneKey = `${zone.city}|${zone.province}`;

  return (
    <>
      <Nav
        user={user}
        profile={profile}
        view={view}
        go={go}
        links={links}
        onLogout={handleLogout}
        onLogin={(mode) => requireLogin(mode)}
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
        {view === 'perfil' && user && <Profile user={user} notify={notify} onUpdated={(patch) => setProfile((p) => ({ ...p, ...patch }))} />}
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

      {applyFor && (
        <ApplyModal
          job={applyFor.job}
          user={user}
          waUrl={applyFor.waUrl}
          notify={notify}
          onClose={() => setApplyFor(null)}
          onDone={() => setApplyFor(null)}
          onEditCv={() => {
            setApplyFor(null);
            go('cv');
          }}
        />
      )}

      {zoneOpen && !user && (
        <ZoneWelcome
          onPick={(z) => {
            setZone(z);
            setZoneOpen(false);
          }}
          onClose={() => {
            // Cerrar = elegir "ver todo el país"
            setZone({ city: null, province: null });
            setZoneOpen(false);
          }}
        />
      )}

      {authOpen && !session && (
        <div className="auth-overlay">
          <button type="button" className="auth-close" onClick={() => setAuthOpen(false)} aria-label="Seguir mirando">
            <span aria-hidden="true">Seguir mirando</span>
            <X size={14} aria-hidden="true" />
          </button>
          <AuthScreen onGuest={() => setAuthOpen(false)} initialMode={authMode} />
        </div>
      )}

      {reportFor && <ReportModal report={reportFor} onClose={() => setReportFor(null)} notify={notify} />}

      <div className={`toast${toast.show ? ' show' : ''}`} role="status" aria-live="polite">
        <i aria-hidden="true" />
        {toast.text}
      </div>
    </>
  );
}
