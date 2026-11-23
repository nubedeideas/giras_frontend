<script setup lang="ts">
// Panel derecho de escritorio (Actividades, Calendario, Contactos). Tiene que ser contenedor
// flex en columna: los detalles (`ActivityDetail`, `ContactDetail`, `ContactForm`...) son
// `flex-1 flex flex-col overflow-hidden` con su zona `overflow-y-auto` dentro, y si este
// envoltorio fuera un bloque su `flex-1` no haría nada, crecerían a la altura de su contenido
// y el `overflow-hidden` de aquí los recortaría sin dejarles desplazar. `min-h-0`/`min-w-0`
// impiden que el contenido estire el panel dentro de la fila de la vista.
</script>

<template>
  <div
    data-testid="detail-pane"
    class="flex min-h-0 min-w-0 flex-col overflow-hidden"
  >
    <slot />
  </div>
</template>
