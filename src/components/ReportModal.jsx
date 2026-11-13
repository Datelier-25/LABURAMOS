import { useEffect, useRef, useState } from 'react';
import { lockScroll } from '../lib/scrollLock';
import { createPortal } from 'react-dom';
import { Check, Flag, X } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';
import LegalConsent from './LegalConsent';
import { consentReady, recordLegalConsent } from '../lib/legal';

const REASONS = [
  { id: 'aviso_falso', label: 'Aviso falso o engañoso' },
  { id: 'estafa', label: 'Parece una estafa' },
  { id: 'anticambio', label: 'Datos de contacto falsos' },
  { id: 'anticipo', label: 'Pide dinero por adelantado' },
  { id: 'discriminacion', label: 'Contenido discriminatorio u ofensivo' },
  { id: 'otro', label: 'Otro motivo' },
];

export default function ReportModal({ report, onClose, notify }) {
  const isSvc = report?.kind === 'service';
  const target = isSvc ? report.service : report?.job;
  const kind = isSvc ? 'service' : 'job';
  const id = target?.id;
  const [reason, setReason] = useState(REASONS[0].id);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [consent, setConsent] = useState({ terms: false, privacy: false });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener('keydown', onKey, true);
      unlock();
    };
  }, []);

  const send = async (e) => {
    e.preventDefault();
    if (!id) {
      setError('No pudimos identificar el aviso. Probá de nuevo.');
      return;
    }
    if (busy) return;
    if (!consentReady(consent)) {
      setError('Para enviar la denuncia, aceptá los Términos y la Política de Privacidad.');
      return;
    }
    setBusy(true);
    setError('');
    const text = [
      `Motivo: ${REASONS.find((r) => r.id === reason)?.label}.`,
      details.trim() ? `Detalle: ${details.trim()}` : '',
      `Aviso: ${target.title || ''} · ID ${id} · ${kind === 'service' ? target.provider_name || '' : target.company_name || ''} · ${kind === 'service' ? target.city || '' : target.location || ''}.`,
      `Enlace: ${window.location.href}`,
    ]
      .filter(Boolean)
      .join(' ');
    const { error: err } = await supabase.rpc('create_report', {
      p_type: 'denuncia',
      p_job_id: kind === 'service' ? null : id,
      p_service_id: kind === 'service' ? id : null,
      p_message: text.slice(0, 2000),
    });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    setSent(true);
    void recordLegalConsent('denuncia-aviso');
    notify('Denuncia enviada. Gracias por avisar.');
  };

  const title = kind === 'service' ? 'Denunciar servicio' : 'Denunciar aviso';

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="place-dlg rep-dlg" role="dialog" aria-modal="true" aria-label={title}>
        <div className="place-head">
          <h2>{title}</h2>
          <button type="button" className="x-sm" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        {sent ? (
          <div className="report-ok">
            <span className="report-ok-ic">
              <Check size={30} />
            </span>
            <h3>Recibido</h3>
            <p>
              Tu denuncia sobre <b>{target?.title}</b> llegó al equipo de LaburamosApp. La revisamos con calma; no te respondemos por este canal.
            </p>
            <button type="button" className="btn btn-ink btn-block" onClick={onClose}>
              Listo
            </button>
          </div>
        ) : (
          <>
            <div className="report-job">
              <Flag size={16} aria-hidden="true" />
              <div>
                <b>{target?.title}</b>
                <small>
                  {kind === 'service' ? target?.provider_name : target?.company_name} · {kind === 'service' ? target?.city : target?.location}
                </small>
              </div>
            </div>

            <form onSubmit={send}>
              <div className="field">
                <span>Motivo</span>
                <div className="fchips" role="group" aria-label="Motivo de la denuncia">
                  {REASONS.map((r) => (
                    <button key={r.id} type="button" className={`chip${reason === r.id ? ' on' : ''}`} onClick={() => setReason(r.id)} aria-pressed={reason === r.id}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <span>Contanos más (opcional)</span>
                <textarea
                  maxLength={800}
                  placeholder="Qué pasó, qué te hizo sospechar del aviso…"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                />
              </div>

              {error && <p className="note err">{error}</p>}
              <LegalConsent value={consent} onChange={setConsent} compact />
              <button type="submit" className="btn btn-ink btn-block" disabled={busy}>
                <Flag size={18} /> {busy ? 'Enviando…' : 'Enviar denuncia'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
