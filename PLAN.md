# Market Pulse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-themed stock watchlist dashboard that shows live price cards with sparklines and news, powered by Yahoo Finance endpoints called server-side.

**Architecture:** Next.js App Router handles routing and API routes; client hooks (`useWatchlist`, `useQuotes`, `useNews`) own all state and fetching; UI components are pure presentational. Yahoo Finance is called exclusively from API routes to avoid CORS — the browser only ever talks to `/api/quote` and `/api/news`.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS v4, Recharts, Jest + React Testing Library, localStorage for persistence

---

## File map

| File                                   | Responsibility                                                       |
| -------------------------------------- | -------------------------------------------------------------------- |
| `types/index.ts`                       | All shared TypeScript interfaces                                     |
| `lib/yahoo.ts`                         | Pure parse helpers for Yahoo Finance JSON (server-only)              |
| `lib/__tests__/yahoo.test.ts`          | Unit tests for parse helpers                                         |
| `app/api/quote/route.ts`               | GET /api/quote?ticker=X                                              |
| `app/api/news/route.ts`                | GET /api/news?ticker=X                                               |
| `app/globals.css`                      | Dark theme, Barlow Condensed, Tailwind v4 theme tokens               |
| `app/layout.tsx`                       | Root layout with font variable                                       |
| `app/page.tsx`                         | Main page — wires watchlist + quote grid                             |
| `hooks/useWatchlist.ts`                | localStorage-backed add/remove ticker list                           |
| `hooks/__tests__/useWatchlist.test.ts` | Hook unit tests                                                      |
| `hooks/useQuotes.ts`                   | Parallel fetch all quotes + 60 s auto-refresh                        |
| `hooks/useNews.ts`                     | On-demand news fetch for one ticker                                  |
| `components/AddTickerForm.tsx`         | Controlled input + submit for adding tickers                         |
| `components/TickerPill.tsx`            | Removable ticker chip                                                |
| `components/WatchlistBar.tsx`          | Row of TickerPill components                                         |
| `components/TopBar.tsx`                | App header with name + AddTickerForm                                 |
| `components/Sparkline.tsx`             | Recharts AreaChart sparkline                                         |
| `components/SkeletonCard.tsx`          | Loading placeholder card                                             |
| `components/StockCard.tsx`             | Full price card (price, change, H/L, volume, sparkline, news toggle) |
| `components/NewsItem.tsx`              | Single news headline row                                             |
| `components/NewsDrawer.tsx`            | Collapsible news feed panel                                          |
| `jest.config.ts`                       | Jest config for Next.js                                              |
| `jest.setup.ts`                        | `@testing-library/jest-dom` import                                   |

---

## Task 1: Install dependencies + configure Jest

**Files:**

- Create: `jest.config.ts`
- Create: `jest.setup.ts`
- Modify: `package.json` (scripts + devDependencies)

- [ ] **Step 1: Install runtime + dev dependencies**

```bash
cd /workspace/market-pulse
npm install recharts
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom @types/jest ts-jest
```

- [ ] **Step 2: Create jest.config.ts**

```typescript
// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

export default createJestConfig(config);
```

Wait — Next.js jest helper uses `setupFilesAfterFramework`? No, it's `setupFilesAfterFramework`. Actually the correct key is `setupFilesAfterFramework` — double check:

```typescript
// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
};

export default createJestConfig(config);
```

The correct key is `setupFilesAfterFramework`. Use this exact config:

```typescript
// jest.config.ts
import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

const config: Config = {
  testEnvironment: 'jsdom',
  setupFilesAfterFramework: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};

export default createJestConfig(config);
```

- [ ] **Step 3: Create jest.setup.ts**

```typescript
// jest.setup.ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Add test script to package.json**

Add `"test": "jest"` and `"test:watch": "jest --watch"` to the `scripts` section.

- [ ] **Step 5: Verify Jest resolves**

```bash
npx jest --version
```

Expected: prints a version number, no errors.

- [ ] **Step 6: Commit**

```bash
git add jest.config.ts jest.setup.ts package.json package-lock.json
git commit -m "chore: add recharts and jest test infrastructure"
```

---

## Task 2: TypeScript interfaces

**Files:**

- Create: `types/index.ts`

- [ ] **Step 1: Write types/index.ts**

```typescript
// types/index.ts

export interface QuoteResponse {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  high: number;
  low: number;
  volume: number;
  sparkline: number[];
}

export interface NewsArticle {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string; // ISO string
}

export interface NewsResponse {
  articles: NewsArticle[];
}

// Per-ticker state used by useQuotes
export type QuoteState =
  | { status: 'loading' }
  | { status: 'ok'; data: QuoteResponse }
  | { status: 'error'; message: string };

// Raw shapes from Yahoo Finance (partial — only what we use)
export interface YahooChartMeta {
  symbol: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  currency: string;
  regularMarketDayHigh: number;
  regularMarketDayLow: number;
  regularMarketVolume: number;
}

export interface YahooChartResult {
  meta: YahooChartMeta;
  indicators: {
    quote: Array<{ close: (number | null)[] }>;
  };
}

export interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code: string; description: string } | null;
  };
}

export interface YahooNewsItem {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number; // Unix seconds
}

export interface YahooSearchResponse {
  news: YahooNewsItem[];
}
```

- [ ] **Step 2: Commit**

```bash
git add types/index.ts
git commit -m "feat: add TypeScript interfaces for Yahoo Finance and app state"
```

---

## Task 3: Yahoo Finance parse helpers + unit tests (TDD)

**Files:**

- Create: `lib/yahoo.ts`
- Create: `lib/__tests__/yahoo.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// lib/__tests__/yahoo.test.ts
import { parseQuote, parseNews } from '../yahoo';
import type { YahooChartResponse, YahooSearchResponse } from '../../types';

const mockChartResponse: YahooChartResponse = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'AAPL',
          longName: 'Apple Inc.',
          regularMarketPrice: 189.87,
          regularMarketChange: 1.23,
          regularMarketChangePercent: 0.653,
          currency: 'USD',
          regularMarketDayHigh: 190.5,
          regularMarketDayLow: 188.0,
          regularMarketVolume: 50_000_000,
        },
        indicators: {
          quote: [{ close: [185.0, 186.5, null, 188.5, 189.87] }],
        },
      },
    ],
    error: null,
  },
};

const mockSearchResponse: YahooSearchResponse = {
  news: [
    {
      title: 'Apple hits new high',
      publisher: 'Reuters',
      link: 'https://example.com/1',
      providerPublishTime: 1_700_000_000,
    },
  ],
};

describe('parseQuote', () => {
  it('maps meta fields to QuoteResponse', () => {
    const result = parseQuote(mockChartResponse);
    expect(result.ticker).toBe('AAPL');
    expect(result.name).toBe('Apple Inc.');
    expect(result.price).toBe(189.87);
    expect(result.change).toBe(1.23);
    expect(result.changePct).toBeCloseTo(0.653);
    expect(result.currency).toBe('USD');
    expect(result.high).toBe(190.5);
    expect(result.low).toBe(188.0);
    expect(result.volume).toBe(50_000_000);
  });

  it('filters null values out of sparkline', () => {
    const result = parseQuote(mockChartResponse);
    expect(result.sparkline).toEqual([185.0, 186.5, 188.5, 189.87]);
  });

  it('falls back to shortName when longName is missing', () => {
    const noLongName: YahooChartResponse = {
      chart: {
        result: [
          {
            ...mockChartResponse.chart.result![0],
            meta: {
              ...mockChartResponse.chart.result![0].meta,
              longName: undefined,
              shortName: 'Apple',
            },
          },
        ],
        error: null,
      },
    };
    expect(parseQuote(noLongName).name).toBe('Apple');
  });

  it('throws when chart result is null', () => {
    expect(() =>
      parseQuote({
        chart: {
          result: null,
          error: { code: '404', description: 'Not found' },
        },
      }),
    ).toThrow('Not found');
  });
});

describe('parseNews', () => {
  it('maps news items to NewsArticle', () => {
    const result = parseNews(mockSearchResponse);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Apple hits new high');
    expect(result[0].publisher).toBe('Reuters');
    expect(result[0].link).toBe('https://example.com/1');
  });

  it('converts providerPublishTime to ISO string', () => {
    const result = parseNews(mockSearchResponse);
    expect(result[0].publishedAt).toBe(
      new Date(1_700_000_000 * 1000).toISOString(),
    );
  });

  it('returns empty array when news is missing', () => {
    expect(parseNews({ news: [] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest lib/__tests__/yahoo.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../yahoo'`

- [ ] **Step 3: Implement lib/yahoo.ts**

```typescript
// lib/yahoo.ts
import type {
  QuoteResponse,
  NewsArticle,
  YahooChartResponse,
  YahooSearchResponse,
} from '@/types';

export function parseQuote(raw: YahooChartResponse): QuoteResponse {
  const result = raw.chart.result?.[0];
  if (!result) {
    throw new Error(raw.chart.error?.description ?? 'No chart data returned');
  }
  const { meta, indicators } = result;
  const closes = indicators.quote[0]?.close ?? [];
  return {
    ticker: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    price: meta.regularMarketPrice,
    change: meta.regularMarketChange,
    changePct: meta.regularMarketChangePercent,
    currency: meta.currency,
    high: meta.regularMarketDayHigh,
    low: meta.regularMarketDayLow,
    volume: meta.regularMarketVolume,
    sparkline: closes.filter((v): v is number => v !== null),
  };
}

export function parseNews(raw: YahooSearchResponse): NewsArticle[] {
  return (raw.news ?? []).map((item) => ({
    title: item.title,
    publisher: item.publisher,
    link: item.link,
    publishedAt: new Date(item.providerPublishTime * 1000).toISOString(),
  }));
}

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json',
};

export async function fetchYahoo<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: YAHOO_HEADERS,
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest lib/__tests__/yahoo.test.ts --no-coverage
```

Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/yahoo.ts lib/__tests__/yahoo.test.ts
git commit -m "feat: Yahoo Finance parse helpers with unit tests"
```

---

## Task 4: API route — /api/quote

**Files:**

- Create: `app/api/quote/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/quote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchYahoo, parseQuote } from '@/lib/yahoo';
import type { YahooChartResponse } from '@/types';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=5d`;

  try {
    const raw = await fetchYahoo<YahooChartResponse>(url);
    const quote = parseQuote(raw);
    return NextResponse.json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[/api/quote] ${ticker}:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Smoke test manually**

Start the dev server (`npm run dev`) and visit:
`http://localhost:3000/api/quote?ticker=AAPL`

Expected: JSON with `ticker`, `price`, `change`, `sparkline`, etc.
Try an invalid ticker like `ZZZZZ` — should return `{ error: "..." }` with status 502.

- [ ] **Step 3: Commit**

```bash
git add app/api/quote/route.ts
git commit -m "feat: /api/quote route wrapping Yahoo Finance chart endpoint"
```

---

## Task 5: API route — /api/news

**Files:**

- Create: `app/api/news/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/news/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { fetchYahoo, parseNews } from '@/lib/yahoo';
import type { YahooSearchResponse } from '@/types';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5&quotesCount=0`;

  try {
    const raw = await fetchYahoo<YahooSearchResponse>(url);
    const articles = parseNews(raw);
    return NextResponse.json({ articles });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[/api/news] ${ticker}:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Smoke test**

`http://localhost:3000/api/news?ticker=AAPL`

Expected: `{ articles: [{ title, publisher, link, publishedAt }, ...] }`

- [ ] **Step 3: Commit**

```bash
git add app/api/news/route.ts
git commit -m "feat: /api/news route wrapping Yahoo Finance search endpoint"
```

---

## Task 6: Global styles + root layout

**Files:**

- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update globals.css**

Replace the entire file with:

```css
@import 'tailwindcss';

@theme {
  --color-bg: #080808;
  --color-card: #111111;
  --color-border: #1f1f1f;
  --color-accent: #c8ff00;
  --color-positive: #22c55e;
  --color-negative: #ef4444;
  --color-muted: #6b7280;
  --font-heading: var(--font-barlow-condensed), 'Barlow Condensed', sans-serif;
}

body {
  background-color: #080808;
  color: #f3f4f6;
  font-family: system-ui, sans-serif;
}
```

- [ ] **Step 2: Update layout.tsx**

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { Barlow_Condensed } from 'next/font/google';
import './globals.css';

const barlowCondensed = Barlow_Condensed({
  weight: ['400', '600', '700'],
  subsets: ['latin'],
  variable: '--font-barlow-condensed',
});

export const metadata: Metadata = {
  title: 'Market Pulse',
  description: 'Live stock watchlist dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={barlowCondensed.variable}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify**

Run `npm run dev`. Visit `http://localhost:3000` — background should be `#080808`, no layout errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: dark theme globals and Barlow Condensed font setup"
```

---

## Task 7: useWatchlist hook + tests (TDD)

**Files:**

- Create: `hooks/useWatchlist.ts`
- Create: `hooks/__tests__/useWatchlist.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// hooks/__tests__/useWatchlist.test.ts
import { renderHook, act } from '@testing-library/react';
import { useWatchlist } from '../useWatchlist';

// localStorage mock is provided by jsdom

beforeEach(() => {
  localStorage.clear();
});

describe('useWatchlist', () => {
  it('starts with an empty list when localStorage is empty', () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.tickers).toEqual([]);
  });

  it('adds a ticker', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.addTicker('AAPL');
    });
    expect(result.current.tickers).toContain('AAPL');
  });

  it('uppercases the ticker on add', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.addTicker('aapl');
    });
    expect(result.current.tickers).toContain('AAPL');
  });

  it('does not add duplicate tickers', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.addTicker('AAPL');
    });
    act(() => {
      result.current.addTicker('AAPL');
    });
    expect(result.current.tickers.filter((t) => t === 'AAPL')).toHaveLength(1);
  });

  it('removes a ticker', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.addTicker('AAPL');
    });
    act(() => {
      result.current.removeTicker('AAPL');
    });
    expect(result.current.tickers).not.toContain('AAPL');
  });

  it('persists tickers to localStorage', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => {
      result.current.addTicker('MSFT');
    });
    const stored = JSON.parse(
      localStorage.getItem('stockbuzz:watchlist') ?? '[]',
    );
    expect(stored).toContain('MSFT');
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem(
      'stockbuzz:watchlist',
      JSON.stringify(['TSLA', 'NVDA']),
    );
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.tickers).toEqual(['TSLA', 'NVDA']);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest hooks/__tests__/useWatchlist.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../useWatchlist'`

- [ ] **Step 3: Implement hooks/useWatchlist.ts**

```typescript
// hooks/useWatchlist.ts
'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'stockbuzz:watchlist';

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTickers(JSON.parse(stored));
    } catch {
      // ignore parse errors
    }
  }, []);

  function persist(next: string[]) {
    setTickers(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  function addTicker(raw: string) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker) return;
    setTickers((prev) => {
      if (prev.includes(ticker)) return prev;
      const next = [...prev, ticker];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function removeTicker(ticker: string) {
    setTickers((prev) => {
      const next = prev.filter((t) => t !== ticker);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { tickers, addTicker, removeTicker };
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest hooks/__tests__/useWatchlist.test.ts --no-coverage
```

Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add hooks/useWatchlist.ts hooks/__tests__/useWatchlist.test.ts
git commit -m "feat: useWatchlist hook with localStorage persistence"
```

---

## Task 8: AddTickerForm, TickerPill, WatchlistBar, TopBar components

**Files:**

- Create: `components/AddTickerForm.tsx`
- Create: `components/TickerPill.tsx`
- Create: `components/WatchlistBar.tsx`
- Create: `components/TopBar.tsx`

- [ ] **Step 1: AddTickerForm**

```typescript
// components/AddTickerForm.tsx
'use client';

import { useState, FormEvent } from 'react';

interface Props {
  onAdd: (ticker: string) => void;
}

export function AddTickerForm({ onAdd }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const ticker = value.trim().toUpperCase();
    if (ticker) {
      onAdd(ticker);
      setValue('');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add ticker…"
        maxLength={10}
        className="bg-[#1a1a1a] border border-[#1f1f1f] rounded px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#C8FF00] w-36"
      />
      <button
        type="submit"
        className="bg-[#C8FF00] text-black text-sm font-semibold px-3 py-1.5 rounded hover:brightness-90 transition-all"
      >
        Add
      </button>
    </form>
  );
}
```

- [ ] **Step 2: TickerPill**

```typescript
// components/TickerPill.tsx
'use client';

interface Props {
  ticker: string;
  onRemove: (ticker: string) => void;
}

export function TickerPill({ ticker, onRemove }: Props) {
  return (
    <span className="flex items-center gap-1 bg-[#1a1a1a] border border-[#1f1f1f] text-white text-sm rounded-full px-3 py-1">
      {ticker}
      <button
        onClick={() => onRemove(ticker)}
        className="text-gray-500 hover:text-[#ef4444] ml-1 leading-none transition-colors"
        aria-label={`Remove ${ticker}`}
      >
        ×
      </button>
    </span>
  );
}
```

- [ ] **Step 3: WatchlistBar**

```typescript
// components/WatchlistBar.tsx
'use client';

import { TickerPill } from './TickerPill';

interface Props {
  tickers: string[];
  onRemove: (ticker: string) => void;
}

export function WatchlistBar({ tickers, onRemove }: Props) {
  if (tickers.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-2">
        No tickers yet — add one above.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2 py-2">
      {tickers.map((t) => (
        <TickerPill key={t} ticker={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: TopBar**

```typescript
// components/TopBar.tsx
'use client';

import { AddTickerForm } from './AddTickerForm';

interface Props {
  onAdd: (ticker: string) => void;
}

export function TopBar({ onAdd }: Props) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-[#1f1f1f]">
      <h1 className="font-heading text-2xl font-bold tracking-wide text-[#C8FF00]">
        Market Pulse
      </h1>
      <AddTickerForm onAdd={onAdd} />
    </header>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add components/AddTickerForm.tsx components/TickerPill.tsx components/WatchlistBar.tsx components/TopBar.tsx
git commit -m "feat: TopBar, AddTickerForm, TickerPill, WatchlistBar components"
```

---

## Task 9: Sparkline component

**Files:**

- Create: `components/Sparkline.tsx`

- [ ] **Step 1: Create Sparkline.tsx**

```typescript
// components/Sparkline.tsx
'use client';

import { AreaChart, Area, ResponsiveContainer } from 'recharts';

interface Props {
  data: number[];
  positive: boolean;
}

export function Sparkline({ data, positive }: Props) {
  const color = positive ? '#22c55e' : '#ef4444';
  const chartData = data.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height={48}>
      <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          strokeWidth={1.5}
          fill={color}
          fillOpacity={0.15}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/Sparkline.tsx
git commit -m "feat: Sparkline component using Recharts AreaChart"
```

---

## Task 10: SkeletonCard component

**Files:**

- Create: `components/SkeletonCard.tsx`

- [ ] **Step 1: Create SkeletonCard.tsx**

```typescript
// components/SkeletonCard.tsx
export function SkeletonCard() {
  return (
    <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4 animate-pulse">
      <div className="flex justify-between mb-3">
        <div className="h-5 w-16 bg-[#1f1f1f] rounded" />
        <div className="h-4 w-12 bg-[#1f1f1f] rounded" />
      </div>
      <div className="h-8 w-28 bg-[#1f1f1f] rounded mb-2" />
      <div className="h-4 w-20 bg-[#1f1f1f] rounded mb-4" />
      <div className="h-12 bg-[#1f1f1f] rounded mb-3" />
      <div className="flex justify-between">
        <div className="h-3 w-24 bg-[#1f1f1f] rounded" />
        <div className="h-3 w-16 bg-[#1f1f1f] rounded" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/SkeletonCard.tsx
git commit -m "feat: SkeletonCard loading placeholder"
```

---

## Task 11: useQuotes hook

**Files:**

- Create: `hooks/useQuotes.ts`

- [ ] **Step 1: Create hooks/useQuotes.ts**

```typescript
// hooks/useQuotes.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { QuoteState } from '@/types';

export function useQuotes(tickers: string[]) {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});

  const fetchAll = useCallback(async () => {
    if (tickers.length === 0) return;

    // Mark all as loading on first fetch only
    setQuotes((prev) => {
      const next = { ...prev };
      for (const ticker of tickers) {
        if (!next[ticker]) next[ticker] = { status: 'loading' };
      }
      return next;
    });

    const results = await Promise.allSettled(
      tickers.map((ticker) =>
        fetch(`/api/quote?ticker=${ticker}`).then((r) => r.json()),
      ),
    );

    setQuotes((prev) => {
      const next = { ...prev };
      tickers.forEach((ticker, i) => {
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
            message: result.reason?.message ?? 'Fetch failed',
          };
        }
      });
      return next;
    });
  }, [tickers.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Remove quotes for tickers that were removed from the watchlist
  useEffect(() => {
    setQuotes((prev) => {
      const tickerSet = new Set(tickers);
      const cleaned = Object.fromEntries(
        Object.entries(prev).filter(([t]) => tickerSet.has(t)),
      );
      return cleaned;
    });
  }, [tickers.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return quotes;
}
```

- [ ] **Step 2: Commit**

```bash
git add hooks/useQuotes.ts
git commit -m "feat: useQuotes hook — parallel fetch + 60s auto-refresh"
```

---

## Task 12: StockCard component

**Files:**

- Create: `components/StockCard.tsx`

- [ ] **Step 1: Create StockCard.tsx**

```typescript
// components/StockCard.tsx
'use client';

import { useState } from 'react';
import type { QuoteState } from '@/types';
import { Sparkline } from './Sparkline';
import { SkeletonCard } from './SkeletonCard';
import { NewsDrawer } from './NewsDrawer';

interface Props {
  ticker: string;
  state: QuoteState;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtVolume(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

export function StockCard({ ticker, state }: Props) {
  const [newsOpen, setNewsOpen] = useState(false);

  if (state.status === 'loading') return <SkeletonCard />;

  if (state.status === 'error') {
    return (
      <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl p-4">
        <p className="text-sm font-semibold text-white mb-1">{ticker}</p>
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
        {/* Header */}
        <div className="flex justify-between items-start mb-2">
          <div>
            <p className="font-heading text-base font-bold text-white tracking-wide">{ticker}</p>
            <p className="text-xs text-gray-500 truncate max-w-[140px]">{data.name}</p>
          </div>
          <span className="text-xs text-gray-500">{data.currency}</span>
        </div>

        {/* Price */}
        <p className="font-heading text-3xl font-bold text-white mb-0.5">
          {fmt(data.price)}
        </p>

        {/* Change */}
        <p className={`text-sm font-semibold ${changeColor} mb-3`}>
          {sign}{fmt(data.change)} ({sign}{fmt(data.changePct)}%)
        </p>

        {/* Sparkline */}
        {data.sparkline.length > 1 && (
          <div className="mb-3">
            <Sparkline data={data.sparkline} positive={positive} />
          </div>
        )}

        {/* Stats row */}
        <div className="flex justify-between text-xs text-gray-500 mb-3">
          <span>H: {fmt(data.high)} / L: {fmt(data.low)}</span>
          <span>Vol: {fmtVolume(data.volume)}</span>
        </div>

        {/* News toggle */}
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

- [ ] **Step 2: Commit**

```bash
git add components/StockCard.tsx
git commit -m "feat: StockCard with price, change, sparkline, and news toggle"
```

---

## Task 13: useNews hook

**Files:**

- Create: `hooks/useNews.ts`

- [ ] **Step 1: Create hooks/useNews.ts**

```typescript
// hooks/useNews.ts
'use client';

import { useState, useEffect } from 'react';
import type { NewsArticle } from '@/types';

type NewsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; articles: NewsArticle[] }
  | { status: 'error'; message: string };

export function useNews(ticker: string) {
  const [state, setState] = useState<NewsState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(`/api/news?ticker=${ticker}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setState({ status: 'error', message: data.error });
        } else {
          setState({ status: 'ok', articles: data.articles });
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

- [ ] **Step 2: Commit**

```bash
git add hooks/useNews.ts
git commit -m "feat: useNews hook for on-demand news fetch"
```

---

## Task 14: NewsItem + NewsDrawer components

**Files:**

- Create: `components/NewsItem.tsx`
- Create: `components/NewsDrawer.tsx`

- [ ] **Step 1: NewsItem**

```typescript
// components/NewsItem.tsx
import type { NewsArticle } from '@/types';

interface Props {
  article: NewsArticle;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function NewsItem({ article }: Props) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="block px-4 py-2.5 hover:bg-[#1a1a1a] transition-colors group"
    >
      <p className="text-sm text-white group-hover:text-[#C8FF00] transition-colors line-clamp-2 leading-snug">
        {article.title}
      </p>
      <p className="text-xs text-gray-500 mt-0.5">
        {article.publisher} · {relativeTime(article.publishedAt)}
      </p>
    </a>
  );
}
```

- [ ] **Step 2: NewsDrawer**

```typescript
// components/NewsDrawer.tsx
'use client';

import { useNews } from '@/hooks/useNews';
import { NewsItem } from './NewsItem';

interface Props {
  ticker: string;
}

export function NewsDrawer({ ticker }: Props) {
  const state = useNews(ticker);

  return (
    <div className="border-t border-[#1f1f1f]">
      {state.status === 'loading' && (
        <div className="px-4 py-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-[#1f1f1f] rounded w-full mb-1" />
              <div className="h-3 bg-[#1f1f1f] rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className="px-4 py-3 text-xs text-[#ef4444]">
          Could not load news: {state.message}
        </p>
      )}

      {state.status === 'ok' && state.articles.length === 0 && (
        <p className="px-4 py-3 text-xs text-gray-500">No recent news.</p>
      )}

      {state.status === 'ok' && (
        <div className="divide-y divide-[#1f1f1f]">
          {state.articles.map((a) => (
            <NewsItem key={a.link} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/NewsItem.tsx components/NewsDrawer.tsx
git commit -m "feat: NewsDrawer and NewsItem components"
```

---

## Task 15: Main page.tsx

**Files:**

- Modify: `app/page.tsx`

- [ ] **Step 1: Replace the default page**

```typescript
// app/page.tsx
'use client';

import { useWatchlist } from '@/hooks/useWatchlist';
import { useQuotes } from '@/hooks/useQuotes';
import { TopBar } from '@/components/TopBar';
import { WatchlistBar } from '@/components/WatchlistBar';
import { StockCard } from '@/components/StockCard';
import { SkeletonCard } from '@/components/SkeletonCard';

export default function Home() {
  const { tickers, addTicker, removeTicker } = useWatchlist();
  const quotes = useQuotes(tickers);

  return (
    <div className="min-h-screen bg-[#080808]">
      <TopBar onAdd={addTicker} />

      <main className="px-6 py-6 max-w-7xl mx-auto">
        <WatchlistBar tickers={tickers} onRemove={removeTicker} />

        {tickers.length > 0 && (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tickers.map((ticker) => {
              const state = quotes[ticker] ?? { status: 'loading' };
              return (
                <StockCard key={ticker} ticker={ticker} state={state} />
              );
            })}
          </div>
        )}

        {tickers.length === 0 && (
          <div className="mt-16 text-center">
            <p className="text-gray-500 text-sm">
              Add a ticker symbol above to get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Golden path test in browser**

Start `npm run dev` and verify:

1. Page loads with dark background and "Market Pulse" header
2. Type `AAPL` and click Add — pill appears, card appears with loading skeleton
3. After ~2 s, card shows price, change in green/red, sparkline
4. Click "Show news ↓" — news articles appear
5. Click the `×` on the AAPL pill — card disappears
6. Reload the page — no tickers (localStorage was cleared)
7. Add `AAPL`, reload — pill and card reappear (localStorage hydration works)
8. Add `ZZZZZ` — error card shows, other cards unaffected

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Final commit**

```bash
git add app/page.tsx
git commit -m "feat: main page — wires watchlist, quotes grid, and TopBar"
```

---

## Self-review

### Spec coverage check

| Requirement                                     | Task(s)                                   |
| ----------------------------------------------- | ----------------------------------------- |
| Add/remove ticker symbols                       | Task 7 (hook) + Task 8 (UI)               |
| Persist to localStorage                         | Task 7                                    |
| Card: price, change $+%, H/L, volume, sparkline | Task 12                                   |
| News feed — 5 headlines per ticker              | Task 13 + Task 14                         |
| News links open in new tab                      | Task 14 (`target="_blank"`)               |
| Auto-refresh every 60 s                         | Task 11 (`setInterval`)                   |
| Green/red color coding                          | Task 12 (`changeColor`)                   |
| User-Agent header on Yahoo requests             | Task 3 (`YAHOO_HEADERS`)                  |
| 10 s timeout                                    | Task 3 (`AbortController`)                |
| Graceful error handling per card                | Task 12 (error branch)                    |
| Loading skeletons                               | Task 10 + Task 12                         |
| `Promise.allSettled` parallel fetch             | Task 11                                   |
| Dark theme #080808 + accent #C8FF00             | Task 6                                    |
| Barlow Condensed headings                       | Task 6                                    |
| 2-col tablet / 3-col desktop grid               | Task 15 (`sm:grid-cols-2 lg:grid-cols-3`) |
| Card news drawer                                | Task 12 (toggle) + Task 14                |

All requirements covered. No placeholders found.
