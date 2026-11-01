import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Mail, Phone, Search, ShieldCheck, X } from 'lucide-react';
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
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

  const verified = !!user?.isVerified;
  const requested = !!user?.verificationRequested;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('applications')
      .select('id, created_at, worker_id, job_id, email, cv_contact, jobs(title, location)')
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

  const jobs = useMemo(() => {
    const m = new Map();
    apps.forEach((a) => m.set(a.job_id, a.jobs?.title || 'Aviso eliminado'));
    return [...m.entries()];
  }, [apps]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return apps.filter((a) => {
      const r = resumes[a.worker_id];
      const text = !term || [r?.full_name, r?.profession, a.jobs?.title].some((v) => (v || '').toLowerCase().includes(term));
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
              const mailto = a.email
                ? `mailto:${a.email}?subject=${encodeURIComponent(`CV para ${a.jobs?.title || 'tu aviso'} en LaburamosApp`)}&body=${encodeURIComponent(`Hola ${r?.full_name || 'hola'}, acá está el CV que te enviamos por tu postulación a "${a.jobs?.title || 'nuestro aviso'}" en LaburamosApp.`)}`
                : '';
              return (
                <Row
                  key={a.id}
                  tone={toneFromName(r?.full_name || a.worker_id)}
                  name={r?.full_name || '?'}
                  tag={a.jobs?.title || 'Aviso eliminado'}
                  title={r?.full_name || 'Postulante'}
                  by={
                    r
                      ? [r.profession, age !== null && `${age} años`, r.city, `se postuló ${timeAgo(a.created_at)}`].filter(Boolean).join(' · ')
                      : 'CV visible para comercios verificados'
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
                      {r ? (
                        <>
                          <button className="btn btn-line" onClick={() => setOpen(r)}>
                            <FileText size={18} /> Ver CV
                          </button>
                          <button
                            className="btn btn-line"
                            disabled={!!reviewed}
                            title={reviewed ? `Ya lo calificaste con ${reviewScore(reviewed)}/100` : 'Calificar a esta persona'}
                            onClick={() => setReviewFor({ id: a.id, name: r.full_name })}
                          >
                            <ShieldCheck size={18} /> {reviewed ? `${reviewScore(reviewed)}/100` : 'Calificar'}
                          </button>
                          {r.phone && waAllowed && (
                            <a
                              className="btn btn-ink"
                              href={waLink(r.phone, `Hola ${r.full_name}, vi tu postulación a "${a.jobs?.title || 'nuestro aviso'}" en LaburamosApp.`)}
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
