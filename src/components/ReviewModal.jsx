import { useEffect, useState } from 'react';
import { Star, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';

// Calificar a la otra parte de una postulación (empresa ↔ persona).
// La base toma el autor y el calificado de la postulación: acá no se pueden falsificar.
export default function ReviewModal({ applicationId, targetName, targetKind = 'persona', onClose, onDone }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = async (e) => {
    e.preventDefault();
    if (!rating) return setError('Elegí de 1 a 5 estrellas.');
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('reviews').insert({
      application_id: applicationId,
      rating,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (err) setError(friendlyError(err.message));
    else onDone?.();
  };

  const value = hover || rating;

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="place-dlg review-dlg" role="dialog" aria-modal="true" aria-label={`Calificar a ${targetName}`} onSubmit={save}>
        <div className="place-head">
          <h2>Calificar {targetKind === 'comercio' ? 'al comercio' : 'a la persona'}</h2>
          <button type="button" className="x-sm" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <p className="lede">{targetName}</p>
        {error && <p className="note err">{error}</p>}

        <div className="stars-input" role="radiogroup" aria-label="Puntaje de 1 a 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} ${n === 1 ? 'estrella' : 'estrellas'}`}
              className={n <= value ? 'on' : ''}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
            >
              <Star size={30} fill={n <= value ? 'currentColor' : 'none'} aria-hidden="true" />
            </button>
          ))}
        </div>

        <label className="field">
          <span>Comentario (opcional)</span>
          <textarea
            maxLength={600}
            rows={4}
            placeholder="Contá cómo fue la experiencia: si cumplió, si pagó en tiempo, si fue respetuoso…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <p className="note">Se publica con tu puntaje, sin tus datos personales. No se puede editar después.</p>

        <button className="btn btn-ink btn-lg btn-block" disabled={saving}>
          {saving ? 'Enviando…' : 'Publicar reseña'}
        </button>
      </form>
    </div>
  );
}
