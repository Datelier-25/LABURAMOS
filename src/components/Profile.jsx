import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { cleanPhone, friendlyError, isValidPhone } from '../lib/utils';
import { compressImage } from '../lib/photos';

export default function Profile({ user, notify, onUpdated }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ full_name: '', city: '', province: '', phone: '' });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verificationRequested, setVerificationRequested] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [pwd, setPwd] = useState({ newPwd: '', confirm: '' });
  const [pwdBusy, setPwdBusy] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (off) return;
      if (data) {
        setForm({
          full_name: data.full_name || '',
          city: data.city || '',
          province: data.province || '',
          phone: data.phone || '',
        });
        setAvatarUrl(data.avatar_url || '');
        setVerified(!!data.is_verified);
        setVerificationRequested(!!data.verification_requested);
      }
      setLoading(false);
    })();
    return () => { off = true; };
  }, [user.id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (form.phone && !isValidPhone(form.phone)) {
      setError('Ingresá un WhatsApp válido: código de área y número, sin 0 ni 15.');
      return;
    }
    setSaving(true);
    const phone = form.phone ? cleanPhone(form.phone) : null;
    const { error: err } = await supabase.from('profiles').update({
      full_name: form.full_name.trim() || null,
      city: form.city.trim() || null,
      province: form.province.trim() || null,
      phone,
    }).eq('id', user.id);
    setSaving(false);
    if (err) setError(friendlyError(err.message));
    else {
      notify('Perfil actualizado');
      onUpdated?.({ full_name: form.full_name.trim() || null, city: form.city.trim() || null, province: form.province.trim() || null, phone });
    }
  };

  const uploadAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarBusy(true);
    setError('');
    try {
      const blob = await compressImage(file, 512, 0.85);
      const path = `${user.id}/avatar.jpg`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const url = data.publicUrl;
      const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', user.id);
      if (dbErr) throw dbErr;
      setAvatarUrl(url);
      notify('Foto de perfil actualizada');
      onUpdated?.({ avatar_url: url });
    } catch (err) {
      setError(friendlyError(err?.message || 'No pudimos subir la foto.'));
    } finally {
      setAvatarBusy(false);
      e.target.value = '';
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

  const changePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (pwd.newPwd.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (pwd.newPwd !== pwd.confirm) { setError('Las contraseñas no coinciden.'); return; }
    setPwdBusy(true);
    const { error: err } = await supabase.auth.updateUser({ password: pwd.newPwd });
    setPwdBusy(false);
    if (err) setError(friendlyError(err.message));
    else { setPwd({ newPwd: '', confirm: '' }); notify('Contraseña actualizada'); }
  };

  if (loading) return <section className="wrap page"><p className="count">Cargando…</p></section>;

  const verState = verified ? 'verified' : verificationRequested ? 'pending' : 'unverified';
  const verLabel = verified ? 'Verificado' : verificationRequested ? 'En proceso' : 'No verificado';

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Mi perfil</h1>
          <p className="lede">Tus datos, tu foto y el estado de verificación. Se usan en tus avisos y en las postulaciones.</p>
        </div>
      </header>
      {error && <p className="note err">{error}</p>}

      <div style={{ display: 'grid', gap: 24, maxWidth: 640 }}>
        <div className="field">
          <span>Foto de perfil</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <span style={{ width: 88, height: 88, borderRadius: '50%', overflow: 'hidden', background: 'var(--mist)', display: 'grid', placeItems: 'center', border: '2px solid var(--line)' }}>
              {avatarUrl ? <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: '2.2rem', color: 'var(--muted)' }}>👤</span>}
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <label className="btn btn-line btn-sm" style={{ cursor: 'pointer' }}>
                {avatarBusy ? 'Subiendo…' : 'Cambiar foto'}
                <input type="file" accept="image/*" hidden onChange={uploadAvatar} disabled={avatarBusy} />
              </label>
              {avatarUrl && <button type="button" className="btn btn-line btn-sm" onClick={removeAvatar} disabled={avatarBusy}>Quitar</button>}
            </div>
          </div>
          <small>JPG/PNG/WebP, hasta 2 MB. Se reduce a 512 px.</small>
        </div>

        <div className="field">
          <span>Verificación de cuenta</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className={`rep-ver ${verState}`} style={{ fontSize: '0.85rem' }}>{verLabel}</span>
            {!verified && !verificationRequested && (
              <button type="button" className="btn btn-ink btn-sm" onClick={requestVerification} disabled={requesting}>
                {requesting ? 'Enviando…' : 'Solicitar verificación'}
              </button>
            )}
          </div>
          <small>
            {verified
              ? 'Tu cuenta fue revisada por LaburamosApp.'
              : verificationRequested
              ? 'Tu solicitud está en revisión. Te avisamos cuando esté lista.'
              : 'Pedí la verificación para mostrar el sello y generar más confianza.'}
          </small>
        </div>

        <form onSubmit={save}>
          <label className="field">
            <span>Nombre y apellido</span>
            <input value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} placeholder="Tu nombre" />
          </label>
          <label className="field">
            <span>WhatsApp</span>
            <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="2342112233" inputMode="tel" />
            <small>Código de área y número, sin 0 ni 15.</small>
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="field">
              <span>Ciudad</span>
              <input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="Bragado" />
            </label>
            <label className="field">
              <span>Provincia</span>
              <input value={form.province} onChange={(e) => set({ province: e.target.value })} placeholder="Buenos Aires" />
            </label>
          </div>
          <button type="submit" className="btn btn-ink" disabled={saving}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </form>

        <form onSubmit={changePassword}>
          <h2 style={{ fontSize: '1.3rem', margin: '0 0 10px' }}>Cambiar contraseña</h2>
          <label className="field">
            <span>Nueva contraseña</span>
            <input type="password" value={pwd.newPwd} onChange={(e) => setPwd((p) => ({ ...p, newPwd: e.target.value }))} placeholder="Mínimo 6 caracteres" />
          </label>
          <label className="field">
            <span>Repetir contraseña</span>
            <input type="password" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} />
          </label>
          <button type="submit" className="btn btn-line" disabled={pwdBusy}>{pwdBusy ? 'Actualizando…' : 'Actualizar contraseña'}</button>
        </form>

        <div>
          <span className="chip-s">Tipo de cuenta: {user.role === 'company' ? 'Comercio' : 'Trabajador/a'}</span>
        </div>
      </div>
    </section>
  );
}
