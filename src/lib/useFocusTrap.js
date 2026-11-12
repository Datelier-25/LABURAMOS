import { useEffect } from 'react';

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),video[controls],[tabindex]:not([tabindex="-1"])';

// Mantiene el foco dentro de un diálogo modal: al abrir entra al diálogo, Tab
// no sale hacia la página de atrás, y al cerrar devuelve el foco a quien lo tenía.
export default function useFocusTrap(ref) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const previous = document.activeElement;

    const focusables = () => [...node.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    const first = focusables()[0] || node;
    first.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === head || !node.contains(document.activeElement))) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && (document.activeElement === tail || !node.contains(document.activeElement))) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus({ preventScroll: true });
      }
    };
  }, [ref]);
}
