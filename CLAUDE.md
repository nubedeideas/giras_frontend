# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**GigSync** — a tour/gig management dashboard (Spanish-language UI, "Giras" = Tours). This is a Vue 3 frontend project in early setup phase. The `sample/gigsync-v2.html` file is the reference design/mockup built with Vue 3 via CDN.

## Package Manager

Use **pnpm** (not npm or yarn).

## Commands

```bash
pnpm install          # Install dependencies
pnpm dev              # Dev server (Vite) — http://localhost:5173
pnpm build            # Production build (runs vue-tsc first)
pnpm preview          # Preview production build
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

**Routing:** `/login` → `LoginView`, then `/notifs`, `/calendar`, `/contacts`, `/reports` all nested under `AppLayout` (has the sidebar). Auth guard redirects unauthenticated users to `/login`.

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
├── layouts/AppLayout.vue        # Sidebar + RouterView + SettingsModal
├── views/                       # One per route
├── components/
│   ├── AppSidebar.vue           # Desktop left nav (64px)
│   ├── MobileNav.vue            # Mobile bottom nav
│   ├── notifications/           # NotifListPanel, NotifCard, NotifDetail, NotifForm
│   ├── calendar/                # CalendarGrid (month view), CalendarSidePanel
│   ├── contacts/                # ContactCard, ContactDetail
│   ├── reports/                 # StatsCards, ChannelBreakdown, ActivityList
│   ├── modals/                  # CreateTourModal, ImportCalModal, ImportContactsModal, SettingsModal
│   └── ui/                      # AppModal, GlassBlock, Pill, BtnPrimary, BtnSecondary, IconBtn
├── stores/                      # Pinia stores (see above)
├── i18n/                        # es.ts, en.ts, index.ts (vue-i18n, locale switchable in UI)
├── data/mock.ts                 # All mock data (events, contacts, tours, calendar events)
└── types/index.ts               # Shared TypeScript types
```

**Mock data:** `src/data/mock.ts` — Duki MTZ Tour (April 2025, CDMX/GDL/MTY) and Bizarrap European Summer Run (Jun–Jul 2025). All stores initialize from this file.

**i18n:** `locale` is a reactive ref exposed by vue-i18n; the language toggle in Login and Settings directly sets it. Keys are nested: `t('notif.title')`, `t('calendar.months[3]')`, etc.
