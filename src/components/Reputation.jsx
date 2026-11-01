import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { BadgeCheck, ShieldCheck, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { timeAgo } from '../lib/utils';

// El puntaje va de 0 a 100 y sale del promedio de tres aspectos del trabajo.
const ASPECTS = [
  { key: 'compliance', label: 'Cumplimiento' },
  { key: 'responsibility', label: 'Responsabilidad' },
  { key: 'communication', label: 'Comunicación' },
];

export function scoreLabel(n) {
  if (n >= 90) return 'Excelente';
  if (n >= 80) return 'Muy confiable';
  if (n >= 70) return 'Confiable';
  if (n >= 50) return 'A mejorar';
  return 'Con observaciones';
}

export function scoreTone(n) {
  if (n >= 85) return 'high';
  if (n >= 70) return 'mid';
  return 'low';
}

// Puntaje (0-100) de una valoración puntual.
export function reviewScore(r) {
  const c = Number(r?.compliance || 0);
  const resp = Number(r?.responsibility || 0);
  const m = Number(r?.communication || 0);
  const avg = c && resp && m ? (c + resp + m) / 3 : Number(r?.rating || 0);
  return Math.round((avg / 5) * 100);
}

// Puntaje público de una cuenta: número (sobre 100) y cantidad de valoraciones.
// Tocar el puntaje abre el detalle y las reseñas escritas.
export function Reputation({ data, className = '' }) {
  const [open, setOpen] = useState(false);
  const reviews = Number(data?.reviews || 0);
  const score = Number(data?.score || 0);
  const comments = Number(data?.comments || 0);
  const verified = !!data?.is_verified;
  if (!verified && !reviews) return null;

  const title = `Puntaje de cumplimiento ${score}/100 · ${reviews} ${reviews === 1 ? 'valoración' : 'valoraciones'}${
    comments ? ` · ${comments} ${comments === 1 ? 'reseña' : 'reseñas'}` : ' · sin reseñas escritas'
  }`;

  return (
    <span className={`rep ${className}`.trim()}>
      {verified && (
        <span className="rep-ver" title="Cuenta verificada por LaburamosApp">
          <BadgeCheck size={15} aria-hidden="true" /> Verificado
        </span>
      )}
      {reviews > 0 && (
        <button type="button" className={`rep-score tone-${scoreTone(score)}`} onClick={() => setOpen(true)} title={title} aria-label={title}>
          <ShieldCheck size={14} aria-hidden="true" />
          <b>{score}</b>
          <small>({reviews})</small>
        </button>
      )}
      {open && <ReputationModal data={data} onClose={() => setOpen(false)} />}
    </span>
  );
}

function ReputationModal({ data, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const reviews = Number(data?.reviews || 0);
  const comments = Number(data?.comments || 0);
  const score = Number(data?.score || 0);
  const userId = data?.user_id;

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

  useEffect(() => {
    let off = false;
    (async () => {
      const { data: list } = await supabase
        .from('user_reviews')
        .select('id, rating, compliance, responsibility, communication, comment, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!off) {
        setRows(list || []);
        setLoading(false);
      }
    })();
    return () => {
      off = true;
    };
  }, [userId]);

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="place-dlg rep-dlg" role="dialog" aria-modal="true" aria-label="Puntaje de cumplimiento">
        <div className="place-head">
          <h2>Puntaje de cumplimiento</h2>
          <button type="button" className="x-sm" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className={`rep-hero tone-${scoreTone(score)}`}>
          <span className="rep-hero-num">
            {score}
            <small>/100</small>
          </span>
          <span className="rep-hero-txt">
            <b>{scoreLabel(score)}</b>
            <small>
              {reviews} {reviews === 1 ? 'valoración' : 'valoraciones'} · {comments} {comments === 1 ? 'reseña' : 'reseñas'}
            </small>
          </span>
        </div>

        <div className="rep-bars">
          {ASPECTS.map((a) => {
            const value = Number(data?.[a.key] || 0);
            return (
              <div key={a.key} className="rep-bar">
                <span>{a.label}</span>
                <span className="rep-track">
                  <span style={{ width: `${value}%` }} />
                </span>
                <b>{value}</b>
              </div>
            );
          })}
        </div>

        <div className="rep-comments">
          <h3>Reseñas</h3>
          {loading ? (
            <p className="note">Cargando reseñas…</p>
          ) : rows.length === 0 ? (
            <p className="note">Todavía no hay reseñas escritas. El puntaje sale de las valoraciones recibidas.</p>
          ) : (
            rows.map((r) => (
              <article key={r.id} className="rep-item">
                <header>
                  <span className={`rep-item-score tone-${scoreTone(reviewScore(r))}`}>
                    <ShieldCheck size={13} aria-hidden="true" /> {reviewScore(r)}
                  </span>
                  <time dateTime={r.created_at}>{timeAgo(r.created_at)}</time>
                </header>
                <p>{r.comment}</p>
              </article>
            ))
          )}
        </div>

        <p className="note">
          Se calcula con tres aspectos: cumplimiento de lo acordado, responsabilidad y comunicación. Las valoraciones no se pueden editar.
        </p>
      </div>
    </div>,
    document.body
  );
}
