# Generate Brief — Design Spec

**Date:** 2026-05-28
**Scope:** One-click AI-generated portfolio brief for owned stocks — per-stock interpretation, cross-portfolio synthesis, and buy/hold/watch signals via OpenAI.

---

## Goal

Add a "Generate Brief" button to the Owned tab. Clicking it opens a new browser tab that runs three sequential OpenAI call stages and displays a structured brief: a market mood summary, a signal table (Buy / Hold / Watch per stock), and per-stock prose analysis.

---

## User Flow

1. User is on the Owned tab with at least one owned stock.
2. Clicks **⚡ Generate Brief** button (right-aligned in the tab bar row).
3. A new browser tab opens at `/brief?tickers=NVDA,MSFT` (comma-separated owned tickers in URL).
4. The brief page shows a loading state with 4 animated steps while the API call runs.
5. When complete, the full brief renders: market mood → signals table → stock analysis.

---

## Architecture

### Data Flow

```
app/page.tsx (Owned tab)
  └─ "Generate Brief" button
       └─ window.open('/brief?tickers=NVDA,MSFT', '_blank')

app/brief/page.tsx  (new tab, client component)
  ├─ reads tickers from URL search params
  ├─ shows loading state
  ├─ POST /api/brief  { tickers: ["NVDA", "MSFT"] }
  └─ renders BriefResult when done

app/api/brief/route.ts  (all server-side)
  ├─ fetch quotes + news + fundamentals for all tickers  (parallel, via lib/yahoo.ts)
  ├─ Call 1 — gpt-4o-mini, per-stock interpreter         (parallel, one per ticker)
  ├─ Call 2 — gpt-4o-mini, portfolio synthesiser         (1 call, awaits all Call 1s)
  ├─ Call 3 — gpt-4o-mini, buy/hold/watch signals        (parallel, uses Call 1 + Call 2)
  └─ returns BriefResult JSON
```

The `/api/brief` route calls Yahoo Finance upstream URLs directly via `fetchYahoo`, `fetchYahooWithCrumb`, `parseQuote`, `parseNews`, and `parseFundamentals` from `lib/yahoo.ts`. It does **not** call the existing `/api/quote`, `/api/news`, or `/api/fundamentals` HTTP routes — that would add a pointless server-to-self network hop.

The crumb cache in `lib/yahoo.ts` is module-level, so if the user has already opened a fundamentals drawer it will be warm.

**Model:** `gpt-4o-mini` for all three call types — fast, low-cost, sufficient for financial interpretation at watchlist scale.

**OpenAI package:** `openai` (official SDK, `import OpenAI from 'openai'`). Instantiated once at module level in the API route using `process.env.OPENAI_API_KEY`.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `types/index.ts` | Modify | Add `BriefRequest`, `StockSummary`, `StockSignal`, `BriefResult` |
| `app/api/brief/route.ts` | Create | Full orchestrator: data fetch + 3-stage AI pipeline |
| `app/brief/page.tsx` | Create | New-tab UI: loading state + brief renderer |
| `app/page.tsx` | Modify | Add "Generate Brief" button to Owned tab bar row |

---

## Types

Add to `types/index.ts`:

```ts
export interface BriefRequest {
  tickers: string[];
}

export interface StockSummary {
  ticker: string;
  summary: string;        // Call 1 output — prose interpretation
}

export interface StockSignal {
  ticker: string;
  signal: 'Buy' | 'Hold' | 'Watch';
  reason: string;         // one-line reason
}

export interface BriefResult {
  generatedAt: string;        // ISO timestamp
  marketMood: string;         // Call 2 — one-sentence macro read
  synthesis: string;          // Call 2 — 2-3 sentence cross-portfolio insight
  summaries: StockSummary[];  // Call 1 outputs
  signals: StockSignal[];     // Call 3 outputs
}
```

---

## API Route — `/api/brief`

**Method:** POST  
**Body:** `BriefRequest` — `{ tickers: string[] }`  
**Success response:** `BriefResult`  
**Error responses:** `{ error: string }` with appropriate HTTP status

### Step 1 — Fetch stock data

For each ticker, run all three Yahoo fetches in parallel:

```
Promise.allSettled per ticker:
  fetchYahoo(quoteUrl)          → parseQuote    → QuoteResponse
  fetchYahoo(newsUrl)           → parseNews     → NewsArticle[]
  fetchYahooWithCrumb(summaryUrl) → parseFundamentals → FundamentalsData
```

Tickers where all three fetches fail are skipped. At least quote data must succeed for a ticker to proceed. If fundamentals fail for a ticker, its Call 1 prompt omits the P/E / beta / analyst fields entirely (not passed as "null" — simply not mentioned). If news fails, the headlines section is omitted from the prompt.

### Step 2 — Call 1: per-stock interpreter (parallel)

One call per ticker. Input per call:

- Ticker symbol and company name
- 5-day price change (`changePct`)
- Current price, high, low, volume
- Forward P/E, beta, analyst recommendation (from fundamentals — null-safe)
- Last 5 news headlines (titles only)

System prompt instructs the model to return a 2–3 sentence prose interpretation: what the numbers and news mean together, not just a restatement of them.

Output: `StockSummary` — `{ ticker, summary }`.

### Step 3 — Call 2: portfolio synthesiser (single call)

Receives all `StockSummary` outputs combined. Looks across the full owned portfolio for patterns: sector-wide moves, relative strength divergence, macro environment signals.

Output is two fields:
- `marketMood` — one sentence (e.g. "Risk-off rotation out of tech this week")
- `synthesis` — 2–3 sentences of cross-portfolio insight

### Step 4 — Call 3: buy/hold/watch signals (parallel)

One call per ticker. Input:
- The ticker's `StockSummary` from Call 1
- The full `{ marketMood, synthesis }` from Call 2

The macro context from Call 2 informs the signal — a stock that looks weak in isolation may still get "Hold" if Call 2 identifies a sector-wide temporary dip.

Output: `StockSignal` — `{ ticker, signal: 'Buy' | 'Hold' | 'Watch', reason }`.

### Error handling

- Empty or missing `tickers` → 400 `{ error: 'tickers are required' }`
- All tickers fail data fetch → 502 `{ error: 'Could not fetch data for any ticker' }`
- Any OpenAI call throws → 502 `{ error: string }` (message from OpenAI, no stack trace to client)
- Route follows the same conventions as other API routes: `User-Agent: Mozilla/5.0`, `console.error` on upstream failures, AbortController timeout on Yahoo fetches

---

## UI

### Button — `app/page.tsx`

Add to the tab bar row, right-aligned. Only rendered when `activeTab === 'owned'` and `counts.owned > 0`.

```tsx
<button
  onClick={() => {
    const ownedTickers = entries
      .filter(e => e.tag === 'owned')
      .map(e => e.ticker)
      .join(',');
    window.open(`/brief?tickers=${ownedTickers}`, '_blank');
  }}
>
  ⚡ Generate Brief
</button>
```

Style: `bg-[#1a2a00] border border-[#C8FF00]/30 text-[#C8FF00] text-[10px] font-bold px-2 py-1 rounded hover:bg-[#2a4f14] transition-colors`

### Brief Page — `app/brief/page.tsx`

Client component. Reads `tickers` from `useSearchParams()`, POSTs to `/api/brief` on mount.

**Loading state** (while fetch is in-flight):

Four steps rendered vertically, each transitioning from pending → active → done using fixed `setTimeout` delays (step 1: 0 ms, step 2: 2 s, step 3: 5 s, step 4: 9 s). These are cosmetic — the actual fetch may finish before or after the animation completes:
1. Fetching stock data
2. Analysing individual stocks
3. Synthesising portfolio
4. Generating signals

Animated shimmer progress bar beneath the "Generating brief..." heading.

**Result state** (on success):

Three sections, no tab bar — this is a standalone page:

1. **Page header** — "Portfolio Brief" in `font-heading`, stock count + date in muted text
2. **Market Mood banner** — neon left-border accent (`border-l-2 border-[#C8FF00]`), mood sentence prominent, synthesis paragraph below in muted text
3. **Signals** section heading + table:
   - Columns: Stock · Signal · Reason
   - Signal colour: `#22c55e` (Buy) · `#facc15` (Hold) · `#ef4444` (Watch)
4. **Stock Analysis** section heading + one card per ticker showing prose summary from Call 1

**Error state** (on failure):

Centred message: "Could not generate brief: {error}" in `text-[#ef4444]`, with a "Try again" button that re-triggers the fetch.

---

## Validation

- The OpenAI key is read server-side from `process.env.OPENAI_API_KEY` — never exposed to the client.
- No changes to existing hooks, API routes, or localStorage schema.
- The brief page is a new route and does not affect any existing page.
- Tickers are passed via URL search params; the brief page does not depend on React state from `app/page.tsx`.
