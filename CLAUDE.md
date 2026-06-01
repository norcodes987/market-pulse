# Market Pulse — Project Conventions

## What this is

A stock watchlist dashboard. Users add ticker symbols; the app shows price cards with sparklines and a news feed. No auth, no database — just Yahoo Finance endpoints and localStorage.

## Stack

- **Framework:** Next.js 16, App Router
- **Language:** TypeScript (strict)
- **Styling:** Tailwind CSS v4 (CSS-first config in globals.css — no `tailwind.config.js`)
- **Charts:** Recharts (`AreaChart` for sparklines)
- **Testing:** Jest + React Testing Library
- **Data:** Yahoo Finance unofficial public endpoints, called **server-side** in API routes to avoid CORS
- **Persistence:** `localStorage` — watchlist only, no database

## Folder structure

```
app/
  api/
    quote/route.ts     — GET /api/quote?ticker=X
    news/route.ts      — GET /api/news?ticker=X
  globals.css          — dark theme, custom properties, Barlow Condensed font
  layout.tsx           — root layout with font variable
  page.tsx             — main page; orchestrates watchlist + card grid
components/
  TopBar.tsx           — app header + ticker input form
  AddTickerForm.tsx    — controlled input; calls onAdd callback
  TickerPill.tsx       — removable ticker chip
  WatchlistBar.tsx     — renders a row of TickerPill chips
  StockCard.tsx        — price/change/high/low/volume + sparkline + news toggle
  Sparkline.tsx        — thin Recharts AreaChart wrapper
  SkeletonCard.tsx     — loading placeholder (same dimensions as StockCard)
  NewsDrawer.tsx       — collapsible panel showing 5 news headlines
  NewsItem.tsx         — single headline row (title, publisher, date, external link)
hooks/
  useWatchlist.ts      — localStorage-backed ticker list (add / remove)
  useQuotes.ts         — fetches all quotes in parallel; 60 s auto-refresh
  useNews.ts           — fetches news for one ticker; triggered on card expand
lib/
  yahoo.ts             — pure parse helpers used by API routes (server-only)
types/
  index.ts             — all shared TypeScript interfaces
```

## API routes

Both routes must:

- Add `User-Agent: Mozilla/5.0` to every outbound request
- Use a 10 s `AbortController` timeout
- Return `{ error: string }` + an appropriate HTTP status on failure

### GET /api/quote?ticker=AAPL

Upstream: `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d`
Response shape: `QuoteResponse` (see types/index.ts)

### GET /api/news?ticker=AAPL

Upstream: `https://query1.finance.yahoo.com/v1/finance/search?q={ticker}&newsCount=5&quotesCount=0`
Response shape: `{ articles: NewsArticle[] }`

## Data fetching rules

- `useQuotes` calls `/api/quote` for **all** tickers with `Promise.allSettled` — no waterfall, no sequential awaits
- Auto-refresh every 60 seconds via `setInterval`; clear on unmount
- `useNews` fetches on demand (user expands a card) — not on mount
- No `useEffect` fetch waterfalls in components; fetch at the hook level

## Styling conventions

- Background: `#080808` | Cards: `#111111` | Borders: `#1f1f1f`
- Accent: `#C8FF00` (neon yellow-green)
- Positive change: `#22c55e` | Negative change: `#ef4444`
- Headings: Barlow Condensed (loaded via `next/font/google`)
- **No inline styles** — Tailwind utility classes only
- Custom design tokens live in the `@theme` block in `globals.css`

## TypeScript rules

- All API response shapes defined in `types/index.ts` — import from there, never re-declare
- Strict null checks; avoid `any` — use `unknown` + type guards when needed
- Props interfaces defined inline at the top of each component file
- `lib/yahoo.ts` is server-only — never import it from a client component or hook

## Error handling

- Each stock card has its own error state — one bad ticker doesn't crash the grid
- `useQuotes` uses `Promise.allSettled` so partial failures are isolated
- Show `SkeletonCard` while loading, inline error message on failed cards
- Log upstream errors to `console.error` in API routes (never leak stack traces to the client)

## Testing

- Pure functions in `lib/yahoo.ts` are unit-tested in `lib/__tests__/yahoo.test.ts`
- `useWatchlist` is tested with `renderHook` in `hooks/__tests__/useWatchlist.test.ts`
- Run tests: `npm test`
- TDD: write the failing test, verify it fails, implement, verify it passes, commit
