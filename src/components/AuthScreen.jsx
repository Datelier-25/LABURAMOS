import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';
import JobSign from './Sign';
import Logo from './Logo';
import { PasswordField } from './ui';
import LegalConsent from './LegalConsent';
import { consentReady, registrationLegalData } from '../lib/legal';
import { PlaceField } from './Place';

export default function AuthScreen({ onGuest, initialMode = 'login' }) {
  const [mode, setMode] = useState(initialMode); // 'login' | 'register' | 'forgot' | 'solo'
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'ok' | 'err', text }
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'worker', place: null });
  const [consent, setConsent] = useState({ terms: false, privacy: false });

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const switchMode = (next) => {
    setMode(next);
    setMessage(null);
  };
  const seguirMirando = () => onGuest?.();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (mode === 'register') {
      if (!form.place?.city) {
        setMessage({ type: 'err', text: 'Elegí tu localidad.' });
        setLoading(false);
        return;
      }
      if (!consentReady(consent)) {
        setMessage({ type: 'err', text: 'Para crear la cuenta tenés que aceptar los Términos y la Política de Privacidad.' });
        setLoading(false);
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        // El trigger de la base lee estos datos para crear el perfil y dejar
        // registrada la aceptación de los documentos legales.
        options: {
          data: {
            full_name: form.name.trim(),
            role: form.role,
            city: form.place.city,
            province: form.place.province,
            ...registrationLegalData(),
          },
        },
      });
      if (error) {
        setMessage({ type: 'err', text: friendlyError(error.message) });
      } else if (data.user && data.user.identities && data.user.identities.length === 0) {
        setMessage({ type: 'err', text: 'Ese email ya está registrado. Probá iniciar sesión.' });
      } else if (!data.session) {
        setMessage({ type: 'ok', text: 'Cuenta creada. Te mandamos un email para confirmarla; cuando lo hagas, ingresá.' });
        setMode('login');
      }
    } else if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email.trim(), { redirectTo: window.location.origin });
      if (error) setMessage({ type: 'err', text: friendlyError(error.message) });
      else setMessage({ type: 'ok', text: 'Si ese email está registrado, te enviamos un enlace para crear una contraseña nueva. Revisá también el spam.' });
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
      if (error) setMessage({ type: 'err', text: friendlyError(error.message) });
    }
    setLoading(false);
  };

  const demo = (title, company, category, type, location) => ({
    category,
    title,
    company_name: company,
    location,
    job_type: type,
  });

  const titles = {
    login: ['Qué bueno verte', 'Ingresá para postularte, armar tu CV o publicar avisos.'],
    register: ['Creá tu cuenta', 'Tarda un minuto. Después contactás directo por WhatsApp.'],
    forgot: ['Recuperá tu acceso', 'Escribí tu email y te mandamos un enlace para elegir una contraseña nueva.'],
  };

  return (
    <div className="auth">
      <div className="auth-art">
        <span className="brand">
          <Logo variant="claro" size={48} />
        </span>
        <h1>
          Encontrá <em>lo que venís a buscar.</em>
        </h1>
        <div className="signs-deco" aria-hidden="true">
          <JobSign compact job={demo('Se busca vendedor/a', 'Comercio El Sol', 'Comercio', 'Part-time', 'Rosario')} />
          <JobSign compact job={demo('Plomero matriculado', 'Juan Pérez', 'Oficios / Técnico', 'Changa', 'Bragado')} />
        </div>
      </div>

      <div className="auth-form">
        <div className="auth-box">
          <div className="seg" role="group" aria-label="Elegir cómo entrar">
            <button type="button" className={mode === 'login' || mode === 'forgot' ? 'on' : ''} onClick={() => switchMode('login')}>
              Ingresar
            </button>
            <button type="button" className={mode === 'register' ? 'on' : ''} onClick={() => switchMode('register')}>
              Crear cuenta
            </button>
            <button type="button" onClick={seguirMirando}>
              Seguir mirando
            </button>
          </div>

          <p className="auth-note">Podés cerrar esta ventana y seguir mirando. La cuenta la pedimos solo cuando querés postular, guardar, contactar o publicar.</p>

          <h2>{titles[mode][0]}</h2>
          <p>{titles[mode][1]}</p>

          {message && <p className={`note ${message.type}`}>{message.text}</p>}

          <form onSubmit={handleSubmit}>
            {mode === 'register' && (
              <>
                <div className="field">
                  <span>Soy</span>
                  <div className="tiles">
                    <button type="button" className={`tile${form.role === 'worker' ? ' on' : ''}`} onClick={() => set({ role: 'worker' })} aria-pressed={form.role === 'worker'}>
                      <b>Vecino</b>
                      <small>Busco trabajo, ofrezco o contrato servicios</small>
                    </button>
                    <button type="button" className={`tile${form.role === 'company' ? ' on' : ''}`} onClick={() => set({ role: 'company' })} aria-pressed={form.role === 'company'}>
                      <b>Comercio</b>
                      <small>Busco personal y ofrezco mis servicios</small>
                    </button>
                  </div>
                </div>
                <label className="field">
                  <span>{form.role === 'company' ? 'Nombre del comercio' : 'Nombre y apellido'}</span>
                  <input required value={form.name} onChange={(e) => set({ name: e.target.value })} autoComplete="name" />
                </label>
                <PlaceField value={form.place} onChange={(place) => set({ place })} required />
                <LegalConsent value={consent} onChange={setConsent} />
                <p className="panel-hint">Pedimos solo lo necesario para crear tu cuenta y mostrarte avisos de tu zona.</p>
              </>
            )}

            <label className="field">
              <span>Email</span>
              <input type="email" required autoComplete="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </label>

            {mode !== 'forgot' && (
              <PasswordField
                label="Contraseña"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={(e) => set({ password: e.target.value })}
                hint={mode === 'register' ? 'Mínimo 6 caracteres.' : undefined}
              />
            )}

            <button className="btn btn-ink btn-lg btn-block" disabled={loading}>
              {loading ? 'Un segundo…' : mode === 'login' ? 'Ingresar' : mode === 'register' ? 'Crear mi cuenta' : 'Enviar enlace'}
            </button>
          </form>

          <p className="auth-alt">
            {mode === 'login' && (
              <button type="button" className="textbtn" onClick={() => switchMode('forgot')}>
                Olvidé mi contraseña
              </button>
            )}
            {mode === 'forgot' && (
              <button type="button" className="textbtn" onClick={() => switchMode('login')}>
                Volver a ingresar
              </button>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
