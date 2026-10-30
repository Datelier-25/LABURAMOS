import { Mail, MapPin, Phone } from 'lucide-react';
import { ageFrom, cleanPhone } from '../lib/utils';
import { placeLabel } from '../lib/geo';
import { themeVars } from '../lib/cvTheme';

const month = (v) => {
  if (!v) return '';
  const [y, m] = v.split('-');
  return m ? `${m}/${y}` : y;
};
const phoneLabel = (raw) => {
  const d = cleanPhone(raw);
  return d.length === 10 ? `${d.slice(0, 4)} ${d.slice(4)}` : raw;
};

// CV de solo lectura: lo usan el PDF y la vista de las empresas. photoUrl es la URL firmada de la foto.
export default function CvSheet({ form, photoUrl = '' }) {
  const age = ageFrom(form.birth_date);
  const where = [form.place && placeLabel(form.place.city, form.place.province), form.neighborhood].filter(Boolean).join(' · ');
  const education = form.education.filter((x) => x.title || x.place);
  const experience = form.experience.filter((x) => x.role || x.place || x.tasks);

  return (
    <div className="cvdoc cv-sheet" style={themeVars(form.theme)}>
      <div className="cv-photo-cell">
        <div className="cv-photo">{photoUrl ? <img src={photoUrl} alt="" /> : null}</div>
      </div>

      <div className="cv-head">
        <h1 className="cv-name">{form.full_name}</h1>
        {form.profession && <p className="cv-role">{form.profession}</p>}
      </div>

      <aside className="cv-side">
        {(age !== null || where) && (
          <div className="cv-block">
            <h3>Datos</h3>
            {age !== null && <p className="cv-age">{age} años</p>}
            {where && (
              <p className="pv-line">
                <MapPin size={14} /> {where}
              </p>
            )}
          </div>
        )}
        {form.skills.length > 0 && (
          <div className="cv-block">
            <h3>Habilidades</h3>
            <ul className="cv-skills">
              {form.skills.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="cv-block">
          <h3>Contacto</h3>
          {form.phone && (
            <p className="pv-line">
              <Phone size={14} /> {phoneLabel(form.phone)}
            </p>
          )}
          {form.email && (
            <p className="pv-line">
              <Mail size={14} /> {form.email}
            </p>
          )}
          <p className="pv-line">Disponibilidad: {form.availability}</p>
        </div>
      </aside>

      <div className="cv-main">
        <div className="cv-mark">
          <img src="/marca/isotipo.png" alt="" />
          <span>
            Laburamos<b>App</b>
          </span>
        </div>
        {form.summary && (
          <div className="cv-block">
            <h3>Presentación</h3>
            <p className="pv-text">{form.summary}</p>
          </div>
        )}
        {education.length > 0 && (
          <div className="cv-block">
            <h3>Educación</h3>
            {education.map((x, i) => (
              <div className="pv-item" key={i}>
                <b>{x.title}</b>
                <span>{[x.place, [x.from, x.to || (x.from ? 'en curso' : '')].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
          </div>
        )}
        {experience.length > 0 && (
          <div className="cv-block">
            <h3>Experiencia</h3>
            {experience.map((x, i) => (
              <div className="pv-item" key={i}>
                <b>{x.role}</b>
                <span>{[x.place, x.from && `${month(x.from)} – ${x.current ? 'actualidad' : month(x.to) || '…'}`].filter(Boolean).join(' · ')}</span>
                {x.tasks && <p className="pv-text">{x.tasks}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
