// Marca de Laburamos. Las imágenes salen de la lámina de marca y viven en public/marca/.
//   <Logo />                  logotipo completo (caballo + "Laburamos"), para fondos claros
//   <Logo variant="claro" />  isotipo en el círculo naranja + "LaburamosApp" en blanco, para fondos oscuros
//   <Logo variant="horizontal" /> isotipo en el círculo naranja + "LaburamosApp" en navy (menú y espacios chicos)
//   <Logo type="isotipo" />   caballo de cuerpo entero con su sombra
//   <Logo type="busto" />     cabeza del caballo
const SRC = {
  logotipo: {
    color: { src: '/marca/logotipo.png', ratio: 1106 / 411 },
    claro: { src: '/marca/logotipo-claro.png', ratio: 1465 / 189 },
    horizontal: { src: '/marca/logotipo-horizontal.png', ratio: 1465 / 189 },
  },
  isotipo: { color: { src: '/marca/isotipo-caballo.png', ratio: 415 / 411 } },
  busto: { color: { src: '/marca/isotipo.png', ratio: 112 / 171 } },
};

export default function Logo({ type = 'logotipo', variant = 'color', size = 44, className = '' }) {
  const set = SRC[type] || SRC.logotipo;
  const s = set[variant] || set.color;
  return (
    <img
      src={s.src}
      alt="LaburamosApp"
      height={size}
      width={Math.round(size * s.ratio)}
      className={`logo ${className}`.trim()}
      draggable={false}
    />
  );
}
