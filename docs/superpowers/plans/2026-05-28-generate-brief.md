# Generate Brief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-click "Generate Brief" button to the Owned tab that opens a new browser tab showing an AI-generated portfolio brief — per-stock interpretation, cross-portfolio synthesis, and Buy/Hold/Watch signals — powered by OpenAI gpt-4o-mini.

**Architecture:** A "Generate Brief" button in the tab bar opens `/brief?tickers=NVDA,MSFT` in a new tab. The brief page POSTs to `/api/brief` which fetches Yahoo Finance data (quotes, news, fundamentals) for all tickers server-side using the existing `lib/yahoo.ts` helpers, then runs three sequential OpenAI call stages and returns a `BriefResult` JSON. The brief page shows a cosmetic loading state then renders the full result.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, `openai` npm SDK, `lib/yahoo.ts` (existing), Tailwind CSS v4

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `types/index.ts` | Modify | Add `BriefRequest`, `StockSummary`, `StockSignal`, `BriefResult` |
| `app/api/brief/route.ts` | Create | POST handler: fetch Yahoo data + run 3-stage AI pipeline |
| `app/brief/page.tsx` | Create | Standalone new-tab page: loading state + brief renderer |
| `components/TabBar.tsx` | Modify | Add optional `action?: ReactNode` slot rendered right-aligned |
| `app/page.tsx` | Modify | Pass "Generate Brief" button as `action` to `TabBar` |

---

## Task 1: Install `openai` and add types

**Files:**
- Modify: `package.json` (via npm)
- Modify: `types/index.ts`

- [ ] **Step 1: Install the OpenAI SDK**

```bash
npm install openai
```

Expected: `openai` appears in `package.json` dependencies, no errors.

- [ ] **Step 2: Add new interfaces to `types/index.ts`**

Append these four interfaces at the end of `types/index.ts` (after the existing `YahooSearchResponse` interface):

```ts
export interface BriefRequest {
  tickers: string[];
}

export interface StockSummary {
  ticker: string;
  summary: string;
}

export interface StockSignal {
  ticker: string;
  signal: 'Buy' | 'Hold' | 'Watch';
  reason: string;
}

export interface BriefResult {
  generatedAt: string;
  marketMood: string;
  synthesis: string;
  summaries: StockSummary[];
  signals: StockSignal[];
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add types/index.ts package.json package-lock.json
git commit -m "feat: install openai SDK and add BriefRequest/BriefResult types"
```

---

## Task 2: Create `/api/brief` route

**Files:**
- Create: `app/api/brief/route.ts`

This route fetches Yahoo Finance data for all tickers in parallel (using helpers from `lib/yahoo.ts`), then runs three OpenAI call stages in sequence. The OpenAI client is instantiated once at module level.

- [ ] **Step 1: Create `app/api/brief/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  fetchYahoo,
  fetchYahooWithCrumb,
  parseQuote,
  parseNews,
  parseFundamentals,
} from '@/lib/yahoo';
import type {
  BriefRequest,
  BriefResult,
  StockSummary,
  StockSignal,
  QuoteResponse,
  NewsArticle,
  FundamentalsData,
  YahooChartResponse,
  YahooSearchResponse,
  YahooSummaryResponse,
} from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface StockInput {
  ticker: string;
  quote: QuoteResponse;
  news: NewsArticle[] | null;
  fundamentals: FundamentalsData | null;
}

function buildStockPrompt({ ticker, quote, news, fundamentals }: StockInput): string {
  const sign = quote.changePct >= 0 ? '+' : '';
  let prompt =
    `Stock: ${quote.name} (${ticker})\n` +
    `5-day change: ${sign}${quote.changePct.toFixed(2)}%\n` +
    `Price: $${quote.price.toFixed(2)} | High: $${quote.high.toFixed(2)} | Low: $${quote.low.toFixed(2)}\n` +
    `Volume: ${quote.volume.toLocaleString()}`;

  if (fundamentals) {
    const parts: string[] = [];
    if (fundamentals.forwardPE != null) parts.push(`Forward P/E: ${fundamentals.forwardPE.toFixed(1)}`);
    if (fundamentals.beta != null) parts.push(`Beta: ${fundamentals.beta.toFixed(2)}`);
    if (fundamentals.recommendation) parts.push(`Analyst consensus: ${fundamentals.recommendation}`);
    if (fundamentals.targetMean != null) parts.push(`Mean target: $${fundamentals.targetMean.toFixed(2)}`);
    if (parts.length > 0) prompt += `\n${parts.join(' | ')}`;
  }

  if (news && news.length > 0) {
    const headlines = news.slice(0, 5).map((a) => `- ${a.title}`).join('\n');
    prompt += `\nRecent headlines:\n${headlines}`;
  }

  return prompt;
}

export async function POST(req: NextRequest) {
  let body: BriefRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { tickers } = body;
  if (!tickers || tickers.length === 0) {
    return NextResponse.json({ error: 'tickers are required' }, { status: 400 });
  }

  // Stage 1 — fetch Yahoo data for all tickers in parallel
  const fetchResults = await Promise.allSettled(
    tickers.map(async (ticker): Promise<StockInput> => {
      const symbol = encodeURIComponent(ticker.toUpperCase());
      const [quoteResult, newsResult, fundamentalsResult] = await Promise.allSettled([
        fetchYahoo<YahooChartResponse>(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`
        ).then(parseQuote),
        fetchYahoo<YahooSearchResponse>(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}&newsCount=5&quotesCount=0`
        ).then(parseNews),
        fetchYahooWithCrumb<YahooSummaryResponse>(
          `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData%2CdefaultKeyStatistics%2CearningsHistory`
        ).then(parseFundamentals),
      ]);

      if (quoteResult.status === 'rejected') {
        throw new Error(`Quote fetch failed for ${ticker}: ${quoteResult.reason?.message ?? 'unknown'}`);
      }

      return {
        ticker,
        quote: quoteResult.value,
        news: newsResult.status === 'fulfilled' ? newsResult.value : null,
        fundamentals: fundamentalsResult.status === 'fulfilled' ? fundamentalsResult.value : null,
      };
    })
  );

  const stocks: StockInput[] = fetchResults
    .filter((r): r is PromiseFulfilledResult<StockInput> => r.status === 'fulfilled')
    .map((r) => r.value);

  if (stocks.length === 0) {
    return NextResponse.json({ error: 'Could not fetch data for any ticker' }, { status: 502 });
  }

  try {
    // Stage 2 — Call 1: per-stock interpreter (parallel)
    const summaries: StockSummary[] = await Promise.all(
      stocks.map(async (stock) => {
        const res = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a concise stock analyst. Given data about a single stock, write 2-3 sentences interpreting what the price action and news mean together — not restating them. Focus on the "why" behind the move.',
            },
            { role: 'user', content: buildStockPrompt(stock) },
          ],
          max_tokens: 150,
        });
        return {
          ticker: stock.ticker,
          summary: res.choices[0]?.message?.content?.trim() ?? '',
        };
      })
    );

    // Stage 3 — Call 2: portfolio synthesiser (single call, awaits all Call 1s)
    const summaryText = summaries.map((s) => `${s.ticker}: ${s.summary}`).join('\n\n');
    const synthesisRes = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a portfolio analyst. Given per-stock summaries, identify cross-portfolio patterns. Return valid JSON with two string fields: "marketMood" (one sentence macro read, e.g. "Risk-off rotation out of tech this week") and "synthesis" (2-3 sentences of cross-portfolio insight).',
        },
        { role: 'user', content: summaryText },
      ],
      max_tokens: 250,
      response_format: { type: 'json_object' },
    });
    const { marketMood, synthesis } = JSON.parse(
      synthesisRes.choices[0]?.message?.content ?? '{}'
    ) as { marketMood: string; synthesis: string };

    // Stage 4 — Call 3: buy/hold/watch signals (parallel, uses Call 1 + Call 2 context)
    const signals: StockSignal[] = await Promise.all(
      summaries.map(async ({ ticker, summary }) => {
        const res = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a stock analyst generating actionable signals. Return valid JSON with "signal" (exactly one of: "Buy", "Hold", "Watch") and "reason" (one sentence, max 10 words).',
            },
            {
              role: 'user',
              content: `Portfolio context: ${marketMood} ${synthesis}\n\nStock: ${ticker}\nAnalysis: ${summary}`,
            },
          ],
          max_tokens: 80,
          response_format: { type: 'json_object' },
        });
        const { signal, reason } = JSON.parse(
          res.choices[0]?.message?.content ?? '{}'
        ) as { signal: string; reason: string };
        return {
          ticker,
          signal: (['Buy', 'Hold', 'Watch'].includes(signal) ? signal : 'Hold') as StockSignal['signal'],
          reason: reason ?? '',
        };
      })
    );

    const result: BriefResult = {
      generatedAt: new Date().toISOString(),
      marketMood: marketMood ?? '',
      synthesis: synthesis ?? '',
      summaries,
      signals,
    };

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/brief] error:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/brief/route.ts
git commit -m "feat: add /api/brief route with Yahoo data fetch and 3-stage OpenAI pipeline"
```

---

## Task 3: Create `/brief` page

**Files:**
- Create: `app/brief/page.tsx`

Client component. Reads tickers from URL search params, shows a cosmetic 4-step loading state, POSTs to `/api/brief`, then renders the result. `useSearchParams()` requires wrapping in `<Suspense>` (Next.js App Router requirement).

- [ ] **Step 1: Create `app/brief/page.tsx`**

```tsx
'use client';

import { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import type { BriefResult } from '@/types';

const STEPS = [
  'Fetching stock data',
  'Analysing individual stocks',
  'Synthesising portfolio',
  'Generating signals',
] as const;

const STEP_DELAYS_MS = [0, 2000, 5000, 9000] as const;

function signalColour(signal: string) {
  if (signal === 'Buy') return 'text-[#22c55e]';
  if (signal === 'Watch') return 'text-[#ef4444]';
  return 'text-[#facc15]';
}

function BriefContent() {
  const params = useSearchParams();
  const tickers = (params.get('tickers') ?? '').split(',').filter(Boolean);

  const [activeStep, setActiveStep] = useState(0);
  const [result, setResult] = useState<BriefResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRefs = useRef<ReturnType<typeof setTimeout>[]>([]);

  const generate = async () => {
    timerRefs.current.forEach(clearTimeout);
    timerRefs.current = [];
    setResult(null);
    setError(null);
    setActiveStep(0);

    STEP_DELAYS_MS.forEach((delay, i) => {
      const id = setTimeout(() => setActiveStep(i), delay);
      timerRefs.current.push(id);
    });

    try {
      const res = await fetch('/api/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError((data as { error: string }).error ?? 'Unknown error');
      } else {
        setResult(data as BriefResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    }
  };

  useEffect(() => {
    if (tickers.length > 0) {
      generate();
    } else {
      setError('No tickers provided');
    }
    return () => timerRefs.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#ef4444] text-sm mb-4">Could not generate brief: {error}</p>
          <button
            onClick={generate}
            className="bg-[#1a2a00] border border-[#C8FF00]/30 text-[#C8FF00] text-xs font-bold px-4 py-2 rounded hover:bg-[#2a4f14] transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="w-64">
          <p className="text-[#C8FF00] font-bold text-sm text-center mb-3">
            ⚡ Generating brief...
          </p>
          <div className="h-[3px] bg-[#1f1f1f] rounded overflow-hidden mb-4">
            <div className="h-full w-full bg-[#C8FF00] animate-pulse" />
          </div>
          <div className="flex flex-col gap-2">
            {STEPS.map((label, i) => {
              const done = i < activeStep;
              const active = i === activeStep;
              return (
                <p
                  key={label}
                  className={`text-xs ${done ? 'text-[#22c55e]' : active ? 'text-[#C8FF00]' : 'text-gray-600'}`}
                >
                  {done ? '✓' : active ? '⟳' : '○'} {label}
                </p>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const date = new Date(result.generatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-[#080808]">
      <div className="border-b border-[#1f1f1f] px-6 py-5">
        <h1 className="font-heading text-2xl font-bold text-white">Portfolio Brief</h1>
        <p className="text-gray-500 text-xs mt-1">
          {result.signals.length} owned {result.signals.length === 1 ? 'stock' : 'stocks'} · {date}
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-6">
        <div className="bg-[#111519] border border-[#C8FF00]/10 border-l-[3px] border-l-[#C8FF00] rounded-lg px-4 py-4">
          <p className="text-[9px] text-gray-600 uppercase tracking-widest mb-2">Market Mood</p>
          <p className="text-white text-sm font-semibold mb-2">{result.marketMood}</p>
          <p className="text-gray-400 text-xs leading-relaxed">{result.synthesis}</p>
        </div>

        <div>
          <h2 className="text-white font-semibold text-sm mb-3">Signals</h2>
          <div className="bg-[#111] border border-[#1f1f1f] rounded-lg overflow-hidden">
            <div className="grid grid-cols-[80px_60px_1fr] px-4 py-2 border-b border-[#1f1f1f] text-[9px] text-gray-600 uppercase tracking-widest">
              <span>Stock</span>
              <span>Signal</span>
              <span>Reason</span>
            </div>
            {result.signals.map((s, i) => (
              <div
                key={s.ticker}
                className={`grid grid-cols-[80px_60px_1fr] px-4 py-3 items-center${
                  i < result.signals.length - 1 ? ' border-b border-[#1f1f1f]' : ''
                }`}
              >
                <span className="text-white text-xs font-bold">{s.ticker}</span>
                <span className={`text-xs font-semibold ${signalColour(s.signal)}`}>{s.signal}</span>
                <span className="text-gray-500 text-xs">{s.reason}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-white font-semibold text-sm mb-3">Stock Analysis</h2>
          <div className="flex flex-col gap-3">
            {result.summaries.map((s) => (
              <div key={s.ticker} className="bg-[#111] border border-[#1f1f1f] rounded-lg px-4 py-3">
                <p className="text-white text-xs font-bold mb-1">{s.ticker}</p>
                <p className="text-gray-400 text-xs leading-relaxed">{s.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BriefPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#080808]" />}>
      <BriefContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/brief/page.tsx
git commit -m "feat: add /brief page with loading state and brief result renderer"
```

---

## Task 4: Add "Generate Brief" button

**Files:**
- Modify: `components/TabBar.tsx`
- Modify: `app/page.tsx`

Add an optional `action` slot to `TabBar` so the parent can inject a right-aligned element without the tab bar needing to know what it is. Pass the "Generate Brief" button from `app/page.tsx`.

- [ ] **Step 1: Update `components/TabBar.tsx`**

Add `import type { ReactNode } from 'react';` at the top and an `action?: ReactNode` prop. Render it right-aligned inside the flex container:

```tsx
import type { ReactNode } from 'react';

type Tab = 'all' | 'owned' | 'watching';

interface Props {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  counts: { all: number; owned: number; watching: number };
  action?: ReactNode;
}

export function TabBar({ activeTab, onTabChange, counts, action }: Props) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'all', label: `All (${counts.all})` },
    { id: 'owned', label: `Owned (${counts.owned})` },
    { id: 'watching', label: `Watching (${counts.watching})` },
  ];

  return (
    <div className='border-b border-[#1f1f1f]'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 flex items-center'>
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
        {action && <div className='ml-auto'>{action}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/page.tsx`**

Replace the existing `<TabBar ... />` JSX with a version that passes the button as `action`. The button is only shown when `activeTab === 'owned'` and there is at least one owned stock:

```tsx
<TabBar
  activeTab={activeTab}
  onTabChange={setActiveTab}
  counts={counts}
  action={
    activeTab === 'owned' && counts.owned > 0 ? (
      <button
        onClick={() => {
          const tickers = entries
            .filter((e) => e.tag === 'owned')
            .map((e) => e.ticker)
            .join(',');
          window.open(`/brief?tickers=${tickers}`, '_blank');
        }}
        className="bg-[#1a2a00] border border-[#C8FF00]/30 text-[#C8FF00] text-[10px] font-bold px-2 py-1 rounded hover:bg-[#2a4f14] transition-colors"
      >
        ⚡ Generate Brief
      </button>
    ) : null
  }
/>
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/TabBar.tsx app/page.tsx
git commit -m "feat: add Generate Brief button to Owned tab bar"
```

---

## Task 5: Manual end-to-end verification

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: server starts on http://localhost:3000, no compilation errors in terminal.

- [ ] **Step 2: Verify button visibility**

Open http://localhost:3000. Add a ticker and tag it as Owned. Switch to the Owned tab. Confirm:
- "⚡ Generate Brief" button appears right-aligned in the tab bar
- Button is absent on the All and Watching tabs
- Button is absent on the Owned tab when there are zero owned stocks

- [ ] **Step 3: Verify loading state**

Click "⚡ Generate Brief". Confirm:
- A new browser tab opens at `/brief?tickers=<ticker>`
- The loading state shows "⚡ Generating brief..." with the animated progress bar
- The four step labels animate through active → done over ~9 seconds

- [ ] **Step 4: Verify brief result**

Wait for the API call to complete (~10–20 seconds for 1–3 stocks). Confirm:
- The page transitions from loading to the result without a full reload
- **Market Mood** banner shows a one-sentence read with neon left border
- **Signals** table shows each owned ticker with a coloured signal (green/yellow/red) and a reason
- **Stock Analysis** section shows per-stock prose for each ticker

- [ ] **Step 5: Verify error state**

Open `/brief?tickers=INVALIDXYZ` directly in the browser. Confirm:
- The page shows "Could not generate brief: ..." in red
- "Try again" button is present and re-triggers the fetch on click

- [ ] **Step 6: Verify no owned stocks edge case**

Remove all owned stocks (tag them all as Watching). Switch to the Owned tab. Confirm the "⚡ Generate Brief" button is not visible.
