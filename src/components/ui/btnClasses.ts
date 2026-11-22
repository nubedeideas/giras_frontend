// Clases de los botones compartidas con los enlaces que deben verse como botón (RouterLink).
// `text-night` (#111) en vez de `text-ink`: dentro de `.sidebar-dark` ink pasa a claro y quedaría
// ilegible sobre lima; night es el mismo #111 en ambos contextos.

export const BTN_PRIMARY_BASE =
  'inline-flex items-center gap-1.5 rounded-sm bg-acid text-night font-bold transition-colors duration-200 hover:bg-acid-light cursor-pointer border-none min-h-[44px] lg:min-h-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive'

export const BTN_PRIMARY_SIZE = 'px-4 py-2.5 text-[14px]'
export const BTN_PRIMARY_SIZE_SMALL = 'px-3 py-2 text-[13px]'

/** Clase completa de `BtnPrimary` en tamaño normal, para un `RouterLink` con aspecto de botón. */
export const BTN_PRIMARY_CLASS = `${BTN_PRIMARY_BASE} ${BTN_PRIMARY_SIZE}`
