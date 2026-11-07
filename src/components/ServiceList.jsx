import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { SERVICE_CATEGORIES, friendlyError, intentOf, plural } from '../lib/utils';
import { applyZone, withinKm, zoneText } from '../lib/geo';
import { attachReputation, loadReputation } from '../lib/reputation';
import { ServiceCard } from './Sign';
import { Empty, Filters, SkeletonGrid } from './ui';
import { ZonePicker } from './Place';

const INTENT_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'ofrece', label: 'Ofrecen' },
  { value: 'busca', label: 'Buscan' },
];

export default function ServiceList({ user, zone, setZone, onPublish, onLogin, onReport, deep, savedSvc, onSaveSvc }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(null);
  const [intent, setIntent] = useState('todos');
  const [distanceKm, setDistanceKm] = useState(0); // Radio máximo (km); 0 = sin límite

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const q = applyZone(
      supabase.from('services').select('*').eq('status', 'active').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }),
      // Con distancia elegida, buscamos a nivel de provincia para llegar a las zonas cercanas
      distanceKm > 0 && zone?.province ? { city: null, province: zone.province } : zone,
      'city'
    );
    const { data, error: err } = await q;
    if (err) {
      setError(friendlyError(err.message));
      setServices([]);
    } else {
      const rep = await loadReputation((data || []).map((s) => s.owner_id));
      setServices(attachReputation(data || [], rep, 'owner_id'));
    }
    setLoading(false);
  }, [zone, distanceKm]);

  useEffect(() => {
    load();
  }, [load]);

  // Enlace profundo (#/aviso/...) al servicio puntual: lo llevamos al frente al cargar.
  const deepId = deep?.id;
  useEffect(() => {
    if (!deepId) return undefined;
    const t = setTimeout(() => {
      document.getElementById(`svc-${deepId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(t);
  }, [deepId, services]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return services
      .filter((s) => {
        const text = !term || [s.title, s.provider_name, s.description].some((v) => (v || '').toLowerCase().includes(term));
        return (
          text &&
          (!category || s.category === category) &&
          (intent === 'todos' || intentOf(s) === intent) &&
          (!distanceKm || withinKm(zone, { city: s.city, province: s.province }, distanceKm))
        );
      });
  }, [services, search, category, intent, zone, distanceKm]);

  const clear = () => {
    setSearch('');
    setCategory(null);
    setIntent('todos');
    setDistanceKm(0);
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
          distance={{ value: distanceKm, onChange: setDistanceKm }}
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
              <ServiceCard key={s.id} service={s} user={user} onLogin={onLogin} onReport={onReport} saved={savedSvc.includes(s.id)} onSave={onSaveSvc} onChanged={load} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
