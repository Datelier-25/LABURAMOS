// Misma tipografía que el pie de página, acompañada por el PNG de la L.
export default function Logo({ type = 'logotipo', variant = 'color', size = 44, className = '' }) {
  const symbolOnly = type === 'isotipo' || type === 'busto';
  return (
    <span className={`logo brand-lockup ${variant === 'claro' ? 'brand-light' : ''} ${className}`.trim()} style={{ '--brand-size': `${size}px` }} role="img" aria-label="LaburamosApp">
      <img src="/marca/icono-l.png" alt="" width={size} height={size} draggable={false} />
      {!symbolOnly && <span className="brand-wordmark" aria-hidden="true">Laburamos<span>App</span></span>}
    </span>
  );
}
