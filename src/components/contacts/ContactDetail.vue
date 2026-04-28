<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Contact } from '@/types'
import { useNotificationsStore } from '@/stores/notifications'
import { useContactsStore } from '@/stores/contacts'
import GlassBlock from '@/components/ui/GlassBlock.vue'
import BtnSecondary from '@/components/ui/BtnSecondary.vue'

const props = defineProps<{ contact: Contact }>()
const emit = defineEmits<{ edit: [] }>()
const { t } = useI18n()
const notifStore = useNotificationsStore()
const contactStore = useContactsStore()

// Events where this contact appears (matched by UUID)
const contactEvents = computed(() =>
  notifStore.events.filter((e) => e.contacts.some((c) => c.uuid === props.contact.uuid)),
)

// Extra emails (beyond primary)
const extraEmails = computed(() =>
  (props.contact.emails ?? []).filter((e) => !e.is_primary),
)

// Extra phones (beyond primary)
const extraPhones = computed(() =>
  (props.contact.phones ?? []).filter((p) => !p.is_primary),
)

const typeIconPath: Record<string, string> = {
  wa: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  sms: `<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
  email: `<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>`,
}
const typeIconClass: Record<string, string> = {
  wa: 'bg-wa-green-dim text-wa-green',
  sms: 'bg-acid-dim text-acid-muted',
  email: 'bg-brand-blue-dim text-brand-blue',
}

const PHONE_LABEL: Record<string, string> = {
  mobile: 'Móvil', work: 'Trabajo', home: 'Casa', fax: 'Fax', other: 'Otro',
}
const EMAIL_LABEL: Record<string, string> = {
  work: 'Trabajo', personal: 'Personal', booking: 'Booking', press: 'Prensa', other: 'Otro',
}
</script>

<template>
  <div class="flex-1 bg-bg-3 flex flex-col overflow-hidden">
    <!-- Profile header -->
    <div class="px-6 pt-6 pb-5 border-b border-line flex-shrink-0">
      <div class="flex items-start gap-4 mb-4">
        <!-- Avatar -->
        <div class="relative w-14 h-14 rounded-full overflow-hidden flex-shrink-0 border-2"
          :style="{ borderColor: contact.role?.color ?? 'var(--acid)' }">
          <img
            v-if="contact.avatar"
            :src="contact.avatar"
            :alt="contact.full_name"
            class="w-full h-full object-cover"
          />
          <div
            v-else
            class="w-full h-full flex items-center justify-center text-lg font-bold text-white"
            :style="{ background: contact.role?.color ?? 'var(--avatar-bg)' }"
          >
            {{ contact.first_name.charAt(0) }}{{ contact.last_name.charAt(0) }}
          </div>
          <!-- Favorite / Emergency badge -->
          <div
            v-if="contact.is_favorite"
            class="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-acid border-2 border-bg-3 flex items-center justify-center"
          >
            <svg width="7" height="7" viewBox="0 0 24 24" fill="currentColor" class="text-black">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div
            v-else-if="contact.is_emergency"
            class="absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-bg-3"
            style="background: #e85d00"
            :title="t('contacts.emergency')"
          />
        </div>

        <!-- Name block -->
        <div class="flex-1">
          <h2 class="text-lg font-bold text-ink tracking-[-0.3px] mb-px">
            {{ contact.full_name }}
          </h2>
          <p v-if="contact.job_title" class="text-[12px] text-ink-2 mb-0.5">
            {{ contact.job_title }}
          </p>
          <p v-if="contact.company_name" class="text-[11px] text-ink-3 mb-1.5">
            {{ contact.company_name }}
          </p>
          <!-- Role badge -->
          <span
            v-if="contact.role"
            class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
            :style="{
              background: contact.role.color + '22',
              color: contact.role.color,
            }"
          >
            {{ contact.role.name }}
          </span>
        </div>
      </div>

      <!-- Badges row -->
      <div class="flex gap-1.5 mb-3">
        <span
          v-if="contact.is_favorite"
          class="text-[9px] font-bold tracking-[0.4px] uppercase px-2 py-[3px] rounded-full bg-acid/15 text-acid"
        >
          ★ {{ t('contacts.favorite') }}
        </span>
        <span
          v-if="contact.is_emergency"
          class="text-[9px] font-bold tracking-[0.4px] uppercase px-2 py-[3px] rounded-full"
          style="background: rgba(232,93,0,0.15); color: #e85d00"
        >
          ⚠ {{ t('contacts.emergency') }}
        </span>
        <span
          v-if="contact.source && contact.source !== 'manual'"
          class="text-[9px] font-bold tracking-[0.4px] uppercase px-2 py-[3px] rounded-full bg-glass border border-line text-ink-3"
        >
          {{ contact.source }}
        </span>
      </div>

      <!-- Action buttons -->
      <div class="flex gap-2">
        <BtnSecondary small @click="emit('edit')">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          {{ t('contacts.editContact') }}
        </BtnSecondary>
        <BtnSecondary small @click="contactStore.removeContact(contact.uuid)">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
          {{ t('contacts.removeContact') }}
        </BtnSecondary>
      </div>
    </div>

    <!-- Scrollable content -->
    <div class="flex-1 overflow-y-auto px-6 py-5 space-y-4">
      <!-- Contact info -->
      <GlassBlock :title="t('contacts.info')">
        <div class="flex flex-col gap-3">
          <!-- Primary phone -->
          <div v-if="contact.primary_phone" class="flex items-start gap-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-3 flex-shrink-0 mt-px">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.6 3.34 2 2 0 0 1 3.55 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.4a16 16 0 0 0 6 6l.38-.38a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            <div class="flex-1">
              <p class="text-[9px] text-ink-3 uppercase tracking-[0.5px] font-semibold mb-0.5">{{ t('contacts.phone') }}</p>
              <p class="text-[12px] text-ink">{{ contact.primary_phone }}</p>
              <!-- Extra phones -->
              <div v-for="ph in extraPhones" :key="ph.id" class="mt-1 flex items-center gap-1.5">
                <span class="text-[9px] text-ink-4 uppercase tracking-[0.3px]">{{ PHONE_LABEL[ph.label] ?? ph.label }}</span>
                <span class="text-[11px] text-ink-2">{{ ph.phone }}</span>
              </div>
            </div>
          </div>

          <!-- Primary email -->
          <div v-if="contact.primary_email" class="flex items-start gap-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-3 flex-shrink-0 mt-px">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
              <polyline points="22,6 12,13 2,6"/>
            </svg>
            <div class="flex-1">
              <p class="text-[9px] text-ink-3 uppercase tracking-[0.5px] font-semibold mb-0.5">{{ t('contacts.email') }}</p>
              <p class="text-[12px] text-ink">{{ contact.primary_email }}</p>
              <!-- Extra emails -->
              <div v-for="em in extraEmails" :key="em.id" class="mt-1 flex items-center gap-1.5">
                <span class="text-[9px] text-ink-4 uppercase tracking-[0.3px]">{{ EMAIL_LABEL[em.label] ?? em.label }}</span>
                <span class="text-[11px] text-ink-2">{{ em.email }}</span>
              </div>
            </div>
          </div>

          <!-- Location -->
          <div v-if="contact.city || contact.country" class="flex items-center gap-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-3 flex-shrink-0">
              <circle cx="12" cy="10" r="3"/>
              <path d="M12 2a8 8 0 0 0-8 8c0 5.5 8 14 8 14s8-8.5 8-14a8 8 0 0 0-8-8z"/>
            </svg>
            <div>
              <p class="text-[9px] text-ink-3 uppercase tracking-[0.5px] font-semibold mb-0.5">{{ t('contacts.location') }}</p>
              <p class="text-[12px] text-ink">
                {{ [contact.city, contact.country].filter(Boolean).join(', ') }}
              </p>
            </div>
          </div>

          <!-- Website -->
          <div v-if="contact.website" class="flex items-center gap-3">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-3 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <div>
              <p class="text-[9px] text-ink-3 uppercase tracking-[0.5px] font-semibold mb-0.5">Web</p>
              <a :href="contact.website" target="_blank" rel="noopener" class="text-[12px] text-acid-muted hover:text-acid transition-colors truncate block">
                {{ contact.website }}
              </a>
            </div>
          </div>
        </div>
      </GlassBlock>

      <!-- Tour relations -->
      <GlassBlock v-if="contact.tour_relations?.length" :title="t('contacts.tours')">
        <div class="flex flex-col gap-2">
          <div
            v-for="rel in contact.tour_relations"
            :key="rel.tour"
            class="flex items-center gap-2.5 p-2 rounded-lg bg-bg-2 border border-line"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-ink-3 flex-shrink-0">
              <circle cx="6" cy="19" r="3"/>
              <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
              <circle cx="18" cy="5" r="3"/>
            </svg>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-semibold text-ink truncate">{{ rel.tour_name }}</p>
              <p v-if="rel.role_name" class="text-[10px] text-ink-3">{{ rel.role_name }}</p>
            </div>
            <span
              v-if="rel.is_primary"
              class="text-[9px] font-bold text-acid bg-acid/10 px-1.5 py-0.5 rounded-full flex-shrink-0"
            >
              Principal
            </span>
          </div>
        </div>
      </GlassBlock>

      <!-- Notes -->
      <GlassBlock v-if="contact.notes" :title="t('contacts.notes')">
        <p class="text-[12px] text-ink-2 leading-relaxed">{{ contact.notes }}</p>
      </GlassBlock>

      <!-- Notifications received -->
      <GlassBlock :title="t('contacts.notifications')">
        <div v-if="contactEvents.length > 0" class="flex flex-col gap-2">
          <div
            v-for="ev in contactEvents"
            :key="ev.id"
            class="flex items-center gap-2.5 p-2.5 rounded-lg bg-bg-2 border border-line"
          >
            <div
              class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              :class="typeIconClass[ev.type]"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" v-html="typeIconPath[ev.type]" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[11px] font-semibold text-ink truncate">{{ ev.title }}</p>
              <p class="text-[10px] text-ink-3">{{ ev.fullDate }} · {{ ev.city }}</p>
            </div>
            <div class="text-right flex-shrink-0">
              <p class="text-[10px] font-bold text-acid">{{ ev.stats.sent }}</p>
              <p class="text-[9px] text-ink-4">env.</p>
            </div>
          </div>
        </div>
        <p v-else class="text-[12px] text-ink-3 text-center py-2">{{ t('contacts.noNotifications') }}</p>
      </GlassBlock>
    </div>
  </div>
</template>
