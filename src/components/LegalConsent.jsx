// Dos casillas independientes para cada formulario: Términos y Privacidad.
// Nunca vienen premarcadas: el consentimiento tiene que ser una acción expresa.
export default function LegalConsent({ value, onChange, compact = false, note }) {
  const checked = { terms: !!value?.terms, privacy: !!value?.privacy };

  const toggle = (key) => (event) => {
    onChange?.({ ...checked, [key]: event.target.checked });
  };

  return (
    <div className={`legal-consent${compact ? ' compact' : ''}`}>
      <label>
        <input type="checkbox" checked={checked.terms} onChange={toggle('terms')} />
        <span>
          Acepto los{' '}
          <a href="/terminos" target="_blank" rel="noopener noreferrer">
            Términos y Condiciones
          </a>
          .
        </span>
      </label>
      <label>
        <input type="checkbox" checked={checked.privacy} onChange={toggle('privacy')} />
        <span>
          Acepto la{' '}
          <a href="/privacidad" target="_blank" rel="noopener noreferrer">
            Política de Privacidad
          </a>{' '}
          y el tratamiento de mis datos personales.
        </span>
      </label>
      {note && <p className="legal-consent-note">{note}</p>}
    </div>
  );
}
