import { useEffect, useState } from 'react';
import { ArrowRight, Briefcase, FileText, Plus, Users, Wrench } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { plural } from '../lib/utils';
import { applyZone, zoneShort, zoneText } from '../lib/geo';
import { attachReputation, loadReputation } from '../lib/reputation';
import JobSign, { ServiceCard } from './Sign';
import { Empty } from './ui';
import { ZonePicker } from './Place';

// Pila de carteles que rota sola; al tocar el de arriba pasa el siguiente
function SignStack({ items, total, onMore }) {
  const [offset, setOffset] = useState(0);
  const [hold, setHold] = useState(false);
  const n = items.length;

  useEffect(() => {
    if (hold || n < 2) return undefined;
    const t = setInterval(() => setOffset((o) => (o + 1) % n), 4200);
    return () => clearInterval(t);
  }, [hold, n]);

  return (
    <div className="stack-wrap">
      <div className="stack" onMouseEnter={() => setHold(true)} onMouseLeave={() => setHold(false)}>
        {items.map((job, i) => {
          const pos = (i - offset + n) % n;
          return (
            <div
              key={job.id}
              className="stack-item"
              data-pos={Math.min(pos, 3)}
              role={pos === 0 && n > 1 ? 'button' : undefined}
              tabIndex={pos === 0 && n > 1 ? 0 : -1}
              aria-hidden={pos === 0 ? undefined : true}
              onClick={() => n > 1 && pos === 0 && setOffset((o) => (o + 1) % n)}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && n > 1 && pos === 0) {
                  e.preventDefault();
                  setOffset((o) => (o + 1) % n);
                }
              }}
            >
              <JobSign job={job} compact />
            </div>
          );
        })}
      </div>
      {n > 1 && (
        <div className="stack-dots" aria-hidden="true">
          {items.map((job, i) => (
            <i key={job.id} className={i === offset ? 'on' : ''} />
          ))}
        </div>
      )}
      {total > 0 && (
        <button className="stack-more" onClick={onMore}>
          Ver {plural(total, 'laburo', 'laburos')} <ArrowRight size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export default function Home({ user, zone, setZone, settings, go, onPublish, onLogin, onApply, saved, onSave, onReport, deep }) {
  const [data, setData] = useState({ jobs: [], services: [], jobsN: 0, servN: 0, loading: true, error: false });
  const [applied, setApplied] = useState(null); // Set de job_id a los que ya postuló el usuario

  useEffect(() => {
    let off = false;
    (async () => {
      const now = new Date().toISOString();
      const jq = applyZone(
        supabase
          .from('jobs')
          .select('*', { count: 'exact' })
          .eq('status', 'active')
          .gt('expires_at', now)
          .order('is_urgent', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(6),
        zone,
        'location'
      );
      const sq = applyZone(
        supabase
          .from('services')
          .select('*', { count: 'exact' })
          .eq('status', 'active')
          .gt('expires_at', now)
          .order('created_at', { ascending: false })
          .limit(6),
        zone,
        'city'
      );
      const [j, s] = await Promise.all([jq, sq]);
      const rep = await loadReputation([
        ...(j.data || []).map((x) => x.company_id),
        ...(s.data || []).map((x) => x.owner_id),
      ]);
      if (user?.id) {
        const { data: myApps } = await supabase.from('applications').select('job_id').eq('worker_id', user.id);
        setApplied(new Set((myApps || []).map((a) => a.job_id)));
      }
      if (!off) {
        setData({
          jobs: attachReputation(j.data || [], rep, 'company_id'),
          services: attachReputation(s.data || [], rep, 'owner_id'),
          jobsN: j.count ?? 0,
          servN: s.count ?? 0,
          loading: false,
          error: !!(j.error || s.error),
        });
      }
    })();
    return () => {
      off = true;
    };
  }, [zone, user?.id]);

  const { jobs, services, jobsN, servN, loading, error } = data;
  const place = zoneText(zone);
  const where = zoneShort(zone) === 'toda Argentina' ? 'Tu ciudad' : zoneShort(zone);

  // Enlace profundo (#/aviso/...) al aviso puntual: lo llevamos al frente al cargar.
  const deepId = deep?.id;
  useEffect(() => {
    if (!deepId) return undefined;
    const t = setTimeout(() => {
      document.getElementById(`job-${deepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(t);
  }, [deepId, jobs]);

  // Si todavía no hay avisos, la pila muestra invitaciones
  const invites = [
    { id: 'i1', category: 'Comercio', title: 'Acá va tu aviso', company_name: 'Tu comercio', location: where, job_type: 'Full-time' },
    { id: 'i2', category: 'Gastronomía', title: 'Se busca gente de confianza', company_name: 'Tu negocio', location: where, job_type: 'Part-time' },
    { id: 'i3', category: 'Oficios / Técnico', title: 'Publicá en un minuto', company_name: 'Vos', location: where, job_type: 'Changa' },
  ];
  const stackItems = jobs.length ? jobs.slice(0, 5) : invites;

  // Tres caminos según quién entra
  let paths;
  if (!user) {
    paths = [
      { label: 'Busco laburo', sub: 'Mirá las ofertas de trabajo', icon: Briefcase, onClick: () => go('laburos') },
      { label: 'Ofrezco un oficio', sub: 'Mostrá lo que sabés hacer', icon: Wrench, onClick: () => onPublish('service', 'ofrece') },
      { label: 'Necesito personal', sub: 'Publicá una búsqueda', icon: Users, onClick: () => onPublish('job') },
    ];
  } else if (user.role === 'company') {
    paths = [
      { label: 'Publicar un aviso', sub: 'Buscá personal', icon: Plus, onClick: () => onPublish('job') },
      { label: 'Ver candidatos', sub: 'CVs visibles de la zona', icon: Users, onClick: () => go('candidatos') },
      { label: 'Anunciar un servicio', sub: 'Mostrá tu negocio', icon: Wrench, onClick: () => onPublish('service', 'ofrece') },
    ];
  } else {
    paths = [
      { label: 'Busco laburo', sub: 'Mirá las ofertas de trabajo', icon: Briefcase, onClick: () => go('laburos') },
      { label: 'Armar mi CV', sub: 'Que los comercios te encuentren', icon: FileText, onClick: () => go('cv') },
      { label: 'Ofrezco un oficio', sub: 'Mostrá lo que sabés hacer', icon: Wrench, onClick: () => onPublish('service', 'ofrece') },
    ];
  }

  const tickerItems = jobs.length
    ? jobs.map((j) => `Se busca: ${j.title} en ${j.company_name}`)
    : ['Publicá tu aviso en un minuto', 'Contacto directo por WhatsApp', `Laburos y oficios en ${place}`, 'Tu cartel, a la vista de los vecinos'];

  return (
    <>
      <section className="hero">
        <div className="wrap hero-in">
          <div>
            <h1>
              <span className="line"><span style={{ '--i': 0 }}>Laburo, oficios</span></span>
              <span className="line"><span style={{ '--i': 1 }}>y changas en</span></span>
              <span className="line"><span style={{ '--i': 2 }}><ZonePicker zone={zone} setZone={setZone} /></span></span>
            </h1>
            <p className="hero-sub">Avisos de comercios y vecinos en {place}. Escribís por WhatsApp y arreglás directo.</p>
            <div className="paths">
              {paths.map((p) => (
                <button key={p.label} className="path" onClick={p.onClick}>
                  <span className="path-ic" aria-hidden="true">
                    <p.icon size={20} />
                  </span>
                  <span className="path-tx">
                    <b>{p.label}</b>
                    <small>{p.sub}</small>
                  </span>
                </button>
              ))}
            </div>
            <p className="live" aria-live="polite">
              <span className="dot" aria-hidden="true" />
              {loading
                ? 'Buscando avisos…'
                : jobsN + servN > 0
                  ? `Hoy hay ${plural(jobsN, 'laburo', 'laburos')} y ${plural(servN, 'oficio', 'oficios')} publicados en ${place}.`
                  : `Todavía no hay avisos en ${place}. Publicá el primero.`}
            </p>
          </div>
          <SignStack items={stackItems} total={jobs.length ? jobsN : 0} onMore={() => go('laburos')} />
        </div>
      </section>

      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {[...tickerItems, ...tickerItems, ...tickerItems, ...tickerItems].map((t, i) => (
            <span className="tk" key={i}>
              {t}
            </span>
          ))}
        </div>
      </div>

      <section className="sec wrap">
        <div className="sec-head">
          <div>
            <h2 className="sec-title">Lo último en {zoneShort(zone)}</h2>
            <p className="lede">Las ofertas de trabajo más nuevas de comercios y vecinos.</p>
          </div>
          <button className="btn btn-line btn-sm" onClick={() => go('laburos')}>
            Ver todos <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {error && <p className="note err">No pudimos cargar los avisos. Revisá tu conexión y volvé a intentar.</p>}
        {loading ? (
          <div className="signs">
            {[0, 1, 2].map((k) => (
              <div key={k} className="skel" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <Empty title={`Todavía no hay laburos en ${place}`} text="Si tenés un comercio, tu aviso puede ser el primero de la vidriera.">
            <button className="btn btn-ink" onClick={() => onPublish('job')}>
              Publicar un aviso
            </button>
          </Empty>
        ) : (
          <div className="signs">
            {jobs.map((job, i) => (
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
                wide={i === 0 && jobs.length >= 3}
              />
            ))}
          </div>
        )}
      </section>

      <section className="sec wrap">
        <div className="sec-head">
          <div>
            <h2 className="sec-title">Oficios y servicios</h2>
            <p className="lede">Gente que ofrece su oficio y vecinos que buscan quién les haga un trabajo.</p>
          </div>
          <button className="btn btn-line btn-sm" onClick={() => go('oficios')}>
            Ver toda la guía <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
        {loading ? null : services.length === 0 ? (
          <Empty title="Todavía no hay oficios cargados" text="¿Hacés plomería, clases, limpieza o cuidados? Anunciate y que te encuentren.">
            <button className="btn btn-ink" onClick={() => onPublish('service', 'ofrece')}>
              Anunciar mi servicio
            </button>
          </Empty>
        ) : (
          <div className="scards">
            {services.map((s) => (
              <ServiceCard key={s.id} service={s} user={user} onLogin={onLogin} />
            ))}
          </div>
        )}
      </section>

      <section className="sec wrap">
        <div className="sec-head">
          <h2 className="sec-title">Cómo funciona</h2>
        </div>
        <div className="steps">
          <div className="step">
            <b>1</b>
            <h3>Mirá los avisos</h3>
            <p>Elegí tu ciudad o tu provincia y el rubro. Sin cuenta ya podés ver todo lo que hay.</p>
          </div>
          <div className="step">
            <b>2</b>
            <h3>Tocá el botón</h3>
            <p>Se abre WhatsApp con un mensaje listo para mandar. Si querés, lo cambiás.</p>
          </div>
          <div className="step">
            <b>3</b>
            <h3>Arreglá directo</h3>
            <p>Hablás con el comercio o el profesional y lo arreglan entre ustedes.</p>
          </div>
        </div>
      </section>

      <section className="sec wrap">
        <div className="cta">
          <div>
            <h2>Tu aviso, a la vista de {place}.</h2>
            <p>Publicá una búsqueda en un minuto. Dura {settings?.job_days || 30} días y los candidatos te escriben directo a tu WhatsApp.</p>
            <button className="btn btn-ink btn-lg" onClick={() => onPublish('job')}>
              <ArrowRight size={20} /> Publicar un aviso
            </button>
          </div>
          <JobSign
            preview
            job={{ category: 'Comercio', title: 'Se busca vendedor/a', company_name: 'Tu comercio', location: where, job_type: 'Part-time' }}
          />
        </div>
      </section>
    </>
  );
}
