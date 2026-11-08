import { useEffect, useRef, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { createPortal } from 'react-dom';
import { ArrowLeft, Pencil, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError, money } from '../lib/utils';
import { loadReputation } from '../lib/reputation';
import { publicationState, PUBLICATION_STATES, userPublications } from '../lib/adminUsers';
import JobSign, { ServiceCard } from './Sign';
import EditListing from './EditListing';

const fmt = (value) => value ? new Date(value).toLocaleDateString('es-AR') : '—';
const fmtTime = (value) => value ? new Date(value).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const text = (value) => Array.isArray(value) ? value.map((v) => typeof v === 'string' ? v : JSON.stringify(v)).join(' · ') : typeof value === 'object' && value !== null ? JSON.stringify(value) : value || '—';

function ActivitySection({ title, rows, render }) {
  return <section className="au-history"><h3>{title} · {rows.length}</h3>{rows.length ? <ul>{rows.map((row) => <li key={row.id}>{render(row)}</li>)}</ul> : <p className="au-muted">Sin registros.</p>}</section>;
}

export default function UserActivityModal({ user, data, onClose, loading, error, onRetry, initialTab = 'publications', onChanged }) {
  const dialog = useRef(null);
  const closeButton = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [tab, setTab] = useState(initialTab);
  const [selected, setSelected] = useState(null);
  const [record, setRecord] = useState(null);
  const [recordLoading, setRecordLoading] = useState(false);
  const [recordError, setRecordError] = useState('');
  const [recordVersion, setRecordVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editingBusy, setEditingBusy] = useState(false);
  const profile = data?.profile || user;
  const publications = userPublications(data);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const el = dialog.current;
    el.showModal();
    const unlock = lockScroll();
    closeButton.current?.focus();
    return () => {
      el.close();
      unlock();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setRecord(null); setRecordLoading(true); setRecordError('');
    (async () => {
      try {
        const isJob = selected.kind === 'job';
        const { data: item, error: err } = await supabase.from(isJob ? 'jobs' : 'services').select('*')
          .eq('id', selected.id).eq(isJob ? 'company_id' : 'owner_id', user.id).maybeSingle();
        if (err) throw err;
        if (!item) throw new Error('La publicación ya no está disponible o no tenés permiso para verla.');
        const reputation = await loadReputation([user.id]);
        if (!cancelled) setRecord({ ...item, reputation: reputation[user.id] || null });
      } catch (err) { if (!cancelled) setRecordError(friendlyError(err.message)); }
      finally { if (!cancelled) setRecordLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [selected, user.id, recordVersion]);

  const changeTab = (next) => { if (editingBusy) return; setTab(next); setSelected(null); setEditing(false); };
  const openPublication = (item) => { setSelected(item); setRecord(null); setRecordError(''); setEditing(false); };
  const detail = selected && record;

  return createPortal(<dialog ref={dialog} className="au-dialog" aria-labelledby="au-user-title" onCancel={(e) => { e.preventDefault(); if (!editingBusy) closeRef.current(); }}>
    <header className="au-dialog-head"><div><h2 id="au-user-title">{profile.full_name || 'Sin nombre'}</h2><p>{profile.email}<br />{[profile.city, profile.province].filter(Boolean).join(' · ') || 'Sin localidad'}</p></div><button ref={closeButton} type="button" disabled={editingBusy} className="icon-btn" onClick={onClose} aria-label="Cerrar detalle del usuario"><X size={20} /></button></header>
    <div className="au-dialog-body">
      <nav className="au-detail-tabs" aria-label="Detalle de la cuenta">{[['account', 'Cuenta'], ['publications', `Publicaciones${data ? ` (${publications.length})` : ''}`], ['activity', 'Actividad']].map(([key, label]) => <button key={key} type="button" disabled={editingBusy} aria-pressed={tab === key} onClick={() => changeTab(key)}>{label}</button>)}</nav>
      {loading && <p className="note" role="status">Cargando información del usuario…</p>}
      {error && <div className="note err" role="alert">{error} <button type="button" className="au-btn" onClick={onRetry}>Reintentar</button></div>}
      {!loading && !error && data && <>
        {tab === 'account' && <section className="au-account"><h3>Información de la cuenta</h3><dl><div><dt>Tipo de cuenta</dt><dd>{profile.role === 'company' ? 'Empleador / comercio' : 'Trabajador'}</dd></div><div><dt>Permisos</dt><dd>{profile.is_admin ? 'Administrador' : 'Usuario'}</dd></div><div><dt>Estado de acceso</dt><dd>{profile.is_blocked ? 'Bloqueado' : 'Activo'}</dd></div><div><dt>Verificación</dt><dd>{profile.is_verified ? 'Verificado' : profile.verification_requested ? 'En proceso de verificación' : 'No verificado'}</dd></div><div><dt>Fecha de registro</dt><dd>{fmtTime(profile.created_at)}</dd></div><div><dt>Último ingreso</dt><dd>{fmtTime(profile.last_sign_in_at)}</dd></div><div><dt>Publicaciones realizadas</dt><dd>{publications.length}</dd></div><div><dt>Postulaciones realizadas</dt><dd>{(data.applications || []).length}</dd></div></dl></section>}
        {tab === 'publications' && !selected && <section><h3>Publicaciones realizadas · {publications.length}</h3><p className="au-muted">Empleos, servicios y pedidos · todos los estados · más recientes primero</p>{!publications.length ? <p className="note">Este usuario todavía no tiene publicaciones.</p> : <div className="au-table-scroll"><table className="au-publications"><thead><tr><th scope="col">Publicación</th><th scope="col">Estado</th><th scope="col">Publicada</th><th scope="col">Detalle</th></tr></thead><tbody>{publications.map((item) => { const status = publicationState(item); return <tr key={`${item.kind}-${item.id}`}><th scope="row"><b>{item.title}</b><small>{item.kind === 'job' ? 'Aviso de empleo' : item.mode === 'busca' ? 'Pedido' : 'Servicio'} · {item.location || 'Sin localidad'}</small></th><td><span className={`au-badge ${status}`}>{PUBLICATION_STATES[status] || status || 'Sin estado'}</span></td><td>{fmt(item.created_at)}</td><td><button type="button" className="au-btn" onClick={() => openPublication(item)}>Ver detalle</button></td></tr>; })}</tbody></table></div>}</section>}
        {tab === 'publications' && selected && <section className="au-publication-detail"><button type="button" disabled={editingBusy} className="au-btn" onClick={() => { setSelected(null); setEditing(false); }}><ArrowLeft size={15} /> Volver a publicaciones</button><h3>{editing ? 'Editar publicación' : 'Publicación del usuario'}</h3>{recordLoading && <p role="status">Cargando la tarjeta…</p>}{recordError && <p className="note err" role="alert">{recordError} <button type="button" className="au-btn" onClick={() => setRecordVersion((v) => v + 1)}>Reintentar</button></p>}
          {detail && !recordLoading && (editing ? <EditListing key={`${selected.kind}-${record.id}`} embedded kind={selected.kind} item={record} onClose={() => setEditing(false)} onBusyChange={setEditingBusy} onSaved={() => { setRecordVersion((v) => v + 1); onChanged?.(); }} /> : <><div className="au-preview-meta"><span className={`au-badge ${publicationState(record)}`}>{PUBLICATION_STATES[publicationState(record)] || record.status}</span><span>Publicada {fmt(record.created_at)} · Vence {fmt(record.expires_at)}</span><button type="button" className="au-btn" onClick={() => setEditing(true)}><Pencil size={14} /> Editar publicación</button></div><div className="au-public-card">{selected.kind === 'job' ? <JobSign job={record} preview /> : <ServiceCard service={record} preview />}</div><p className="au-muted">Vista de la tarjeta pública. Las acciones de contacto y guardado están desactivadas en este panel.</p></>)}
        </section>}
        {tab === 'activity' && <>
          <ActivitySection title="Postulaciones" rows={data.applications || []} render={(a) => <><b>{a.job_title || a.service_title || 'Publicación eliminada'}</b><p>{a.company_name}{a.status ? ` · ${a.status}` : ''}</p><small>{fmtTime(a.created_at)}</small>{a.message && <p>{a.message}</p>}</>} />
          <ActivitySection title="Valoraciones recibidas" rows={data.reviews_received || []} render={(r) => <><b>{r.rating}/5 · {r.reviewer_name || 'Usuario'}</b><p>{r.comment || 'Sin comentario'}</p><small>{r.job_title || r.service_title} · {fmt(r.created_at)}</small></>} />
          <ActivitySection title="Valoraciones realizadas" rows={data.reviews_given || []} render={(r) => <><b>{r.rating}/5 · {r.reviewee_name || 'Usuario'}</b><p>{r.comment || 'Sin comentario'}</p><small>{r.job_title || r.service_title} · {fmt(r.created_at)}</small></>} />
          <section className="au-history"><h3>CV</h3>{data.cv ? <><b>{data.cv.headline || 'Sin título'}</b><p>{data.cv.summary}</p><dl className="au-cv"><dt>Disponibilidad</dt><dd>{text(data.cv.availability)}</dd><dt>Habilidades</dt><dd>{text(data.cv.skills)}</dd><dt>Experiencia</dt><dd>{text(data.cv.experience)}</dd><dt>Formación</dt><dd>{text(data.cv.education)}</dd></dl><p className="au-muted">{data.cv.is_public ? 'Visible' : 'Oculto'} · Actualizado {fmt(data.cv.updated_at)}</p></> : <p className="au-muted">No tiene un CV registrado.</p>}</section>
          <ActivitySection title="Compras de CV" rows={data.purchases || []} render={(p) => <><b>{money(p.amount)}</b><p>{({ por_descarga: 'Por descarga', por_dias: `Por ${p.days} días`, para_siempre: 'Para siempre' })[p.mode] || p.mode} · {({ approved: 'Aprobada', pending: 'Pendiente', rejected: 'Rechazada' })[p.status] || p.status}</p><small>{fmtTime(p.created_at)}</small></>} />
        </>}
      </>}
    </div>
    <footer className="au-dialog-footer"><p>Cerrá este panel para volver al listado de usuarios.</p><button type="button" disabled={editingBusy} className="btn btn-ink" onClick={onClose}>Cerrar y volver a usuarios</button></footer>
  </dialog>, document.body);
}
