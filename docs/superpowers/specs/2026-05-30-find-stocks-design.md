# Find Stocks — Design Spec

**Date:** 2026-05-30
**Status:** Approved

## Overview

A dedicated `/find` page that runs a three-step AI-powered agentic workflow. The user picks a theme (from 8 presets or a custom input), and the system generates a curated ticker universe, scores every name on a 100-point conviction framework, then delivers a deep thesis for the top 3. Read-only: results are not automatically added to the watchlist.

---

## User Flow

1. User clicks **Find Stocks** button in the TopBar → navigates to `/find`
2. User selects or types a theme, clicks **Find Stocks →**
3. Steps reveal progressively as each completes:
   - **Step 1:** Numbered list of 25 tickers with one-line descriptions
   - **Step 2:** Full conviction table ranked by score, with tier color-coding
   - **Step 3:** Three deep thesis cards for the top 3 names
4. User reads results. No watchlist integration — manual copy if desired.

---

## Theme Selector

Eight preset pill buttons:
1. AI Infrastructure
2. Semiconductors
3. Cybersecurity
4. GLP-1 / Obesity
5. Defense Primes
6. Credit-Card Networks
7. SaaS at a Discount
8. Re-shoring Industries

Plus a free-text input for custom themes. Selecting a preset fills the input; user can still edit it. The **Find Stocks →** button is disabled until a non-empty theme is present.

---

## Step 1 — Ticker Universe

**API route:** `POST /api/find-stocks/tickers`
**Model:** `gpt-4o-mini`

**Input:**
```json
{ "theme": "AI Infrastructure" }
```

**Output:**
```json
{
  "candidates": [
    { "rank": 1, "ticker": "NVDA", "description": "Dominant GPU maker powering AI training and inference at scale" },
    ...
  ]
}
```

**Prompt contract:** System prompt instructs the model to act as an equity analyst identifying 25 publicly traded US stocks most exposed to the given theme. Output must be valid JSON matching the schema above. Tickers must be real, US-listed symbols.

**UI:** Renders as a two-column list (`#  Ticker  Description`). Appears as soon as Step 1 completes; Step 2 spinner starts immediately.

---

## Step 2 — Conviction Scores

**API route:** `POST /api/find-stocks/scores`
**Model:** `gpt-4o`

### Scoring Framework (100 points max)

**Quality Gate — +20 each (80 max)**
| Criterion | Threshold |
|-----------|-----------|
| ROIC | ≥ 15% |
| Free Cash Flow | Positive (TTM) |
| Net Debt / EBITDA | < 2× |
| Revenue growth | Positive YoY |

**Discount Gate — +10 each (20 max)**
| Criterion | Threshold | Data source |
|-----------|-----------|-------------|
| Price vs 52-week high | ≥ 15% below | Yahoo Finance (1y chart, real-time) |
| Forward P/E vs Trailing P/E | Forward < Trailing | Yahoo Finance (summary module, real-time) |

**Tiers**
| Score | Tier |
|-------|------|
| 80–100 | Best |
| 65–79 | Strong |
| 50–64 | Watch |
| < 50 | Avoid |

### Hybrid data approach

The scores route calls Yahoo Finance directly (server-side) for all 25 tickers in parallel via `Promise.allSettled`. Two endpoints per ticker (50 calls total, all parallel):
- **Chart (1y):** `https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1y` → extract max of `indicators.quote[0].high` array as 52-week high
- **Summary:** `https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=defaultKeyStatistics%2CsummaryDetail` → extract `defaultKeyStatistics.forwardPE.raw` and `summaryDetail.trailingPE.raw`. The existing `YahooSummaryResponse` type covers `defaultKeyStatistics`; a new `FindStocksYahooSummary` type must be added to `types/index.ts` that adds `summaryDetail?: { trailingPE?: { raw: number } }`.

Both calls use the same `User-Agent: Mozilla/5.0` header and 10 s `AbortController` timeout as all other Yahoo routes.

These real-time values are injected into the prompt payload. OpenAI scores the **quality gate** criteria from its training knowledge (clearly labeled "AI-estimated") and applies the **discount gate** scores from the provided real numbers.

**Input:**
```json
{
  "theme": "AI Infrastructure",
  "candidates": [{ "ticker": "NVDA", "description": "..." }, ...],
  "marketData": [
    {
      "ticker": "NVDA",
      "currentPrice": 138.50,
      "fiftyTwoWeekHigh": 153.13,
      "pctBelowHigh": 9.6,
      "forwardPE": 37.2,
      "trailingPE": 56.1,
      "forwardBelowTrailing": true
    },
    ...
  ]
}
```

**Output:**
```json
{
  "scores": [
    {
      "rank": 1,
      "ticker": "NVDA",
      "score": 91,
      "tier": "Best",
      "thesis": "Near-monopoly in AI compute with 80%+ data-center GPU share"
    },
    ...
  ]
}
```

**UI:** Renders as a sortable-by-rank table (`Rank | Ticker | Score | Tier | Thesis`). Tier badge color: Best = green, Strong = muted green, Watch = yellow, Avoid = red. Footer note: "Quality metrics (ROIC, FCF, leverage, growth) are AI-estimated from training data. Discount metrics use real-time Yahoo Finance data."

---

## Step 3 — Deep Thesis

**API route:** `POST /api/find-stocks/thesis`
**Model:** `gpt-4o`

Takes only the top 3 tickers from the Step 2 ranked output.

**Input:**
```json
{
  "theme": "AI Infrastructure",
  "topNames": [
    { "rank": 1, "ticker": "NVDA", "score": 91, "tier": "Best", "thesis": "..." },
    { "rank": 2, "ticker": "MSFT", "score": 82, "tier": "Best", "thesis": "..." },
    { "rank": 3, "ticker": "AVGO", "score": 76, "tier": "Strong", "thesis": "..." }
  ]
}
```

**Output:**
```json
{
  "thesis": [
    {
      "ticker": "NVDA",
      "rank": 1,
      "moat": "...",
      "drawdown": "...",
      "catalyst": "...",
      "exit": "...",
      "sources": ["NVDA Q1 2025 earnings", "Bernstein Research", "Reuters export control coverage"]
    },
    ...
  ]
}
```

**Each card contains:**
1. **The Moat** — what makes the competitive advantage durable
2. **The Drawdown** — why the stock is on sale / undervalued now
3. **The Catalyst** — what unlocks upside in the next 12 months
4. **The Exit** — specific price level or fundamental trigger that kills the thesis
5. **Sources** — citations for each claim (AI-generated; labeled as such)

**UI:** Three cards in a horizontal row (stacked on mobile). Each card is a dark panel (`#111`) with labeled sections. Sources shown as a small footnote row at the card bottom.

---

## Types (additions to `types/index.ts`)

```typescript
export interface TickerCandidate {
  rank: number;
  ticker: string;
  description: string;
}

export interface TickerMarketData {
  ticker: string;
  currentPrice: number | null;
  fiftyTwoWeekHigh: number | null;
  pctBelowHigh: number | null;
  forwardPE: number | null;
  trailingPE: number | null;
  forwardBelowTrailing: boolean | null;
}

export interface ConvictionScore {
  rank: number;
  ticker: string;
  score: number;
  tier: 'Best' | 'Strong' | 'Watch' | 'Avoid';
  thesis: string;
}

export interface ThesisCard {
  ticker: string;
  rank: number;
  moat: string;
  drawdown: string;
  catalyst: string;
  exit: string;
  sources: string[];
}
```

---

## Hook — `useFindStocks`

Located at `hooks/useFindStocks.ts`. Orchestrates the three API calls sequentially. State is a discriminated union:

```typescript
type FindStocksPhase =
  | { phase: 'idle' }
  | { phase: 'tickers-loading' }
  | { phase: 'tickers-done'; candidates: TickerCandidate[] }
  | { phase: 'scores-loading'; candidates: TickerCandidate[] }
  | { phase: 'scores-done'; candidates: TickerCandidate[]; scores: ConvictionScore[] }
  | { phase: 'thesis-loading'; candidates: TickerCandidate[]; scores: ConvictionScore[] }
  | { phase: 'complete'; candidates: TickerCandidate[]; scores: ConvictionScore[]; thesis: ThesisCard[] }
  | { phase: 'error'; step: 1 | 2 | 3; message: string; candidates?: TickerCandidate[]; scores?: ConvictionScore[] };
```

Exposes: `state: FindStocksPhase`, `run(theme: string): void`, `reset(): void`.

The error phase carries whatever partial data was accumulated before failure, so the page can still display completed steps.

---

## Components

| Component | File | Props |
|-----------|------|-------|
| `ThemeSelector` | `components/FindStocks/ThemeSelector.tsx` | `value`, `onChange`, `onSubmit`, `loading` |
| `TickerList` | `components/FindStocks/TickerList.tsx` | `candidates: TickerCandidate[]` |
| `ConvictionTable` | `components/FindStocks/ConvictionTable.tsx` | `scores: ConvictionScore[]` |
| `ThesisCards` | `components/FindStocks/ThesisCards.tsx` | `thesis: ThesisCard[]` |

All components are pure presentational — no data fetching, no local state.

---

## Navigation

`TopBar.tsx` gains a **Find Stocks** link — `<a href="/find">` styled as a secondary outlined button (border `#1f1f1f`, text `#888`, hover text `#C8FF00`). Positioned between the logo and the `AddTickerForm`.

---

## Error Handling

- If Step 1 fails: show error message with retry button. Steps 2 and 3 do not run.
- If Step 2 fails: show the Step 1 ticker list, show an error for Step 2, skip Step 3.
- If Step 3 fails: show Steps 1 and 2 results, show an error for Step 3 only.
- If a Yahoo Finance call fails for a given ticker during Step 2: that ticker's discount gate scores default to 0 (not scored). The overall run continues.
- API routes return `{ error: string }` + appropriate HTTP status on failure. Never leak stack traces.
- AbortController timeout: 30 s per OpenAI call (longer than Yahoo routes due to model latency).

---

## Environment

Requires `OPENAI_API_KEY` in `.env.local`. The OpenAI SDK (`openai` package) is already installed.

---

## Cost Estimate

| Step | Model | Est. tokens/run | Est. cost/run |
|------|-------|----------------|--------------|
| Step 1 — Tickers | `gpt-4o-mini` | ~1,350 | ~$0.001 |
| Step 2 — Scores | `gpt-4o` | ~2,500 | ~$0.026 |
| Step 3 — Thesis | `gpt-4o` | ~3,100 | ~$0.023 |
| **Total** | | **~6,950** | **~$0.05/run** |

---

## Prompt Structure

Each API route uses `openai.chat.completions.create` with `response_format: { type: 'json_object' }` to guarantee parseable output. All three prompts follow the same pattern: a detailed **system prompt** that defines role, rules, and output schema, and a minimal **user message** that supplies the runtime variables.

---

### Step 1 — Tickers prompt (`gpt-4o-mini`)

**System prompt:**
```
You are a senior equity analyst. Your job is to identify the 25 publicly traded US stocks
most exposed to a given investment theme.

Rules:
- Only include stocks listed on NYSE, NASDAQ, or AMEX.
- Use the primary ticker symbol (e.g. "BRK.B" not "BRK/B").
- Each description must be one sentence, max 15 words, explaining the company's specific
  exposure to the theme — not a generic business description.
- Do not repeat tickers.
- Rank by relevance to the theme, most relevant first.
- Respond with valid JSON only. No markdown, no commentary.

Output schema:
{
  "candidates": [
    { "rank": 1, "ticker": "NVDA", "description": "..." },
    ...
  ]
}
```

**User message:**
```
Theme: {{theme}}
```

---

### Step 2 — Scores prompt (`gpt-4o`)

**System prompt:**
```
You are a quantitative equity analyst applying a structured conviction scoring framework.

Scoring rules — 100 points maximum:

QUALITY GATE (20 points each, 80 max) — score from your training knowledge:
  - ROIC >= 15%: award 20 if true, 0 if false or unknown
  - Free Cash Flow positive (TTM): award 20 if true, 0 if false or unknown
  - Net Debt / EBITDA < 2x: award 20 if true, 0 if false or unknown
  - Revenue growing year over year: award 20 if true, 0 if false or unknown

DISCOUNT GATE (10 points each, 20 max) — use the real-time market data provided:
  - Price >= 15% below 52-week high: award 10 if pctBelowHigh >= 15, else 0
  - Forward P/E below trailing P/E: award 10 if forwardBelowTrailing is true, else 0

Tiers: Best = 80-100, Strong = 65-79, Watch = 50-64, Avoid = <50

Rules:
- If market data is null for a ticker, score both discount gate criteria as 0.
- Provide a one-line thesis (max 15 words) explaining the key reason for the score.
- Rank output by score descending.
- Respond with valid JSON only. No markdown, no commentary.

Output schema:
{
  "scores": [
    { "rank": 1, "ticker": "NVDA", "score": 91, "tier": "Best", "thesis": "..." },
    ...
  ]
}
```

**User message:**
```
Theme: {{theme}}

Candidates:
{{candidates as JSON array}}

Real-time market data:
{{marketData as JSON array}}
```

---

### Step 3 — Thesis prompt (`gpt-4o`)

**System prompt:**
```
You are a portfolio manager writing conviction reports for institutional investors.
For each of the top 3 stocks provided, write a structured thesis with exactly four sections.

Section definitions:
1. The Moat — what makes the competitive advantage durable? Be specific (patents, switching
   costs, network effects, regulation, scale). 2-3 sentences.
2. The Drawdown — why is the stock on sale right now? Name the specific event, concern,
   or sentiment shift that has compressed the valuation. 2-3 sentences.
3. The Catalyst — what single event or trend unlocks the upside in the next 12 months?
   Be concrete (product launch, contract win, regulatory approval, earnings inflection).
   2-3 sentences.
4. The Exit — name a specific price level OR a measurable fundamental trigger that would
   invalidate the thesis (e.g. "AMD captures >20% data-center GPU share"). 1-2 sentences.

Sources:
- List 2-4 sources that support your claims (earnings calls, analyst reports, news events,
  regulatory filings). These are AI-generated citations — be honest about what they are.

Rules:
- Write in direct, confident prose. No hedging phrases like "could potentially" or "may".
- Do not repeat the ticker name as the opening word of any section.
- Respond with valid JSON only. No markdown, no commentary.

Output schema:
{
  "thesis": [
    {
      "ticker": "NVDA",
      "rank": 1,
      "moat": "...",
      "drawdown": "...",
      "catalyst": "...",
      "exit": "...",
      "sources": ["...", "..."]
    },
    ...
  ]
}
```

**User message:**
```
Theme: {{theme}}

Top 3 names to analyze:
{{topNames as JSON array}}
```

---

## Out of Scope

- Watchlist integration (read-only page)
- Streaming responses (full JSON per step, spinner between)
- Saving or caching results
- Non-US tickers
- User authentication
