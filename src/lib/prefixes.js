// Abreviaturas de profesiones para acompañar el nombre en la tarjeta.
// Regla: hasta 4 letras y un punto. Se ofrecen las variantes de género de las
// profesiones principales; cuando la abreviatura es la misma, se usa una sola
// opción con la forma "nombre/a". La opción vacía (sin abreviatura) es la que
// viene elegida por defecto.
export const PROFESSION_PREFIXES = [
  { value: 'Abg.', label: 'Abogado/a' },
  { value: 'Cdor.', label: 'Contador' },
  { value: 'Cra.', label: 'Contadora' },
  { value: 'Ing.', label: 'Ingeniero/a' },
  { value: 'Lic.', label: 'Licenciado/a' },
  { value: 'Arq.', label: 'Arquitecto/a' },
  { value: 'Dr.', label: 'Médico' },
  { value: 'Dra.', label: 'Médica' },
  { value: 'Prof.', label: 'Profesor/a' },
  { value: 'Téc.', label: 'Técnico/a' },
  { value: 'Enf.', label: 'Enfermero/a' },
  { value: 'Kgo.', label: 'Kinesiólogo' },
  { value: 'Kga.', label: 'Kinesióloga' },
  { value: 'Psi.', label: 'Psicólogo/a' },
  { value: 'Nut.', label: 'Nutricionista' },
  { value: 'Vet.', label: 'Veterinario/a' },
  { value: 'Dis.', label: 'Diseñador/a' },
  { value: 'Doc.', label: 'Docente' },
  { value: 'Elec.', label: 'Electricista' },
  { value: 'Plom.', label: 'Plomero/a' },
  { value: 'Gas.', label: 'Gasista' },
  { value: 'Carp.', label: 'Carpintero/a' },
  { value: 'Mec.', label: 'Mecánico/a' },
  { value: 'Pint.', label: 'Pintor/a' },
  { value: 'Alb.', label: 'Albañil' },
  { value: 'Cer.', label: 'Cerrajero/a' },
  { value: 'Pel.', label: 'Peluquero/a' },
  { value: 'Coc.', label: 'Cocinero/a' },
  { value: 'Mas.', label: 'Masajista' },
  { value: 'Jard.', label: 'Jardinero/a' },
  { value: 'Fot.', label: 'Fotógrafo/a' },
  { value: 'Mús.', label: 'Músico/a' },
  { value: 'Prog.', label: 'Programador/a' },
];

// "Cra. Andrea Pérez" — el prefijo se guarda aparte para poder cambiarlo o
// quitarlo sin tocar el nombre.
export function nameWithPrefix(name, prefix) {
  return [prefix, name].filter(Boolean).join(' ');
}
