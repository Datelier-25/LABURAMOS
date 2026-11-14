import { useCallback, useEffect, useMemo, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { FileText, Mail, Phone, Search, Send, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { ageFrom, friendlyError, plural, timeAgo, toneFromName, waLink } from '../lib/utils';
import { resumeToForm, useSignedPhoto } from '../lib/cv';
import { loadReputation } from '../lib/reputation';
import CvSheet from './CvSheet';
import ReviewModal from './ReviewModal';
import { Empty, Row, SkeletonGrid } from './ui';
import { Reputation, reviewScore } from './Reputation';

// Ventana con el CV completo de un postulante (o de cualquiera, para el administrador)
export function CvModal({ resume, onClose }) {
  const form = resumeToForm(resume);
  const photoUrl = useSignedPhoto(form.photo_path);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey);
      unlock();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cv-modal" role="dialog" aria-modal="true" aria-label={`CV de ${form.full_name}`}>
        <button type="button" className="x" onClick={onClose} aria-label="Cerrar">
          <X size={20} />
        </button>
        <CvSheet form={form} photoUrl={photoUrl} />
      </div>
    </div>
  );
}

// Postulantes: las personas que se postularon a los avisos de esta empresa
export default function Candidates({ user, notify }) {
  const [apps, setApps] = useState([]);
  const [resumes, setResumes] = useState({});
  const [rep, setRep] = useState({});
  const [mine, setMine] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [open, setOpen] = useState(null);
  const [reviewFor, setReviewFor] = useState(null);
  const [requesting, setRequesting] = useState(false);
  const [channels, setChannels] = useState({});
  const [cvBusy, setCvBusy] = useState('');
  const [resending, setResending] = useState('');

  const verified = !!user?.isVerified;
  const requested = !!user?.verificationRequested;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('applications')
      .select('id, created_at, worker_id, job_id, email, cv_contact, cv_kind, cv_path, cv_name, worker_name, worker_phone, email_sent_at, email_error, jobs(title, location)')
      .order('created_at', { ascending: false });
    if (err) {
      setError(friendlyError(err.message));
      setLoading(false);
      return;
    }
    const list = data || [];
    setApps(list);
    const ids = [...new Set(list.map((a) => a.worker_id))];
    if (ids.length) {
      const [rs, rv] = await Promise.all([
        supabase.from('resumes').select('*').in('user_id', ids),
        supabase.from('reviews').select('application_id, rating, compliance, responsibility, communication').eq('author_id', user?.id || ''),
      ]);
      setResumes(Object.fromEntries((rs.data || []).map((r) => [r.user_id, r])));
      setMine(Object.fromEntries((rv.data || []).map((r) => [r.application_id, r])));
      setRep(await loadReputation(ids));
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const requestVerification = async () => {
    setRequesting(true);
    const { error: err } = await supabase.rpc('request_verification');
    setRequesting(false);
    if (err) notify?.(friendlyError(err.message));
    else {
      notify?.('Pedido enviado. El administrador lo revisa y te avisamos.');
      load();
    }
  };

  // La empresa decide cómo recibe el CV de cada postulante: WhatsApp, Gmail o ambas.
  const setChannel = async (applicationId, channel) => {
    setCvBusy(applicationId);
    const { error: err } = await supabase.rpc('set_cv_contact', { p_application_id: applicationId, p_channel: channel });
    setCvBusy('');
    if (err) setError(friendlyError(err.message));
    else {
      setChannels((m) => ({ ...m, [applicationId]: channel }));
      notify?.('Vía de recepción guardada');
    }
  };

  // Reenvía el correo de la postulación (si el proveedor no estaba configurado
  // cuando la persona se postuló, o si el envío falló).
  const resendEmail = async (a) => {
    setResending(a.id);
    const { data, error: err } = await supabase.functions.invoke('send_application_email', {
      body: { application_id: a.id },
    });
    setResending('');
    if (err || data?.error) {
      notify?.('No se pudo enviar el correo. Revisá la configuración del proveedor.');
      return;
    }
    notify?.('Correo de la postulación enviado.');
    load();
  };

  // El CV puede venir armado en la app (tabla resumes) o como PDF adjunto en la
  // postulación (bucket privado cvs). El PDF se abre con una URL firmada.
  const openCv = async (a, r) => {
    if (!a.cv_path) {
      if (r) setOpen(r);
      return;
    }
    const win = window.open('', '_blank');
    setCvBusy(a.id);
    const { data, error: err } = await supabase.storage.from('cvs').createSignedUrl(a.cv_path, 600);
    setCvBusy('');
    if (err) {
      if (win && !win.closed) win.close();
      notify?.(friendlyError(err.message));
      return;
    }
    if (win && !win.closed) win.location.href = data.signedUrl;
    else window.open(data.signedUrl, '_blank', 'noopener');
  };

  const jobs = useMemo(() => {
    const m = new Map();
    apps.forEach((a) => m.set(a.job_id, a.jobs?.title || 'Aviso eliminado'));
    return [...m.entries()];
  }, [apps]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return apps.filter((a) => {
      const r = resumes[a.worker_id];
      const text = !term || [r?.full_name || a.worker_name, r?.profession, a.jobs?.title].some((v) => (v || '').toLowerCase().includes(term));
      return text && (!jobFilter || a.job_id === jobFilter);
    });
  }, [apps, resumes, search, jobFilter]);

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Postulantes</h1>
          <p className="lede">Personas que se postularon a tus avisos. Podés ver su CV y escribirles por WhatsApp.</p>
        </div>
        <Reputation data={{ is_verified: verified, rating: 0, reviews: 0 }} />
      </header>

      {!verified && (
        <div className="banner">
          <span className="banner-ic" aria-hidden="true">
            <ShieldCheck size={24} />
          </span>
          <div className="banner-tx">
            <b>Para ver los CVs necesitás verificar tu comercio</b>
            <p>
              La verificación protege a quienes se postulan: solo los comercios aprobados por el administrador pueden abrir los CVs.
              Mientras tanto, tus avisos funcionan normal y podés escribirles por WhatsApp.
            </p>
          </div>
          {requested ? (
            <span className="pill paused">Pedido enviado</span>
          ) : (
            <button className="btn btn-ink" onClick={requestVerification} disabled={requesting}>
              {requesting ? 'Enviando…' : 'Pedir verificación'}
            </button>
          )}
        </div>
      )}

      <div className="finder">
        <label className="search">
          <span className="sr">Buscar postulantes</span>
          <input type="search" placeholder="Buscá por nombre, oficio o aviso" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={26} aria-hidden="true" />
        </label>
        {jobs.length > 1 && (
          <div className="fbar">
            <select className="fbtn" value={jobFilter} onChange={(e) => setJobFilter(e.target.value)} aria-label="Aviso">
              <option value="">Todos mis avisos</option>
              {jobs.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <SkeletonGrid n={3} />
      ) : error ? (
        <Empty title="No pudimos cargar los postulantes" text={error}>
          <button className="btn btn-ink" onClick={load}>
            Reintentar
          </button>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty
          title={apps.length === 0 ? 'Todavía no se postuló nadie' : 'Nadie coincide con la búsqueda'}
          text={apps.length === 0 ? 'Cuando alguien toque "Postularme" en uno de tus avisos, va a aparecer acá con su CV.' : 'Probá con otra palabra.'}
        />
      ) : (
        <>
          <p className="count">
            {plural(filtered.length, 'postulación', 'postulaciones')}
            {!verified ? ' · verificá tu comercio para ver los CVs' : ''}
          </p>
          <div className="guide">
            {filtered.map((a) => {
              const r = resumes[a.worker_id];
              const age = ageFrom(r?.birth_date);
              const reviewed = mine[a.id];
              const cur = channels[a.id] || a.cv_contact || 'whatsapp';
              const waAllowed = cur !== 'email';
              const emAllowed = cur !== 'whatsapp';
              const cvPdf = !!a.cv_path;
              const mailStatus = a.email_sent_at ? 'correo enviado' : a.email_error ? 'correo con error' : 'correo pendiente';
              const name = r?.full_name || a.worker_name || 'Postulante';
              const phone = r?.phone || a.worker_phone || '';
              const mailto = a.email
                ? `mailto:${a.email}?subject=${encodeURIComponent(`CV para ${a.jobs?.title || 'tu aviso'} en LaburamosApp`)}&body=${encodeURIComponent(`Hola ${name}, acá está el CV que te enviamos por tu postulación a "${a.jobs?.title || 'nuestro aviso'}" en LaburamosApp.`)}`
                : '';
              return (
                <Row
                  key={a.id}
                  tone={toneFromName(name)}
                  name={name}
                  tag={a.jobs?.title || 'Aviso eliminado'}
                  title={name}
                  by={
                    r
                      ? [r.profession, age !== null && `${age} años`, r.city, cvPdf ? 'CV en PDF adjunto' : null, `se postuló ${timeAgo(a.created_at)}`, mailStatus]
                          .filter(Boolean)
                          .join(' · ')
                      : cvPdf
                        ? ['CV en PDF adjunto', `se postuló ${timeAgo(a.created_at)}`, mailStatus].join(' · ')
                        : `CV visible para comercios verificados · ${mailStatus}`
                  }
                  desc={r?.summary}
                  extra={<Reputation data={rep[a.worker_id]} />}
                  action={
                    <div className="row-acts">
                      <div className="row-channels" role="group" aria-label="Cómo recibir el CV">
                        {[
                          { id: 'whatsapp', label: 'WhatsApp' },
                          { id: 'email', label: 'Gmail' },
                          { id: 'both', label: 'Ambas' },
                        ].map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className={`btn btn-xs ${cur === c.id ? 'btn-ink' : 'btn-line'}`}
                            onClick={() => setChannel(a.id, c.id)}
                            disabled={cvBusy === a.id}
                            aria-pressed={cur === c.id}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      {r || cvPdf ? (
                        <>
                          <button className="btn btn-line" onClick={() => openCv(a, r)} disabled={cvBusy === a.id}>
                            <FileText size={18} /> {cvPdf ? (cvBusy === a.id ? 'Abriendo…' : 'Ver CV (PDF)') : 'Ver CV'}
                          </button>
                          <button
                            className="btn btn-line"
                            disabled={!!reviewed}
                            title={reviewed ? `Ya lo calificaste con ${reviewScore(reviewed)}/100` : 'Calificar a esta persona'}
                            onClick={() => setReviewFor({ id: a.id, name })}
                          >
                            <ShieldCheck size={18} /> {reviewed ? `${reviewScore(reviewed)}/100` : 'Calificar'}
                          </button>
                          {phone && waAllowed && (
                            <a
                              className="btn btn-ink"
                              href={waLink(phone, `Hola ${name}, vi tu postulación a "${a.jobs?.title || 'nuestro aviso'}" en LaburamosApp.`)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <Phone size={18} /> Escribir por WhatsApp
                            </a>
                          )}
                          {emAllowed && a.email && (
                            <a className="btn btn-line" href={mailto} target="_blank" rel="noreferrer">
                              <Mail size={18} /> Enviar por Gmail
                            </a>
                          )}
                          <button
                            type="button"
                            className="btn btn-line"
                            onClick={() => resendEmail(a)}
                            disabled={resending === a.id}
                            title={a.email_sent_at ? 'Volver a enviar el correo de la postulación' : 'Enviar el correo de la postulación a la casilla del aviso'}
                          >
                            <Send size={18} />{' '}
                            {resending === a.id ? 'Enviando…' : a.email_sent_at ? 'Reenviar correo' : 'Enviar correo'}
                          </button>
                        </>
                      ) : null}
                    </div>
                  }
                />
              );
            })}
          </div>
        </>
      )}

      {open && <CvModal resume={open} onClose={() => setOpen(null)} />}
      {reviewFor && (
        <ReviewModal
          applicationId={reviewFor.id}
          targetName={reviewFor.name}
          onClose={() => setReviewFor(null)}
          onDone={() => {
            setReviewFor(null);
            notify?.('Reseña publicada');
            load();
          }}
        />
      )}
    </section>
  );
}
