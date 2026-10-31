import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Download, Lock, Mail, MapPin, Phone, Plus, Share2, Trash2, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { AVAILABILITY, ageFrom, cleanPhone, friendlyError, isValidPhone, money } from '../lib/utils';
import { SKILL_GROUPS } from '../lib/skills';
import { placeLabel } from '../lib/geo';
import { BG_COLORS, TITLE_COLORS, themeVars } from '../lib/cvTheme';
import { PlaceField } from './Place';
import CvPrint from './CvPrint';
import { MAX_SKILLS, PHOTO_BUCKET, emptyEdu, emptyExp, resumeToForm, useSignedPhoto } from '../lib/cv';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

// Qué incluye el pago, según lo que configuró el administrador
function payText(a) {
  if (a.mode === 'por_descarga') return 'Incluye una descarga (la podés repetir durante 24 horas).';
  if (a.mode === 'para_siempre') return 'Pagás una vez y lo descargás todas las veces que quieras.';
  return `Lo descargás todas las veces que quieras durante ${a.days} días.`;
}
function accessText(a) {
  if (!a?.has_access) return '';
  if (a.access_mode === 'para_siempre') return 'Tenés descargas ilimitadas.';
  if (a.access_mode === 'por_descarga' && a.downloads_left > 0) return 'Tenés una descarga disponible.';
  return `Podés descargarlo hasta el ${fmtDate(a.valid_until)}.`;
}


const MAX_SUMMARY = 300;


// Ideas de presentación según la profesión que escribió la persona (plantillas fijas)
const IDEAS = [
  {
    match: /vend|comerc|caj|atenci|repos|kiosc/,
    texts: [
      'Tengo experiencia en atención al público y ventas. Me gusta el trato con la gente, soy ordenada con la caja y aprendo rápido los productos.',
      'Busco sumarme a un comercio donde pueda aportar buena atención, responsabilidad y ganas de crecer.',
    ],
  },
  {
    match: /alba|constr|pint|electric|plom|gas|carpint|herre|mecan|soldad|jardin|parque/,
    texts: [
      'Trabajo en el oficio hace varios años. Soy prolijo, cumplo con los tiempos y tengo mis propias herramientas.',
      'Hago trabajos por mi cuenta y también busco sumarme a una empresa o cuadrilla. Responsable, puntual y con buena predisposición.',
    ],
  },
  {
    match: /admin|contab|secret|recep|datos|oficina|factur/,
    texts: [
      'Tengo experiencia en tareas administrativas: carga de datos, facturación y atención telefónica. Soy organizada y manejo herramientas de oficina.',
      'Busco un puesto administrativo donde pueda aportar orden, responsabilidad y buena comunicación.',
    ],
  },
  {
    match: /cuid|enfer|niñ|acompa|limp|domest|geriat/,
    texts: [
      'Tengo experiencia en el cuidado de personas. Soy paciente, responsable y tengo referencias para mostrar.',
      'Ofrezco mi trabajo con compromiso y confianza. Me adapto a distintos horarios y tareas.',
    ],
  },
  {
    match: /cocin|mozo|moza|gastr|panad|bar|pizz|parrill|ayudante/,
    texts: [
      'Tengo experiencia en gastronomía y me gusta trabajar en equipo. Soy rápido, prolijo y sé manejarme en momentos de mucho movimiento.',
      'Busco sumarme a un restaurante, bar o panadería. Tengo buena predisposición, puntualidad y ganas de aprender.',
    ],
  },
  {
    match: /chof|repart|transp|cami|delivery|logist|moto/,
    texts: [
      'Tengo registro vigente y experiencia en reparto y manejo. Conozco bien la zona y soy responsable con los horarios.',
      'Busco trabajo como chofer o repartidor. Cuidadoso con el vehículo y con la mercadería.',
    ],
  },
];
const GENERIC = [
  'Me considero una persona responsable, puntual y con muchas ganas de aprender. Busco sumarme a un equipo donde pueda crecer.',
  'Tengo buena predisposición para el trabajo y me adapto rápido a tareas nuevas. Valoro el buen trato y el trabajo bien hecho.',
];
function ideasFor(profession) {
  const p = (profession || '').toLowerCase();
  const hit = IDEAS.find((i) => i.match.test(p));
  return hit ? [...hit.texts, GENERIC[0]] : GENERIC;
}

// Reduce la foto en el navegador antes de subirla (máx. 600 px, JPEG)
async function compress(file) {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 600 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la foto'))), 'image/jpeg', 0.85));
}

// Texto editable que se ve como parte del CV
function Ed({ as = 'input', className = '', ...props }) {
  const Tag = as;
  return <Tag className={`ed ${className}`.trim()} {...props} />;
}

export default function MyResume({ user, zone, notify, payReturn = null }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [skillDraft, setSkillDraft] = useState('');
  const [skillTab, setSkillTab] = useState(SKILL_GROUPS[0].id);
  const [access, setAccess] = useState(null); // lo que devuelve cv_access()
  const [paying, setPaying] = useState(false);
  const [payNote, setPayNote] = useState(null); // { type, text }
  const [form, setForm] = useState(() => resumeToForm(null, user, zone));
  const fileInput = useRef(null);
  const [printing, setPrinting] = useState(false); // el CV limpio se monta solo al descargar
  const photoUrl = useSignedPhoto(form.photo_path);
  const autoName = useRef(form.full_name);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setItem = (key, i, patch) => setForm((f) => ({ ...f, [key]: f[key].map((it, k) => (k === i ? { ...it, ...patch } : it)) }));
  const addItem = (key, make) => setForm((f) => ({ ...f, [key]: [...f[key], make()] }));
  const removeItem = (key, i) => setForm((f) => ({ ...f, [key]: f[key].filter((_, k) => k !== i) }));

  useEffect(() => {
    let off = false;
    (async () => {
      const { data, error: loadErr } = await supabase.from('resumes').select('*').eq('user_id', user.id).maybeSingle();
      if (off) return;
      if (loadErr) {
        // No mostramos el formulario vacío: guardar así pisaría el CV existente
        setLoadError('No pudimos cargar tu CV. Revisá tu conexión y recargá la página.');
        setLoading(false);
        return;
      }
      if (data) setForm(resumeToForm(data, user, zone));
      setLoading(false);
    })();
    return () => {
      off = true;
    };
    // Solo al entrar o si cambia la persona
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // El perfil puede llegar después: completa nombre y localidad si la persona todavía no los tocó
  useEffect(() => {
    const prevAuto = autoName.current;
    setForm((f) => ({
      ...f,
      full_name: f.full_name === prevAuto ? user.name || '' : f.full_name,
      place: f.place || (user.city ? { city: user.city, province: user.province || null } : null),
      phone: f.phone || user.phone || '',
    }));
    autoName.current = user.name || '';
  }, [user.name, user.city, user.province, user.phone]);

  // Estado del cobro de la descarga
  const refreshAccess = async () => {
    const { data, error: err } = await supabase.rpc('cv_access');
    if (!err && data) setAccess(data);
    return err ? null : data;
  };

  useEffect(() => {
    refreshAccess();
    // Mientras se está en Mi CV, imprimir la página no muestra el CV (salvo desde "Descargar PDF")
    document.body.classList.add('on-cv');
    return () => document.body.classList.remove('on-cv');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Vuelta de Mercado Pago: esperamos la confirmación del pago (llega por el aviso al servidor)
  useEffect(() => {
    if (!payReturn) return undefined;
    if (['rejected', 'failure', 'null'].includes(payReturn)) {
      setPayNote({ type: 'err', text: 'El pago no se completó. Podés intentarlo de nuevo cuando quieras.' });
      return undefined;
    }
    setPayNote({ type: 'ok', text: 'Estamos esperando la confirmación de Mercado Pago…' });
    let off = false;
    (async () => {
      for (let i = 0; i < 12 && !off; i++) {
        const a = await refreshAccess();
        if (off) return;
        if (a?.has_access) {
          setPayNote({ type: 'ok', text: '¡Pago aprobado! Ya podés descargar tu CV.' });
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      if (!off) setPayNote({ type: 'err', text: 'Mercado Pago todavía no confirmó el pago. Si se acreditó, en unos minutos se habilita la descarga.' });
    })();
    return () => {
      off = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payReturn]);

  const addSkill = (raw = skillDraft) => {
    const s = raw.trim().replace(/,+$/, '').trim();
    if (!s || form.skills.length >= MAX_SKILLS || form.skills.some((x) => x.toLowerCase() === s.toLowerCase())) {
      setSkillDraft('');
      return;
    }
    set({ skills: [...form.skills, s] });
    setSkillDraft('');
  };

  // Las habilidades sugeridas se suman o se sacan con un toque
  const toggleSkill = (s) => {
    if (form.skills.some((x) => x.toLowerCase() === s.toLowerCase())) {
      set({ skills: form.skills.filter((x) => x.toLowerCase() !== s.toLowerCase()) });
    } else {
      addSkill(s);
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) {
      setError('La foto tiene que ser JPG, PNG o WebP.');
      return;
    }
    setError('');
    setUploading(true);
    try {
      const blob = await compress(file);
      // Nombre imposible de adivinar dentro de la carpeta de la persona
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from(PHOTO_BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
      if (upErr) throw upErr;
      const old = form.photo_path;
      set({ photo_path: path });
      if (old && old !== path) supabase.storage.from(PHOTO_BUCKET).remove([old]);
      notify('Foto cargada. Guardá el CV para que quede.');
    } catch (err) {
      setError(friendlyError(err.message || 'No pudimos subir la foto.'));
    }
    setUploading(false);
  };

  // Guarda el CV. Devuelve true si salió bien.
  const saveCv = async ({ quiet = false } = {}) => {
    if (loadError) return false;
    setError('');
    if (!form.full_name.trim() || !form.profession.trim()) {
      setError('Completá tu nombre y tu profesión u oficio.');
      return false;
    }
    if (!form.place?.city) {
      setError('Elegí tu localidad.');
      return false;
    }
    if (!isValidPhone(form.phone)) {
      setError('Ingresá un WhatsApp válido: código de área y número, sin 0 ni 15. Ejemplo: 2342112233');
      return false;
    }
    const education = form.education.filter((x) => x.title.trim() || x.place.trim());
    const experience = form.experience.filter((x) => x.role.trim() || x.place.trim() || x.tasks.trim());
    setSaving(true);
    const { error: err } = await supabase.from('resumes').upsert(
      {
        user_id: user.id,
        full_name: form.full_name.trim(),
        profession: form.profession.trim(),
        summary: form.summary.trim() || null,
        photo_path: form.photo_path || null,
        birth_date: form.birth_date || null,
        city: form.place.city,
        province: form.place.province,
        neighborhood: form.neighborhood.trim() || null,
        skills_list: form.skills,
        // Texto de compatibilidad para pantallas que todavía lo leen
        skills: form.skills.join(', '),
        experience: experience.map((x) => [x.role, x.place].filter(Boolean).join(' en ') + (x.tasks ? `: ${x.tasks}` : '')).join('\n'),
        experience_list: experience,
        education,
        availability: form.availability,
        phone: cleanPhone(form.phone),
        email: form.email.trim() || null,
        theme: form.theme,
      },
      { onConflict: 'user_id' }
    );
    setSaving(false);
    if (err) {
      setError(friendlyError(err.message));
      return false;
    }
    set({ education, experience });
    if (!quiet) notify('CV guardado');
    return true;
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveCv();
  };

  // Va a Mercado Pago. Antes guarda el CV para no perder cambios al salir de la página.
  const goPay = async () => {
    setPayNote(null);
    if (!(await saveCv({ quiet: true }))) return;
    setPaying(true);
    const { data, error: err } = await supabase.functions.invoke('crear-pago-cv');
    if (err || !data?.url) {
      let code = '';
      try {
        code = (await err?.context?.json())?.error || '';
      } catch {
        /* sin detalle */
      }
      setPaying(false);
      setError(
        code === 'pago_no_configurado'
          ? 'El cobro todavía no está configurado. Avisale al administrador.'
          : code === 'cobro_desactivado'
            ? 'La descarga ya no se cobra: probá de nuevo.'
            : 'No pudimos iniciar el pago. Probá de nuevo en unos minutos.'
      );
      refreshAccess();
      return;
    }
    window.location.href = data.url;
  };

  // Genera el PDF con el diálogo de impresión del navegador ("Guardar como PDF")
  const download = async () => {
    setError('');
    if (access?.paid_enabled && !access.has_access) {
      goPay();
      return;
    }
    const { data: ok, error: err } = await supabase.rpc('consume_cv_download');
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    if (!ok) {
      setError('Tu descarga ya no está habilitada. Pagala de nuevo para descargar.');
      refreshAccess();
      return;
    }
    setPrinting(true);
    refreshAccess();
  };

  // Cuando el CV limpio ya está montado, se abre el diálogo de impresión y al cerrarlo se desmonta
  useEffect(() => {
    if (!printing) return undefined;
    const title = document.title;
    document.title = `CV ${form.full_name}`.trim();
    document.body.classList.add('print-cv');
    const done = () => {
      document.body.classList.remove('print-cv');
      document.title = title;
      setPrinting(false);
    };
    window.addEventListener('afterprint', done, { once: true });
    const t = setTimeout(() => window.print(), 350); // tiempo para que cargue la foto
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', done);
      document.body.classList.remove('print-cv');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [printing]);

  const age = ageFrom(form.birth_date);
  const skillGroup = SKILL_GROUPS.find((g) => g.id === skillTab) || SKILL_GROUPS[0];
  const checks = [form.full_name, form.profession, form.summary, form.photo_path, form.skills.length, form.experience.length || form.education.length, isValidPhone(form.phone)];
  const pct = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const canShare = form.profession && isValidPhone(form.phone);
  const shareText = [
    `CV de ${form.full_name}, ${form.profession}`,
    [age !== null && `${age} años`, form.place && placeLabel(form.place.city, form.place.province)].filter(Boolean).join(' · '),
    form.summary,
    form.experience.length ? `Experiencia:\n${form.experience.map((x) => `• ${[x.role, x.place].filter(Boolean).join(' en ')}`).join('\n')}` : '',
    form.education.length ? `Educación:\n${form.education.map((x) => `• ${[x.title, x.place].filter(Boolean).join(', ')}`).join('\n')}` : '',
    form.skills.length ? `Habilidades: ${form.skills.join(', ')}` : '',
    `Disponibilidad: ${form.availability}`,
    `Contacto: https://wa.me/549${cleanPhone(form.phone)}`,
  ]
    .filter(Boolean)
    .join('\n');

  if (loading) return <p className="wrap page-head">Cargando tu CV…</p>;

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Mi CV</h1>
          <p className="lede">Armá tu currículum una vez y usalo para postularte. Tocá cada parte para completarla.</p>
        </div>
      </header>

      <form className="cv" onSubmit={handleSave}>
        {loadError && <p className="note err">{loadError}</p>}
        {payNote && <p className={`note ${payNote.type}`}>{payNote.text}</p>}
        {error && <p className="note err">{error}</p>}

        <div className="cv-bar">
          <p className="cv-privacy">
            <Lock size={18} aria-hidden="true" />
            <span>
              <b>Tu CV es privado</b>
              <small>Lo ves vos y solo las empresas a las que te postulás.</small>
            </span>
          </p>
          <div className="meter-wrap">
            <div className="meter" style={{ '--p': `${pct}%` }}>
              <i />
            </div>
            Tu CV está al {pct}%
          </div>
          <div className="cv-acts">
            <a
              className="btn btn-line"
              style={canShare ? undefined : { opacity: 0.5, pointerEvents: 'none' }}
              href={canShare ? `https://wa.me/?text=${encodeURIComponent(shareText)}` : undefined}
              target="_blank"
              rel="noreferrer"
              aria-disabled={!canShare}
            >
              <Share2 size={18} /> Compartir
            </a>
            <button type="button" className="btn btn-sun" onClick={download} disabled={saving || uploading || paying || !!loadError}>
              <Download size={18} />
              {paying ? 'Yendo a Mercado Pago…' : access?.paid_enabled && !access.has_access ? `Descargar PDF · ${money(access.price)}` : 'Descargar PDF'}
            </button>
            <button className="btn btn-ink" disabled={saving || uploading || !!loadError}>
              {saving ? 'Guardando…' : 'Guardar mi CV'}
            </button>
          </div>
          {access?.paid_enabled && (
            <p className="cv-pay">{access.has_access ? accessText(access) : `Pagás con Mercado Pago. ${payText(access)}`}</p>
          )}
          <div className="cv-theme">
            <div className="swatches" role="group" aria-label="Color de fondo">
              <span>Fondo</span>
              {BG_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`swatch${form.theme.bg === c.id ? ' on' : ''}`}
                  style={{ '--sw': c.hex }}
                  onClick={() => setForm((f) => ({ ...f, theme: { ...f.theme, bg: c.id } }))}
                  aria-pressed={form.theme.bg === c.id}
                  aria-label={`Fondo ${c.label}`}
                  title={c.label}
                />
              ))}
            </div>
            <div className="swatches" role="group" aria-label="Color de los títulos">
              <span>Títulos</span>
              {TITLE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`swatch${form.theme.title === c.id ? ' on' : ''}`}
                  style={{ '--sw': c.hex }}
                  onClick={() => setForm((f) => ({ ...f, theme: { ...f.theme, title: c.id } }))}
                  aria-pressed={form.theme.title === c.id}
                  aria-label={`Títulos ${c.label}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="cvdoc" style={themeVars(form.theme)}>
          {/* Trama de marcas de agua mientras se arma: el CV limpio sale solo con "Descargar PDF" */}
          <div className="cv-tiles" aria-hidden="true" />
          {/* ---------- izquierda arriba: foto ---------- */}
          <div className="cv-photo-cell">
            <div className="cv-photo">
              {photoUrl ? <img src={photoUrl} alt="Tu foto" /> : <Camera size={34} aria-hidden="true" />}
              <button type="button" className="cv-photo-btn" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? 'Subiendo…' : form.photo_path ? 'Cambiar foto' : 'Agregar foto'}
              </button>
              {form.photo_path && !uploading && (
                <button type="button" className="cv-photo-x" onClick={() => set({ photo_path: '' })} aria-label="Quitar foto">
                  <X size={16} />
                </button>
              )}
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr" onChange={onPhoto} tabIndex={-1} />
            </div>
          </div>

          {/* ---------- centro y derecha arriba: nombre y profesión ---------- */}
          <div className="cv-head">
            <Ed className="cv-name" placeholder="Nombre y apellido" value={form.full_name} onChange={(e) => set({ full_name: e.target.value })} aria-label="Nombre y apellido" maxLength={80} />
            <Ed className="cv-role" placeholder="Profesión u oficio" value={form.profession} onChange={(e) => set({ profession: e.target.value })} aria-label="Profesión u oficio" maxLength={80} />
          </div>

          {/* ---------- izquierda: datos, habilidades y contacto ---------- */}
          <aside className="cv-side">
            <div className="cv-block">
              <h3>Datos</h3>
              <label className="cv-line">
                <span>Nacimiento</span>
                <Ed type="date" value={form.birth_date} max={new Date().toISOString().slice(0, 10)} onChange={(e) => set({ birth_date: e.target.value })} />
              </label>
              {age !== null && <p className="cv-age">{age} años</p>}
              <PlaceField value={form.place} onChange={(place) => set({ place })} />
              <label className="cv-line">
                <span>Barrio</span>
                <Ed placeholder="Centro, Barrio Norte…" value={form.neighborhood} onChange={(e) => set({ neighborhood: e.target.value })} maxLength={60} />
              </label>
              <small className="cv-hint">
                <MapPin size={13} aria-hidden="true" /> Solo se muestran la localidad y el barrio, nunca tu dirección.
              </small>
            </div>

            <div className="cv-block">
              <h3>
                Habilidades <small>{form.skills.length}/{MAX_SKILLS}</small>
              </h3>
              <ul className="cv-skills">
                {form.skills.map((s) => (
                  <li key={s}>
                    {s}
                    <button type="button" onClick={() => set({ skills: form.skills.filter((x) => x !== s) })} aria-label={`Quitar ${s}`}>
                      <X size={13} />
                    </button>
                  </li>
                ))}
              </ul>
              {form.skills.length < MAX_SKILLS && (
                <Ed
                  placeholder="O escribí la tuya y tocá Enter"
                  value={skillDraft}
                  maxLength={40}
                  onChange={(e) => (e.target.value.endsWith(',') ? addSkill(e.target.value) : setSkillDraft(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill();
                    }
                  }}
                  onBlur={() => addSkill()}
                />
              )}
              <div className="skill-pick">
                <div className="skill-tabs" role="group" aria-label="Áreas de habilidades">
                  {SKILL_GROUPS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={skillTab === g.id ? 'on' : ''}
                      onClick={() => setSkillTab(g.id)}
                      aria-pressed={skillTab === g.id}
                    >
                      {g.label}
                    </button>
                  ))}
                </div>
                <div className="skill-opts">
                  {skillGroup.items.map((s) => {
                    const on = form.skills.some((x) => x.toLowerCase() === s.toLowerCase());
                    return (
                      <button
                        key={s}
                        type="button"
                        className={`skill-opt${on ? ' on' : ''}`}
                        onClick={() => toggleSkill(s)}
                        disabled={!on && form.skills.length >= MAX_SKILLS}
                        aria-pressed={on}
                      >
                        {on ? <Check size={12} aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="cv-block">
              <h3>Contacto</h3>
              <label className="cv-line">
                <span>
                  <Phone size={14} aria-hidden="true" /> WhatsApp
                </span>
                <Ed required inputMode="tel" placeholder="2342112233" value={form.phone} onChange={(e) => set({ phone: e.target.value })} />
              </label>
              <label className="cv-line">
                <span>
                  <Mail size={14} aria-hidden="true" /> Correo
                </span>
                <Ed type="email" placeholder="tu@correo.com" value={form.email} onChange={(e) => set({ email: e.target.value })} />
              </label>
              <label className="cv-line">
                <span>Disponibilidad</span>
                <Ed as="select" value={form.availability} onChange={(e) => set({ availability: e.target.value })}>
                  {AVAILABILITY.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </Ed>
              </label>
            </div>
          </aside>

          {/* ---------- centro y derecha: presentación, educación y experiencia ---------- */}
          <div className="cv-main">
            {/* Marca de agua */}
            <div className="cv-mark" aria-hidden="true">
              <img src="/marca/isotipo.png" alt="" />
              <span>
                Laburamos<b>App</b>
              </span>
            </div>

            <div className="cv-block">
              <h3>
                Presentación <small>{form.summary.length}/{MAX_SUMMARY}</small>
              </h3>
              <Ed
                as="textarea"
                className="cv-summary"
                placeholder="Contá en dos o tres líneas quién sos y qué buscás."
                value={form.summary}
                maxLength={MAX_SUMMARY}
                onChange={(e) => set({ summary: e.target.value })}
              />
              <div className="ideas">
                <span>¿No sabés qué poner? Usá una idea y cambiala a tu gusto:</span>
                {ideasFor(form.profession).map((t) => (
                  <button key={t} type="button" className="idea" onClick={() => set({ summary: t.slice(0, MAX_SUMMARY) })}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="cv-block">
              <h3>Educación</h3>
              {form.education.map((x, i) => (
                <div className="cv-item" key={i}>
                  <Ed className="cv-item-title" placeholder="Título o curso (Secundario completo, Curso de electricidad…)" value={x.title} onChange={(e) => setItem('education', i, { title: e.target.value })} />
                  <Ed placeholder="Institución" value={x.place} onChange={(e) => setItem('education', i, { place: e.target.value })} />
                  <div className="cv-dates">
                    <Ed inputMode="numeric" placeholder="Desde (año)" value={x.from} maxLength={4} onChange={(e) => setItem('education', i, { from: e.target.value.replace(/\D/g, '') })} />
                    <span>–</span>
                    <Ed inputMode="numeric" placeholder="Hasta (o en curso)" value={x.to} maxLength={4} onChange={(e) => setItem('education', i, { to: e.target.value.replace(/\D/g, '') })} />
                  </div>
                  <button type="button" className="cv-del" onClick={() => removeItem('education', i)} aria-label="Quitar educación">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="cv-add" onClick={() => addItem('education', emptyEdu)}>
                <Plus size={16} /> Agregar estudio
              </button>
            </div>

            <div className="cv-block">
              <h3>Experiencia</h3>
              {form.experience.map((x, i) => (
                <div className="cv-item" key={i}>
                  <Ed className="cv-item-title" placeholder="Puesto (Vendedora, Ayudante de albañil…)" value={x.role} onChange={(e) => setItem('experience', i, { role: e.target.value })} />
                  <Ed placeholder="Dónde (comercio, empresa o por tu cuenta)" value={x.place} onChange={(e) => setItem('experience', i, { place: e.target.value })} />
                  <div className="cv-dates">
                    <label>
                      <span className="cv-dl">Desde</span>
                      <Ed type="month" value={x.from} onChange={(e) => setItem('experience', i, { from: e.target.value })} />
                    </label>
                    <span>–</span>
                    {x.current ? (
                      <b className="cv-now">Actualmente</b>
                    ) : (
                      <label>
                        <span className="cv-dl">Hasta</span>
                        <Ed type="month" value={x.to} min={x.from || undefined} onChange={(e) => setItem('experience', i, { to: e.target.value })} />
                      </label>
                    )}
                    <label className="check sm">
                      <input type="checkbox" checked={x.current} onChange={(e) => setItem('experience', i, { current: e.target.checked, to: '' })} />
                      Trabajo acá
                    </label>
                  </div>
                  <Ed as="textarea" placeholder="Qué tareas hacías" value={x.tasks} maxLength={500} onChange={(e) => setItem('experience', i, { tasks: e.target.value })} />
                  <button type="button" className="cv-del" onClick={() => removeItem('experience', i)} aria-label="Quitar experiencia">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="cv-add" onClick={() => addItem('experience', emptyExp)}>
                <Plus size={16} /> Agregar experiencia
              </button>
            </div>
          </div>
        </div>
      </form>
      {printing && <CvPrint form={form} photoUrl={photoUrl} />}
    </section>
  );
}
