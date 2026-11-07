import { X } from 'lucide-react';

export default function UserActivityModal({ user, data, onClose, loading }) {
  if (!user || !data) return null;

  const profile = data.profile;
  const jobs = data.jobs || [];
  const services = data.services || [];
  const applications = data.applications || [];
  const reviewsGiven = data.reviews_given || [];
  const reviewsReceived = data.reviews_received || [];
  const cv = data.cv;
  const purchases = data.purchases || [];

  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
  const fmtDateTime = (iso) => iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

  return (
    <div className="place-dlg" role="dialog" aria-modal="true" aria-label={`Actividad de ${profile.full_name || profile.email}`}>
      <div className="admin-activity" style={{ maxWidth: '900px', maxHeight: '85vh', overflow: 'auto' }}>
        <div className="admin-activity-header">
          <div>
            <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{profile.full_name || 'Sin nombre'}</h3>
            <p style={{ margin: '4px 0 0', color: 'var(--muted)', fontSize: '0.9rem' }}>{profile.email} · {profile.role === 'company' ? 'Comercio' : 'Trabajador'}{profile.is_admin ? ' · Admin' : ''}{profile.is_blocked ? ' · Bloqueado' : ''}</p>
          </div>
          <button className="x-menu" onClick={onClose} aria-label="Cerrar">
            <X size={26} />
          </button>
        </div>

        {loading && <div className="admin-activity-loading">Cargando…</div>}

        {!loading && (
          <>
            <div className="admin-activity-section">
              <h4>Resumen</h4>
              <div className="admin-activity-grid">
                <div className="admin-activity-card">
                  <b>{jobs.length}</b> <span>Avisos de empleo</span>
                </div>
                <div className="admin-activity-card">
                  <b>{services.length}</b> <span>Servicios</span>
                </div>
                <div className="admin-activity-card">
                  <b>{applications.length}</b> <span>Postulaciones</span>
                </div>
                <div className="admin-activity-card">
                  <b>{reviewsGiven.length}</b> <span>Reseñas dadas</span>
                </div>
                <div className="admin-activity-card">
                  <b>{reviewsReceived.length}</b> <span>Reseñas recibidas</span>
                </div>
                <div className="admin-activity-card">
                  <b>{purchases.length}</b> <span>Compras de CV</span>
                </div>
              </div>
            </div>

            {jobs.length > 0 && (
              <div className="admin-activity-section">
                <h4>Avisos de empleo ({jobs.length})</h4>
                <div className="admin-activity-list">
                  {jobs.map((j) => (
                    <div key={j.id} className="admin-activity-item">
                      <div>
                        <b>{j.title}</b>
                        <small> · {j.category} · {j.job_type} · {j.location}</small>
                      </div>
                      <div className="admin-activity-meta">
                        <span className={`pill ${j.status === 'active' ? 'active' : j.status === 'paused' ? 'paused' : j.status === 'filled' ? 'verified' : 'expired'}`}>{j.status}</span>
                        <small>Creado: {fmt(j.created_at)} · Vence: {fmt(j.expires_at)}</small>
                        <small>{j.applications_count} postulaciones</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {services.length > 0 && (
              <div className="admin-activity-section">
                <h4>Servicios ({services.length})</h4>
                <div className="admin-activity-list">
                  {services.map((s) => (
                    <div key={s.id} className="admin-activity-item">
                      <div>
                        <b>{s.title}</b>
                        <small> · {s.category} · {s.mode} · {s.location}</small>
                      </div>
                      <div className="admin-activity-meta">
                        <span className={`pill ${s.status === 'active' ? 'active' : s.status === 'paused' ? 'paused' : s.status === 'filled' ? 'verified' : 'expired'}`}>{s.status}</span>
                        <small>Creado: {fmt(s.created_at)} · Vence: {fmt(s.expires_at)}</small>
                        <small>{s.applications_count} contactos</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {applications.length > 0 && (
              <div className="admin-activity-section">
                <h4>Postulaciones ({applications.length})</h4>
                <div className="admin-activity-list">
                  {applications.map((a) => (
                    <div key={a.id} className="admin-activity-item">
                      <div>
                        <b>{a.job_title || a.service_title}</b>
                        <small> · {a.status === 'pending' ? 'Pendiente' : a.status === 'accepted' ? 'Aceptada' : a.status === 'rejected' ? 'Rechazada' : a.status}</small>
                      </div>
                      <div className="admin-activity-meta">
                        <small>{fmtDateTime(a.created_at)}</small>
                        {a.message && <small>{a.message.substring(0, 100)}{a.message.length > 100 ? '…' : ''}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviewsReceived.length > 0 && (
              <div className="admin-activity-section">
                <h4>Reseñas recibidas ({reviewsReceived.length})</h4>
                <div className="admin-activity-list">
                  {reviewsReceived.map((r) => (
                    <div key={r.id} className="admin-activity-item">
                      <div>
                        <b>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b>
                        <small> · De {r.reviewer_name} · {r.job_title || r.service_title}</small>
                      </div>
                      <div className="admin-activity-meta">
                        <small>{fmt(r.created_at)}</small>
                        {r.comment && <small>{r.comment.substring(0, 150)}{r.comment.length > 150 ? '…' : ''}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reviewsGiven.length > 0 && (
              <div className="admin-activity-section">
                <h4>Reseñas dadas ({reviewsGiven.length})</h4>
                <div className="admin-activity-list">
                  {reviewsGiven.map((r) => (
                    <div key={r.id} className="admin-activity-item">
                      <div>
                        <b>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</b>
                        <small> · A {r.reviewee_name} · {r.job_title || r.service_title}</small>
                      </div>
                      <div className="admin-activity-meta">
                        <small>{fmt(r.created_at)}</small>
                        {r.comment && <small>{r.comment.substring(0, 150)}{r.comment.length > 150 ? '…' : ''}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cv && (
              <div className="admin-activity-section">
                <h4>CV</h4>
                <div className="admin-activity-item">
                  <div>
                    <b>{cv.headline || 'Sin título'}</b>
                    <small> · {cv.availability || '—'} · ${cv.salary_expectation || '—'}</small>
                  </div>
                  <div className="admin-activity-meta">
                    <small>Actualizado: {fmt(cv.updated_at)}</small>
                    <small>Público: {cv.is_public ? 'Sí' : 'No'}</small>
                  </div>
                </div>
              </div>
            )}

            {purchases.length > 0 && (
              <div className="admin-activity-section">
                <h4>Compras de CV ({purchases.length})</h4>
                <div className="admin-activity-list">
                  {purchases.map((p) => (
                    <div key={p.id} className="admin-activity-item">
                      <div>
                        <b>${p.amount}</b>
                        <small> · {p.mode === 'por_dias' ? `Por ${p.days} días` : p.mode === 'unica' ? 'Única' : p.mode}</small>
                      </div>
                      <div className="admin-activity-meta">
                        <span className={`pill ${p.status === 'approved' ? 'active' : p.status === 'pending' ? 'paused' : 'expired'}`}>{p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado'}</span>
                        <small>{fmtDateTime(p.created_at)}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(jobs.length === 0 && services.length === 0 && applications.length === 0 && reviewsGiven.length === 0 && reviewsReceived.length === 0 && !cv && purchases.length === 0) && (
              <div className="admin-activity-empty">
                <p>Este usuario no tiene actividad registrada.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
