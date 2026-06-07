<template>
  <section id="funcionalidades" class="relative overflow-hidden border-y border-white/10 px-6 py-12 md:py-20">
    <div class="mx-auto max-w-7xl">
      <!-- min-h-svh → min-h-screen -->
      <div ref="stickyRef" class="sticky top-0 flex min-h-screen items-center py-6 md:py-10">
        <div class="w-full space-y-8 md:space-y-10">
          <div class="reveal-up text-center">
            <h2 class="font-header text-5xl leading-none uppercase sm:text-6xl md:text-8xl">
              De la Grilla al <br /><span class="acid-green italic">Bolsillo del Crew</span>
            </h2>
          </div>

          <!-- rounded-4xl → rounded-[2rem] | border-white/15 → border-[rgba(255,255,255,0.15)] -->
          <div
            ref="sectionRef"
            class="glass showcase-shell rounded-[2rem] border-[rgba(255,255,255,0.15)] px-4 py-5 shadow-[0_30px_100px_rgba(0,0,0,0.45)] md:px-8 md:py-8"
          >
            <div class="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(320px,1.1fr)] lg:gap-12">
              <div class="order-2 space-y-4 md:space-y-5 lg:order-1">
                <div class="text-[10px] uppercase tracking-[0.35em] text-white/40">Paso activo</div>

                <div role="list" aria-label="Flujo automatizado en tres pasos" class="space-y-2 md:space-y-3 relative">
                  <TransitionGroup name="fade-step">
                    <FeatureStep
                      v-for="(feature, index) in steps"
                      v-show="!isMobile || index === activeStep"
                      :key="feature.number"
                      :active="index === activeStep"
                      :compact="isMobile"
                      :number="feature.number"
                      :title="feature.title"
                      :desc="feature.desc"
                      :aria-current="index === activeStep ? 'step' : undefined"
                      :aria-label="`Paso ${index + 1} de ${steps.length}: ${feature.title}`"
                      @click="goToStep(index)"
                    />
                  </TransitionGroup>
                </div>
              </div>

              <!-- min-h-90 → min-h-[22.5rem] | min-h-125 → min-h-[31.25rem] | min-h-140 → min-h-[35rem] -->
              <div class="order-1 relative flex min-h-[22.5rem] items-center justify-center md:min-h-[31.25rem] lg:order-2 lg:min-h-[35rem]">
                <!-- bg-acid-green/18 → bg-[rgba(192,255,0,0.18)] | bg-white/6 → bg-white/[0.06] -->
                <div
                  class="pointer-events-none absolute inset-x-[5%] top-1/2 -z-10 aspect-square -translate-y-1/2 rounded-full blur-[120px] transition-all duration-500 md:blur-[150px]"
                  :class="activeStep === 2 ? 'bg-[rgba(192,255,0,0.18)]' : 'bg-white/[0.06]'"
                  aria-hidden="true"
                ></div>

                <!-- min-h-88 → min-h-[22rem] | max-w-84 → max-w-[21rem] | min-h-104 → min-h-[26rem] | min-h-128 → min-h-[32rem] | min-h-144 → min-h-[36rem] -->
                <div
                  class="showcase-stage relative min-h-[22rem] w-full max-w-[21rem] sm:min-h-[26rem] sm:max-w-md md:min-h-[32rem] md:max-w-lg lg:min-h-[36rem] lg:max-w-xl"
                  aria-hidden="true"
                >
                  <div
                    v-for="(feature, index) in steps"
                    :key="'card-' + feature.number"
                    class="pointer-events-none absolute inset-0 flex items-center justify-center will-change-transform"
                  >
                    <!-- Card 0: Calendar view -->
                    <div v-if="index === 0" class="w-full">
                      <div class="glass overflow-hidden border-white/20 shadow-[0_40px_100px_rgba(0,0,0,0.6)]">
                        <div class="flex items-center justify-between border-b border-white/10 bg-white/5 p-4">
                          <div class="flex gap-1">
                            <div class="h-2 w-2 rounded-full bg-red-500/40"></div>
                            <div class="h-2 w-2 rounded-full bg-yellow-500/40"></div>
                            <div class="h-2 w-2 rounded-full bg-green-500/40"></div>
                          </div>
                          <span class="text-[10px] font-bold uppercase tracking-widest text-white/40">CALENDAR_VIEW.JS</span>
                          <div class="w-4"></div>
                        </div>
                        <div class="space-y-6 p-5 md:p-6">
                          <div class="flex items-end justify-between gap-4">
                            <div>
                              <h4 class="font-header text-4xl uppercase leading-none md:text-5xl">Marzo 2025</h4>
                              <p class="font-mono text-[9px] tracking-tight text-white/40">Sincronizacion: Activa (G-Suite)</p>
                            </div>
                            <div class="flex gap-2 text-[10px] text-white/45">
                              <span class="flex h-6 w-6 items-center justify-center border border-white/10">&lt;</span>
                              <span class="flex h-6 w-6 items-center justify-center border border-white/10">&gt;</span>
                            </div>
                          </div>

                          <div>
                            <div class="mb-2 grid grid-cols-7 gap-1 text-center text-[8px] font-bold uppercase text-white/30">
                              <span>Lu</span><span>Ma</span><span>Mi</span><span>Ju</span><span>Vi</span><span>Sa</span><span>Do</span>
                            </div>
                            <div class="grid grid-cols-7 gap-1 font-mono text-[9px] text-white/20">
                              <div v-for="day in 21" :key="`pre-${day}`" class="flex aspect-square items-center justify-center border border-white/5">
                                {{ String(day).padStart(2, '0') }}
                              </div>
                              <div class="flex aspect-square items-center justify-center border border-acid-green/40 bg-acid-green/5 font-bold text-acid-green">22</div>
                              <div v-for="day in 8" :key="`post-${day}`" class="flex aspect-square items-center justify-center border border-white/5">
                                {{ String(day + 22).padStart(2, '0') }}
                              </div>
                            </div>
                          </div>

                          <div class="space-y-2">
                            <div class="flex items-center justify-between gap-3 bg-acid-green p-3 text-[10px] font-bold text-black">
                              <div class="flex items-center gap-2 uppercase tracking-tight">
                                <span class="h-2 w-2 rounded-full bg-black"></span>
                                <span>Lobby Call: Madrid (NH)</span>
                              </div>
                              <span class="font-mono text-[8px] opacity-65">08:00 AM</span>
                            </div>
                            <div class="flex items-center justify-between gap-3 border border-white/10 bg-white/5 p-3 text-[10px] font-bold text-white/45">
                              <div class="flex items-center gap-2 uppercase tracking-tight">
                                <span class="h-2 w-2 rounded-full bg-white/20"></span>
                                <span class="italic">Soundcheck: WiZink Center</span>
                              </div>
                              <span class="font-mono text-[8px] opacity-50">16:30 PM</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <!-- Card 1: Rules system -->
                    <div v-else-if="index === 1" class="w-full">
                      <div class="glass border-white/20 p-6 shadow-[0_40px_100px_rgba(0,0,0,0.6)] md:p-8">
                        <div class="mb-6 flex items-center justify-between border-b border-white/10 pb-4">
                          <span class="text-[10px] font-bold uppercase tracking-widest text-acid-green">SISTEMA_REGLAS.v2</span>
                          <span class="font-mono text-[10px] uppercase text-white/50">11:52:49</span>
                        </div>
                        <div class="space-y-4">
                          <DemoScheduleItem time="14:00" label="LOBBY CALL - MADRID" status="SENT" :highlight="false" />
                          <DemoScheduleItem time="16:30" label="SOUNDCHECK" status="SENDING..." :active="true" />
                          <DemoScheduleItem time="19:00" label="DINNER CALL" status="PENDING" />
                          <DemoScheduleItem time="21:00" label="SHOWTIME" status="QUEUED" />
                        </div>
                      </div>
                    </div>

                    <!-- Card 2: WhatsApp delivery -->
                    <div v-else class="w-full max-w-sm">
                      <!-- border-12 → border-[12px] -->
                      <div class="relative aspect-[9/18.5] w-full rounded-[3rem] border-[12px] border-white/5 p-4 shadow-[0_60px_150px_rgba(192,255,0,0.15)] glass">
                        <div class="-mx-4 -mt-4 mb-4 flex items-center gap-3 rounded-t-[2.2rem] bg-[#075e54] p-5">
                          <div class="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/20 text-xs">G</div>
                          <div>
                            <div class="text-[11px] font-bold tracking-tight text-white">Giras Manager (Bot)</div>
                            <div class="flex items-center gap-1 text-[9px] text-acid-green">
                              <span class="h-1.5 w-1.5 rounded-full bg-acid-green"></span>
                              En linea
                            </div>
                          </div>
                        </div>

                        <div class="space-y-4 px-2">
                          <div class="text-center">
                            <span class="rounded-full bg-black/40 px-3 py-1 text-[8px] uppercase text-white/60">HOY</span>
                          </div>
                          <div class="w-[90%] rounded-2xl rounded-tl-none bg-[#dcf8c6] p-4 text-[11px] text-black shadow-lg msg-bubble-1">
                            <div class="mb-2 flex items-center gap-2">
                              <span>&#x1F4CD;</span>
                              <b class="uppercase tracking-tight">Lobby Call: Madrid</b>
                            </div>
                            <p class="leading-relaxed opacity-80">
                              Hola Equipo. Manana el transporte sale a las <b>08:00 AM</b> puntual.<br /><br />
                              Hotel: NH Ribera del Manzanares<br />Destino: WiZink Center
                            </p>
                            <div class="mt-2 text-right text-[8px] opacity-40">21:45 &#x2713;&#x2713;</div>
                          </div>
                          <div class="w-[90%] rounded-2xl rounded-tl-none bg-[#dcf8c6] p-4 text-[11px] text-black shadow-lg msg-bubble-2">
                            <div class="mb-2 flex items-center gap-2 text-red-600">
                              <span>&#x1F6A8;</span>
                              <b class="uppercase tracking-tight">Urgente</b>
                            </div>
                            <p class="leading-relaxed opacity-80">
                              La prueba de sonido se adelanta 15 minutos.<br />Nuevo horario: <b>16:15</b>.
                            </p>
                            <div class="mt-2 text-right text-[8px] opacity-40">21:46 &#x2713;&#x2713;</div>
                          </div>
                        </div>

                        <div class="absolute bottom-6 left-6 right-6 flex h-12 items-center rounded-full border border-white/10 bg-white/5 px-5">
                          <span class="font-mono text-[10px] italic text-white/30">Responder...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, nextTick } from 'vue'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import FeatureStep from './feature-step.vue'
import DemoScheduleItem from './demo-schedule-item.vue'

gsap.registerPlugin(ScrollTrigger)

defineOptions({ name: 'LandingShowcase' })

type ShowcaseStep = { number: string; title: string; desc: string; mobileHint: string }

const steps: ShowcaseStep[] = [
  {
    number: '01',
    title: 'Lectura de Calendario',
    desc: 'Giras detecta tus eventos de Google Calendar en milisegundos. Sin importar el huso horario.',
    mobileHint: '',
  },
  {
    number: '02',
    title: 'Procesamiento de Reglas',
    desc: 'El motor de IA formatea el mensaje perfecto basado en el tipo de actividad y el crew asignado.',
    mobileHint: '',
  },
  {
    number: '03',
    title: 'Notificacion Instantanea',
    desc: 'Envio masivo por WhatsApp Business con confirmacion de entrega en tiempo real.',
    mobileHint: '',
  },
]

const sectionRef = ref<HTMLElement | null>(null)
const stickyRef = ref<HTMLElement | null>(null)
const isMobile = ref(false)
const prefersReducedMotion = ref(false)
const activeStep = ref(0)

let scrollTriggerInstance: ScrollTrigger | null = null
let matchMediaInstance: gsap.MatchMedia | null = null

const updateViewportState = () => { isMobile.value = window.innerWidth < 1024 }

const goToStep = (index: number) => {
  if (!scrollTriggerInstance) return
  const totalScroll = scrollTriggerInstance.end - scrollTriggerInstance.start
  const stepScroll = totalScroll / steps.length
  const targetScroll = scrollTriggerInstance.start + stepScroll * index + stepScroll / 2
  window.scrollTo({ top: targetScroll, behavior: prefersReducedMotion.value ? 'auto' : 'smooth' })
}

onMounted(async () => {
  updateViewportState()
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  prefersReducedMotion.value = mediaQuery.matches

  await nextTick()

  if (prefersReducedMotion.value) {
    activeStep.value = 2
    return
  }

  gsap.context(() => {
    matchMediaInstance = gsap.matchMedia()
    matchMediaInstance.add('(min-width: 320px)', () => {
      const cards = gsap.utils.toArray<HTMLElement>('.showcase-stage > div')

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: stickyRef.value,
          start: () => stickyRef.value && stickyRef.value.offsetHeight > window.innerHeight ? 'bottom bottom' : 'top top',
          end: '+=300%',
          pin: true,
          scrub: 1,
          onUpdate: (self) => {
            activeStep.value = Math.min(steps.length - 1, Math.floor(self.progress * steps.length))
          },
        },
      })

      scrollTriggerInstance = tl.scrollTrigger ?? null

      cards.forEach((card, index) => {
        if (index > 0) gsap.set(card, { opacity: 0, y: 50, scale: 0.9, zIndex: 100 - index })
        else gsap.set(card, { opacity: 1, y: 0, scale: 1, zIndex: 100 })
      })

      tl.to(cards[0], { opacity: 0, y: -50, scale: 0.9, duration: 1 })
        .to(cards[1], { opacity: 1, y: 0, scale: 1, duration: 1 }, '<0.2')
        .to(cards[1], { opacity: 0, y: -50, scale: 0.9, duration: 1 })
        .to(cards[2], { opacity: 1, y: 0, scale: 1, duration: 1 }, '<0.2')
        .fromTo('.msg-bubble-1', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '<0.5')
        .fromTo('.msg-bubble-2', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '<0.2')
        .to({}, { duration: 0.5 })
    })
  })

  window.addEventListener('resize', updateViewportState)
})

onUnmounted(() => {
  matchMediaInstance?.revert()
  window.removeEventListener('resize', updateViewportState)
})
</script>

<style scoped>
.showcase-shell { contain: layout paint; }
.showcase-stage { contain: layout style paint; }

.fade-step-move,
.fade-step-enter-active,
.fade-step-leave-active { transition: all 0.3s ease; }
.fade-step-enter-from,
.fade-step-leave-to { opacity: 0; transform: translateY(10px); }
.fade-step-leave-active { position: absolute; }

@media (prefers-reduced-motion: reduce) {
  .showcase-stage > div,
  .showcase-shell *,
  .fade-step-enter-active,
  .fade-step-leave-active {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
</style>
