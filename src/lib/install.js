// Instalación de la app en la pantalla del celular.
// Chrome/Edge disparan "beforeinstallprompt"; iOS Safari se instala a mano
// desde Compartir > Agregar a inicio, así que mostramos las instrucciones.
import { useCallback, useEffect, useState } from 'react';

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const isIos = () =>
  /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
  (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);

export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(() => window.__installPrompt || null);
  const [installed, setInstalled] = useState(isStandalone);
  const [ios] = useState(isIos);

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      window.__installPrompt = event;
      setPromptEvent(event);
    };
    const onReady = () => setPromptEvent(window.__installPrompt || null);
    const onInstalled = () => {
      window.__installPrompt = null;
      setPromptEvent(null);
      setInstalled(true);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('pwa-installable', onReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('pwa-installable', onReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Devuelve true si se abrió el diálogo nativo de instalación.
  const promptInstall = useCallback(async () => {
    const event = promptEvent || window.__installPrompt;
    if (!event) return false;
    window.__installPrompt = null;
    setPromptEvent(null);
    await event.prompt();
    const choice = await event.userChoice;
    if (choice?.outcome === 'accepted') setInstalled(true);
    return true;
  }, [promptEvent]);

  return { installed, ios, promptInstall };
}
