import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { SERVICE_CATEGORIES, friendlyError, intentOf, plural } from '../lib/utils';
import { applyZone, zoneText } from '../lib/geo';
import { ServiceCard } from './Sign';
import { Empty, Filters, SkeletonGrid } from './ui';
import { ZonePicker } from './Place';

const INTENT_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ofrece', label: 'Ofrecen' },
  { value: 'busca', label: 'Buscan' },
];

export default function ServiceList({ user, zone, setZone, onPublish, onLogin }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [intent, setIntent] = useState('todos');
  const [onlyUrgent, setOnlyUrgent] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const q = applyZone(
      supabase.from('services').select('*').eq('status', 'active').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
      zone,
      'city'
    );
    const { data, error: err } = await q;
    if (err) setError(friendlyError(err.message));
    else setServices(data || []);
    setLoading(false);
  }, [zone]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return services
      .filter((s) => {
        const text = !term || [s.title, s.provider_name, s.description].some((v) => (v || '').toLowerCase().includes(term));
        return (
          text &&
          (!category || s.category === category) &&
          (intent === 'todos' || intentOf(s) === intent) &&
          (!onlyUrgent || s.is_urgent)
        );
      })
      .sort((a, b) => Number(!!b.is_urgent) - Number(!!a.is_urgent));
  }, [services, search, category, intent, onlyUrgent]);

  const clear = () => {
    setSearch('');
    setCategory(null);
    setIntent('todos');
    setOnlyUrgent(false);
  };

  const place = zoneText(zone);
  const nAsk = filtered.filter((s) => intentOf(s) === 'busca').length;

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">
            Oficios en <ZonePicker dark zone={zone} setZone={setZone} />
          </h1>
          <p className="lede">Encontrá quién te haga un trabajo o hacé conocer el tuyo. Plomeros, profes, cuidados y más en {place}.</p>
        </div>
        <div className="head-acts">
          <button className="btn btn-line" onClick={() => onPublish('service', 'busca')}>
            Pedir un servicio
          </button>
          <button className="btn btn-ink" onClick={() => onPublish('service', 'ofrece')}>
            Anunciar mi servicio
          </button>
        </div>
      </header>

      <div className="finder">
        <label className="search">
          <span className="sr">Buscar oficios</span>
          <input type="search" placeholder="Buscá un oficio o un nombre" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Search size={26} aria-hidden="true" />
        </label>
        <Filters
          segment={{ options: INTENT_OPTIONS, value: intent, onChange: setIntent }}
          groups={[{ id: 'rubro', label: 'Rubro', all: 'Todos los rubros', options: SERVICE_CATEGORIES, value: category, onChange: setCategory }]}
          toggles={[{ id: 'urgentes', label: 'Solo urgentes', value: onlyUrgent, onChange: setOnlyUrgent }]}
          onClear={clear}
          total={filtered.length}
        />
      </div>

      {loading ? (
        <SkeletonGrid n={3} />
      ) : error ? (
        <Empty title="No pudimos cargar la guía" text={error}>
          <button className="btn btn-ink" onClick={load}>
            Reintentar
          </button>
        </Empty>
      ) : filtered.length === 0 ? (
        <Empty
          title={services.length === 0 ? `Todavía no hay oficios en ${place}` : 'No encontramos ese oficio'}
          text={services.length === 0 ? '¿Hacés algún trabajo? Anunciate y que te encuentren.' : 'Probá con otra palabra o sacá algún filtro.'}
        >
          {services.length === 0 ? (
            <button className="btn btn-ink" onClick={() => onPublish('service', 'ofrece')}>
              Anunciar mi servicio
            </button>
          ) : (
            <button className="btn btn-ink" onClick={clear}>
              Limpiar filtros
            </button>
          )}
        </Empty>
      ) : (
        <>
          <p className="count" aria-live="polite">
            {plural(filtered.length - nAsk, 'servicio ofrecido', 'servicios ofrecidos')} y {plural(nAsk, 'pedido', 'pedidos')} en {place}
          </p>
          <div className="scards">
            {filtered.map((s) => (
              <ServiceCard key={s.id} service={s} user={user} onLogin={onLogin} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
