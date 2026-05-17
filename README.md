# Market Pulse

A dark-themed stock watchlist dashboard. Add ticker symbols, get live price cards with sparklines, and pull up recent news headlines — no account required.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8)

## Features

- **Market overview bar** — pinned strip showing SPY, QQQ, IWM, and VIX with live change %; select any to read a plain-English description
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

Tests cover `lib/yahoo.ts` (parse helpers), `hooks/useWatchlist.ts`, and `hooks/useMarketOverview.ts`.

## Project structure

```
app/
  api/quote/route.ts   — proxies Yahoo Finance chart endpoint
  api/news/route.ts    — proxies Yahoo Finance search endpoint
  page.tsx             — main page
components/            — UI components (MarketBar, StockCard, TopBar, NewsDrawer, …)
hooks/                 — useMarketOverview, useWatchlist, useQuotes, useNews
lib/yahoo.ts           — server-only parse helpers
types/index.ts         — shared TypeScript interfaces
```

## Data sources

All data comes from Yahoo Finance's unofficial public endpoints, called server-side to avoid CORS. No API key required.

### Price cards — `GET /api/quote?ticker=X`

Proxies: `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d`

| Displayed field | Source field | Notes |
|---|---|---|
| Price | `meta.regularMarketPrice` | Current market price |
| Day change / % | `closes[-2]` → `regularMarketPrice` | Previous session's close is the second-to-last entry in the closes array; Yahoo omits `regularMarketChange` from this endpoint |
| High / Low | `meta.regularMarketDayHigh` / `meta.regularMarketDayLow` | Intraday range |
| Volume | `meta.regularMarketVolume` | Shares traded today |
| Company name | `meta.longName` → `meta.shortName` | Falls back to ticker if both absent |
| Sparkline | `indicators.quote[0].close` | Up to 5 daily closing prices; nulls filtered out |

### News drawer — `GET /api/news?ticker=X`

Proxies: `https://query1.finance.yahoo.com/v1/finance/search?q={ticker}&newsCount=5&quotesCount=0`

| Displayed field | Source field |
|---|---|
| Headline | `news[].title` |
| Publisher | `news[].publisher` |
| Timestamp | `news[].providerPublishTime` (Unix → ISO) |
| Link | `news[].link` |

### Fundamentals drawer — `GET /api/fundamentals?ticker=X`

Proxies: `https://query2.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=financialData,defaultKeyStatistics,earningsHistory`

Requires a crumb token obtained from `fc.yahoo.com` + `query2`'s getcrumb endpoint (handled server-side, no API key needed).

**Analyst targets** — from `financialData` module:

| Displayed field | Source field |
|---|---|
| Low / Mean / High target | `targetLowPrice.raw` / `targetMeanPrice.raw` / `targetHighPrice.raw` |
| Upside % | Derived: `(targetMean − currentPrice) / currentPrice × 100` |
| Recommendation | `recommendationKey` (`buy`, `hold`, `sell`, `strong_buy`, `underperform`) |
| Analyst count | `numberOfAnalystOpinions.raw` |

**Key stats** — from `defaultKeyStatistics` module:

| Displayed field | Source field | Notes |
|---|---|---|
| Fwd P/E | `forwardPE.raw` | Forward price-to-earnings ratio |
| Beta | `beta.raw` | 5-year monthly beta vs. S&P 500 |
| Short % | `shortPercentOfFloat.raw` | Fraction of float sold short (displayed × 100) |

**Earnings history** — from `earningsHistory.history[]`:

| Displayed field | Source field | Notes |
|---|---|---|
| Quarter | `quarter.fmt` | e.g. `3/31/2024` |
| EPS estimate | `epsEstimate.raw` | Consensus estimate at time of report |
| EPS actual | `epsActual.raw` | Reported EPS |
| Surprise % | `surprisePercent.raw` | Fraction; displayed × 100 |

### Market overview bar

Uses the same `/api/quote` endpoint for the four fixed tickers: **SPY** (S&P 500), **QQQ** (Nasdaq 100), **IWM** (Russell 2000), **VIX** (CBOE Volatility Index). Descriptions are static strings in the codebase, not fetched.

## Tech

| | |
|---|---|
| Framework | Next.js 16, App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Testing | Jest + React Testing Library |
| Persistence | localStorage |
