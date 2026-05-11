# Market Pulse

A dark-themed stock watchlist dashboard. Add ticker symbols, get live price cards with sparklines, and pull up recent news headlines — no account required.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8)

## Features

- **Watchlist** — add/remove tickers, persisted to `localStorage`
- **Price cards** — current price, day change, high/low, volume
- **Sparklines** — 5-day closing price trend (Recharts)
- **News drawer** — 5 recent headlines per ticker, fetched on demand
- **Auto-refresh** — quotes refresh every 60 seconds
- **Isolated errors** — one bad ticker doesn't crash the grid

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Running tests

```bash
npm test
```

Tests cover `lib/yahoo.ts` (parse helpers) and `hooks/useWatchlist.ts`.

## Project structure

```
app/
  api/quote/route.ts   — proxies Yahoo Finance chart endpoint
  api/news/route.ts    — proxies Yahoo Finance search endpoint
  page.tsx             — main page
components/            — UI components (StockCard, TopBar, NewsDrawer, …)
hooks/                 — useWatchlist, useQuotes, useNews
lib/yahoo.ts           — server-only parse helpers
types/index.ts         — shared TypeScript interfaces
```

## Data

Prices and news come from Yahoo Finance's unofficial public endpoints, called server-side to avoid CORS. No API key needed. Data reflects the last market session when markets are closed — change/changePct will show 0 outside trading hours.

## Tech

| | |
|---|---|
| Framework | Next.js 16, App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Testing | Jest + React Testing Library |
| Persistence | localStorage |
