// Bloqueo del scroll del fondo para ventanas modales.
//
// Antes cada ventana guardaba y restauraba `document.body.style.overflow` por
// su cuenta. Cuando se abría una ventana dentro de otra (por ejemplo, el
// buscador de localidad dentro de la bienvenida de zona) y las dos se cerraban
// a la vez, el orden de restauración podía dejar el body con `overflow: hidden`
// para siempre y la página quedaba sin scroll en todas las secciones.
//
// Este contador compartido resuelve el problema: el bloqueo se activa con el
// primer modal y recién se libera cuando se cierra el último, sin importar el
// orden en que se desmonten.
let locks = 0;

function sync() {
  const root = document.documentElement;
  if (locks > 0) {
    root.classList.add('scroll-locked');
  } else {
    root.classList.remove('scroll-locked');
  }
  // Limpieza defensiva: versiones anteriores escribían el estilo en línea.
  document.body.style.overflow = '';
}

export function lockScroll() {
  locks += 1;
  sync();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    locks = Math.max(0, locks - 1);
    sync();
  };
}
