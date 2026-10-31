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
import { Footer } from './components/ui';

const VIEWS = ['home', 'laburos', 'oficios', 'cv', 'candidatos', 'avisos', 'admin'];
// Vuelta de Mercado Pago después de pagar la descarga del CV: /?pago=cv&status=approved...
const PAY_RETURN = (() => {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  if (q.get('pago') !== 'cv') return null;
  const status = q.get('status') || q.get('collection_status') || 'pending';
  window.history.replaceState(null, '', `${window.location.pathname}#/cv`);
  return status;
})();
// Si la persona llega desde el enlace de "Olvidé mi contraseña", Supabase lo marca en la dirección
const STARTED_IN_RECOVERY = typeof window !== 'undefined' && /type=recovery/.test(window.location.hash);

const readHash = () => {
  const h = window.location.hash.replace(/^#\/?/, '');
  return VIEWS.includes(h) ? h : 'home';
};

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [booting, setBooting] = useState(true);
  const [guest, setGuest] = useState(false);
  const [recovery, setRecovery] = useState(STARTED_IN_RECOVERY);
  const [rawView, setRawView] = useState(readHash);
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

  // Navegación por hash: #/laburos, #/oficios... (anda el botón "atrás")
  useEffect(() => {
    const onHash = () => {
      setRawView(readHash());
      setMenuOpen(false);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
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

  const view = links.some((l) => l.id === rawView) ? rawView : 'home';

  const go = (id) => {
    setMenuOpen(false);
    if (id === view) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.location.hash = id === 'home' ? '' : `/${id}`;
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await supabase.auth.signOut();
    setGuest(false);
    window.location.hash = '';
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

    const { error } = await supabase.from('applications').insert({ job_id: job.id });

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
  if (recovery) return <ResetPassword onDone={() => { setRecovery(false); window.location.hash = ''; }} />;
  if (!session && !guest) return <AuthScreen onGuest={() => setGuest(true)} />;

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
        {view === 'candidatos' && user && <Candidates />}
        {view === 'admin' && user?.isAdmin && <Admin notify={notify} onSettingsSaved={reloadSettings} />}
        {view === 'avisos' && user && <MyPosts key={refreshKey} user={user} settings={settings} onPublish={openPublish} notify={notify} />}
      </main>

      <Footer go={go} links={links} />

      {!modal && (
        <button className="fab" onClick={() => openPublish(defaultPublish)} aria-label="Publicar un aviso">
          <Plus size={22} /> Publicar
        </button>
      )}

      {modal && <PublishModal type={modal} intent={modalIntent} user={user} zone={zone} settings={settings} onClose={() => setModal(null)} onCreated={handleCreated} />}

      <div className={`toast${toast.show ? ' show' : ''}`} role="status" aria-live="polite">
        <i aria-hidden="true" />
        {toast.text}
      </div>
    </>
  );
}
