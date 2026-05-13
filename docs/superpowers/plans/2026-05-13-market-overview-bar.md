# Market Overview Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pinned market overview bar below the TopBar showing live SPY, QQQ, IWM, and VIX data with a selectable description strip.

**Architecture:** A new `useMarketOverview` hook fetches the four hardcoded tickers via the existing `/api/quote` endpoint using `Promise.allSettled`, auto-refreshing every 60 s. A new `MarketBar` component consumes the hook, tracks which ticker is selected, and renders the ticker row + description strip. `page.tsx` renders `MarketBar` between `TopBar` and `main`.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Tailwind CSS v4, Jest + React Testing Library

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `hooks/useMarketOverview.ts` | Fetch + auto-refresh SPY/QQQ/IWM/VIX |
| Create | `hooks/__tests__/useMarketOverview.test.ts` | Unit tests for the hook |
| Create | `components/MarketBar.tsx` | Pinned bar UI + description strip |
| Modify | `app/page.tsx` | Render `<MarketBar />` between TopBar and main |

---

### Task 1: `useMarketOverview` hook — tests first

**Files:**
- Create: `hooks/__tests__/useMarketOverview.test.ts`
- Create: `hooks/useMarketOverview.ts`

- [ ] **Step 1: Write the failing tests**

Create `hooks/__tests__/useMarketOverview.test.ts`:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useMarketOverview } from '../useMarketOverview';
import type { QuoteResponse } from '@/types';

function mockQuote(ticker: string): QuoteResponse {
  return {
    ticker,
    name: `${ticker} Fund`,
    price: 100,
    change: 1,
    changePct: 1,
    currency: 'USD',
    high: 101,
    low: 99,
    volume: 1_000_000,
    sparkline: [99, 100, 101],
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useMarketOverview', () => {
  it('starts all four tickers in loading state', () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useMarketOverview());
    expect(result.current['SPY']).toEqual({ status: 'loading' });
    expect(result.current['QQQ']).toEqual({ status: 'loading' });
    expect(result.current['IWM']).toEqual({ status: 'loading' });
    expect(result.current['VIX']).toEqual({ status: 'loading' });
  });

  it('sets all tickers to ok on successful fetch', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const ticker = new URL(input as string, 'http://localhost').searchParams.get('ticker')!;
      return Promise.resolve({
        json: () => Promise.resolve(mockQuote(ticker)),
      } as Response);
    });

    const { result } = renderHook(() => useMarketOverview());
    await waitFor(() => expect(result.current['SPY'].status).toBe('ok'));
    expect(result.current['QQQ'].status).toBe('ok');
    expect(result.current['IWM'].status).toBe('ok');
    expect(result.current['VIX'].status).toBe('ok');
  });

  it('sets ticker to error when fetch rejects', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useMarketOverview());
    await waitFor(() => expect(result.current['SPY'].status).toBe('error'));
    expect(result.current['QQQ'].status).toBe('error');
  });

  it('sets ticker to error when API returns error field', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ error: 'Invalid ticker' }),
    } as Response);

    const { result } = renderHook(() => useMarketOverview());
    await waitFor(() => expect(result.current['SPY'].status).toBe('error'));
    expect((result.current['SPY'] as { status: 'error'; message: string }).message).toBe('Invalid ticker');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- --testPathPattern="useMarketOverview" --no-coverage
```

Expected: `Cannot find module '../useMarketOverview'`

- [ ] **Step 3: Implement the hook**

Create `hooks/useMarketOverview.ts`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import type { QuoteState } from '@/types';

const MARKET_TICKERS = ['SPY', 'QQQ', 'IWM', 'VIX'] as const;

const initialState: Record<string, QuoteState> = Object.fromEntries(
  MARKET_TICKERS.map((t) => [t, { status: 'loading' } as QuoteState])
);

export function useMarketOverview(): Record<string, QuoteState> {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>(initialState);

  async function fetchAll() {
    const results = await Promise.allSettled(
      MARKET_TICKERS.map((ticker) =>
        fetch(`/api/quote?ticker=${ticker}`).then((r) => r.json())
      )
    );

    setQuotes(() => {
      const next: Record<string, QuoteState> = {};
      MARKET_TICKERS.forEach((ticker, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.error) {
            next[ticker] = { status: 'error', message: data.error };
          } else {
            next[ticker] = { status: 'ok', data };
          }
        } else {
          next[ticker] = {
            status: 'error',
            message: (result.reason as Error)?.message ?? 'Fetch failed',
          };
        }
      });
      return next;
    });
  }

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
    // fetchAll is defined inside the effect's closure; no dep needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return quotes;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- --testPathPattern="useMarketOverview" --no-coverage
```

Expected: 4 tests pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add hooks/useMarketOverview.ts hooks/__tests__/useMarketOverview.test.ts
git commit -m "feat: add useMarketOverview hook for SPY/QQQ/IWM/VIX"
```

---

### Task 2: `MarketBar` component

**Files:**
- Create: `components/MarketBar.tsx`

- [ ] **Step 1: Create the component**

Create `components/MarketBar.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useMarketOverview } from '@/hooks/useMarketOverview';
import type { QuoteState } from '@/types';

const MARKET_TICKERS = ['SPY', 'QQQ', 'IWM', 'VIX'] as const;

const DESCRIPTIONS: Record<string, string> = {
  SPY: "S&P 500 ETF — tracks the 500 largest US companies. The broadest read on the US stock market.",
  QQQ: "Nasdaq-100 ETF — heavily weighted toward tech. Moves more aggressively than SPY; a tech sentiment signal.",
  IWM: "Russell 2000 ETF — 2,000 small-caps. Lags SPY when credit is tight or recession fear is rising.",
  VIX: "CBOE Volatility Index — the market's fear gauge. Below 15: calm. 15–25: normal. Above 25: elevated stress.",
};

interface TickerItemProps {
  ticker: string;
  state: QuoteState;
  selected: boolean;
  onClick: () => void;
}

function TickerItem({ ticker, state, selected, onClick }: TickerItemProps) {
  let value = '--';
  let colorClass = 'text-gray-500';

  if (state.status === 'ok') {
    const sign = state.data.changePct >= 0 ? '+' : '';
    value = `${sign}${state.data.changePct.toFixed(2)}%`;
    colorClass = state.data.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start shrink-0 px-4 py-2.5 border-b-2 transition-colors hover:bg-white/5 ${
        selected ? 'border-[#C8FF00]' : 'border-transparent'
      }`}
    >
      <span className="text-xs text-gray-500 font-semibold tracking-wide">{ticker}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>{value}</span>
    </button>
  );
}

export function MarketBar() {
  const quotes = useMarketOverview();
  const [selected, setSelected] = useState<string>('SPY');

  return (
    <div className="border-b border-[#1f1f1f]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex overflow-x-auto">
          {MARKET_TICKERS.map((ticker) => (
            <TickerItem
              key={ticker}
              ticker={ticker}
              state={quotes[ticker] ?? { status: 'loading' }}
              selected={selected === ticker}
              onClick={() => setSelected(ticker)}
            />
          ))}
        </div>
        <div className="pb-2 px-1">
          <p className="text-xs text-gray-500">
            <span className="text-gray-400 font-semibold">{selected}:</span>{' '}
            {DESCRIPTIONS[selected]}
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite to check for regressions**

```bash
npm test -- --no-coverage
```

Expected: all existing tests still pass, no new failures.

- [ ] **Step 3: Commit**

```bash
git add components/MarketBar.tsx
git commit -m "feat: add MarketBar component with description strip"
```

---

### Task 3: Wire `MarketBar` into the page

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add `MarketBar` to the page**

In `app/page.tsx`, add the import and place the component between `<TopBar>` and `<main>`:

```tsx
'use client';

import { useWatchlist } from '@/hooks/useWatchlist';
import { useQuotes } from '@/hooks/useQuotes';
import { TopBar } from '@/components/TopBar';
import { MarketBar } from '@/components/MarketBar';
import { WatchlistBar } from '@/components/WatchlistBar';
import { StockCard } from '@/components/StockCard';

export default function Home() {
  const { tickers, addTicker, removeTicker } = useWatchlist();
  const quotes = useQuotes(tickers);

  return (
    <div className='min-h-screen bg-[#080808]'>
      <TopBar onAdd={addTicker} />
      <MarketBar />

      <main className='px-4 sm:px-6 py-6 max-w-7xl mx-auto'>
        <WatchlistBar tickers={tickers} onRemove={removeTicker} />

        {tickers.length > 0 && (
          <div className='mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {tickers.map((ticker) => {
              const state = quotes[ticker] ?? { status: 'loading' };
              return <StockCard key={ticker} ticker={ticker} state={state} />;
            })}
          </div>
        )}

        {tickers.length === 0 && (
          <div className='mt-16 text-center'>
            <p className='text-gray-500 text-sm'>
              Add a ticker symbol above to get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
```

Note: also removes the stray `console.log(state)` that was in the original.

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --no-coverage
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire MarketBar into page between TopBar and main"
```
