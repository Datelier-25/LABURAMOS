import { Plus, X } from 'lucide-react';

export const MAX_REQUIREMENTS = 10;

// Editor de requisitos del aviso. Cada ítem tiene su texto y una casilla para
// marcarlo como excluyente (obligatorio) o dejarlo como deseable.
export default function RequirementItems({ items = [], onChange, disabled = false }) {
  const update = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const remove = (index) => onChange(items.filter((_, i) => i !== index));
  const add = () => onChange([...items, { text: '', required: false }]);

  return (
    <div className="req-editor">
      {items.length === 0 && (
        <p className="req-empty">Todavía no cargaste requisitos. Podés sumar los que necesites.</p>
      )}
      {items.map((item, i) => (
        <div className="req-row" key={i}>
          <input
            value={item.text || ''}
            maxLength={200}
            disabled={disabled}
            placeholder="Ej.: Experiencia previa en atención al público"
            aria-label={`Requisito ${i + 1}`}
            onChange={(e) => update(i, { text: e.target.value })}
          />
          <label className="req-flag">
            <input
              type="checkbox"
              checked={!!item.required}
              disabled={disabled}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            <span>Excluyente</span>
          </label>
          <button
            type="button"
            className="req-del"
            disabled={disabled}
            onClick={() => remove(i)}
            aria-label={`Quitar requisito ${i + 1}`}
            title="Quitar requisito"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      ))}
      {items.length < MAX_REQUIREMENTS && (
        <button type="button" className="btn btn-line req-add" onClick={add} disabled={disabled}>
          <Plus size={16} aria-hidden="true" /> Agregar requisito
        </button>
      )}
      <small>
        Marcá “Excluyente” si el requisito es obligatorio. Los que no estén tildados se muestran como no excluyentes.
      </small>
    </div>
  );
}
