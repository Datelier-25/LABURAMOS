import { useEffect, useState } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';
import { scoreLabel, scoreTone } from './Reputation';
import LegalConsent from './LegalConsent';
import { consentReady, recordLegalConsent } from '../lib/legal';

// Calificar a la otra parte de una postulación (empresa ↔ persona).
// Se puntúan tres aspectos del trabajo, de 1 a 5. El puntaje público (0-100)
// sale del promedio. La base toma el autor y el calificado de la postulación.
const ASPECTS = [
  { key: 'compliance', label: 'Cumplimiento', hint: '¿Hizo lo que acordaron?' },
  { key: 'responsibility', label: 'Responsabilidad', hint: '¿Fue puntual y avisó?' },
  { key: 'communication', label: 'Comunicación', hint: '¿Respondió y trató bien?' },
];

export default function ReviewModal({ applicationId, targetName, targetKind = 'persona', onClose, onDone }) {
  const [scores, setScores] = useState({ compliance: 0, responsibility: 0, communication: 0 });
  const [hover, setHover] = useState({ key: null, value: 0 });
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [consent, setConsent] = useState({ terms: false, privacy: false });

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const complete = ASPECTS.every((a) => scores[a.key] > 0);
  const average = (scores.compliance + scores.responsibility + scores.communication) / 3;
  const score = complete ? Math.round((average / 5) * 100) : 0;

  const save = async (e) => {
    e.preventDefault();
    if (!complete) return setError('Puntuá los tres aspectos (1 a 5).');
    if (!consentReady(consent)) return setError('Para publicar la calificación, aceptá los Términos y la Política de Privacidad.');
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('reviews').insert({
      application_id: applicationId,
      compliance: scores.compliance,
      responsibility: scores.responsibility,
      communication: scores.communication,
      comment: comment.trim() || null,
    });
    setSaving(false);
    if (err) setError(friendlyError(err.message));
    else {
      void recordLegalConsent('calificacion');
      onDone?.();
    }
  };

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

        {ASPECTS.map((a) => {
          const value = hover.key === a.key ? hover.value : scores[a.key];
          return (
            <div key={a.key} className="rate-row">
              <div className="rate-head">
                <b>{a.label}</b>
                <small>{a.hint}</small>
              </div>
              <div className="rate-scale" role="radiogroup" aria-label={`${a.label} (1 a 5)`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={scores[a.key] === n}
                    aria-label={`${n} de 5`}
                    className={n <= value ? 'on' : ''}
                    onMouseEnter={() => setHover({ key: a.key, value: n })}
                    onMouseLeave={() => setHover({ key: null, value: 0 })}
                    onClick={() => setScores((s) => ({ ...s, [a.key]: n }))}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className={`rate-preview tone-${complete ? scoreTone(score) : 'none'}`}>
          {complete ? (
            <>
              <ShieldCheck size={18} aria-hidden="true" />
              <span>
                Puntaje: <b>{score}</b>/100 <small>· {scoreLabel(score)}</small>
              </span>
            </>
          ) : (
            <span className="note">1 = no cumplió · 5 = siempre cumplió</span>
          )}
        </div>

        <label className="field">
          <span>Reseña (opcional)</span>
          <textarea
            maxLength={600}
            rows={3}
            placeholder="Contá cómo fue la experiencia: si cumplió, si pagó en tiempo, si fue respetuoso…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </label>
        <p className="note">Se publica con tu puntaje, sin tus datos personales. No se puede editar después.</p>

        <LegalConsent value={consent} onChange={setConsent} compact />

        <button className="btn btn-ink btn-lg btn-block" disabled={saving || !complete}>
          {saving ? 'Enviando…' : 'Publicar calificación'}
        </button>
      </form>
    </div>
  );
}
