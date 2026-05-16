# Fundamentals Drawer Design

**Goal:** Add a lazy-loaded "Show fundamentals" drawer to each `StockCard` that surfaces analyst price targets, key stats (Forward P/E, Beta, Short Float), and the last 4 quarters of EPS history — all sourced from Yahoo Finance's `quoteSummary` endpoint, no API key required.

---

## Architecture

Follows the existing `useNews` + `NewsDrawer` pattern exactly. A new "Show fundamentals ↓" button in `StockCard` conditionally mounts `FundamentalsDrawer`, which calls `useFundamentals(ticker)`, which fetches `/api/fundamentals?ticker=X`. The drawer is only mounted when open, so the fetch is lazy.

The one new complexity vs the news flow: Yahoo Finance's `quoteSummary` endpoint requires a crumb + session cookie (the chart and news endpoints do not). This is handled transparently in `lib/yahoo.ts` via a module-level `crumbCache` — invisible to the route and hook.

---

## Data Shape

Two new interfaces added to `types/index.ts`:

```ts
export interface EarningsQuarter {
  quarter: string;          // "3/31/2024" (Yahoo fmt string)
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;  // fraction: 0.027 = +2.7%
}

export interface FundamentalsData {
  targetLow: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  analystCount: number | null;
  recommendation: string | null;  // "buy" | "hold" | "sell" | "strong_buy" | "underperform"
  forwardPE: number | null;
  beta: number | null;
  shortFloat: number | null;      // fraction: 0.032 = 3.2%
  earnings: EarningsQuarter[];
}
```

All scalar fields are nullable. ETFs and indices often have no P/E or earnings data — callers render `--` for null values.

---

## Crumb Handling

Yahoo Finance requires a session crumb for `quoteSummary`. The crumb is fetched in two steps:

1. GET `https://finance.yahoo.com` → captures `Set-Cookie` header
2. GET `https://query1.finance.yahoo.com/v1/test/getcrumb` with that cookie → returns a short crumb string

`lib/yahoo.ts` exposes `fetchYahooWithCrumb<T>(url: string): Promise<T>` which:
- Checks a module-level `crumbCache` (type: `{ crumb: string; cookie: string; expiresAt: number } | null`)
- If cache is missing or expired (TTL: 1 hour), fetches a fresh crumb and updates the cache
- Appends `&crumb=<value>` to the URL and sets the `Cookie` header
- On a 401 response, clears the cache and retries once (handles mid-session expiry)

The cache is module-level so it survives across requests in the same Next.js process. No external packages needed.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `types/index.ts` | Modify | Add `EarningsQuarter`, `FundamentalsData` |
| `lib/yahoo.ts` | Modify | Add `parseFundamentals`, `fetchYahooWithCrumb`, `crumbCache` |
| `lib/__tests__/yahoo.test.ts` | Modify | TDD tests for `parseFundamentals` |
| `app/api/fundamentals/route.ts` | Create | GET `/api/fundamentals?ticker=X` |
| `hooks/useFundamentals.ts` | Create | Lazy fetch hook, mirrors `useNews` |
| `components/FundamentalsDrawer.tsx` | Create | Three-section drawer |
| `components/StockCard.tsx` | Modify | Add `fundOpen` state + second toggle button |

---

## API Route

**GET `/api/fundamentals?ticker=AAPL`**

Upstream: `https://query1.finance.yahoo.com/v10/finance/quoteSummary/{ticker}?modules=financialData%2CdefaultKeyStatistics%2CearningsHistory&crumb={crumb}`

Success response shape: `FundamentalsData`

Error responses:
- Missing ticker → 400 `{ error: 'ticker is required' }`
- Crumb fetch fails → 502 `{ error: 'Unable to authenticate with Yahoo Finance' }`
- Yahoo returns no result → 502 `{ error: string }` with Yahoo's error description as the message

The route follows the same pattern as `/api/quote`: `User-Agent` header, 10s `AbortController` timeout, `console.error` on upstream failures, no stack traces in client responses.

---

## Hook

```ts
type FundamentalsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: FundamentalsData }
  | { status: 'error'; message: string };

export function useFundamentals(ticker: string): FundamentalsState
```

Mirrors `useNews` exactly: `useEffect` with cancellation flag, fetches on mount, maps `data.error` to error state.

---

## UI — FundamentalsDrawer

Three visual sections inside a `border-t border-[#1f1f1f]` container, same as `NewsDrawer`:

**1. Analyst Targets**
- Single row: `Low $X · Mean $X · High $X` — prices formatted to 2 decimal places
- Upside/downside to mean vs current price shown as `+X.X% to mean` (green/red)
- Analyst count: `(N analysts)`
- Recommendation badge: `BUY` accent green `#C8FF00` bg, `HOLD` gray, `SELL` red. Maps `strong_buy` → `BUY`, `underperform` → `SELL`.

**2. Key Stats Row**
Three equal-width labeled cells:
- `Fwd P/E` — `forwardPE?.toFixed(1) ?? '--'`
- `Beta` — `beta?.toFixed(2) ?? '--'`
- `Short` — `shortFloat ? (shortFloat * 100).toFixed(1) + '%' : '--'`

**3. Earnings History**
Rendered only when `earnings.length > 0`. Compact table, last 4 quarters (most recent first):

| Quarter | Est | Actual | Surprise |
|---|---|---|---|
| 3/31/2024 | $1.48 | $1.52 | +2.7% |

Positive surprise: `text-[#22c55e]`. Negative surprise: `text-[#ef4444]`.

Loading state: 3 skeleton rows (same pulse style as `NewsDrawer`).
Error state: `Could not load fundamentals: {message}` in red.

**StockCard changes:** Add `fundOpen` boolean state. Add a second button below the existing news button:
```
Show fundamentals ↓  /  Hide fundamentals ↑
```
When `fundOpen` is true, render `<FundamentalsDrawer ticker={ticker} />` below `NewsDrawer`.

---

## Error Handling & Edge Cases

- **ETFs / indices** (XLK, SPY, VIX etc.): `earnings` will be `[]`, earnings section is hidden. `forwardPE` will be null, shown as `--`.
- **No analyst coverage**: all target fields null, targets section shows `No analyst coverage.`
- **Crumb expiry mid-session**: caught by the retry-once logic in `fetchYahooWithCrumb`.
- **Network timeout**: same 10s `AbortController` as other routes.

---

## Testing

Per project conventions, only pure functions in `lib/yahoo.ts` are unit-tested.

New tests in `lib/__tests__/yahoo.test.ts` under a `parseFundamentals` describe block:

1. Maps all fields from a full mock response
2. Returns null for missing optional fields (no forward P/E)
3. Returns empty `earnings` array when `earningsHistory.history` is absent
4. Maps `surprisePercent.raw` correctly as a fraction
5. Handles a `quoteSummary` result with no `financialData` module (throws)
