import { useEffect, useState } from 'react';
import { Check, Flag, Lightbulb, Send } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { friendlyError } from '../lib/utils';
import LegalConsent from './LegalConsent';
import { consentReady, recordLegalConsent } from '../lib/legal';

const TYPES = [
  { id: 'sugerencia', label: 'Sugerencia' },
  { id: 'denuncia', label: 'Denuncia' },
];

export default function Contacto({ user, settings, notify }) {
  const [type, setType] = useState('sugerencia');
  const [jobId, setJobId] = useState('');
  const [jobs, setJobs] = useState([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [consent, setConsent] = useState({ terms: false, privacy: false });

  useEffect(() => {
    if (!user?.id) return undefined;
    let off = false;
    supabase
      .from('jobs')
      .select('id, title')
      .eq('company_id', user.id)
      .eq('status', 'active')
      .then(({ data }) => {
        if (!off) setJobs(data || []);
      });
    return () => {
      off = true;
    };
  }, [user?.id]);

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Contá el mensaje antes de enviarlo.');
      return;
    }
    if (!consentReady(consent)) {
      setError('Para enviar el mensaje, aceptá los Términos y la Política de Privacidad.');
      return;
    }
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('create_report', { p_type: type, p_job_id: jobId || null, p_service_id: null, p_message: message.trim() });
    setBusy(false);
    if (err) {
      setError(friendlyError(err.message));
      return;
    }
    setSent(true);
    setMessage('');
    setJobId('');
    void recordLegalConsent(type === 'denuncia' ? 'contacto-denuncia' : 'contacto-sugerencia');
    notify('Gracias. Tu mensaje llegó al equipo de LaburamosApp.');
  };

  const adminEmail = settings?.contact_email;

  return (
    <section className="wrap page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Sugerencias y denuncias</h1>
          <p className="lede">
            ¿Encontraste un aviso falso, una oferta que parece una estafa o una experiencia que te molestó? Escribinos. También podés
            pasar una sugerencia para mejorar LaburamosApp. Todo llega al equipo por el correo <b>{adminEmail || '…'}</b>.
          </p>
        </div>
      </header>

      <div className="safety-hero">
        <Flag size={30} aria-hidden="true" />
        <p>
          <b>LaburamosApp no interviene en los acuerdos</b> que se hacen por WhatsApp entre las partes, pero las denuncias sobre avisos,
          ofertas o conductas se toman en serio.
        </p>
      </div>

      <form onSubmit={send}>
        {error && <p className="note err">{error}</p>}
        {sent && (
          <p className="note ok">
            <Check size={14} style={{ verticalAlign: '-2px' }} /> Gracias: tu {type === 'denuncia' ? 'denuncia' : 'sugerencia'} quedó registrado
            y lo revisa el equipo.
          </p>
        )}

        <div className="field">
          <span>Tipo</span>
          <div className="fchips" role="group" aria-label="Tipo de mensaje">
            {TYPES.map((t) => (
              <button key={t.id} type="button" className={`chip${type === t.id ? ' on' : ''}`} onClick={() => setType(t.id)} aria-pressed={type === t.id}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {jobs.length > 0 && (
          <div className="field">
            <span>{type === 'denuncia' ? 'Aviso al que te referís' : 'Aviso que te genera la duda (opcional)'}</span>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
              <option value="">Sin aviso en particular</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="field">
          <span>{type === 'denuncia' ? 'Contanos qué pasó' : 'Contanos tu idea'}</span>
          <textarea required minLength={10} maxLength={2000} placeholder="Contá el contexto: qué aviso, qué oferta, qué te molestó…" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <LegalConsent value={consent} onChange={setConsent} compact />

        <button type="submit" className="btn btn-ink" disabled={busy}>
          <Send size={18} /> {busy ? 'Enviando…' : 'Enviar al equipo'}
        </button>
      </form>

      <div className="safety-hero" style={{ marginTop: 26 }}>
        <Lightbulb size={30} aria-hidden="true" />
        <p>
          <b>Si es una denuncia urgente</b> (amenazas, estafa en curso), escribinos igualmente con el aviso que te afecta y lo revisamos
          rápido.
        </p>
      </div>
    </section>
  );
}
