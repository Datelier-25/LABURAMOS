// Colores del CV (los usan el editor y la versión para imprimir)
export const BG_COLORS = [
  { id: 'navy', label: 'Navy', hex: '#19194b' },
  { id: 'azul', label: 'Azul', hex: '#405ae5' },
  { id: 'verde', label: 'Verde', hex: '#17633a' },
  { id: 'bordo', label: 'Bordó', hex: '#6d1f3a' },
  { id: 'grafito', label: 'Grafito', hex: '#2f3542' },
  { id: 'celeste', label: 'Celeste', hex: '#99c4ef' },
  { id: 'blanco', label: 'Blanco', hex: '#ffffff' },
];
export const TITLE_COLORS = [
  { id: 'naranja', label: 'Naranja', hex: '#f76a01' },
  { id: 'azul', label: 'Azul', hex: '#405ae5' },
  { id: 'celeste', label: 'Celeste', hex: '#99c4ef' },
  { id: 'navy', label: 'Navy', hex: '#19194b' },
  { id: 'verde', label: 'Verde', hex: '#17753f' },
  { id: 'rosa', label: 'Rosa', hex: '#d14f86' },
];
export const DEFAULT_THEME = { bg: 'navy', title: 'naranja' };
const INK = '#19194b';

// Contraste WCAG entre dos colores hex
function lum(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

// Variables CSS del CV: si un título no se lee sobre su fondo, se usa el color de texto de ese fondo
export function themeVars(theme) {
  const bg = (BG_COLORS.find((c) => c.id === theme?.bg) || BG_COLORS[0]).hex;
  const title = (TITLE_COLORS.find((c) => c.id === theme?.title) || TITLE_COLORS[0]).hex;
  const dark = lum(bg) < 0.4;
  const on = dark ? '#ffffff' : INK;
  return {
    '--cv-bg': bg,
    '--cv-on': on,
    '--cv-muted': dark ? 'rgba(255, 255, 255, 0.72)' : 'rgba(25, 25, 75, 0.66)',
    '--cv-line': dark ? 'rgba(255, 255, 255, 0.22)' : 'rgba(25, 25, 75, 0.18)',
    '--cv-fill': dark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(25, 25, 75, 0.06)',
    '--cv-scheme': dark ? 'dark' : 'light',
    '--cv-title-side': contrast(title, bg) >= 2.5 ? title : on,
    '--cv-title-main': contrast(title, '#ffffff') >= 2.5 ? title : INK,
    '--cv-edge': bg === '#ffffff' ? '1px solid var(--line)' : '0',
  };
}
