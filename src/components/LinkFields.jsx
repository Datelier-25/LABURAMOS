import { Plus, X } from 'lucide-react';
import { normalizeLink } from '../lib/premium';

// Editor simple de links para publicar y editar una publicación.
// El límite lo define el estado premium y la configuración del administrador.
export default function LinkFields({ links, onChange, limit, premium = false, upgrade = false }) {
  const setAt = (index, value) => onChange(links.map((link, i) => (i === index ? value : link)));
  const removeAt = (index) => onChange(links.filter((_, i) => i !== index));
  const invalid = links.some((link) => link.trim() && !normalizeLink(link));

  return (
    <div className="link-fields">
      {links.map((link, index) => (
        <div className="link-row" key={index}>
          <input
            inputMode="url"
            autoComplete="url"
            placeholder={index === 0 ? 'https://maps.app.goo.gl/…' : index === 1 ? 'https://instagram.com/…' : 'https://…'}
            value={link}
            onChange={(e) => setAt(index, e.target.value)}
            aria-label={`Link ${index + 1}`}
            aria-invalid={!!link.trim() && !normalizeLink(link)}
          />
          <button type="button" onClick={() => removeAt(index)} aria-label={`Quitar link ${index + 1}`}>
            <X size={15} />
          </button>
        </div>
      ))}
      {invalid && <small className="note err">Revisá el link: tiene que ser una dirección web válida.</small>}
      {links.length < limit && (
        <button type="button" className="chip link-add" onClick={() => onChange([...links, ''])}>
          <Plus size={14} aria-hidden="true" /> Agregar link
        </button>
      )}
      <small>
        Hasta {limit} {limit === 1 ? 'link' : 'links'}. Se muestran dentro de “Ver más”.
        {premium ? ' Tu publicación es premium.' : upgrade ? ' Con premium podés sumar más.' : ''}
      </small>
    </div>
  );
}
