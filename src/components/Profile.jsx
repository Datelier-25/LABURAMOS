import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BadgeCheck, Camera, KeyRound, Mail, ShieldAlert, Trash2, UserRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { cleanPhone, friendlyError, isValidPhone } from '../lib/utils';
import AvatarCropper from './AvatarCropper';

// Carpetas del usuario en cada bucket que hay que vaciar al eliminar la cuenta
const USER_BUCKETS = ['avatars', 'cv-photos', 'ad-videos', 'ad-images'];
const CONFIRM_WORD = 'ELIMINAR';

export default function Profile({ user, notify, onUpdated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', city: '', province: '', phone: '' });
  const [saved, setSaved] = useState({ full_name: '', city: '', province: '', phone: '' });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const [verified, setVerified] = useState(false);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [pwd, setPwd] = useState({ newPwd: '', confirm: '' });
  const [pwdBusy, setPwdBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [activeAds, setActiveAds] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      // Campañas pagas y vigentes: impiden eliminar la cuenta
      const { count } = await supabase
        .from('ad_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('payment_status', 'paid')
        .eq('active', true)
        .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`);
      if (off) return;
      if (data) {
        const base = {
          full_name: data.full_name || '',
          city: data.city || '',
          province: data.province || '',
          phone: data.phone || '',
        };
        setForm(base);
        setSaved(base);
        setAvatarUrl(data.avatar_url || '');
        setVerified(!!data.is_verified);
        setVerificationRequested(!!data.verification_requested);
      }
      setActiveAds(count || 0);
      setLoading(false);
    })();
    return () => {
      off = true;
    };
  }, [user.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const dirty = useMemo(() => Object.keys(saved).some((k) => (form[k] || '') !== (saved[k] || '')), [form, saved]);

  // Progreso del perfil: qué tan completo está y qué le falta
  const checklist = [
    { label: 'Foto de perfil', done: !!avatarUrl },
    { label: 'Nombre y apellido', done: !!form.full_name.trim() },
    { label: 'WhatsApp', done: !!form.phone.trim() },
    { label: 'Ciudad', done: !!form.city.trim() },
    { label: 'Verificación solicitada', done: verified || verificationRequested },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const percent = Math.round((doneCount / checklist.length) * 100);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (form.phone && !isValidPhone(form.phone)) {
      setError('Ingresá un WhatsApp válido: código de área y número, sin 0 ni 15.');
      return;
    }
    setSaving(true);
    const phone = form.phone ? cleanPhone(form.phone) : null;
    const next = {
      full_name: form.full_name.trim() || null,
      city: form.city.trim() || null,
      province: form.province.trim() || null,
      phone,
    };
    const { error: err } = await supabase.from('profiles').update(next).eq('id', user.id);
    setSaving(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    setSaved({ full_name: next.full_name || '', city: next.city || '', province: next.province || '', phone: phone || '' });
    notify('Perfil actualizado');
    onUpdated?.(next);
  };

  const pickAvatar = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('La foto tiene que ser JPG, PNG o WebP.');
      return;
    }
    setError('');
    setCropFile(file);
  };

  const uploadAvatar = async (blob) => {
    setCropFile(null);
    setAvatarBusy(true);
    setError('');
    try {
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '0' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = `${data.publicUrl}?v=${Date.now()}`;
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (dbErr) throw dbErr;
      setAvatarUrl(url);
      notify('Foto de perfil actualizada');
      onUpdated?.({ avatar_url: url });
    } catch (err) {
      setError(friendlyError(err?.message || 'No pudimos subir la foto.'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await supabase.storage.from('avatars').remove([`${user.id}/avatar.jpg`]);
      await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id);
      setAvatarUrl('');
      notify('Foto de perfil quitada');
      onUpdated?.({ avatar_url: null });
    } catch (err) {
      setError(friendlyError(err?.message));
    } finally {
      setAvatarBusy(false);
    }
  };

  const requestVerification = async () => {
    setRequesting(true);
    setError('');
    const { error: err } = await supabase.rpc('request_verification');
    setRequesting(false);
    if (err) setError(friendlyError(err.message));
    else {
      setVerificationRequested(true);
      notify('Solicitud de verificación enviada');
    }
  };

  const pwdHint =
    pwd.newPwd.length === 0
      ? 'Mínimo 6 caracteres.'
      : pwd.newPwd.length < 6
        ? 'Todavía corta: mínimo 6 caracteres.'
        : pwd.newPwd !== pwd.confirm && pwd.confirm
          ? 'Las contraseñas todavía no coinciden.'
          : 'Lista para guardar.';

  const changePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (pwd.newPwd.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (pwd.newPwd !== pwd.confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setPwdBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pwd.newPwd });
    setPwdBusy(false);
    if (err) setError(friendlyError(err.message));
    else {
      setPwd({ newPwd: '', confirm: '' });
      notify('Contraseña actualizada');
    }
  };

  // Elimina la cuenta: primero lista los archivos (si la función falla, no se borra nada),
  // después llama a la base y, si todo salió bien, vacía los buckets y cierra la sesión.
  const deleteAccount = async () => {
    if (deleteText !== CONFIRM_WORD) return;
    setDeleting(true);
    setError('');
    const files = [];
    for (const bucket of USER_BUCKETS) {
      const { data } = await supabase.storage.from(bucket).list(user.id, { limit: 1000 });
      (data || []).forEach((f) => files.push({ bucket, path: `${user.id}/${f.name}` }));
    }

    const { error: err } = await supabase.rpc('delete_my_account');
    if (err) {
      setDeleting(false);
      const msg = String(err.message || '');
      setError(
        msg.includes('anuncios_activos')
          ? 'Tenés anuncios pagos que todavía se están mostrando. Podés eliminar la cuenta cuando terminen, o escribinos desde Sugerencias.'
          : friendlyError(msg)
      );
      return;
    }

    for (const bucket of USER_BUCKETS) {
      const paths = files.filter((f) => f.bucket === bucket).map((f) => f.path);
      if (paths.length) await supabase.storage.from(bucket).remove(paths);
    }
    await supabase.auth.signOut({ scope: 'local' });
    setDeleting(false);
  };

  if (loading) return <section className="wrap page"><p className="count">Cargando…</p></section>;

  const verState = verified ? 'verified' : verificationRequested ? 'pending' : 'unverified';
  const verLabel = verified ? 'Verificado' : verificationRequested ? 'En proceso' : 'No verificado';
  const typeLabel = user.role === 'company' ? 'Comercio' : 'Trabajador/a';

  return (
    <section className="wrap page profile-page">
      <header className="profile-hero">
        <span className="profile-avatar" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={40} />}
        </span>
        <div className="profile-hero-text">
          <h1 className="page-title">{form.full_name || user.name || 'Mi perfil'}</h1>
          <p className="profile-meta">
            <span className="chip-s">{typeLabel}</span>
            <span className={`rep-ver ${verState}`}>{verLabel}</span>
          </p>
          <p className="profile-mail">
            <Mail size={15} aria-hidden="true" /> {user.email}
          </p>
        </div>
        <div className="profile-progress" aria-label={`Perfil completo al ${percent} por ciento`}>
          <span className="profile-progress-top">
            <b>{percent}%</b> del perfil completo
          </span>
          <span className="profile-bar">
            <i style={{ width: `${percent}%` }} />
          </span>
          <ul className="profile-checks">
            {checklist.map((c) => (
              <li key={c.label} className={c.done ? 'ok' : ''}>
                {c.done ? '✓' : '○'} {c.label}
              </li>
            ))}
          </ul>
        </div>
      </header>

      {error && <p className="note err">{error}</p>}

      <div className="profile-grid">
        <section className="panel-card">
          <h2 className="panel-title"><Camera size={18} aria-hidden="true" /> Foto de perfil</h2>
          <div className="avatar-row">
            <span className="avatar-big">
              {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={36} aria-hidden="true" />}
            </span>
            <div className="avatar-actions">
              <label className="btn btn-line btn-sm avatar-pick">
                {avatarBusy ? 'Subiendo…' : 'Cambiar foto'}
                <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickAvatar} disabled={avatarBusy} />
              </label>
              {avatarUrl && (
                <button type="button" className="btn btn-line btn-sm" onClick={removeAvatar} disabled={avatarBusy}>
                  Quitar
                </button>
              )}
            </div>
          </div>
          <small className="panel-hint">JPG, PNG o WebP, hasta 2 MB. Después podés encuadrarla dentro del círculo.</small>
        </section>

        <section className="panel-card">
          <h2 className="panel-title"><BadgeCheck size={18} aria-hidden="true" /> Verificación</h2>
          <p className="panel-text">
            {verified
              ? 'Tu cuenta fue revisada por LaburamosApp. El sello aparece en tus avisos.'
              : verificationRequested
                ? 'Tu solicitud está en revisión. Te avisamos cuando esté lista.'
                : 'Pedí la verificación para mostrar el sello y generar más confianza.'}
          </p>
          {!verified && !verificationRequested && (
            <button type="button" className="btn btn-ink btn-sm" onClick={requestVerification} disabled={requesting}>
              {requesting ? 'Enviando…' : 'Solicitar verificación'}
            </button>
          )}
        </section>

        <form className="panel-card panel-wide" onSubmit={save}>
          <h2 className="panel-title"><UserRound size={18} aria-hidden="true" /> Datos personales</h2>
          <div className="two">
            <label className="field">
              <span>Nombre y apellido</span>
              <input value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} placeholder="Tu nombre" autoComplete="name" />
            </label>
            <label className="field">
              <span>WhatsApp</span>
              <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="2342112233" inputMode="tel" />
              <small>Código de área y número, sin 0 ni 15.</small>
            </label>
          </div>
          <div className="two">
            <label className="field">
              <span>Ciudad</span>
              <input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="Bragado" />
            </label>
            <label className="field">
              <span>Provincia</span>
              <input value={form.province} onChange={(e) => set({ province: e.target.value })} placeholder="Buenos Aires" />
            </label>
          </div>
          <div className="panel-actions">
            <button type="submit" className="btn btn-ink" disabled={saving || !dirty}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
            {dirty && !saving && <span className="panel-hint">Tenés cambios sin guardar.</span>}
          </div>
        </form>

        <form className="panel-card" onSubmit={changePassword}>
          <h2 className="panel-title"><KeyRound size={18} aria-hidden="true" /> Contraseña</h2>
          <label className="field">
            <span>Nueva contraseña</span>
            <input type="password" value={pwd.newPwd} onChange={(e) => setPwd((p) => ({ ...p, newPwd: e.target.value }))} autoComplete="new-password" />
          </label>
          <label className="field">
            <span>Repetir contraseña</span>
            <input type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" />
          </label>
          <p className="panel-hint">{pwdHint}</p>
          <button type="submit" className="btn btn-line btn-sm" disabled={pwdBusy || pwd.newPwd.length < 6 || pwd.newPwd !== pwd.confirm}>
            {pwdBusy ? 'Actualizando…' : 'Actualizar contraseña'}
          </button>
        </form>

        <section className="panel-card panel-danger panel-wide">
          <h2 className="panel-title"><ShieldAlert size={18} aria-hidden="true" /> Zona de peligro</h2>
          <p className="panel-text">
            Podés eliminar tu cuenta cuando quieras. Se borran tu perfil, tus avisos, servicios, postulaciones, reseñas, CV, fotos y
            videos de anuncios. <b>No se puede deshacer.</b>
          </p>
          {activeAds > 0 && (
            <p className="note err">
              <AlertTriangle size={16} aria-hidden="true" /> Tenés {activeAds} anuncio{activeAds === 1 ? '' : 's'} pago{activeAds === 1 ? '' : 's'} todavía vigente{activeAds === 1 ? '' : 's'}. Hasta que termine, no se puede eliminar la cuenta.
            </p>
          )}
          <button type="button" className="btn btn-danger" onClick={() => { setDeleteText(''); setError(''); setDeleteOpen(true); }}>
            <Trash2 size={16} aria-hidden="true" /> Eliminar mi cuenta
          </button>
        </section>
      </div>

      {deleteOpen && (
        <div className="confirm-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !deleting) setDeleteOpen(false); }}>
          <div className="confirm-box" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <button type="button" className="confirm-x" onClick={() => setDeleteOpen(false)} disabled={deleting} aria-label="Cerrar">
              <X size={18} aria-hidden="true" />
            </button>
            <h2 id="delete-title">¿Eliminar tu cuenta?</h2>
            <p>Se van a borrar de forma permanente:</p>
            <ul className="confirm-list">
              <li>Tu perfil, foto y datos de contacto</li>
              <li>Tus avisos, servicios y postulaciones</li>
              <li>Tus reseñas y tu CV, con sus fotos</li>
              <li>Tus anuncios en video que no estén pagos</li>
              <li>Tus datos personales asociados a los pagos de CV (los pagos se conservan sin tu nombre, por registro contable)</li>
            </ul>
            <label className="field">
              <span>Para confirmar, escribí {CONFIRM_WORD}</span>
              <input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} autoComplete="off" disabled={deleting} />
            </label>
            <div className="confirm-actions">
              <button type="button" className="btn btn-line" onClick={() => setDeleteOpen(false)} disabled={deleting}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={deleteAccount} disabled={deleting || deleteText !== CONFIRM_WORD || activeAds > 0}>
                {deleting ? 'Eliminando…' : 'Eliminar definitivamente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cropFile && <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onDone={uploadAvatar} />}
    </section>
  );
}
