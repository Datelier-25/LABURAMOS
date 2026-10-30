import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileText, Phone, Search, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { ageFrom, friendlyError, plural, timeAgo, toneFromName, waLink } from '../lib/utils';
import { resumeToForm, useSignedPhoto } from '../lib/cv';
import CvSheet from './CvSheet';
import { Empty, Row, SkeletonGrid } from './ui';

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
export default function Candidates() {
  const [apps, setApps] = useState([]);
  const [resumes, setResumes] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [jobFilter, setJobFilter] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('applications')
      .select('id, created_at, worker_id, job_id, jobs(title, location)')
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
      const { data: rs } = await supabase.from('resumes').select('*').in('user_id', ids);
      setResumes(Object.fromEntries((rs || []).map((r) => [r.user_id, r])));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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
      </header>

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
          <p className="count">{plural(filtered.length, 'postulación', 'postulaciones')}</p>
          <div className="guide">
            {filtered.map((a) => {
              const r = resumes[a.worker_id];
              const age = ageFrom(r?.birth_date);
              return (
                <Row
                  key={a.id}
                  tone={toneFromName(r?.full_name || a.worker_id)}
                  name={r?.full_name || '?'}
                  tag={a.jobs?.title || 'Aviso eliminado'}
                  title={r?.full_name || 'Todavía no cargó su CV'}
                  by={[r?.profession, age !== null && `${age} años`, r?.city, `se postuló ${timeAgo(a.created_at)}`].filter(Boolean).join(' · ')}
                  desc={r?.summary}
                  action={
                    r ? (
                      <div className="row-acts">
                        <button className="btn btn-line" onClick={() => setOpen(r)}>
                          <FileText size={18} /> Ver CV
                        </button>
                        {r.phone && (
                          <a
                            className="btn btn-ink"
                            href={waLink(r.phone, `Hola ${r.full_name}, vi tu postulación a "${a.jobs?.title || 'nuestro aviso'}" en LaburamosApp.`)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Phone size={18} /> Escribir
                          </a>
                        )}
                      </div>
                    ) : null
                  }
                />
              );
            })}
          </div>
        </>
      )}

      {open && <CvModal resume={open} onClose={() => setOpen(null)} />}
    </section>
  );
}
