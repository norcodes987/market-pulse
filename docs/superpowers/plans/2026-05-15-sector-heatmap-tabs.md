# Sector Heatmap + Owned/Watching Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sector ETF tiles to the MarketBar and split the watchlist into All/Owned/Watching tabs with per-card tag toggling.

**Architecture:** `useWatchlist` migrates its localStorage format from `string[]` to `WatchlistEntry[]`, giving tickers and tags a single source of truth. A new `TabBar` component handles tab switching in `page.tsx`, and `useMarketOverview` is extended to fetch 11 sector ETFs alongside the 4 index tickers in one `Promise.allSettled`.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, React hooks, localStorage

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `types/index.ts` | Modify | Add `WatchlistEntry` interface |
| `hooks/useWatchlist.ts` | Modify | New data model, `setTag`, migration |
| `hooks/__tests__/useWatchlist.test.ts` | Modify | Update + extend tests |
| `hooks/useMarketOverview.ts` | Modify | Export `SECTOR_TICKERS`, fetch all 15 tickers |
| `hooks/__tests__/useMarketOverview.test.ts` | Modify | Update test title and add sector assertions |
| `components/MarketBar.tsx` | Modify | Import `SECTOR_TICKERS`, render sector pills with divider |
| `components/TabBar.tsx` | Create | All / Owned / Watching tab strip |
| `components/StockCard.tsx` | Modify | Add `tag`, `onTagToggle`, `onRemove` props + badge + ✕ |
| `components/WatchlistBar.tsx` | Delete | Replaced by TabBar |
| `app/page.tsx` | Modify | Tab state, filtering, updated props, remove WatchlistBar |

---

### Task 1: Add `WatchlistEntry` to types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add the interface**

In `types/index.ts`, add after the `NewsResponse` interface (after line 23):

```ts
export interface WatchlistEntry {
  ticker: string;
  tag: 'owned' | 'watching';
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add WatchlistEntry type"
```

---

### Task 2: Update `useWatchlist` tests (TDD — write failing tests first)

**Files:**
- Modify: `hooks/__tests__/useWatchlist.test.ts`

- [ ] **Step 1: Replace the test file**

Replace the entire contents of `hooks/__tests__/useWatchlist.test.ts` with:

```ts
import { renderHook, act } from '@testing-library/react';
import { useWatchlist } from '../useWatchlist';
import type { WatchlistEntry } from '@/types';

const STORAGE_KEY = 'stockbuzz:watchlist';

beforeEach(() => {
  localStorage.clear();
});

describe('useWatchlist', () => {
  it('starts with an empty list when localStorage is empty', () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual([]);
  });

  it('adds a ticker as watching by default', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    expect(result.current.entries).toContainEqual({ ticker: 'AAPL', tag: 'watching' });
  });

  it('uppercases the ticker on add', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('aapl'); });
    expect(result.current.entries[0].ticker).toBe('AAPL');
  });

  it('does not add duplicate tickers', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    act(() => { result.current.addTicker('AAPL'); });
    expect(result.current.entries.filter((e) => e.ticker === 'AAPL')).toHaveLength(1);
  });

  it('removes a ticker entry', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    act(() => { result.current.removeTicker('AAPL'); });
    expect(result.current.entries).not.toContainEqual(expect.objectContaining({ ticker: 'AAPL' }));
  });

  it('sets a tag on an existing ticker', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    act(() => { result.current.setTag('AAPL', 'owned'); });
    expect(result.current.entries).toContainEqual({ ticker: 'AAPL', tag: 'owned' });
  });

  it('setTag is a no-op for unknown tickers', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.setTag('UNKNOWN', 'owned'); });
    expect(result.current.entries).toEqual([]);
  });

  it('persists entries to localStorage', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('MSFT'); });
    const stored: WatchlistEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toContainEqual({ ticker: 'MSFT', tag: 'watching' });
  });

  it('hydrates WatchlistEntry[] from localStorage on mount', () => {
    const entries: WatchlistEntry[] = [
      { ticker: 'TSLA', tag: 'owned' },
      { ticker: 'NVDA', tag: 'watching' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual(entries);
  });

  it('migrates legacy string[] format to WatchlistEntry[] on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['TSLA', 'NVDA']));
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual([
      { ticker: 'TSLA', tag: 'watching' },
      { ticker: 'NVDA', tag: 'watching' },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- hooks/__tests__/useWatchlist.test.ts --no-coverage
```

Expected: multiple failures — `entries` and `setTag` do not exist yet on the hook.

---

### Task 3: Implement new `useWatchlist`

**Files:**
- Modify: `hooks/useWatchlist.ts`

- [ ] **Step 1: Replace the hook implementation**

Replace the entire contents of `hooks/useWatchlist.ts` with:

```ts
'use client';

import { useState, useEffect } from 'react';
import type { WatchlistEntry } from '@/types';

const STORAGE_KEY = 'stockbuzz:watchlist';

function loadEntries(): WatchlistEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Migrate legacy string[] format
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      const migrated: WatchlistEntry[] = (parsed as string[]).map((ticker) => ({
        ticker,
        tag: 'watching',
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return parsed as WatchlistEntry[];
  } catch {
    return [];
  }
}

function persist(entries: WatchlistEntry[]): WatchlistEntry[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  function addTicker(raw: string) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker) return;
    setEntries((prev) => {
      if (prev.some((e) => e.ticker === ticker)) return prev;
      return persist([...prev, { ticker, tag: 'watching' }]);
    });
  }

  function removeTicker(ticker: string) {
    setEntries((prev) => persist(prev.filter((e) => e.ticker !== ticker)));
  }

  function setTag(ticker: string, tag: 'owned' | 'watching') {
    setEntries((prev) => {
      if (!prev.some((e) => e.ticker === ticker)) return prev;
      return persist(prev.map((e) => (e.ticker === ticker ? { ...e, tag } : e)));
    });
  }

  return { entries, addTicker, removeTicker, setTag };
}
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npm test -- hooks/__tests__/useWatchlist.test.ts --no-coverage
```

Expected: all 10 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add hooks/useWatchlist.ts hooks/__tests__/useWatchlist.test.ts
git commit -m "feat: migrate useWatchlist to WatchlistEntry model with setTag and legacy migration"
```

---

### Task 4: Extend `useMarketOverview` with sector tickers

**Files:**
- Modify: `hooks/useMarketOverview.ts`
- Modify: `hooks/__tests__/useMarketOverview.test.ts`

- [ ] **Step 1: Update the first test to assert sector tickers**

In `hooks/__tests__/useMarketOverview.test.ts`, replace the first `it` block:

```ts
it('starts index and sector tickers in loading state', () => {
  jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
  const { result } = renderHook(() => useMarketOverview());
  expect(result.current['SPY']).toEqual({ status: 'loading' });
  expect(result.current['QQQ']).toEqual({ status: 'loading' });
  expect(result.current['IWM']).toEqual({ status: 'loading' });
  expect(result.current['VIX']).toEqual({ status: 'loading' });
  expect(result.current['XLK']).toEqual({ status: 'loading' });
  expect(result.current['XLE']).toEqual({ status: 'loading' });
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- hooks/__tests__/useMarketOverview.test.ts --no-coverage
```

Expected: FAIL — `XLK` and `XLE` are `undefined`, not `{ status: 'loading' }`.

- [ ] **Step 3: Replace `useMarketOverview` implementation**

Replace the entire contents of `hooks/useMarketOverview.ts` with:

```ts
'use client';

import { useState, useEffect } from 'react';
import type { QuoteState } from '@/types';

const MARKET_TICKERS = ['SPY', 'QQQ', 'IWM', 'VIX'] as const;

export const SECTOR_TICKERS = [
  'XLK', 'XLF', 'XLE', 'XLV', 'XLU', 'XLI', 'XLB', 'XLRE', 'XLY', 'XLP', 'XLC',
] as const;

const ALL_TICKERS = [...MARKET_TICKERS, ...SECTOR_TICKERS] as const;

// Yahoo Finance uses ^-prefixed symbols for indices, not plain ticker names
const YAHOO_SYMBOLS: Record<string, string> = {
  VIX: '^VIX',
};

const initialState: Record<string, QuoteState> = Object.fromEntries(
  ALL_TICKERS.map((t) => [t, { status: 'loading' } as QuoteState])
);

export function useMarketOverview(): Record<string, QuoteState> {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>(initialState);

  async function fetchAll() {
    const results = await Promise.allSettled(
      ALL_TICKERS.map((ticker) => {
        const symbol = encodeURIComponent(YAHOO_SYMBOLS[ticker] ?? ticker);
        return fetch(`/api/quote?ticker=${symbol}`).then((r) => r.json());
      })
    );

    setQuotes(() => {
      const next: Record<string, QuoteState> = {};
      ALL_TICKERS.forEach((ticker, i) => {
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
  }, []);

  return quotes;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- hooks/__tests__/useMarketOverview.test.ts --no-coverage
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add hooks/useMarketOverview.ts hooks/__tests__/useMarketOverview.test.ts
git commit -m "feat: extend useMarketOverview with 11 sector ETF tickers"
```

---

### Task 5: Update `MarketBar` to render sector pills

**Files:**
- Modify: `components/MarketBar.tsx`

- [ ] **Step 1: Replace `MarketBar` implementation**

Replace the entire contents of `components/MarketBar.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { useMarketOverview, SECTOR_TICKERS } from '@/hooks/useMarketOverview';
import type { QuoteState } from '@/types';

const MARKET_TICKERS = ['SPY', 'QQQ', 'IWM', 'VIX'] as const;

const DESCRIPTIONS: Record<string, string> = {
  SPY: 'S&P 500 ETF — tracks the 500 largest US companies',
  QQQ: 'Nasdaq-100 ETF — heavily weighted toward tech.',
  IWM: 'Russell 2000 ETF — 2,000 small-caps.',
  VIX: 'CBOE Volatility Index. Below 15: calm. 15–25: normal. Above 25: elevated stress.',
};

interface IndexItemProps {
  ticker: string;
  state: QuoteState;
  selected: boolean;
  onClick: () => void;
}

function IndexItem({ ticker, state, selected, onClick }: IndexItemProps) {
  let price = '--';
  let changePct = '--';
  let colorClass = 'text-gray-500';

  if (state.status === 'ok') {
    const sign = state.data.changePct >= 0 ? '+' : '';
    price = state.data.price.toFixed(2);
    changePct = `${sign}${state.data.changePct.toFixed(2)}%`;
    colorClass = state.data.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';
  }

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start shrink-0 px-4 py-2.5 border-b-2 transition-colors hover:bg-white/5 ${
        selected ? 'border-[#C8FF00]' : 'border-transparent'
      }`}
    >
      <span className='text-xs text-gray-500 font-semibold tracking-wide'>{ticker}</span>
      <span className='text-xs font-semibold text-white'>{price}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>{changePct}</span>
    </button>
  );
}

interface SectorPillProps {
  ticker: string;
  state: QuoteState;
}

function SectorPill({ ticker, state }: SectorPillProps) {
  let changePct = '--';
  let colorClass = 'text-gray-500';

  if (state.status === 'ok') {
    const sign = state.data.changePct >= 0 ? '+' : '';
    changePct = `${sign}${state.data.changePct.toFixed(2)}%`;
    colorClass = state.data.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]';
  }

  return (
    <div className='flex flex-col items-start shrink-0 px-3 py-2.5'>
      <span className='text-xs text-gray-500 font-semibold tracking-wide'>{ticker}</span>
      <span className={`text-xs font-semibold ${colorClass}`}>{changePct}</span>
    </div>
  );
}

export function MarketBar() {
  const quotes = useMarketOverview();
  const [selected, setSelected] = useState<string>('SPY');

  return (
    <div className='border-b border-[#1f1f1f]'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6'>
        <div className='flex overflow-x-auto'>
          {MARKET_TICKERS.map((ticker) => (
            <IndexItem
              key={ticker}
              ticker={ticker}
              state={quotes[ticker] ?? { status: 'loading' }}
              selected={selected === ticker}
              onClick={() => setSelected(ticker)}
            />
          ))}
          <div className='flex items-center px-2 text-[#2f2f2f] text-lg select-none shrink-0'>
            │
          </div>
          {SECTOR_TICKERS.map((ticker) => (
            <SectorPill
              key={ticker}
              ticker={ticker}
              state={quotes[ticker] ?? { status: 'loading' }}
            />
          ))}
        </div>
        <div className='py-2.5 px-1'>
          <p className='text-xs text-gray-500'>
            <span className='text-gray-400 font-semibold'>{selected}:</span>{' '}
            {DESCRIPTIONS[selected]}
          </p>
        </div>
      </div>
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
git add components/MarketBar.tsx
git commit -m "feat: add sector ETF pills to MarketBar with visual divider"
```

---

### Task 6: Create `TabBar` component

**Files:**
- Create: `components/TabBar.tsx`

- [ ] **Step 1: Create the component**

Create `components/TabBar.tsx`:

```tsx
type Tab = 'all' | 'owned' | 'watching';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  counts: { all: number; owned: number; watching: number };
}

export function TabBar({ activeTab, onTabChange, counts }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'owned', label: `Owned (${counts.owned})` },
    { id: 'watching', label: `Watching (${counts.watching})` },
  ];

  return (
    <div className='border-b border-[#1f1f1f]'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 flex'>
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-colors ${
              activeTab === id
                ? 'border-[#C8FF00] text-white'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
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
git add components/TabBar.tsx
git commit -m "feat: add TabBar component for All/Owned/Watching navigation"
```

---

### Task 7: Update `StockCard` with badge and remove button

**Files:**
- Modify: `components/StockCard.tsx`

- [ ] **Step 1: Replace `StockCard` implementation**

Replace the entire contents of `components/StockCard.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import type { QuoteState } from '@/types';
import { Sparkline } from './Sparkline';
import { SkeletonCard } from './SkeletonCard';
import { NewsDrawer } from './NewsDrawer';

interface Props {
  ticker: string;
  state: QuoteState;
  tag: 'owned' | 'watching';
  onTagToggle: () => void;
  onRemove: () => void;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVolume(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

export function StockCard({ ticker, state, tag, onTagToggle, onRemove }: Props) {
  const [newsOpen, setNewsOpen] = useState(false);

  if (state.status === 'loading') return <SkeletonCard />;

  if (state.status === 'error') {
    return (
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
        <div className="flex justify-between items-start mb-1">
          <p className="text-sm font-semibold text-white">{ticker}</p>
          <button
            onClick={onRemove}
            className="text-gray-600 hover:text-gray-400 text-xs leading-none ml-2"
            aria-label={`Remove ${ticker}`}
          >
            ✕
          </button>
        </div>
        <p className="text-xs text-[#ef4444]">{state.message}</p>
      </div>
    );
  }

  const { data } = state;
  const positive = data.change >= 0;
  const changeColor = positive ? 'text-[#22c55e]' : 'text-[#ef4444]';
  const sign = positive ? '+' : '';

  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-heading text-base font-bold text-white tracking-wide">{ticker}</p>
            <p className="text-xs text-gray-500 truncate max-w-[140px]">{data.name}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
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
              className="text-gray-600 hover:text-gray-400 text-xs leading-none"
              aria-label={`Remove ${ticker}`}
            >
              ✕
            </button>
          </div>
        </div>

        <p className="font-heading text-3xl font-bold text-white mb-0.5">
          {fmt(data.price)}
        </p>

        <p className={`text-sm font-semibold ${changeColor} mb-3`}>
          {sign}{fmt(data.change)} ({sign}{fmt(data.changePct)}%)
        </p>

        {data.sparkline.length > 1 && (
          <div className="mb-3">
            <Sparkline data={data.sparkline} positive={positive} />
          </div>
        )}

        <div className="flex justify-between text-xs text-gray-500 mb-3">
          <span>H: {fmt(data.high)} / L: {fmt(data.low)}</span>
          <span>Vol: {fmtVolume(data.volume)}</span>
        </div>

        <button
          onClick={() => setNewsOpen((o) => !o)}
          className="text-xs text-[#C8FF00] hover:underline w-full text-left"
        >
          {newsOpen ? 'Hide news ↑' : 'Show news ↓'}
        </button>
      </div>

      {newsOpen && <NewsDrawer ticker={ticker} />}
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
git commit -m "feat: add owned/watching badge and remove button to StockCard"
```

---

### Task 8: Wire `page.tsx`, delete `WatchlistBar`

**Files:**
- Modify: `app/page.tsx`
- Delete: `components/WatchlistBar.tsx`

- [ ] **Step 1: Delete `WatchlistBar`**

```bash
git rm components/WatchlistBar.tsx
```

- [ ] **Step 2: Replace `page.tsx`**

Replace the entire contents of `app/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useQuotes } from '@/hooks/useQuotes';
import { TopBar } from '@/components/TopBar';
import { MarketBar } from '@/components/MarketBar';
import { TabBar } from '@/components/TabBar';
import { StockCard } from '@/components/StockCard';

type Tab = 'all' | 'owned' | 'watching';

export default function Home() {
  const { entries, addTicker, removeTicker, setTag } = useWatchlist();
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const allTickers = entries.map((e) => e.ticker);
  const quotes = useQuotes(allTickers);

  const visibleEntries =
    activeTab === 'all' ? entries : entries.filter((e) => e.tag === activeTab);

  const counts = {
    all: entries.length,
    owned: entries.filter((e) => e.tag === 'owned').length,
    watching: entries.filter((e) => e.tag === 'watching').length,
  };

  return (
    <div className='min-h-screen bg-[#080808]'>
      <TopBar onAdd={addTicker} />
      <MarketBar />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

      <main className='px-4 sm:px-6 py-6 max-w-7xl mx-auto'>
        {visibleEntries.length > 0 && (
          <div className='mt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
            {visibleEntries.map(({ ticker, tag }) => {
              const state = quotes[ticker] ?? { status: 'loading' };
              return (
                <StockCard
                  key={ticker}
                  ticker={ticker}
                  state={state}
                  tag={tag}
                  onTagToggle={() => setTag(ticker, tag === 'owned' ? 'watching' : 'owned')}
                  onRemove={() => removeTicker(ticker)}
                />
              );
            })}
          </div>
        )}

        {entries.length === 0 && (
          <div className='mt-16 text-center'>
            <p className='text-gray-500 text-sm'>
              Add a ticker symbol above to get started.
            </p>
          </div>
        )}

        {entries.length > 0 && visibleEntries.length === 0 && (
          <div className='mt-16 text-center'>
            <p className='text-gray-500 text-sm'>
              No {activeTab} stocks yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test --no-coverage
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: wire TabBar, tab filtering, and tag toggle into page; remove WatchlistBar"
```
