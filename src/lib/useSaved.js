import { useCallback, useState } from 'react';

const DEFAULT_KEY = 'tb_saved_jobs';

function read(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function write(key, next) {
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* sin almacenamiento disponible */
  }
}

// Guardados en este dispositivo (por defecto, avisos de trabajo; con otra clave, servicios)
export default function useSaved(key = DEFAULT_KEY) {
  const [saved, setSaved] = useState(() => read(key));

  const toggle = useCallback(
    (id) => {
      setSaved((prev) => {
        const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
        write(key, next);
        return next;
      });
    },
    [key]
  );

  // Deja solo los ids que siguen vigentes (los vencidos o eliminados se quitan)
  const prune = useCallback(
    (aliveIds) => {
      setSaved((prev) => {
        const alive = new Set(aliveIds);
        const next = prev.filter((id) => alive.has(id));
        if (next.length === prev.length) return prev;
        write(key, next);
        return next;
      });
    },
    [key]
  );

  return [saved, toggle, prune];
}
