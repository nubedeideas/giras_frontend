# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Giras** (formerly GigSync) — tour logistics and notification platform for the live music industry. This is the Vue 3 frontend, in active development against the real Django API (`../backend`, see its CLAUDE.md). Landing and app are served as one static build at `giras.pro` (the app under `/home`, `/events`...); the API is `https://app.giras.pro/api`. `sample/gigsync-v2.html` is the original dark mockup, obsolete since the Paleta B redesign (2026-11-22, spec `../specs/2026-11-22-diseno-paleta-b.md`).

This repo is part of the `giras/` workspace; the root `../CLAUDE.md` describes the agent pool and the cross-repo workflow. All product copy must be Spanish (Spain), "tú" form, never "vos".

## Package Manager

Use **pnpm** (not npm or yarn).

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Dev server (Vite) — http://localhost:5173
pnpm build            # Production build (runs vue-tsc first)
pnpm preview          # Preview production build
pnpm test             # Vitest (jsdom), once; `pnpm test:watch` for watch mode
pnpm lint             # ESLint --fix
pnpm format           # Prettier write src/
```

## Code Style

**Prettier** (enforced via `.prettierrc`):
- No semicolons
- Single quotes
- 2-space indentation
- Print width: 100
- Trailing commas: ES5
- LF line endings

**ESLint** (`.eslintrc.cjs`) — Vue 3 recommended + eslint:recommended:
- Component names in templates must be **PascalCase**
- Props must use **camelCase**
- `multi-word-component-names` rule is disabled (single-word components are allowed)
- `v-html` warnings are disabled
- Unused vars are warned (args prefixed with `_` are exempt)

## Design System

**Paleta B · Hoja de ruta** (since 2026-11-22): a single light theme, no theme toggle (the "Apariencia" section was removed; `stores/ui.ts` still sets `data-theme` but no CSS reads it). Tokens are CSS variables in `:root` of `src/assets/main.css`, mapped to Tailwind colours in `tailwind.config.ts` (`bg-bg`, `text-ink-2`, `olive`, `lime-soft`, `line-soft`, `night`, `on-night`, `sent-bg`/`sent-fg`..., `priority-high`); the old names were kept and **remapped**, so existing classes keep working:

- Surfaces: `--bg` paper `#f5f5f0` (view background), `--bg-3` surface `#fff` (cards, header), `--bg-2`/`--glass` surface-2 `#fafaf7`, `--bg-4`/`--glass-hover` line-soft `#edede7`, `--glass-active`/`--acid-dim` lime-soft `#f4fadb` (selected).
- Text: `--ink` `#111`, `--ink-2` ink-muted `#54545a`, `--ink-3` = `--ink-4` ink-faint `#6e6e74` (only ≥ 12 px metadata).
- Lines: `--line` `#e2e2dc`, `--line-2` `#cfcfc8`, `--line-acid` = olive.
- Accent: `--acid` lime `#d4f25a` (**fill only**), `--olive` `#4a5e00` / `--olive-strong` `#3f5000` (accent as text/border/focus ring on light). The landing keeps its own `acid-green` `#c0ff00` and `landing.css`.
- Night: `--night` `#111`, `--night-2`, `--night-line`, `--on-night`, `--on-night-muted`.
- Status pairs (`-bg`/`-fg`): `sent`, `pending`, `scheduled`, `failed`, `off`, `wa`; `--priority-high` `#9a3412`. `brand-blue`/`brand-orange`/`wa-green` were darkened for contrast on light.
- Radius (Tailwind `borderRadius`): `rounded-sm` 9 px, `rounded` 14 px, `rounded-lg` 20 px. Font: Roboto; times and dates in Space Mono via `font-time` plus `.tnum` (tabular figures). `font-mono` is NOT Space Mono (landing and templates use it).

**Night surfaces**: the `.sidebar-dark` class re-maps the same variables to dark values inside its subtree. It is on `AppSidebar`, `MobileNav`, the `TourMenuPanel` panel and `ConsentBanner`. Inside it `text-ink` is light, `--olive` becomes lime (so `ring-olive` stays visible) and `text-acid` (lime on night) is correct; on a lime fill use `text-night`, not `text-ink` (`BtnPrimary` does this). Shell: black outer frame with lime border (`.app-frame`, ≥ 1024 px) and a paper inner card.

Rules (each one came out of the redesign or its reviews):
- Lime never as text on light: `text-olive` (`hover:text-olive-strong`), borders/focus `border-olive`/`focus-visible:ring-olive`. Lime fill with `text-ink` (or `text-night` inside `.sidebar-dark`).
- Status colours only through `ui/StatusBadge.vue` and the pure mappers in `utils/statusBadge.ts` (`activityBadge`, `notificationBadge`, `tourBadge`); no hardcoded hex or `text-red-400`/`text-amber-400` (use `text-failed-fg`, `bg-pending-bg`...).
- No `opacity` to mark past items: use `text-ink-2` plus an "off" badge. `opacity` stays only for `disabled`.
- A tour's colour appears only as a dot (10 px in `TourSelect`); never as tinted background or text. Activity-type colour likewise only as a dot.
- Typography floor: no `text-[8px]`–`text-[10px]`; 11 px only for uppercase eyebrows (in `text-ink-2`); body 15 px.
- Touch targets ≥ 44 px below 1024 px (`min-h-[44px] lg:min-h-0`).
- Times and dates in `font-time tnum`.
- Tailwind opacity modifiers (`bg-acid/15`, `border-acid/30`) do not work on `var(--x)` colours: use the `-dim`/`-soft` tokens.
- Landing (`src/components/landing/**`, `LandingView`, `MarketingLandingView`, `LoginView`, legal pages, `PublicLayout`, `src/assets/landing.css`) has its own black/`acid-green` style and is not part of Paleta B.

## Architecture

**Stack:** Vite + Vue 3 (Composition API + `<script setup>`) + TypeScript + Tailwind CSS + Pinia + Vue Router + vue-i18n

**Routing:** public `/` (LandingView), `/landing`, `/terms`, `/privacy`, `/soporte` (under `PublicLayout`), `/login`, `/auth/callback`, `/auth/magic-link`, `/crew/:token` (crew portal, no account) and `/admin` (outside `AppLayout`, gated by `authStore.user?.is_superuser`); authenticated routes nested under `AppLayout`: `/home` (`DashboardView`, the "Hoy" dashboard and post-login destination), `/events`, `/calendar`, `/contacts`, `/tour` (Mi Gira), `/reports`, `/settings`. Auth guard redirects unauthenticated users to `/login`. `router/index.ts` defines `scrollBehavior` (top, hash anchors, savedPosition).

**Shell (Paleta B):** `AppLayout` = black frame + paper card with `AppSidebar` (desktop, night, `w-60`: Inicio, Actividades, Calendario, Contactos, Mi Gira, Informes, Panel Admin for superusers, and a single "Configuración" entry at the bottom), `DashboardHeader` (route title, `TourSelect` pill that opens `TourMenuPanel` anchored to the header, `InboxBell`, avatar → Ajustes; the avatar lives only in the header) and `MobileNav` (< 1024 px, night, 5 tabs: Inicio · Actividades · Calendario · Contactos · Ajustes with a gear). The tour selector is only in the header: `TourBand`, `HomeView` and the sidebar tour pill no longer exist. `SubscriptionUsageBanner` is hidden on `/home` (the dashboard shows the quota).

**API access pattern:** each resource has a composable in `src/composables/useXxx.ts` that declares TS interfaces matching the backend serializer and calls the API through `apiClient` (`src/utils/apiClient.ts`): `get/post/put/patch/delete<T>(path, body?, { fallback })` with paths relative to `API_BASE` (`VITE_API_URL`, fallback `http://localhost:8000/api`), `getAll<T>` to follow DRF pagination, `FormData` and `responseType: 'blob'` supported, `auth: false` for public endpoints. It reuses `useAuthStore().fetchWithAuth` (Bearer token + one retry after refresh on 401) and throws `ApiError` (`status`, `data`, `fieldErrors`, Spanish `message`). The backend wraps exceptions as `{success: false, error: {message, status_code, details}}` (`apps.core.exceptions`), while hand-written `Response(..., status=4xx)` come in plain DRF shape; `ApiError` handles both. Never call `fetch` directly from a composable or component. Pinia stores hold shared state; composables talk to the API. Never mix the two roles. URLs returned by the backend are already absolute.

**State (Pinia stores, `src/stores/`):**
- `useAuthStore` — session, `fetchWithAuth`, `loginWithGoogle()`, `loginDemo()`/`isDemoMode`, `logout()`
- `useToursStore` — tours list, `activeTour` (in memory only: after a reload `/home` shows `TourSelectPrompt`), `createTour()`
- `useActivitiesStore` — activities of the active tour, grouping helpers
- `useCalendarStore` — month navigation, `daysGrid` (6×7, Monday-first); initial month = selected activity or today
- `useContactsStore` — contacts list, selection, search
- `useInboxStore` — bell + panel list (calls in `useInbox`, polling in `useInboxPolling`)
- `useNoticesStore` — on-demand notices (R2) of the active tour, shared by the Avisos tab, `TourView` and the dashboard
- `useReminderCatalogStore` — reminder catalogue per tour (admin only; 403 → `forbidden`), shared by calendar chips and dashboard; `invalidate()` after changing reminder settings
- `useGoogleStore` — Google connection state; `useUIStore` — legacy theme flag, no visual effect

**Component structure:**
```
src/
├── layouts/AppLayout.vue        # Frame + sidebar + header + RouterView + MobileNav
├── views/                       # One per route (DashboardView, EventsView, CalendarView, TourView...)
├── components/
│   ├── AppSidebar.vue, MobileNav.vue, DashboardHeader.vue, TourSelect.vue, TourMenuPanel.vue
│   ├── dashboard/               # DashboardBlock + Pending, Upcoming, Sends, Inbox, Plan blocks, DashboardEmptyTour
│   ├── activities/              # ActivityListPanel, ActivityCard, ActivityDetail, NotificationCard, recipients, urgent notice
│   ├── calendar/                # CalendarGrid (month view), side panels
│   ├── tour/                    # Mi Gira: reminders, role groups, AiReviewList, documents, crew portal, notices/
│   ├── inbox/                   # InboxBell, InboxPanel, InboxItemRow
│   ├── settings/                # managers, reminders/, rules/
│   ├── contacts/, reports/, modals/, onboarding/, templates/, admin/
│   ├── landing/                 # public site only (separate style)
│   └── ui/                      # AppModal, GlassBlock, Pill, StatusBadge, BtnPrimary, BtnSecondary, MobileDetailOverlay
├── utils/                       # pure helpers with specs (apiClient, statusBadge, dashboard, duration, notificationErrors...)
├── stores/, composables/, i18n/ (es.ts, en.ts), test/ (fetch mocks and fixtures), types/index.ts
```

**Reports y confirmaciones:** `/reports` y el historial de `ContactDetail` leen datos reales de `useNotificationReports` (`/api/notifications/reports/summary/` y `contact-history/`); el mock se eliminó el 2026-11-20. Las confirmaciones de lectura (`confirmed_at`, `confirmed_count`, `confirmable`) y el botón "Recordar a los que faltan" (`remind-unconfirmed`, con dry run previo) viven en `components/activities/`.

**i18n:** `locale` is a reactive ref exposed by vue-i18n, persisted to `localStorage` in `src/i18n/index.ts`; toggles in Login, Settings and the landing `LanguageSwitcher` set it. Keys are nested: `t('notif.title')`. Every new key goes in **both** `es.ts` and `en.ts`. Keys whose value is an array must be read with `tm()`, not `t()` (`t()` returns the key string and a `v-for` iterates characters). Namespaces: `landing`, `termsPage` (not `terms`, which is a flat key), `support`.

**Checks:** `pnpm exec vue-tsc --noEmit`, `pnpm exec eslint src --ext .vue,.js,.ts`, `pnpm test`, `pnpm build`. Tests live next to the code as `*.spec.ts` (Vitest + `@vue/test-utils` + jsdom, config in `vitest.config.ts`, helpers to mock `fetch` in `src/test/http.ts`); CI runs them before the build. `vite-ssg build` fails on `window`/`document` access outside `onMounted`.

**Patterns to watch (real bugs found in reviews):**
- Tailwind emits utilities in its own order, not attribute order: a fixed class beats a conditional one of the same property (`class="text-ink-2" :class="active && 'text-ink'"` never turns `text-ink`). Make both branches conditional.
- Never show a raw backend error code (`plan_limit_reached`, `scheduled_after_activity`...) to the user: map it to an i18n message (`utils/notificationErrors.ts`, `ApiError.message`).
- After a mutation, refresh every store that depends on it (e.g. `useReminderCatalogStore().invalidate(uuid)` after editing reminder settings or role groups; the notices store after sending).
- Loads keyed on the active tour need a stale-response guard (`let request = 0`, compare after `await`, as in `AiReviewList.vue`): switching tour mid-request must not paint the previous tour's data.
- `mockFetch` in `src/test/http.ts` answers by call order; for components that fire parallel requests, mock `fetch` by URL (`mockImplementation` that switches on the path) instead.
