import { useEffect, useRef, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { FileText, Loader2, Mail, ShieldCheck, UserRound, X, ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';
import LegalConsent from './LegalConsent';
import { consentReady, recordLegalConsent } from '../lib/legal';

const MAX_PDF = 5 * 1024 * 1024;
const MAX_COMMENT = 300;

// Mensajes predeterminados para el comentario: se tocan y se suman al texto
// (opcional, se pueden combinar con lo que escriba la persona).
const QUICK_NOTES = [
  'Tengo experiencia en el rubro.',
  'Tengo disponibilidad full time.',
  'Puedo empezar de inmediato.',
  'Vivo cerca del lugar.',
  'Tengo movilidad propia.',
  'Es mi primera experiencia.',
];

const tidyComment = (text) =>
  text.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').replace(/^\s+|\s+$/g, '');

// Al postularse se puede mandar el CV armado en LaburamosApp o un PDF propio.
// El PDF se sube al bucket privado "cvs" y la empresa lo abre desde Postulantes.
// El correo se envía desde la app (remitente configurado en Admin) con Reply-To al postulante.
export default function ApplyModal({ job, user, onClose, onDone, onEditCv, notify }) {
  const [step, setStep] = useState('choose'); // 'choose' | 'confirm'
  const [mode, setMode] = useState('app');
  const [file, setFile] = useState(null);
  const [resume, setResume] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState({ terms: false, privacy: false });
  const [comment, setComment] = useState('');
  const input = useRef(null);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !sending) {
        if (step === 'confirm') setStep('choose');
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [onClose, sending, step]);

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
    return () => { off = true; };
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

  const goConfirm = () => {
    if (mode === 'file' && !file) return setError('Elegí un PDF o usá tu CV de LaburamosApp.');
    if (!consentReady(consent)) return setError('Para postularte, aceptá los Términos y la Política de Privacidad.');
    setStep('confirm');
    setError('');
  };

  // Suma o quita un mensaje predeterminado del comentario.
  const toggleQuick = (text) => {
    setComment((cur) => {
      if (cur.includes(text)) return tidyComment(cur.replace(text, ''));
      const next = cur.trim() ? `${cur.trim()} ${text}` : text;
      return next.length > MAX_COMMENT ? cur : next;
    });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError('');

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

      const { data: created, error: err } = await supabase.from('applications').insert({
        job_id: job.id,
        email: user?.email || null,
        cv_contact: 'email',
        cv_kind: path ? 'file' : 'app',
        cv_path: path,
        cv_name: path ? file.name.slice(0, 120) : null,
        worker_name: user?.name || null,
        worker_phone: user?.phone || null,
        worker_comment: comment.trim() || null,
      }).select('id').single();

      if (err) {
        if (path) await supabase.storage.from('cvs').remove([path]);
        if (err.code === '23505') {
          notify?.('Ya te habías postulado a este aviso.');
          onClose();
          return;
        }
        throw err;
      }

      // El correo lo envía una Edge Function: remitente propio configurado en Admin
      // y Reply-To con el email del postulante. No bloquea la UI si falla.
      if (created?.id) {
        supabase.functions.invoke('send_application_email', { body: { application_id: created.id } })
          .catch(() => { /* silencioso: se puede reenviar desde Postulantes */ });
      }

      notify?.(path ? 'Postulación enviada con tu CV en PDF.' : 'Postulación enviada. Tu CV ya está en Postulantes.');
      void recordLegalConsent('postulacion');
      onDone?.();
      onClose();
    } catch (err) {
      const msg = (err?.message || '').includes('aviso_no_disponible')
        ? 'Este aviso ya no está disponible.'
        : friendlyError(err?.message || 'No pudimos enviar la postulación.');
      setError(msg);
      setSending(false);
    }
  };

  const back = () => setStep('choose');

  // Paso 1: Elegir CV
  const chooseView = (
    <>
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
            <small>{resume ? `Tu CV está al ${pct}% · se ve en Postulantes` : 'Todavía no armaste tu CV · se ve en Postulantes'}</small>
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
        <ShieldCheck size={15} aria-hidden="true" /> Solo los comercios verificados pueden abrir tu CV. La postulación se envía por email desde la app.
      </p>
      <p className="note apply-note">
        <Mail size={15} aria-hidden="true" /> El correo se envía desde <b>LaburamosApp</b> y tu email va como <b>Responder a</b>: la empresa te contesta directo sin que tu correo quede publicado.
      </p>

      <LegalConsent value={consent} onChange={setConsent} compact />

      <div className="apply-acts">
        <button type="button" className="btn btn-ink" onClick={goConfirm} disabled={sending}>
          Continuar <ArrowLeft size={18} aria-hidden="true" className="reverse" />
        </button>
      </div>
    </>
  );

  // Paso 2: Confirmar y enviar
  const confirmView = (
    <>
      <div className="place-head">
        <button type="button" className="x-sm" onClick={back} disabled={sending} aria-label="Volver">
          <ArrowLeft size={18} />
        </button>
        <h2>Confirmar postulación</h2>
        <button type="button" className="x-sm" onClick={onClose} disabled={sending} aria-label="Cerrar">
          <X size={18} />
        </button>
      </div>

      <p className="lede">
        <b>{job.title}</b>
        {job.company_name ? ` · ${job.company_name}` : ''}
      </p>

      <p className="apply-q">¿Estás seguro de enviar tu CV para <b>{job.title}</b> en <b>{job.company_name}</b>?</p>

      <p className="note">
        Se enviará el perfil que tenés cargado actualmente ({mode === 'app' ? 'CV de LaburamosApp' : 'tu PDF'}).<br />
        El correo le llega a <b>{job.company_name || 'la empresa'}</b> desde <b>LaburamosApp</b>, con tu email como{' '}
        <b>Responder a</b>, así te contesta directo.
      </p>

      <div className="field">
        <span>Comentario breve para el empleador (opcional)</span>
        <div className="apply-quick" role="group" aria-label="Mensajes predeterminados">
          {QUICK_NOTES.map((text) => {
            const on = comment.includes(text);
            return (
              <button
                key={text}
                type="button"
                className={`apply-quick-chip${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => toggleQuick(text)}
                disabled={sending}
              >
                {text}
              </button>
            );
          })}
        </div>
        <small className="apply-quick-hint">Tocá las que te sirvan: se agregan al comentario.</small>
        <textarea
          maxLength={MAX_COMMENT}
          placeholder="Ej: Tengo disponibilidad horaria completa y experiencia en el rubro…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
        />
        <small>{comment.length}/{MAX_COMMENT}</small>
      </div>

      {error && <p className="note err">{error}</p>}

      <div className="apply-acts">
        <button type="button" className="btn btn-line" onClick={back} disabled={sending}>
          Volver
        </button>
        <button type="submit" className="btn btn-ink" disabled={sending}>
          {sending ? (
            <>
              <Loader2 size={18} className="spin" aria-hidden="true" /> Enviando…
            </>
          ) : (
            <>
              <Send size={18} aria-hidden="true" /> Enviar postulación
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && !sending && (step === 'choose' ? onClose() : back())}>
      <form className="place-dlg apply-dlg" role="dialog" aria-modal="true" aria-label={`Postularte a ${job.title}`} onSubmit={submit}>
        {step === 'choose' ? chooseView : confirmView}
      </form>
    </div>
  );
}