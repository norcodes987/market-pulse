# Fundamentals Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a lazy-loaded "Show fundamentals" drawer to each `StockCard` surfacing analyst price targets, key stats (Fwd P/E, Beta, Short Float), and last 4 quarters of EPS history — sourced from Yahoo Finance `quoteSummary`, no API key required.

**Architecture:** New `/api/fundamentals` route calls Yahoo Finance `quoteSummary` via a crumb-authenticated fetcher (`fetchYahooWithCrumb`) defined in `lib/yahoo.ts`. A new `useFundamentals` hook (mirrors `useNews`) fetches on mount inside `FundamentalsDrawer`, which is conditionally rendered from `StockCard` when `fundOpen` is true.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, Yahoo Finance `quoteSummary` v10

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `types/index.ts` | Modify | Add `EarningsQuarter`, `FundamentalsData`, `YahooSummaryResponse` |
| `lib/yahoo.ts` | Modify | Add `parseFundamentals`, `fetchYahooWithCrumb`, `crumbCache` |
| `lib/__tests__/yahoo.test.ts` | Modify | TDD tests for `parseFundamentals` |
| `app/api/fundamentals/route.ts` | Create | GET `/api/fundamentals?ticker=X` |
| `hooks/useFundamentals.ts` | Create | Lazy fetch hook, mirrors `useNews` |
| `components/FundamentalsDrawer.tsx` | Create | Three-section drawer |
| `components/StockCard.tsx` | Modify | Add `fundOpen` state + second toggle + render drawer |

---

### Task 1: Add types to `types/index.ts`

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Append the new interfaces**

Add at the end of `types/index.ts`:

```ts
export interface EarningsQuarter {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
}

export interface FundamentalsData {
  targetLow: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  analystCount: number | null;
  recommendation: string | null;
  forwardPE: number | null;
  beta: number | null;
  shortFloat: number | null;
  earnings: EarningsQuarter[];
}

export interface YahooSummaryResponse {
  quoteSummary: {
    result: Array<{
      financialData?: {
        targetLowPrice?: { raw: number };
        targetMeanPrice?: { raw: number };
        targetHighPrice?: { raw: number };
        numberOfAnalystOpinions?: { raw: number };
        recommendationKey?: string;
      };
      defaultKeyStatistics?: {
        forwardPE?: { raw: number };
        beta?: { raw: number };
        shortPercentOfFloat?: { raw: number };
      };
      earningsHistory?: {
        history: Array<{
          epsActual?: { raw: number };
          epsEstimate?: { raw: number };
          surprisePercent?: { raw: number };
          quarter?: { fmt: string };
        }>;
      };
    }> | null;
    error?: { code: string; description: string } | null;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add FundamentalsData, EarningsQuarter, YahooSummaryResponse types"
```

---

### Task 2: Write failing tests for `parseFundamentals` (TDD)

**Files:**
- Modify: `lib/__tests__/yahoo.test.ts`

- [ ] **Step 1: Add mock data and test block**

Append to `lib/__tests__/yahoo.test.ts` (after the existing `parseNews` describe block):

```ts
import { parseQuote, parseNews, parseFundamentals } from '../yahoo';
```

Replace the existing import at the top of the file with the line above, then append the following to the bottom of the file:

```ts
const mockSummaryResponse: YahooSummaryResponse = {
  quoteSummary: {
    result: [
      {
        financialData: {
          targetLowPrice: { raw: 150.0 },
          targetMeanPrice: { raw: 220.0 },
          targetHighPrice: { raw: 300.0 },
          numberOfAnalystOpinions: { raw: 42 },
          recommendationKey: 'buy',
        },
        defaultKeyStatistics: {
          forwardPE: { raw: 28.5 },
          beta: { raw: 1.25 },
          shortPercentOfFloat: { raw: 0.032 },
        },
        earningsHistory: {
          history: [
            {
              quarter: { fmt: '3/31/2024' },
              epsActual: { raw: 1.52 },
              epsEstimate: { raw: 1.48 },
              surprisePercent: { raw: 0.027 },
            },
            {
              quarter: { fmt: '12/31/2023' },
              epsActual: { raw: 2.18 },
              epsEstimate: { raw: 2.1 },
              surprisePercent: { raw: 0.038 },
            },
          ],
        },
      },
    ],
    error: null,
  },
};

describe('parseFundamentals', () => {
  it('maps all fields from a full response', () => {
    const result = parseFundamentals(mockSummaryResponse);
    expect(result.targetLow).toBe(150.0);
    expect(result.targetMean).toBe(220.0);
    expect(result.targetHigh).toBe(300.0);
    expect(result.analystCount).toBe(42);
    expect(result.recommendation).toBe('buy');
    expect(result.forwardPE).toBe(28.5);
    expect(result.beta).toBe(1.25);
    expect(result.shortFloat).toBe(0.032);
    expect(result.earnings).toHaveLength(2);
  });

  it('maps earnings fields including surprisePct as a fraction', () => {
    const result = parseFundamentals(mockSummaryResponse);
    expect(result.earnings[0]).toEqual({
      quarter: '3/31/2024',
      epsActual: 1.52,
      epsEstimate: 1.48,
      surprisePct: 0.027,
    });
  });

  it('returns null for missing optional stat fields', () => {
    const noStats: YahooSummaryResponse = {
      quoteSummary: {
        result: [
          {
            financialData: mockSummaryResponse.quoteSummary.result![0].financialData,
          },
        ],
        error: null,
      },
    };
    const result = parseFundamentals(noStats);
    expect(result.forwardPE).toBeNull();
    expect(result.beta).toBeNull();
    expect(result.shortFloat).toBeNull();
  });

  it('returns empty earnings array when earningsHistory is absent', () => {
    const noHistory: YahooSummaryResponse = {
      quoteSummary: {
        result: [
          {
            financialData: mockSummaryResponse.quoteSummary.result![0].financialData,
            defaultKeyStatistics:
              mockSummaryResponse.quoteSummary.result![0].defaultKeyStatistics,
          },
        ],
        error: null,
      },
    };
    const result = parseFundamentals(noHistory);
    expect(result.earnings).toEqual([]);
  });

  it('throws when quoteSummary result is null', () => {
    expect(() =>
      parseFundamentals({
        quoteSummary: {
          result: null,
          error: { code: '404', description: 'Not found' },
        },
      })
    ).toThrow('Not found');
  });
});
```

Also add `YahooSummaryResponse` to the import from `@/types` at the top of the file:

```ts
import type { YahooChartResponse, YahooSearchResponse, YahooSummaryResponse } from '../../types';
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- lib/__tests__/yahoo.test.ts --no-coverage
```

Expected: FAIL — `parseFundamentals is not a function`

---

### Task 3: Implement `parseFundamentals` and `fetchYahooWithCrumb` in `lib/yahoo.ts`

**Files:**
- Modify: `lib/yahoo.ts`

- [ ] **Step 1: Update the import at the top of `lib/yahoo.ts`**

Replace the existing import block at the top of `lib/yahoo.ts`:

```ts
import type {
  QuoteResponse,
  NewsArticle,
  YahooChartResponse,
  YahooSearchResponse,
  FundamentalsData,
  EarningsQuarter,
  YahooSummaryResponse,
} from '@/types';
```

- [ ] **Step 2: Append the crumb cache, `refreshCrumb`, `fetchYahooWithCrumb`, and `parseFundamentals`**

Append to the end of `lib/yahoo.ts` (after the existing `fetchYahoo` function):

```ts
let crumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null;

async function refreshCrumb(): Promise<{ crumb: string; cookie: string }> {
  const homeRes = await fetch('https://finance.yahoo.com', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  });
  const setCookies = homeRes.headers.getSetCookie();
  const cookie = setCookies.map((c) => c.split(';')[0].trim()).join('; ');

  const crumbRes = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
  });
  if (!crumbRes.ok) throw new Error('Unable to authenticate with Yahoo Finance');
  const crumb = await crumbRes.text();
  if (!crumb || crumb.startsWith('{')) throw new Error('Unable to authenticate with Yahoo Finance');
  return { crumb, cookie };
}

export async function fetchYahooWithCrumb<T>(url: string): Promise<T> {
  if (!crumbCache || Date.now() > crumbCache.expiresAt) {
    const refreshed = await refreshCrumb();
    crumbCache = { ...refreshed, expiresAt: Date.now() + 3_600_000 };
  }

  async function attempt(crumb: string, cookie: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const sep = url.includes('?') ? '&' : '?';
      return await fetch(`${url}${sep}crumb=${encodeURIComponent(crumb)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  let res = await attempt(crumbCache.crumb, crumbCache.cookie);
  if (res.status === 401) {
    const refreshed = await refreshCrumb();
    crumbCache = { ...refreshed, expiresAt: Date.now() + 3_600_000 };
    res = await attempt(crumbCache.crumb, crumbCache.cookie);
  }
  if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
  return res.json() as Promise<T>;
}

export function parseFundamentals(raw: YahooSummaryResponse): FundamentalsData {
  const result = raw.quoteSummary.result?.[0];
  if (!result) {
    throw new Error(raw.quoteSummary.error?.description ?? 'No quoteSummary data returned');
  }

  const fin = result.financialData;
  const stats = result.defaultKeyStatistics;
  const history = result.earningsHistory?.history ?? [];

  const earnings: EarningsQuarter[] = history.map((h) => ({
    quarter: h.quarter?.fmt ?? '',
    epsActual: h.epsActual?.raw ?? null,
    epsEstimate: h.epsEstimate?.raw ?? null,
    surprisePct: h.surprisePercent?.raw ?? null,
  }));

  return {
    targetLow: fin?.targetLowPrice?.raw ?? null,
    targetMean: fin?.targetMeanPrice?.raw ?? null,
    targetHigh: fin?.targetHighPrice?.raw ?? null,
    analystCount: fin?.numberOfAnalystOpinions?.raw ?? null,
    recommendation: fin?.recommendationKey ?? null,
    forwardPE: stats?.forwardPE?.raw ?? null,
    beta: stats?.beta?.raw ?? null,
    shortFloat: stats?.shortPercentOfFloat?.raw ?? null,
    earnings,
  };
}
```

- [ ] **Step 3: Run tests to confirm they pass**

```bash
npm test -- lib/__tests__/yahoo.test.ts --no-coverage
```

Expected: all tests PASS (including the 5 new `parseFundamentals` tests).

- [ ] **Step 4: Commit**

```bash
git add lib/yahoo.ts lib/__tests__/yahoo.test.ts
git commit -m "feat: add parseFundamentals and fetchYahooWithCrumb to lib/yahoo"
```

---

### Task 4: Create `/app/api/fundamentals/route.ts`

**Files:**
- Create: `app/api/fundamentals/route.ts`

- [ ] **Step 1: Create the route**

Create `app/api/fundamentals/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchYahooWithCrumb, parseFundamentals } from '@/lib/yahoo';
import type { YahooSummaryResponse } from '@/types';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  const symbol = encodeURIComponent(ticker.toUpperCase());
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData%2CdefaultKeyStatistics%2CearningsHistory`;

  try {
    const raw = await fetchYahooWithCrumb<YahooSummaryResponse>(url);
    const data = parseFundamentals(raw);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[/api/fundamentals] ${ticker}:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add app/api/fundamentals/route.ts
git commit -m "feat: add /api/fundamentals route"
```

---

### Task 5: Create `hooks/useFundamentals.ts`

**Files:**
- Create: `hooks/useFundamentals.ts`

- [ ] **Step 1: Create the hook**

Create `hooks/useFundamentals.ts`:

```ts
'use client';

import { useState, useEffect } from 'react';
import type { FundamentalsData } from '@/types';

type FundamentalsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: FundamentalsData }
  | { status: 'error'; message: string };

export function useFundamentals(ticker: string): FundamentalsState {
  const [state, setState] = useState<FundamentalsState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(`/api/fundamentals?ticker=${ticker}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setState({ status: 'error', message: data.error });
        } else {
          setState({ status: 'ok', data });
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return state;
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useFundamentals.ts
git commit -m "feat: add useFundamentals hook"
```

---

### Task 6: Create `components/FundamentalsDrawer.tsx`

**Files:**
- Create: `components/FundamentalsDrawer.tsx`

- [ ] **Step 1: Create the component**

Create `components/FundamentalsDrawer.tsx`:

```tsx
'use client';

import { useFundamentals } from '@/hooks/useFundamentals';
import type { FundamentalsData } from '@/types';

interface Props {
  ticker: string;
  currentPrice: number;
}

function recBadge(key: string | null): { label: string; className: string } {
  if (!key) return { label: '--', className: 'text-gray-500' };
  if (key === 'buy' || key === 'strong_buy')
    return { label: 'BUY', className: 'text-[#C8FF00] bg-[#1f3a0f]' };
  if (key === 'sell' || key === 'underperform')
    return { label: 'SELL', className: 'text-[#ef4444] bg-[#2a0f0f]' };
  return { label: 'HOLD', className: 'text-gray-400 bg-[#1f1f1f]' };
}

function fmt2(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DataSection({ data, currentPrice }: { data: FundamentalsData; currentPrice: number }) {
  const rec = recBadge(data.recommendation);
  const upside =
    data.targetMean != null && currentPrice > 0
      ? ((data.targetMean - currentPrice) / currentPrice) * 100
      : null;

  return (
    <div className='divide-y divide-[#1f1f1f]'>
      {/* Analyst Targets */}
      <div className='px-4 py-3'>
        <p className='text-[10px] text-gray-500 font-semibold tracking-wide uppercase mb-2'>
          Analyst Targets
        </p>
        {data.targetMean == null ? (
          <p className='text-xs text-gray-500'>No analyst coverage.</p>
        ) : (
          <div className='flex items-center flex-wrap gap-x-3 gap-y-1'>
            <span className='text-xs text-gray-500'>
              Low{' '}
              <span className='text-white font-semibold'>${fmt2(data.targetLow!)}</span>
              {' · '}Mean{' '}
              <span className='text-white font-semibold'>${fmt2(data.targetMean)}</span>
              {' · '}High{' '}
              <span className='text-white font-semibold'>${fmt2(data.targetHigh!)}</span>
            </span>
            {upside != null && (
              <span
                className={`text-xs font-semibold ${upside >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
              >
                {upside >= 0 ? '+' : ''}
                {upside.toFixed(1)}% to mean
              </span>
            )}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rec.className}`}
            >
              {rec.label}
            </span>
            {data.analystCount != null && (
              <span className='text-[10px] text-gray-500'>({data.analystCount} analysts)</span>
            )}
          </div>
        )}
      </div>

      {/* Key Stats */}
      <div className='px-4 py-3'>
        <p className='text-[10px] text-gray-500 font-semibold tracking-wide uppercase mb-2'>
          Key Stats
        </p>
        <div className='flex gap-6'>
          <div>
            <p className='text-[10px] text-gray-500'>Fwd P/E</p>
            <p className='text-xs font-semibold text-white'>
              {data.forwardPE?.toFixed(1) ?? '--'}
            </p>
          </div>
          <div>
            <p className='text-[10px] text-gray-500'>Beta</p>
            <p className='text-xs font-semibold text-white'>
              {data.beta?.toFixed(2) ?? '--'}
            </p>
          </div>
          <div>
            <p className='text-[10px] text-gray-500'>Short</p>
            <p className='text-xs font-semibold text-white'>
              {data.shortFloat != null
                ? `${(data.shortFloat * 100).toFixed(1)}%`
                : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Earnings History */}
      {data.earnings.length > 0 && (
        <div className='px-4 py-3'>
          <p className='text-[10px] text-gray-500 font-semibold tracking-wide uppercase mb-2'>
            Earnings History
          </p>
          <table className='w-full text-xs'>
            <thead>
              <tr className='text-[10px] text-gray-500'>
                <th className='text-left font-medium pb-1'>Quarter</th>
                <th className='text-right font-medium pb-1'>Est</th>
                <th className='text-right font-medium pb-1'>Actual</th>
                <th className='text-right font-medium pb-1'>Surprise</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-[#1f1f1f]'>
              {data.earnings.map((q) => {
                const s = q.surprisePct != null ? q.surprisePct * 100 : null;
                const sColor =
                  s == null
                    ? 'text-gray-500'
                    : s >= 0
                    ? 'text-[#22c55e]'
                    : 'text-[#ef4444]';
                return (
                  <tr key={q.quarter}>
                    <td className='py-1 text-gray-400'>{q.quarter}</td>
                    <td className='py-1 text-right text-gray-400'>
                      {q.epsEstimate != null ? `$${q.epsEstimate.toFixed(2)}` : '--'}
                    </td>
                    <td className='py-1 text-right text-white font-semibold'>
                      {q.epsActual != null ? `$${q.epsActual.toFixed(2)}` : '--'}
                    </td>
                    <td className={`py-1 text-right font-semibold ${sColor}`}>
                      {s != null
                        ? `${s >= 0 ? '+' : ''}${s.toFixed(1)}%`
                        : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FundamentalsDrawer({ ticker, currentPrice }: Props) {
  const state = useFundamentals(ticker);

  return (
    <div className='border-t border-[#1f1f1f]'>
      {state.status === 'loading' && (
        <div className='px-4 py-3 space-y-2'>
          {[1, 2, 3].map((i) => (
            <div key={i} className='animate-pulse'>
              <div className='h-3 bg-[#1f1f1f] rounded w-full mb-1' />
              <div className='h-3 bg-[#1f1f1f] rounded w-3/4' />
            </div>
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className='px-4 py-3 text-xs text-[#ef4444]'>
          Could not load fundamentals: {state.message}
        </p>
      )}

      {state.status === 'ok' && (
        <DataSection data={state.data} currentPrice={currentPrice} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add components/FundamentalsDrawer.tsx
git commit -m "feat: add FundamentalsDrawer component"
```

---

### Task 7: Update `StockCard` to add fundamentals toggle

**Files:**
- Modify: `components/StockCard.tsx`

- [ ] **Step 1: Replace the StockCard implementation**

Replace the entire contents of `components/StockCard.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import type { QuoteState } from '@/types';
import { Sparkline } from './Sparkline';
import { SkeletonCard } from './SkeletonCard';
import { NewsDrawer } from './NewsDrawer';
import { FundamentalsDrawer } from './FundamentalsDrawer';

interface Props {
  ticker: string;
  state: QuoteState;
  tag: 'owned' | 'watching';
  onTagToggle: () => void;
  onRemove: () => void;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtVolume(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

export function StockCard({ ticker, state, tag, onTagToggle, onRemove }: Props) {
  const [newsOpen, setNewsOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);

  if (state.status === 'loading') return <SkeletonCard />;

  if (state.status === 'error') {
    return (
      <div className='bg-[#111111] border border-[#1f1f1f] rounded-xl p-4'>
        <div className='flex justify-between items-start mb-1'>
          <p className='text-sm font-semibold text-white'>{ticker}</p>
          <button
            onClick={onRemove}
            className='text-gray-600 hover:text-gray-400 text-xs leading-none ml-2'
            aria-label={`Remove ${ticker}`}
          >
            ✕
          </button>
        </div>
        <p className='text-xs text-[#ef4444]'>{state.message}</p>
      </div>
    );
  }

  const { data } = state;
  const positive = data.change >= 0;
  const changeColor = positive ? 'text-[#22c55e]' : 'text-[#ef4444]';
  const sign = positive ? '+' : '';

  return (
    <div className='bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden'>
      <div className='p-4'>
        <div className='flex justify-between items-start mb-2'>
          <div>
            <p className='font-heading text-base font-bold text-white tracking-wide'>{ticker}</p>
            <p className='text-xs text-gray-500 truncate max-w-[140px]'>{data.name}</p>
          </div>
          <div className='flex items-center gap-1.5 shrink-0'>
            <button
              onClick={onTagToggle}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                tag === 'owned'
                  ? 'bg-[#1f3a0f] text-[#C8FF00] hover:bg-[#2a4f14]'
                  : 'bg-[#1a1a2e] text-gray-500 hover:bg-[#222240]'
              }`}
            >
              {tag === 'owned' ? 'OWNED' : 'WATCH'}
            </button>
            <button
              onClick={onRemove}
              className='text-gray-600 hover:text-gray-400 text-xs leading-none'
              aria-label={`Remove ${ticker}`}
            >
              ✕
            </button>
          </div>
        </div>

        <p className='font-heading text-3xl font-bold text-white mb-0.5'>{fmt(data.price)}</p>

        <p className={`text-sm font-semibold ${changeColor} mb-3`}>
          {sign}
          {fmt(data.change)} ({sign}
          {fmt(data.changePct)}%)
        </p>

        {data.sparkline.length > 1 && (
          <div className='mb-3'>
            <Sparkline data={data.sparkline} positive={positive} />
          </div>
        )}

        <div className='flex justify-between text-xs text-gray-500 mb-3'>
          <span>
            H: {fmt(data.high)} / L: {fmt(data.low)}
          </span>
          <span>Vol: {fmtVolume(data.volume)}</span>
        </div>

        <button
          onClick={() => setNewsOpen((o) => !o)}
          className='text-xs text-[#C8FF00] hover:underline w-full text-left'
        >
          {newsOpen ? 'Hide news ↑' : 'Show news ↓'}
        </button>
        <button
          onClick={() => setFundOpen((o) => !o)}
          className='text-xs text-[#C8FF00] hover:underline w-full text-left mt-1'
        >
          {fundOpen ? 'Hide fundamentals ↑' : 'Show fundamentals ↓'}
        </button>
      </div>

      {newsOpen && <NewsDrawer ticker={ticker} />}
      {fundOpen && <FundamentalsDrawer ticker={ticker} currentPrice={data.price} />}
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add components/StockCard.tsx
git commit -m "feat: add fundamentals drawer toggle to StockCard"
```
