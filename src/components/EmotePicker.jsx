import { EMOTE_OPTIONS, emoteUrl } from '../lib/emotes';

// Selector de emote: miniaturas del catálogo (30 oficios × hombre/mujer).
export default function EmotePicker({ value, onChange }) {
  return (
    <>
      {value && (
        <div className="emote-pick">
          <span className="emote-cur">
            <img src={emoteUrl(value)} alt="" />
          </span>
          <button type="button" className="chip" onClick={() => onChange('')}>
            Quitar emote
          </button>
        </div>
      )}
      <details className="emote-picker">
        <summary>{value ? 'Elegir otro emote' : 'Elegir emote'}</summary>
        <div className="emote-grid" role="group" aria-label="Catálogo de emotes">
          {EMOTE_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`emote${value === o.id ? ' on' : ''}`}
              title={`${o.label} (${o.cat})`}
              onClick={() => onChange(o.id)}
              aria-pressed={value === o.id}
            >
              <img src={o.url} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </details>
    </>
  );
}
