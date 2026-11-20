# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Giras** (formerly GigSync) — tour logistics and notification platform for the live music industry. This is the Vue 3 frontend, in active development against the real Django API (`../backend`, see its CLAUDE.md). Public site at `giras.pro`, app at `app.giras.pro`. `sample/gigsync-v2.html` is the original design mockup, kept only as visual reference.

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

From the sample mockup, the app uses a dark theme with these CSS custom properties:

- **Primary accent**: `--acid: #a8d800` (softened acid green / mint)
- **Backgrounds**: `--bg: #0c0c0f`, `--bg2: #111115`, `--bg3: #161619`, `--bg4: #1b1b20`
- **Glass morphism**: `--glass`, `--glass2`, `--glass-hover` for card surfaces
- **Typography**: Roboto font, `--text: #e8e8ec`, muted variants `--text-2` through `--text-4`
- **Border radius**: `--radius: 14px`, `--radius-sm: 9px`, `--radius-lg: 20px`
- Secondary colors: blue (`#1a8fff`), orange (`#e85d00`), WhatsApp green (`#1fad5a`)

When building components, follow the glass-morphism card style and dark theme established in the sample.

## Architecture

**Stack:** Vite + Vue 3 (Composition API + `<script setup>`) + TypeScript + Tailwind CSS + Pinia + Vue Router + vue-i18n

**Routing:** public `/` (LandingView), `/terminos-y-condiciones`, `/soporte` (under `PublicLayout`), `/login`; authenticated routes (`/home`, `/events`, `/calendar`, `/contacts`, `/reports`, `/settings`, admin panel gated by `authStore.user?.is_superuser`) nested under `AppLayout` (sidebar + `MobileNav`). Auth guard redirects unauthenticated users to `/login`. `router/index.ts` defines `scrollBehavior` (top, hash anchors, savedPosition).

**API access pattern:** each resource has a composable in `src/composables/useXxx.ts` that declares TS interfaces matching the backend serializer and calls the API through `apiClient` (`src/utils/apiClient.ts`): `get/post/put/patch/delete<T>(path, body?, { fallback })` with paths relative to `API_BASE` (`VITE_API_URL`, fallback `http://localhost:8000/api`), `getAll<T>` to follow DRF pagination, `FormData` and `responseType: 'blob'` supported, `auth: false` for public endpoints. It reuses `useAuthStore().fetchWithAuth` (Bearer token + one retry after refresh on 401) and throws `ApiError` (`status`, `data`, `fieldErrors`, Spanish `message`). The backend wraps exceptions as `{success: false, error: {message, status_code, details}}` (`apps.core.exceptions`), while hand-written `Response(..., status=4xx)` come in plain DRF shape; `ApiError` handles both. Never call `fetch` directly from a composable or component. Pinia stores hold shared state; composables talk to the API. Never mix the two roles. URLs returned by the backend are already absolute.

**State (Pinia stores):**
- `useAuthStore` — user session, `loginWithGoogle()`, `loginDemo()`, `logout()`
- `useNotificationsStore` — events list, selectedId, filterTab, searchQuery, groupedEvents computed
- `useContactsStore` — contacts list, selectedId, searchQuery, filtered computed
- `useToursStore` — tours list, createTour()
- `useCalendarStore` — calendar events, month navigation, daysGrid computed (6×7 grid, Monday-first)

**Tailwind tokens** — All design tokens are CSS variables in `:root` (see `src/assets/main.css`) and mapped to Tailwind via `tailwind.config.ts`. Key class prefixes:
- `bg-bg`, `bg-bg-2/3/4` — dark backgrounds
- `bg-glass`, `bg-glass-2/hover/active` — glass surfaces
- `border-line`, `border-line-2`, `border-line-acid` — borders
- `text-ink`, `text-ink-2/3/4` — text hierarchy
- `text-acid`, `bg-acid`, `text-acid-muted` — primary accent (green)
- `text-brand-blue`, `text-brand-orange`, `text-wa-green` — channel colors

**Component structure:**
```
src/
├── layouts/AppLayout.vue        # Sidebar + RouterView
├── views/                       # One per route
├── components/
│   ├── AppSidebar.vue           # Desktop left nav (64px)
│   ├── MobileNav.vue            # Mobile bottom nav
│   ├── calendar/                # CalendarGrid (month view), CalendarSidePanel
│   ├── contacts/                # ContactCard, ContactDetail
│   ├── reports/                 # StatsCards, ChannelBreakdown, ActivityList
│   ├── modals/                  # Create/Edit Activity & Notification, ImportContactsModal, ImportCalActivitiesModal...
│   └── ui/                      # AppModal, GlassBlock, Pill, BtnPrimary, BtnSecondary, MobileDetailOverlay
├── stores/                      # Pinia stores (see above)
├── i18n/                        # es.ts, en.ts, index.ts (vue-i18n, locale switchable in UI)
├── data/mock.ts                 # All mock data (events, contacts, tours, calendar events)
└── types/index.ts               # Shared TypeScript types
```

**Mock data:** `src/data/mock.ts` is legacy demo data (used by `loginDemo()` only). Real stores load from the API; do not add new features on top of the mock.

**i18n:** `locale` is a reactive ref exposed by vue-i18n, persisted to `localStorage` in `src/i18n/index.ts`; toggles in Login, Settings and the landing `LanguageSwitcher` set it. Keys are nested: `t('notif.title')`. Every new key goes in **both** `es.ts` and `en.ts`. Keys whose value is an array must be read with `tm()`, not `t()` (`t()` returns the key string and a `v-for` iterates characters). Namespaces: `landing`, `termsPage` (not `terms`, which is a flat key), `support`.

**Checks:** `pnpm exec vue-tsc --noEmit`, `pnpm exec eslint src --ext .vue,.js,.ts`, `pnpm test`, `pnpm build`. Tests live next to the code as `*.spec.ts` (Vitest + `@vue/test-utils` + jsdom, config in `vitest.config.ts`, helpers to mock `fetch` in `src/test/http.ts`); CI runs them before the build. `vite-ssg build` fails on `window`/`document` access outside `onMounted`.
