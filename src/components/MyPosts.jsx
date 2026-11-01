import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { daysLeft, friendlyError, intentOf, timeAgo } from '../lib/utils';
import { loadReputation } from '../lib/reputation';
import ReviewModal from './ReviewModal';
import { Empty } from './ui';
import { Reputation, reviewScore } from './Reputation';

const LABEL = { active: 'Activo', paused: 'Pausado', filled: 'Cubierto', expired: 'Vencido' };

function Post({ item, kind, days, onStatus, onRenew, onDelete }) {
  const isJob = kind === 'job';
  const expired = new Date(item.expires_at) < new Date();
  const state = item.status === 'active' && expired ? 'expired' : item.status;
  const renewDays = days || 30;
  const left = daysLeft(item.expires_at);

  return (
    <article className="post">
      <div>
        <h3>
          {!isJob && <span className={`kind-s ${intentOf(item)}`}>{intentOf(item) === 'busca' ? 'Busco' : 'Ofrezco'}</span>}
          {item.title}
        </h3>
        <p>
          {isJob ? `${item.company_name} en ${item.location}` : `${item.provider_name} en ${item.city}`}.{' '}
          {left > 0 ? `Vence en ${left} días.` : 'Está vencido: renovalo para que vuelva a verse.'}
        </p>
      </div>
      <span className={`pill ${state}`}>{LABEL[state]}</span>
      <div className="acts">
        {item.status === 'active' && !expired && (
          <button className="btn btn-line btn-sm" onClick={() => onStatus(kind, item.id, 'paused', 'Aviso pausado')}>
            Pausar
          </button>
        )}
        {item.status !== 'active' && (
          <button className="btn btn-line btn-sm" onClick={() => onStatus(kind, item.id, 'active', 'Aviso activo')}>
            Reactivar
          </button>
        )}
        {isJob && item.status === 'active' && (
          <button className="btn btn-line btn-sm" onClick={() => onStatus(kind, item.id, 'filled', 'Marcado como cubierto')}>
            Ya lo cubrí
          </button>
        )}
        <button
          className="btn btn-line btn-sm"
          onClick={() => onRenew(kind, item.id, `Renovado por ${renewDays} días`)}
        >
          Renovar {renewDays} días
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDelete(kind, item.id, item.title)}>
          Eliminar
        </button>
      </div>
    </article>
  );
}

export default function MyPosts({ user, settings, onPublish, notify }) {
  const isCompany = user.role === 'company';
  const [jobs, setJobs] = useState([]);
  const [services, setServices] = useState([]);
  const [apps, setApps] = useState([]);
  const [rep, setRep] = useState({});
  const [mine, setMine] = useState({});
  const [reviewFor, setReviewFor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [j, s, a] = await Promise.all([
      isCompany
        ? supabase.from('jobs').select('*').eq('company_id', user.id).order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      supabase.from('services').select('*').eq('owner_id', user.id).order('created_at', { ascending: false }),
      !isCompany
        ? supabase
            .from('applications')
            .select('id, created_at, company_id, job_id, jobs(title, company_name)')
            .eq('worker_id', user.id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    const err = j.error || s.error || a.error;
    if (err) setError(friendlyError(err.message));
    setJobs(j.data || []);
    setServices(s.data || []);
    const list = a.data || [];
    setApps(list);
    if (list.length) {
      const ids = [...new Set(list.map((x) => x.company_id))];
      const [r, rv] = await Promise.all([
        loadReputation(ids),
        supabase.from('reviews').select('application_id, rating, compliance, responsibility, communication').eq('author_id', user.id),
      ]);
      setRep(r);
      setMine(Object.fromEntries((rv.data || []).map((x) => [x.application_id, x])));
    }
    setLoading(false);
  }, [user.id, isCompany]);

  useEffect(() => {
    load();
  }, [load]);

  const table = (kind) => (kind === 'job' ? 'jobs' : 'services');

  // Estado y vencimiento se cambian con funciones de la base, que validan que el aviso sea tuyo
  const handleStatus = async (kind, id, status, message) => {
    const { error: err } = await supabase.rpc('set_listing_status', { p_kind: kind, p_id: id, p_status: status });
    if (err) setError(friendlyError(err.message));
    else {
      notify(message);
      load();
    }
  };

  const handleRenew = async (kind, id, message) => {
    const { error: err } = await supabase.rpc('renew_listing', { p_kind: kind, p_id: id });
    if (err) setError(friendlyError(err.message));
    else {
      notify(message);
      load();
    }
  };

  const handleDelete = async (kind, id, title) => {
    if (!window.confirm(`¿Eliminar "${title}"? No se puede deshacer.`)) return;
    const { error: err } = await supabase.from(table(kind)).delete().eq('id', id);
    if (err) setError(friendlyError(err.message));
    else {
      notify('Aviso eliminado');
      load();
    }
  };

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Mis avisos</h1>
          <p className="lede">Todo lo que publicaste: pausalo, renovalo o marcalo como cubierto cuando quieras.</p>
        </div>
        <button className="btn btn-ink" onClick={() => onPublish(isCompany ? 'job' : 'service')}>
          {isCompany ? 'Publicar un aviso' : 'Publicar un servicio'}
        </button>
      </header>

      {error && <p className="note err">{error}</p>}
      {loading && <p className="count">Cargando…</p>}

      {!loading && isCompany && (
        <>
          <h2 className="block-title">Ofertas laborales</h2>
          {jobs.length === 0 ? (
            <Empty title="Todavía no publicaste ningún laburo" text={`Tu primer aviso tarda un minuto y dura ${settings?.job_days || 30} días.`}>
              <button className="btn btn-ink" onClick={() => onPublish('job')}>
                Publicar un aviso
              </button>
            </Empty>
          ) : (
            <div className="mine">
              {jobs.map((j) => (
                <Post key={j.id} item={j} kind="job" days={settings?.job_days} onStatus={handleStatus} onRenew={handleRenew} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
      )}

      {!loading && !isCompany && (
        <>
          <h2 className="block-title">Mis postulaciones</h2>
          {apps.length === 0 ? (
            <Empty title="Todavía no te postulaste a nada" text="Cuando toques «Postularme» en un aviso, va a quedar acá y vas a poder calificar al comercio." />
          ) : (
            <div className="mine">
              {apps.map((a) => {
                const reviewed = mine[a.id];
                return (
                  <article className="post" key={a.id}>
                    <div>
                      <h3>{a.jobs?.title || 'Aviso no disponible'}</h3>
                      <p>
                        {a.jobs?.company_name || 'Comercio'} · te postulaste {timeAgo(a.created_at)}
                      </p>
                      <Reputation data={rep[a.company_id]} />
                    </div>
                    <div className="acts">
                      <button
                        className="btn btn-line btn-sm"
                        disabled={!!reviewed}
                        title={reviewed ? 'Ya calificaste a este comercio' : 'Calificar al comercio'}
                        onClick={() => setReviewFor(a)}
                      >
                        <ShieldCheck size={16} /> {reviewed ? `Calificaste ${reviewScore(reviewed)}/100` : 'Calificar al comercio'}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      {!loading && (
        <>
          <h2 className="block-title">Servicios</h2>
          {services.length === 0 ? (
            <Empty title="Todavía no anunciaste ningún servicio" text="Si hacés un oficio, anunciate y que te encuentren.">
              <button className="btn btn-ink" onClick={() => onPublish('service')}>
                Anunciar un servicio
              </button>
            </Empty>
          ) : (
            <div className="mine">
              {services.map((s) => (
                <Post key={s.id} item={s} kind="service" days={settings?.service_days} onStatus={handleStatus} onRenew={handleRenew} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </>
      )}

      {reviewFor && (
        <ReviewModal
          applicationId={reviewFor.id}
          targetName={reviewFor.jobs?.company_name || 'el comercio'}
          targetKind="comercio"
          onClose={() => setReviewFor(null)}
          onDone={() => {
            setReviewFor(null);
            notify('Reseña publicada');
            load();
          }}
        />
      )}
    </section>
  );
}
