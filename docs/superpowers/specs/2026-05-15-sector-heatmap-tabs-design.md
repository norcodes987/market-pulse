# Sector Heatmap + Owned/Watching Tabs — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

---

## Overview

Two related features added to the Market Pulse dashboard:

1. **Sector heatmap** — sector ETFs (XLK, XLF, XLE, etc.) displayed alongside the existing index tickers (SPY, QQQ, IWM, VIX) in the MarketBar, color-coded by daily performance.
2. **Owned / Watching tabs** — the watchlist is split into three views (All, Owned, Watching) via tabs below the MarketBar. Each stock card carries a badge the user can toggle to classify a stock.

---

## Data Model

`useWatchlist` changes its localStorage format from `string[]` to `WatchlistEntry[]`:

```ts
// types/index.ts
interface WatchlistEntry {
  ticker: string;
  tag: 'owned' | 'watching';
}
```

New tickers are always added with `tag: 'watching'` by default.

**Migration:** On first load, if the stored value parses as a `string[]` (old format), each entry is converted to `{ ticker, tag: 'watching' }` and re-persisted. The migration is wrapped in a try/catch — on any parse failure the watchlist starts empty.

The hook's public API becomes:

```ts
{
  entries: WatchlistEntry[]
  addTicker(ticker: string): void
  removeTicker(ticker: string): void
  setTag(ticker: string, tag: 'owned' | 'watching'): void
}
```

All mutations update React state and localStorage atomically in a single `setTickers` call.

---

## Components

### New: `TabBar` (`components/TabBar.tsx`)

Purely presentational. Renders the All / Owned / Watching tab strip.

```ts
interface TabBarProps {
  activeTab: 'all' | 'owned' | 'watching';
  onTabChange: (tab: 'all' | 'owned' | 'watching') => void;
  counts: { all: number; owned: number; watching: number };
}
```

Displays tab labels with counts, e.g. "Owned (2)". Active tab has the accent underline (`#C8FF00`). No internal state.

### Modified: `StockCard`

Two new props:

```ts
tag: 'owned' | 'watching';
onTagToggle: () => void;
onRemove: () => void;
```

- Badge (top-right corner): shows "OWNED" or "WATCH". Clicking it calls `onTagToggle`, which flips the tag via `setTag` in the parent.
- Remove button: a small `✕` in the card corner calls `onRemove`.

### Modified: `MarketBar`

- Existing `MARKET_TICKERS` (`['SPY', 'QQQ', 'IWM', 'VIX']`) unchanged.
- New `SECTOR_TICKERS` constant: `['XLK', 'XLF', 'XLE', 'XLV', 'XLU', 'XLI', 'XLB', 'XLRE', 'XLY', 'XLP', 'XLC']`.
- `useMarketOverview` fetches all 15 tickers in one `Promise.allSettled`.
- MarketBar renders them in a single scrollable row with a `│` divider between indices and sectors.
- Click-to-select and the description strip below the bar apply only to the 4 index tickers. Sector pills are display-only (color-coded, no click behavior).

### Deleted: `WatchlistBar`

The ticker pill row is removed entirely. Ticker removal is handled by the `✕` button on each `StockCard`.

### Modified: `page.tsx`

- Adds `activeTab` state (`'all' | 'owned' | 'watching'`, default `'all'`).
- Renders `<TabBar>` between `<MarketBar>` and the stock grid.
- Derives `visibleEntries` by filtering `entries` on `activeTab`:
  - `'all'` → all entries
  - `'owned'` → entries where `tag === 'owned'`
  - `'watching'` → entries where `tag === 'watching'`
- Passes `tickers` (from all entries, not just visible) to `useQuotes` so quotes stay warm across tab switches.
- Passes `tag`, `onTagToggle`, and `onRemove` to each `StockCard`.

---

## Data Flow

### Watchlist

Single localStorage key `stockbuzz:watchlist`. All of `addTicker`, `removeTicker`, and `setTag` call `setTickers` with the updated array, which triggers both React state update and localStorage persist in one operation.

### Market overview + sectors

`useMarketOverview` fetches all 15 tickers (`MARKET_TICKERS + SECTOR_TICKERS`) via a single `Promise.allSettled`. Return type stays `Record<string, QuoteState>` — MarketBar reads index keys for the description strip and sector keys for the colored pills. Auto-refresh every 60 seconds (same as `useQuotes`).

### Tab filtering

Pure derived computation in `page.tsx` render — no new state, no fetch, no effect. Tab switch is instant. Counts for tab labels are derived from `entries` directly.

### Quote fetching

`useQuotes` always receives `entries.map(e => e.ticker)` — the full ticker list from all entries, regardless of active tab. Quotes for hidden tabs stay loaded in the background, so switching tabs shows data immediately with no loading skeletons. The local variable holding this derived list should be named `allTickers` in `page.tsx` to avoid confusion with the old `tickers` name.

---

## Error Handling

- **localStorage failure:** try/catch on parse; watchlist starts empty. Same behavior as today.
- **Sector fetch failure:** isolated by `Promise.allSettled`. A failed sector pill shows `--` with neutral color, does not crash the bar.
- **`setTag` on unknown ticker:** no-op — `entries.map` skips non-matching entries cleanly.

---

## Testing

**`hooks/__tests__/useWatchlist.test.ts`** — extend existing tests to cover:
- `setTag` flips a ticker's tag and persists to localStorage
- `removeTicker` removes the full `WatchlistEntry` (not just the ticker string)
- Migration: old `string[]` format in localStorage is converted to `WatchlistEntry[]` on mount

No new test files needed. `TabBar` is purely presentational (no logic). `MarketBar`'s sector extension is covered by mocking `useMarketOverview` in existing patterns.

---

## File Change Summary

| File | Change |
|---|---|
| `types/index.ts` | Add `WatchlistEntry` interface |
| `hooks/useWatchlist.ts` | New data model, `setTag`, migration logic |
| `hooks/useMarketOverview.ts` | Add `SECTOR_TICKERS`, fetch all 15 tickers |
| `components/MarketBar.tsx` | Render sector pills with `│` divider |
| `components/TabBar.tsx` | **New** — All / Owned / Watching tab strip |
| `components/StockCard.tsx` | Badge + `onTagToggle` + `onRemove` |
| `components/WatchlistBar.tsx` | **Deleted** |
| `app/page.tsx` | Tab state, filtering, updated props |
| `hooks/__tests__/useWatchlist.test.ts` | Extend with new test cases |
