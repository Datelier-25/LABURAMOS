import { useEffect, useRef, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { FileText, Loader2, Mail, MessageCircle, ShieldCheck, UserRound, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';

const MAX_PDF = 5 * 1024 * 1024;

// Al postularse se puede mandar el CV armado en LaburamosApp o un PDF propio.
// El PDF se sube al bucket privado "cvs" y la empresa lo abre desde Postulantes.
export default function ApplyModal({ job, user, applyChannel = 'whatsapp', applyUrl, onClose, onDone, onEditCv, notify }) {
  const [mode, setMode] = useState('app');
  const [file, setFile] = useState(null);
  const [resume, setResume] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const input = useRef(null);
  const byEmail = applyChannel === 'email';

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !sending && onClose();
    window.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [onClose, sending]);

  useEffect(() => {
    let off = false;
    (async () => {
      const { data } = await supabase
        .from('resumes')
        .select('full_name, profession, summary, phone, skills, experience, education, photo_path')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!off) setResume(data || null);
    })();
    return () => {
      off = true;
    };
  }, [user.id]);

  const filled = resume
    ? [resume.full_name, resume.profession, resume.summary, resume.photo_path, resume.skills?.length, resume.experience?.length || resume.education?.length, resume.phone].filter(Boolean).length
    : 0;
  const pct = Math.round((filled / 7) * 100);

  const pick = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
    if (!isPdf) return setError('El archivo tiene que ser un PDF.');
    if (f.size > MAX_PDF) return setError('El PDF no puede pesar más de 5 MB.');
    setError('');
    setFile(f);
    setMode('file');
  };

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    if (mode === 'file' && !file) return setError('Elegí un PDF o usá tu CV de LaburamosApp.');

    // La pestaña se abre dentro del clic para que el navegador no la bloquee.
    // Con email no hace falta: al final se abre el cliente de correo.
    const win = !byEmail && applyUrl ? window.open('', '_blank') : null;
    setSending(true);
    setError('');

    const goContact = () => {
      if (!applyUrl) return;
      if (byEmail) {
        window.location.href = applyUrl;
        return;
      }
      if (win && !win.closed) win.location.href = applyUrl;
      else window.location.href = applyUrl;
    };

    try {
      let path = null;
      if (mode === 'file' && file) {
        path = `${user.id}/${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`}.pdf`;
        const { error: upErr } = await supabase.storage.from('cvs').upload(path, file, {
          contentType: 'application/pdf',
          upsert: false,
        });
        if (upErr) throw upErr;
      }

      const { error: err } = await supabase.from('applications').insert({
        job_id: job.id,
        email: user?.email || null,
        cv_contact: byEmail ? 'email' : 'whatsapp',
        cv_kind: path ? 'file' : 'app',
        cv_path: path,
        cv_name: path ? file.name.slice(0, 120) : null,
        worker_name: user?.name || null,
        worker_phone: user?.phone || null,
      });

      if (err) {
        if (path) await supabase.storage.from('cvs').remove([path]);
        if (err.code === '23505') {
          notify?.('Ya te habías postulado a este aviso.');
          onClose();
          goContact();
          return;
        }
        throw err;
      }

      notify?.(path ? 'Postulación enviada con tu CV en PDF.' : 'Postulación enviada. Tu CV ya está en Postulantes.');
      onDone?.();
      onClose();
      goContact();
    } catch (err) {
      if (win && !win.closed) win.close();
      const msg = (err?.message || '').includes('aviso_no_disponible')
        ? 'Este aviso ya no está disponible.'
        : friendlyError(err?.message || 'No pudimos enviar la postulación.');
      setError(msg);
      setSending(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()}>
      <form className="place-dlg apply-dlg" role="dialog" aria-modal="true" aria-label={`Postularte a ${job.title}`} onSubmit={submit}>
        <div className="place-head">
          <h2>Postularte</h2>
          <button type="button" className="x-sm" onClick={onClose} disabled={sending} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <p className="lede">
          <b>{job.title}</b>
          {job.company_name ? ` · ${job.company_name}` : ''}
        </p>

        <p className="apply-q">¿Qué CV querés enviar?</p>

        <div className="cv-options" role="radiogroup" aria-label="CV a enviar">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'app'}
            className={`cv-opt${mode === 'app' ? ' on' : ''}`}
            onClick={() => setMode('app')}
          >
            <span className="cv-opt-ic" aria-hidden="true">
              <UserRound size={19} />
            </span>
            <span>
              <b>Mi CV de LaburamosApp</b>
              <small>{resume ? `Tu CV está al ${pct}% · se abre desde Postulantes` : 'Todavía no armaste tu CV · se abre desde Postulantes'}</small>
            </span>
          </button>

          <button
            type="button"
            role="radio"
            aria-checked={mode === 'file'}
            className={`cv-opt${mode === 'file' ? ' on' : ''}`}
            onClick={() => (file ? setMode('file') : input.current?.click())}
          >
            <span className="cv-opt-ic" aria-hidden="true">
              <FileText size={19} />
            </span>
            <span>
              <b>Adjuntar un CV en PDF</b>
              <small>Subí el archivo que ya tenés (hasta 5 MB)</small>
            </span>
          </button>
        </div>

        {file && (
          <div className="cv-file">
            <FileText size={16} aria-hidden="true" />
            <span title={file.name}>{file.name}</span>
            <button type="button" onClick={() => { setFile(null); setMode('app'); }} disabled={sending}>
              Quitar
            </button>
          </div>
        )}

        <input ref={input} type="file" accept="application/pdf,.pdf" className="sr" onChange={pick} tabIndex={-1} />

        {onEditCv && (
          <button type="button" className="apply-edit" onClick={onEditCv} disabled={sending}>
            Editar mi CV de LaburamosApp
          </button>
        )}

        {error && <p className="note err">{error}</p>}

        <p className="note apply-note">
          <ShieldCheck size={15} aria-hidden="true" /> Solo los comercios verificados pueden abrir tu CV. Después de enviar se abre {byEmail ? 'tu correo' : 'el chat de WhatsApp'}.
        </p>
        <p className="note apply-note">
          {byEmail ? <Mail size={15} aria-hidden="true" /> : <MessageCircle size={15} aria-hidden="true" />}
          {byEmail
            ? `Este aviso recibe postulaciones por email${job.apply_email ? ` (${job.apply_email})` : ''}.`
            : 'Este aviso recibe postulaciones por WhatsApp.'}
        </p>

        <div className="apply-acts">
          <button type="button" className="btn btn-line" onClick={onClose} disabled={sending}>
            Cancelar
          </button>
          <button className="btn btn-ink" disabled={sending}>
            {sending ? (
              <>
                <Loader2 size={18} className="spin" aria-hidden="true" /> Enviando…
              </>
            ) : (
              'Enviar postulación'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
