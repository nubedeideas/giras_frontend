<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import ScheduleItem from './schedule-item.vue'
import { RouterLink } from 'vue-router'

const time = ref(new Date())
const timeString = ref(time.value.toLocaleTimeString())

let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => {
    time.value = new Date()
    timeString.value = time.value.toLocaleTimeString()
  }, 1000)
})

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <section
    class="relative flex flex-col overflow-hidden px-6 pt-24 pb-10 sm:pt-28 sm:pb-14 lg:min-h-screen lg:justify-center lg:pt-32 lg:pb-16"
  >
    <div
      class="max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center pb-4 sm:pb-6 lg:pb-8"
    >
      <div class="lg:col-span-7 space-y-8 z-10">
        <h1
          class="font-header text-7xl md:text-9xl leading-[0.85] tracking-tighter uppercase italic"
        >
          El Caos del <span class="acid-green">Backstage</span> <br />
          Se Acabó.
        </h1>
        <p class="max-w-lg text-white/60 text-sm md:text-base leading-relaxed">
          Sincroniza tu Google Calendar. Automatiza tus Lobby Calls. <br />
          Notifica a todo el crew vía WhatsApp sin mover un dedo. <br />
          Logística musical para Tour Managers que no duermen.
        </p>
        <div class="flex flex-col sm:flex-row gap-4 pt-4">
          <RouterLink
            to="/login"
            class="bg-acid-green text-black px-8 py-4 font-bold text-lg uppercase tracking-tighter shadow-hard hover:translate-x-1 hover:translate-y-1 hover:!shadow-none transition-all text-center"
          >
            Automatizar Mi Crew
          </RouterLink>
          <a
            href="#funcionalidades"
            class="border border-white/20 hover:border-acid-green px-8 py-4 font-bold text-lg uppercase tracking-tighter transition-all glass text-center"
          >
            Ver Demo Live
          </a>
        </div>
      </div>

      <div
        class="relative flex items-center justify-center min-h-[480px] sm:min-h-[540px] lg:col-span-5 lg:min-h-[600px]"
      >
        <!-- WhatsApp Mockup -->
        <div
          class="absolute left-1/2 top-0 z-10 w-full max-w-[200px] -translate-x-1/2 reveal-up shadow-[0_40px_100px_rgba(0,0,0,0.6)] sm:max-w-[230px] lg:left-0 lg:max-w-[260px] lg:translate-x-0"
        >
          <div
            class="w-full glass rounded-[2.5rem] border-[10px] border-white/10 p-4 aspect-[9/18.5] relative overflow-hidden"
          >
            <div
              class="bg-[#075e54] -mt-4 -mx-4 p-5 rounded-t-[1.8rem] mb-4 flex items-center gap-3"
            >
              <div
                class="w-10 h-10 rounded-full bg-white/20 border border-white/10 flex items-center justify-center text-xs"
              >
                G
              </div>
              <div>
                <div class="text-[11px] font-bold text-white tracking-tight">Giras Manager</div>
                <div class="text-[9px] text-acid-green flex items-center gap-1">
                  <span class="w-1.5 h-1.5 bg-acid-green rounded-full animate-pulse"></span>
                  En línea
                </div>
              </div>
            </div>
            <div class="space-y-4 px-1">
              <div
                class="bg-[#dcf8c6] text-black p-4 rounded-2xl rounded-tl-none text-[11px] w-[90%] shadow-lg"
              >
                <div class="flex items-center gap-2 mb-2 font-bold uppercase text-[9px]">
                  <span>📍</span> LOBBY CALL: MADRID
                </div>
                <p class="leading-relaxed opacity-80">
                  Hola Equipo 👋. Mañana el transporte sale a las <b>08:00 AM</b> puntual.
                </p>
              </div>
              <div
                class="bg-[#dcf8c6] text-black p-4 rounded-2xl rounded-tl-none text-[11px] w-[90%] shadow-lg"
              >
                <div
                  class="flex items-center gap-2 mb-2 font-bold uppercase text-[9px] text-red-600"
                >
                  <span>🚨</span> URGENTE
                </div>
                <p class="leading-relaxed opacity-80">
                  La prueba de sonido se adelanta a las <b>16:15</b>.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Traffic Control Panel -->
        <div
          class="glass absolute left-1/2 top-1/2 z-20 w-[85%] max-w-[280px] -translate-x-1/2 border-white/20 p-4 reveal-up shadow-[0_30px_60px_rgba(0,0,0,0.8)] sm:max-w-[300px] sm:p-5 lg:relative lg:left-auto lg:top-auto lg:w-full lg:max-w-[300px] lg:translate-x-20 lg:translate-y-40"
        >
          <div class="flex justify-between items-center mb-4 border-b border-white/10 pb-3">
            <span class="text-[9px] uppercase text-acid-green font-bold tracking-widest"
              >Control de Tráfico</span
            >
            <span class="text-[9px] uppercase opacity-50 font-mono">{{ timeString }}</span>
          </div>
          <div class="space-y-3">
            <ScheduleItem time="14:00" label="Check-in en Hotel" status="SENT" />
            <ScheduleItem time="16:30" label="Soundcheck" status="PENDING" />
            <ScheduleItem time="19:00" label="Dinner Call" status="PENDING" />
            <ScheduleItem time="21:00" label="Showtime" status="QUEUED" :active="true" />
          </div>
        </div>

        <div class="absolute -top-20 -right-20 w-64 h-64 bg-acid-green/10 blur-[100px]"></div>
        <div class="absolute -bottom-20 -left-20 w-64 h-64 bg-white/5 blur-[100px]"></div>
      </div>
    </div>

    <div
      class="absolute bottom-0 left-0 w-full overflow-hidden whitespace-nowrap border-y border-white/5 py-2"
    >
      <div class="inline-block animate-marquee uppercase text-[10px] tracking-[0.4em] opacity-30">
        TOUR READY — CALENDAR SYNC — WHATSAPP AUTOMATION — NO MORE MISSED CALLS — SCALE YOUR
        LOGISTICS — TOUR READY — CALENDAR SYNC — WHATSAPP AUTOMATION — NO MORE MISSED CALLS — SCALE
        YOUR LOGISTICS —
      </div>
    </div>
  </section>
</template>
