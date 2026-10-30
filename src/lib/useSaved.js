import { useCallback, useState } from 'react';

const KEY = 'tb_saved_jobs';

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(next) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* sin almacenamiento disponible */
  }
}

// Avisos guardados en este dispositivo
export default function useSaved() {
  const [saved, setSaved] = useState(read);

  const toggle = useCallback((id) => {
    setSaved((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      write(next);
      return next;
    });
  }, []);

  // Deja solo los ids que siguen vigentes (los vencidos o eliminados se quitan)
  const prune = useCallback((aliveIds) => {
    setSaved((prev) => {
      const alive = new Set(aliveIds);
      const next = prev.filter((id) => alive.has(id));
      if (next.length === prev.length) return prev;
      write(next);
      return next;
    });
  }, []);

  return [saved, toggle, prune];
}
