# Market Pulse

A dark-themed stock watchlist dashboard. Add ticker symbols, get live price cards with sparklines, and pull up recent news headlines — no account required.

![Stack](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8)

## Features

- **Market overview bar** — pinned strip showing SPY, QQQ, IWM, VIX, and all 11 SPDR sector ETFs with live change %; click any to see a plain-English description
- **Watchlist** — add/remove tickers, persisted to `localStorage`; tag each as Owned or Watching
- **Price cards** — current price, day change, high/low, volume
- **Sparklines** — 5-day closing price trend with hover tooltip showing relative day and price (e.g. `3d ago · $421.92`)
- **News drawer** — 5 recent headlines per ticker, fetched on demand
- **Fundamentals drawer** — analyst price targets, recommendation, Fwd P/E, Beta, Short %, and last 4 quarters of EPS history; fetched on demand
- **Tab filtering** — filter the card grid by All / Owned / Watching
- **Auto-refresh** — quotes refresh every 60 seconds
- **Isolated errors** — one bad ticker doesn't crash the grid
- **Find Stocks** — AI-powered theme scanner at `/find`; pick a theme (or type your own), get 25 candidate tickers, conviction scores, and deep thesis cards for the top 3

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

Tests cover `lib/yahoo.ts` (parse helpers), `hooks/useWatchlist.ts`, `hooks/useMarketOverview.ts`, `hooks/useFindStocks.ts`, and all four `components/FindStocks/` components.

## Project structure

```
app/
  api/quote/route.ts              — proxies Yahoo Finance chart endpoint
  api/news/route.ts               — proxies Yahoo Finance search endpoint
  api/find-stocks/tickers/route.ts — POST: GPT-4o-mini generates 25 candidate tickers
  api/find-stocks/scores/route.ts  — POST: Yahoo data + GPT-4o conviction scores
  api/find-stocks/thesis/route.ts  — POST: GPT-4o deep thesis for top 3
  page.tsx                        — main watchlist page
  find/page.tsx                   — Find Stocks page (3-step AI workflow)
components/
  FindStocks/                     — ThemeSelector, TickerList, ConvictionTable, ThesisCards
  …                               — MarketBar, StockCard, TopBar, NewsDrawer, …
hooks/                            — useMarketOverview, useWatchlist, useQuotes, useNews, useFindStocks
lib/yahoo.ts                      — server-only parse helpers
types/index.ts                    — shared TypeScript interfaces
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

Requires a crumb token. The server handles this automatically, but if you want to test the endpoint manually (e.g. in Postman) you need three requests in sequence:

**Why three requests?** Yahoo's crumb endpoint won't issue a token without a valid `A3` session cookie. `fc.yahoo.com` is the endpoint that hands one out without a login. Skip it and step 2 returns `{"error":{"code":"Unauthorized","description":"Invalid Cookie"}}`.

**Step 1 — seed the cookie** (one-time per session):
```
GET https://fc.yahoo.com
User-Agent: Mozilla/5.0
```
No useful response body. This stores the `A3` cookie in your client's cookie jar (Postman does this automatically when cookies are enabled).

**Step 2 — get the crumb:**
```
GET https://query2.finance.yahoo.com/v1/test/getcrumb
User-Agent: Mozilla/5.0
```
Returns a plain string, e.g. `fGUdnCa/hly`. The `A3` cookie from step 1 is sent automatically. Copy this value.

**Step 3 — call quoteSummary:**
```
GET https://query2.finance.yahoo.com/v10/finance/quoteSummary/MSFT?modules=financialData%2CdefaultKeyStatistics%2CearningsHistory&crumb=PASTE_CRUMB_HERE
User-Agent: Mozilla/5.0
```
If your crumb contains `/`, URL-encode it as `%2F` (Postman's Params tab does this automatically if you enter the raw value as a key/value pair).

All three requests must use **`query2`** (not `query1`). Both the `A3` cookie and the crumb are tied to the same session.

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

### Find Stocks — `POST /api/find-stocks/*`

Requires `OPENAI_API_KEY` in `.env.local`. The three routes run sequentially, orchestrated by `useFindStocks`:

| Route | Model | Purpose |
|---|---|---|
| `POST /api/find-stocks/tickers` | `gpt-4o-mini` | Returns 25 US-listed tickers most exposed to the theme |
| `POST /api/find-stocks/scores` | `gpt-4o` | Scores each ticker 0–100 via a conviction framework |
| `POST /api/find-stocks/thesis` | `gpt-4o` | Writes a deep thesis (moat / drawdown / catalyst / exit) for the top 3 |

**Conviction scoring (100 pts max):**

| Gate | Criterion | Points | Source |
|---|---|---|---|
| Quality | ROIC ≥ 15% | 20 | AI training knowledge |
| Quality | FCF positive (TTM) | 20 | AI training knowledge |
| Quality | Net Debt/EBITDA < 2× | 20 | AI training knowledge |
| Quality | Revenue growing YoY | 20 | AI training knowledge |
| Discount | Price ≥ 15% below 52-week high | 10 | Yahoo Finance (1y chart, live) |
| Discount | Forward P/E < Trailing P/E | 10 | Yahoo Finance (quoteSummary, live) |

Tiers: **Best** 80–100 · **Strong** 65–79 · **Watch** 50–64 · **Avoid** < 50

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
