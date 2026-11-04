import { useCallback, useEffect, useMemo, useState } from 'react';
import { Bookmark, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { JOB_CATEGORIES, JOB_TYPES, friendlyError, plural } from '../lib/utils';
import { applyZone, withinKm, zoneText } from '../lib/geo';
import { attachReputation, loadReputation } from '../lib/reputation';
import JobSign from './Sign';
import { Empty, Filters, SkeletonGrid } from './ui';
import { ZonePicker } from './Place';

export default function JobList({ user, zone, setZone, onPublish, onLogin, onApply, saved, onSave, onPrune, onReport, deep }) {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [jobType, setJobType] = useState(null);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [onlySaved, setOnlySaved] = useState(false);
  const [applied, setApplied] = useState(null); // Set de job_id a los que ya postuló el usuario
  const [distanceKm, setDistanceKm] = useState(0); // Radio máximo (km); 0 = sin límite

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const q = applyZone(
      supabase
        .from('jobs')
        .select('*')
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('is_urgent', { ascending: false })
        .order('created_at', { ascending: false }),
      // Con distancia elegida, buscamos a nivel de provincia para llegar a las zonas cercanas
      distanceKm > 0 && zone?.province ? { city: null, province: zone.province } : zone,
      'location'
    );
    const { data, error: err } = await q;
    if (err) {
      setError(friendlyError(err.message));
      setJobs([]);
    } else {
      const rep = await loadReputation((data || []).map((j) => j.company_id));
      setJobs(attachReputation(data || [], rep, 'company_id'));
    }
    if (user?.id) {
      const { data: myApps } = await supabase.from('applications').select('job_id').eq('worker_id', user.id);
      setApplied(new Set((myApps || []).map((a) => a.job_id)));
    }
    setLoading(false);
  }, [zone, user?.id, distanceKm]);

  useEffect(() => {
    load();
  }, [load]);

  // Enlace profundo (#/aviso/...) al aviso puntual: lo llevamos al frente al cargar.
  const deepId = deep?.id;
  useEffect(() => {
    if (!deepId) return undefined;
    const t = setTimeout(() => {
      document.getElementById(`job-${deepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(t);
  }, [deepId, jobs]);

  // Al entrar, depura los guardados que ya vencieron o se eliminaron (de cualquier zona)
  useEffect(() => {
    if (!saved.length || !onPrune) return undefined;
    let off = false;
    (async () => {
      const { data, error: err } = await supabase
        .from('jobs')
        .select('id')
        .in('id', saved)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString());
      if (!off && !err) onPrune((data || []).map((j) => j.id));
    })();
    return () => {
      off = true;
    };
    // Solo al montar la pantalla
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((j) => {
      const text = !term || [j.title, j.company_name, j.description].some((v) => (v || '').toLowerCase().includes(term));
      return (
        text &&
        (!category || j.category === category) &&
        (!jobType || j.job_type === jobType) &&
        (!onlyUrgent || j.is_urgent) &&
        (!onlySaved || saved.includes(j.id)) &&
        (!distanceKm || withinKm(zone, { city: j.location, province: j.province }, distanceKm))
      );
    });
  }, [jobs, search, category, jobType, onlyUrgent, onlySaved, saved, zone, distanceKm]);

  const clear = () => {
    setSearch('');
    setCategory(null);
    setJobType(null);
    setOnlyUrgent(false);
    setOnlySaved(false);
    setDistanceKm(0);
  };

  const place = zoneText(zone);

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">
            Laburos en <ZonePicker dark zone={zone} setZone={setZone} />
          </h1>
          <p className="lede">Ofertas de trabajo de comercios y vecinos en {place}. Postulate escribiendo directo a quien publica.</p>
        </div>
        <div className="head-acts">
          <button
            className={`saved-btn${onlySaved ? ' on' : ''}`}
            onClick={() => setOnlySaved(!onlySaved)}
            aria-pressed={onlySaved}
            aria-label={`Guardados: ${saved.length}`}
            title="Ver solo los guardados"
          >
            <Bookmark size={18} fill={onlySaved ? 'currentColor' : 'none'} aria-hidden="true" />
            <span>{saved.length}</span>
          </button>
          {(!user || user.role === 'company') && (
            <button className="btn btn-ink" onClick={() => onPublish('job')}>
              Publicar un aviso
            </button>
          )}
        </div>
      </header>

      <div className="finder">
        <label className="search">
          <span className="sr">Buscar laburos</span>
          <input type="search" placeholder="Buscá un puesto o un comercio" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={26} aria-hidden="true" />
        </label>
        <Filters
          groups={[
            { id: 'rubro', label: 'Rubro', all: 'Todos los rubros', options: JOB_CATEGORIES, value: category, onChange: setCategory },
            { id: 'modalidad', label: 'Modalidad', all: 'Cualquier modalidad', options: JOB_TYPES, value: jobType, onChange: setJobType },
          ]}
          toggles={[{ id: 'urgentes', label: 'Solo urgentes', value: onlyUrgent, onChange: setOnlyUrgent }]}
          distance={{ value: distanceKm, onChange: setDistanceKm }}
          extra={onlySaved ? [{ id: 'guardados', label: 'Guardados', onRemove: () => setOnlySaved(false) }] : []}
          onClear={clear}
          total={filtered.length}
        />
      </div>

      {loading ? (
        <SkeletonGrid />
      ) : error ? (
        <Empty title="No pudimos cargar los avisos" text={error}>
          <button className="btn btn-ink" onClick={load}>
            Reintentar
          </button>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty
          title={jobs.length === 0 ? `Todavía no hay laburos en ${place}` : 'Ningún aviso coincide'}
          text={jobs.length === 0 ? 'Sé el primero en publicar y quedás arriba de todo.' : 'Probá con otra palabra o sacá algún filtro.'}
        >
          {jobs.length === 0 ? (
            <>
              <button className="btn btn-ink" onClick={() => onPublish('job')}>
                Publicar un aviso
              </button>
              {zone.city && (
                <div className="empty-acts">
                  <button className="btn btn-line btn-sm" onClick={() => setDistanceKm(50)}>
                    Ampliar a 50 km
                  </button>
                  {zone.province && (
                    <button className="btn btn-line btn-sm" onClick={() => setZone({ city: null, province: zone.province })}>
                      Toda la provincia
                    </button>
                  )}
                </div>
              )}
            </>
          ) : (
            <button className="btn btn-ink" onClick={clear}>
              Limpiar filtros
            </button>
          )}
        </Empty>
      ) : (
        <>
          <p className="count" aria-live="polite">
            {plural(filtered.length, 'aviso', 'avisos')} {distanceKm ? `a menos de ${distanceKm} km de ${place}` : `en ${place}`}
          </p>
          {(zone.city || distanceKm) && (
            <div className="radius-bar">
              {zone.city && (
                <>
                  <span className="radius-note">
                    Mostrando los avisos de <b>{zone.city}</b>. ¿Querés más lejos?
                  </span>
                  <div className="radius-opts">
                    {[25, 50, 100].map((km) => (
                      <button key={km} type="button" className={`chip${distanceKm === km ? ' on' : ''}`} onClick={() => setDistanceKm(km)}>
                        {km} km
                      </button>
                    ))}
                    {zone.province && (
                      <button type="button" className="chip" onClick={() => setZone({ city: null, province: zone.province })}>
                        Toda la provincia
                      </button>
                    )}
                  </div>
                </>
              )}
              {distanceKm ? <span className="radius-note">Filtrando por distancia.</span> : null}
            </div>
          )}
          <div className="signs">
            {filtered.map((job, i) => (
              <JobSign
                key={job.id}
                job={job}
                user={user}
                saved={saved.includes(job.id)}
                onSave={onSave}
                onLogin={onLogin}
                onApply={onApply}
                applied={applied?.has(job.id) ?? false}
                onReport={onReport}
                wide={i === 0 && filtered.length >= 3 && !search}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
