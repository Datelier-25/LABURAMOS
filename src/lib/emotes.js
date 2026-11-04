// Catálogo de emotes: ilustraciones de oficios ( chew public/emotes/*.png ) para
// usar como imagen de la tarjeta cuando quien publica no sube fotos.
// Cada emote tiene una variante *_hombre y *_mujer; en el alta se elige la que
// quiera y en la base se guarda el id completo (ej. "plomero_mujer").

const BASES = [
  { id: 'agricultor', label: 'Agricultor/a', cats: ['Agro / Campo'] },
  { id: 'carpintero', label: 'Carpintero/a', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'cerrajero', label: 'Cerrajero/a', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'cocinero', label: 'Cocinero/a', cats: ['Gastronomía'] },
  { id: 'colocador_ladrillos', label: 'Albañil', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'comerciante', label: 'Comerciante', cats: ['Comercio'] },
  { id: 'conductor', label: 'Conductor/a', cats: ['Transporte'] },
  { id: 'contador', label: 'Contador/a', cats: ['Administración', 'Profesionales'] },
  { id: 'cuidador', label: 'Cuidador/a de personas', cats: ['Salud y cuidados', 'Cuidados'] },
  { id: 'cuidador_infantil', label: 'Cuidado infantil', cats: ['Cuidados'] },
  { id: 'docente', label: 'Docente', cats: ['Clases particulares'] },
  { id: 'electricista', label: 'Electricista', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'enfermero', label: 'Enfermero/a', cats: ['Salud y cuidados'] },
  { id: 'jardinero', label: 'Jardinero/a', cats: ['Oficios', 'Agro / Campo'] },
  { id: 'limpieza', label: 'Limpieza', cats: ['Limpieza'] },
  { id: 'masajista', label: 'Masajista', cats: ['Cuidados', 'Eventos'] },
  { id: 'mecanico', label: 'Mecánico/a', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'mozo', label: 'Mozo/a', cats: ['Gastronomía'] },
  { id: 'obrero_construccion', label: 'Obrero/a de construcción', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'peluquero_canino', label: 'Peluquero/a canino', cats: ['Otros'] },
  { id: 'peluquero', label: 'Peluquero/a', cats: ['Moda'] },
  { id: 'pintor', label: 'Pintor/a', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'plomero', label: 'Plomero/a', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'recepcionista', label: 'Recepcionista', cats: ['Administración', 'Profesionales'] },
  { id: 'reparacion_electrodomesticos', label: 'Repara electrodomésticos', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'repartidor', label: 'Repartidor/a', cats: ['Transporte'] },
  { id: 'sastre', label: 'Sastre', cats: ['Moda'] },
  { id: 'seguridad', label: 'Seguridad', cats: ['Otros'] },
  { id: 'soldador', label: 'Soldador/a', cats: ['Oficios / Técnico', 'Oficios'] },
  { id: 'tecnico_informatico', label: 'Técnico/a informático/a', cats: ['Tecnología'] },
];

export const EMOTE_OPTIONS = BASES.filter((b) => !b.exclude).flatMap((b) =>
  ['hombre', 'mujer'].map((g) => ({
    id: `${b.id}_${g}`,
    label: b.label,
    cat: b.cats[0],
    url: `/emotes/${b.id}_${g}.png`,
  }))
);

export const emoteUrl = (id) => (id ? `/emotes/${id}.png` : null);

// Emote por defecto según el rubro (se usa cuando no se eligió ninguno).
const CAT_EMOTE = {};
for (const b of BASES) for (const c of b.cats) CAT_EMOTE[c] ??= `${b.id}`;
CAT_EMOTE.Gastronomía ??= 'cocinero';
CAT_EMOTE['Eventos'] ??= 'masajista';
CAT_EMOTE['Otros'] ??= 'comerciante';
// Género estable por nombre, para que el mismo aviso muestre siempre el mismo emote.
const hashGender = (s = '') => [...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 2 ? 'mujer' : 'hombre';

// Url del emote para una tarjeta. Prioridad: icono elegido > emote del rubro con
// género estable > null (la placa muestra entonces su emoji de reserva).
export function plateEmote(record) {
  const chosen = record?.icon;
  const name = record?.company_name || record?.provider_name || record?.name || record?.title || '';
  if (chosen) return emoteUrl(chosen);
  const base = CAT_EMOTE[record?.category];
  if (!base) return null;
  return emoteUrl(`${base}_${hashGender(name)}`);
}
