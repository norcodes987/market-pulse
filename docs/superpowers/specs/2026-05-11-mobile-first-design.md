# Mobile-First Redesign — Design Spec

**Date:** 2026-05-11
**Scope:** Targeted mobile-first fixes + mobile-first Tailwind class ordering across all components

---

## Goal

Make the app comfortable to use on a 375px mobile screen without changing the desktop experience or introducing new UI patterns. Align all component Tailwind classes to mobile-first order (base → `sm:` → `lg:`) so future changes are easier to reason about.

---

## Decisions

| Question | Decision |
|---|---|
| TopBar on mobile | Stack vertically — title row, then full-width input row |
| WatchlistBar on mobile | Single horizontally-scrollable row; hide scrollbar |
| WatchlistBar on desktop | Keep current wrapping behaviour |
| News toggle | Keep as text link (no change) |
| Overall approach | Targeted fixes + mobile-first class reordering (Option B) |

---

## Component Changes

### `components/TopBar.tsx`

**Current:** `flex items-center justify-between px-6 py-4`

**Change:** Stack on mobile, row on `sm+`.

```
header: flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 gap-3 sm:gap-0
```

- Title stays `text-2xl font-bold` at all sizes.
- `AddTickerForm` renders below the title on mobile; beside it on `sm+`.

### `components/AddTickerForm.tsx`

**Current:** `flex gap-2` with `w-36` fixed input.

**Change:** Input stretches to fill available width on mobile; fixed width on `sm+`.

```
form: flex gap-2
input: flex-1 sm:w-36  (drops the bare w-36, adds flex-1 as base)
```

- `suppressHydrationWarning` already present — keep it.

### `components/WatchlistBar.tsx`

**Current:** `flex flex-wrap gap-2 py-2`

**Change:** Single scrollable row on mobile; wraps on `sm+`.

```
div: flex gap-2 py-2 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [-ms-overflow-style:none]
```

- Add `[&::-webkit-scrollbar]:hidden` to suppress the scrollbar chrome on WebKit.
- Pills use `shrink-0` so they never compress.

### `components/TickerPill.tsx`

**Current:** `×` button has `ml-1 leading-none` — tap target too small. Pill has no `shrink-0`.

**Change:** Enlarge the remove button's tap target with padding. Add `shrink-0` to the pill so it never compresses inside the scrollable WatchlistBar.

```
span (pill): add shrink-0
button: ml-1 -mr-1 p-1 leading-none  (p-1 adds 4px padding on all sides, effectively enlarging the hit area)
```

### `app/page.tsx` — main padding

**Current:** `px-6 py-6`

**Change:** `px-4 sm:px-6 py-6` — slightly more breathing room on narrow screens.

### All components — class ordering

For every file listed in the Files Touched table, rewrite Tailwind utility classes in mobile-first order: base (mobile) classes first, then `sm:` overrides, then `lg:` overrides. Components with no responsive breakpoints (StockCard, NewsDrawer, NewsItem, Sparkline, SkeletonCard) are already implicitly mobile-first and need no reordering. No visual change on desktop — purely a code quality improvement.

---

## What Does Not Change

- Card grid breakpoints (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`) — already correct.
- `StockCard` internal layout — already works on mobile.
- `NewsDrawer` and `NewsItem` — no changes needed.
- `Sparkline` — `ResponsiveContainer` already fills width correctly.
- `SkeletonCard` — no changes needed.
- News toggle style — stays as text link.
- All hooks, API routes, types — no changes.

---

## Files Touched

| File | Change |
|---|---|
| `components/TopBar.tsx` | Stack layout on mobile |
| `components/AddTickerForm.tsx` | Flex-1 input on mobile |
| `components/WatchlistBar.tsx` | Horizontal scroll on mobile |
| `components/TickerPill.tsx` | Larger tap target on `×` |
| `app/page.tsx` | Responsive padding |
| All components | Mobile-first class ordering |

---

## Non-Goals

- No new navigation patterns (no bottom nav, no FAB).
- No changes to the news toggle interaction.
- No new components.
- No changes to data fetching or API layer.
