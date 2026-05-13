# Market Overview Bar — Design Spec

**Date:** 2026-05-13
**Status:** Approved

## Overview

Add a pinned market overview bar between the TopBar and the main content area. It shows four hardcoded market indicators (SPY, QQQ, IWM, VIX) with live price data and a contextual description strip that appears when a ticker is selected.

## Layout

The bar sits as a sub-header: below `<TopBar>`, above `<main>`. It scrolls with the page (not sticky). Two rows:

1. **Ticker row** — four tickers side by side, horizontally scrollable on mobile
2. **Explanation strip** — one line of descriptive text for the selected ticker

```
┌─────────────────────────────────────────────────────────┐
│  SPY +0.82%   QQQ −0.31%   IWM +0.44%   VIX 18.2 ▲    │
├─────────────────────────────────────────────────────────┤
│  SPY: S&P 500 ETF — tracks the 500 largest US companies │
└─────────────────────────────────────────────────────────┘
```

## Components

### `hooks/useMarketOverview.ts` (new)

- Hardcoded ticker list: `['SPY', 'QQQ', 'IWM', 'VIX']`
- Fetches all four via `/api/quote` using `Promise.allSettled` — same pattern as `useQuotes`
- Auto-refreshes every 60 seconds via `setInterval`; clears on unmount
- Returns `Record<string, QuoteState>`

### `components/MarketBar.tsx` (new)

- Consumes `useMarketOverview`
- Local state: `selectedTicker` (string), defaults to `'SPY'` on mount
- Clicking a ticker sets `selectedTicker`
- Selected ticker gets an accent underline in `#C8FF00`
- Each ticker shows: symbol (grey) + change% colored green/red based on daily direction
- VIX coloring is change-based (same as all other tickers — up = red, down = green)
- Explanation strip below the ticker row shows the hardcoded description for `selectedTicker`
- Ticker row is horizontally scrollable on mobile (`overflow-x-auto`, `flex-nowrap`)

### `app/page.tsx` (edit)

- Import and render `<MarketBar />` between `<TopBar onAdd={addTicker} />` and `<main>`
- No props needed — the hook is self-contained

## Ticker Descriptions (hardcoded)

| Ticker | Description |
|--------|-------------|
| SPY | S&P 500 ETF — tracks the 500 largest US companies. The broadest read on the US stock market. |
| QQQ | Nasdaq-100 ETF — heavily weighted toward tech. Moves more aggressively than SPY; a tech sentiment signal. |
| IWM | Russell 2000 ETF — 2,000 small-caps. Lags SPY when credit is tight or recession fear is rising. |
| VIX | CBOE Volatility Index — the market's fear gauge. Below 15: calm. 15–25: normal. Above 25: elevated stress. |

## Styling

Follows existing conventions from `globals.css` and `CLAUDE.md`:

- Background: `#080808` (matches page), border-bottom `#1f1f1f`
- Ticker symbol: `text-gray-500`
- Change positive: `text-[#22c55e]`, negative: `text-[#ef4444]`
- Selected ticker underline: `border-b-2 border-[#C8FF00]`
- Explanation strip: `text-xs text-gray-500`, `border-t border-[#1f1f1f]`
- No inline styles — Tailwind utility classes only

## Error Handling

- `Promise.allSettled` means each ticker fails independently
- A ticker in error state renders `--` in place of its value; does not crash the bar
- The bar renders even if all four tickers fail

## Data

- No new API routes — reuses `/api/quote?ticker=X`
- Descriptions are static strings in the component — no fetch needed
- Ticker list is hardcoded in the hook — no user configuration

## Out of Scope

- Sector heatmap (separate future feature)
- User-configurable market tickers
- Level-based VIX coloring
