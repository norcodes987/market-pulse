# Find Stocks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/find` page with a 3-step AI agentic workflow: theme → 25 tickers → conviction scores → deep thesis for top 3.

**Architecture:** Three sequential `POST` API routes (`/api/find-stocks/tickers`, `/api/find-stocks/scores`, `/api/find-stocks/thesis`) are orchestrated by a `useFindStocks` hook. The scores route fetches live Yahoo Finance data (52-week high, PE ratios) for all 25 tickers in parallel before calling OpenAI. All components are pure presentational; the page owns theme state and delegates workflow state to the hook.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Tailwind CSS v4, OpenAI SDK (already installed), Yahoo Finance (existing `fetchYahoo` / `fetchYahooWithCrumb` helpers in `lib/yahoo.ts`)

---

## File Map

| File                                        | Action | Responsibility                                                                                                               |
| ------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `types/index.ts`                            | Modify | Add `TickerCandidate`, `TickerMarketData`, `ConvictionScore`, `ThesisCard`, `FindStocksYahooChart`, `FindStocksYahooSummary` |
| `lib/yahoo.ts`                              | Modify | Add `parseMarketData` pure function and `fetchTickerMarketData` helper                                                       |
| `lib/__tests__/yahoo.test.ts`               | Modify | Add `parseMarketData` unit tests                                                                                             |
| `app/api/find-stocks/tickers/route.ts`      | Create | POST — calls OpenAI gpt-4o-mini, returns 25 `TickerCandidate[]`                                                              |
| `app/api/find-stocks/scores/route.ts`       | Create | POST — fetches Yahoo market data for 25 tickers, calls OpenAI gpt-4o, returns `ConvictionScore[]`                            |
| `app/api/find-stocks/thesis/route.ts`       | Create | POST — calls OpenAI gpt-4o with top 3 tickers, returns `ThesisCard[]`                                                        |
| `hooks/useFindStocks.ts`                    | Create | Orchestrates 3 sequential API calls; exposes typed phase state, `run`, `reset`                                               |
| `hooks/__tests__/useFindStocks.test.ts`     | Create | Hook phase-transition tests using mocked `fetch`                                                                             |
| `components/FindStocks/ThemeSelector.tsx`   | Create | 8 preset pills + controlled text input + submit button                                                                       |
| `components/FindStocks/TickerList.tsx`      | Create | Numbered table of 25 candidates                                                                                              |
| `components/FindStocks/ConvictionTable.tsx` | Create | Ranked table with tier badges                                                                                                |
| `components/FindStocks/ThesisCards.tsx`     | Create | 3 deep thesis cards                                                                                                          |
| `app/find/page.tsx`                         | Create | Client page; owns theme state, renders hook-driven steps                                                                     |
| `components/TopBar.tsx`                     | Modify | Add "Find Stocks" link between logo and AddTickerForm                                                                        |

---

## Task 1: Add Types

**Files:**

- Modify: `types/index.ts`

- [ ] **Step 1: Append the new interfaces to `types/index.ts`**

Add at the end of the file (after the last existing interface):

```typescript
export interface FindStocksYahooChart {
  chart: {
    result: Array<{
      meta: YahooChartMeta;
      indicators: {
        quote: Array<{
          high: (number | null)[];
        }>;
      };
    }> | null;
    error: { code: string; description: string } | null;
  };
}

export interface FindStocksYahooSummary {
  quoteSummary: {
    result: Array<{
      defaultKeyStatistics?: {
        forwardPE?: { raw: number };
      };
      summaryDetail?: {
        trailingPE?: { raw: number };
      };
    }> | null;
    error?: { code: string; description: string } | null;
  };
}

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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat: add Find Stocks types (TickerCandidate, ConvictionScore, ThesisCard, market data)"
```

---

## Task 2: Yahoo Market Data Helper

**Files:**

- Modify: `lib/yahoo.ts`
- Modify: `lib/__tests__/yahoo.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to the end of `lib/__tests__/yahoo.test.ts`:

```typescript
import { parseMarketData } from '../yahoo';
import type { FindStocksYahooChart, FindStocksYahooSummary } from '../../types';

const mockChart: FindStocksYahooChart = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'NVDA',
          regularMarketPrice: 130,
          currency: 'USD',
        },
        indicators: {
          quote: [{ high: [100, 150, 140, null, 130] }],
        },
      },
    ],
    error: null,
  },
};

const mockSummary: FindStocksYahooSummary = {
  quoteSummary: {
    result: [
      {
        defaultKeyStatistics: { forwardPE: { raw: 30 } },
        summaryDetail: { trailingPE: { raw: 50 } },
      },
    ],
    error: null,
  },
};

describe('parseMarketData', () => {
  it('extracts 52-week high as max of highs array, ignoring nulls', () => {
    const result = parseMarketData('NVDA', mockChart, mockSummary);
    expect(result.fiftyTwoWeekHigh).toBe(150);
  });

  it('computes pctBelowHigh correctly', () => {
    const result = parseMarketData('NVDA', mockChart, mockSummary);
    // (150 - 130) / 150 * 100 = 13.33
    expect(result.pctBelowHigh).toBeCloseTo(13.33, 1);
  });

  it('extracts forward and trailing PE from summary', () => {
    const result = parseMarketData('NVDA', mockChart, mockSummary);
    expect(result.forwardPE).toBe(30);
    expect(result.trailingPE).toBe(50);
    expect(result.forwardBelowTrailing).toBe(true);
  });

  it('returns forwardBelowTrailing false when forward >= trailing', () => {
    const summary: FindStocksYahooSummary = {
      quoteSummary: {
        result: [
          {
            defaultKeyStatistics: { forwardPE: { raw: 60 } },
            summaryDetail: { trailingPE: { raw: 40 } },
          },
        ],
        error: null,
      },
    };
    const result = parseMarketData('NVDA', mockChart, summary);
    expect(result.forwardBelowTrailing).toBe(false);
  });

  it('returns all null fields when chart result is null', () => {
    const emptyChart: FindStocksYahooChart = {
      chart: {
        result: null,
        error: { code: 'Not Found', description: 'Not found' },
      },
    };
    const emptySummary: FindStocksYahooSummary = {
      quoteSummary: { result: null },
    };
    const result = parseMarketData('FAKE', emptyChart, emptySummary);
    expect(result.fiftyTwoWeekHigh).toBeNull();
    expect(result.currentPrice).toBeNull();
    expect(result.pctBelowHigh).toBeNull();
    expect(result.forwardPE).toBeNull();
    expect(result.trailingPE).toBeNull();
    expect(result.forwardBelowTrailing).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=lib/__tests__/yahoo
```

Expected: `parseMarketData is not a function` or similar — the function does not exist yet.

- [ ] **Step 3: Add `parseMarketData` and `fetchTickerMarketData` to `lib/yahoo.ts`**

Add the following imports at the top of `lib/yahoo.ts` (after existing imports):

```typescript
import type {
  FindStocksYahooChart,
  FindStocksYahooSummary,
  TickerMarketData,
} from '@/types';
```

Then append these two functions at the end of `lib/yahoo.ts`:

```typescript
export function parseMarketData(
  ticker: string,
  chart: FindStocksYahooChart,
  summary: FindStocksYahooSummary,
): TickerMarketData {
  const chartResult = chart.chart.result?.[0];
  const highs = chartResult?.indicators?.quote?.[0]?.high ?? [];
  const currentPrice = chartResult?.meta?.regularMarketPrice ?? null;
  const validHighs = highs.filter((h): h is number => h !== null);
  const fiftyTwoWeekHigh =
    validHighs.length > 0 ? Math.max(...validHighs) : null;
  const pctBelowHigh =
    currentPrice !== null && fiftyTwoWeekHigh !== null && fiftyTwoWeekHigh > 0
      ? ((fiftyTwoWeekHigh - currentPrice) / fiftyTwoWeekHigh) * 100
      : null;

  const summaryResult = summary.quoteSummary.result?.[0];
  const forwardPE = summaryResult?.defaultKeyStatistics?.forwardPE?.raw ?? null;
  const trailingPE = summaryResult?.summaryDetail?.trailingPE?.raw ?? null;
  const forwardBelowTrailing =
    forwardPE !== null && trailingPE !== null ? forwardPE < trailingPE : null;

  return {
    ticker,
    currentPrice,
    fiftyTwoWeekHigh,
    pctBelowHigh,
    forwardPE,
    trailingPE,
    forwardBelowTrailing,
  };
}

export async function fetchTickerMarketData(
  ticker: string,
): Promise<TickerMarketData> {
  const symbol = encodeURIComponent(ticker.toUpperCase());
  const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1y`;
  const summaryUrl = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=defaultKeyStatistics%2CsummaryDetail`;

  const [chart, summary] = await Promise.all([
    fetchYahoo<FindStocksYahooChart>(chartUrl),
    fetchYahooWithCrumb<FindStocksYahooSummary>(summaryUrl),
  ]);

  return parseMarketData(ticker, chart, summary);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=lib/__tests__/yahoo
```

Expected: all tests pass including the new `parseMarketData` suite.

- [ ] **Step 5: Commit**

```bash
git add lib/yahoo.ts lib/__tests__/yahoo.test.ts
git commit -m "feat: add parseMarketData and fetchTickerMarketData to yahoo helpers"
```

---

## Task 3: Tickers API Route

**Files:**

- Create: `app/api/find-stocks/tickers/route.ts`

- [ ] **Step 1: Create the directory and route file**

```typescript
// app/api/find-stocks/tickers/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const tickersSystemPrompt = `You are a senior equity analyst. Your job is to identify the 10 publicly traded US stocks
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
}`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const theme = typeof body.theme === 'string' ? body.theme.trim() : '';
  if (!theme) {
    return NextResponse.json({ error: 'theme is required' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: tickersSystemPrompt },
          { role: 'user', content: `Theme: ${theme}` },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );
    const content = response.choices[0]?.message?.content ?? '{}';
    return NextResponse.json(JSON.parse(content));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/find-stocks/tickers]:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/find-stocks/tickers/route.ts
git commit -m "feat: add /api/find-stocks/tickers route (gpt-4o-mini)"
```

---

## Task 4: Scores API Route

**Files:**

- Create: `app/api/find-stocks/scores/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/find-stocks/scores/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fetchTickerMarketData } from '@/lib/yahoo';
import type { TickerCandidate, TickerMarketData } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const scoresSystemPrompt = `You are a quantitative equity analyst applying a structured conviction scoring framework.

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
}`;

const scoresUserPrompt = (
  theme: string,
  candidates: TickerCandidate[],
  marketData: TickerMarketData[],
) =>
  `Theme: ${theme}\n\nCandidates:\n${JSON.stringify(candidates)}\n\nReal-time market data:\n${JSON.stringify(marketData)}`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { theme, candidates } = body as {
    theme?: string;
    candidates?: TickerCandidate[];
  };

  if (!theme || !Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json(
      { error: 'theme and candidates are required' },
      { status: 400 },
    );
  }

  const rawResults = await Promise.allSettled(
    candidates.map((c) => fetchTickerMarketData(c.ticker)),
  );

  const marketData: TickerMarketData[] = candidates.map((c, i) => {
    const result = rawResults[i];
    if (result.status === 'fulfilled') return result.value;
    console.error(
      `[/api/find-stocks/scores] market data failed for ${c.ticker}:`,
      result.reason?.message,
    );
    return {
      ticker: c.ticker,
      currentPrice: null,
      fiftyTwoWeekHigh: null,
      pctBelowHigh: null,
      forwardPE: null,
      trailingPE: null,
      forwardBelowTrailing: null,
    };
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: scoresSystemPrompt },
          {
            role: 'user',
            content: scoresUserPrompt(theme, candidates, marketData),
          },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );
    const content = response.choices[0]?.message?.content ?? '{}';
    return NextResponse.json(JSON.parse(content));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/find-stocks/scores]:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/find-stocks/scores/route.ts
git commit -m "feat: add /api/find-stocks/scores route (hybrid Yahoo + gpt-4o)"
```

---

## Task 5: Thesis API Route

**Files:**

- Create: `app/api/find-stocks/thesis/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/find-stocks/thesis/route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { ConvictionScore } from '@/types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const thesisSystemPrompt = `You are a portfolio manager writing conviction reports for institutional investors.
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
}`;

const thesisUserPrompt = (theme: string, topNames: ConvictionScore[]) =>
  `Theme: ${theme}\n\nTop 3 names to analyze:\n${JSON.stringify(topNames)}`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { theme, topNames } = body as {
    theme?: string;
    topNames?: ConvictionScore[];
  };

  if (!theme || !Array.isArray(topNames) || topNames.length === 0) {
    return NextResponse.json(
      { error: 'theme and topNames are required' },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await openai.chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: thesisSystemPrompt },
          { role: 'user', content: thesisUserPrompt(theme, topNames) },
        ],
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );
    const content = response.choices[0]?.message?.content ?? '{}';
    return NextResponse.json(JSON.parse(content));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[/api/find-stocks/thesis]:', message);
    return NextResponse.json({ error: message }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/find-stocks/thesis/route.ts
git commit -m "feat: add /api/find-stocks/thesis route (gpt-4o deep thesis)"
```

---

## Task 6: `useFindStocks` Hook

**Files:**

- Create: `hooks/useFindStocks.ts`
- Create: `hooks/__tests__/useFindStocks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// hooks/__tests__/useFindStocks.test.ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFindStocks } from '@/hooks/useFindStocks';

const mockCandidates = [{ rank: 1, ticker: 'NVDA', description: 'GPU maker' }];
const mockScores = [
  {
    rank: 1,
    ticker: 'NVDA',
    score: 91,
    tier: 'Best' as const,
    thesis: 'Dominant AI chip',
  },
];
const mockThesis = [
  {
    ticker: 'NVDA',
    rank: 1,
    moat: 'moat',
    drawdown: 'drawdown',
    catalyst: 'catalyst',
    exit: 'exit',
    sources: [],
  },
];

function makeFetch(...responses: object[]) {
  let call = 0;
  return jest.fn().mockImplementation(() => {
    const data = responses[call++] ?? {};
    return Promise.resolve({
      ok: !('error' in data),
      json: () => Promise.resolve(data),
    });
  });
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useFindStocks', () => {
  it('starts in idle phase', () => {
    const { result } = renderHook(() => useFindStocks());
    expect(result.current.state.phase).toBe('idle');
  });

  it('progresses to complete after all 3 steps succeed', async () => {
    global.fetch = makeFetch(
      { candidates: mockCandidates },
      { scores: mockScores },
      { thesis: mockThesis },
    );
    const { result } = renderHook(() => useFindStocks());
    act(() => {
      result.current.run('AI Infrastructure');
    });
    await waitFor(() => expect(result.current.state.phase).toBe('complete'));
    const state = result.current.state;
    if (state.phase === 'complete') {
      expect(state.candidates).toEqual(mockCandidates);
      expect(state.scores).toEqual(mockScores);
      expect(state.thesis).toEqual(mockThesis);
    }
  });

  it('enters error phase with step=1 when tickers call fails', async () => {
    global.fetch = makeFetch({ error: 'OpenAI unavailable' });
    const { result } = renderHook(() => useFindStocks());
    act(() => {
      result.current.run('AI Infrastructure');
    });
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    const state = result.current.state;
    if (state.phase === 'error') {
      expect(state.step).toBe(1);
      expect(state.candidates).toBeUndefined();
    }
  });

  it('enters error phase with step=2 and preserves candidates when scores call fails', async () => {
    global.fetch = makeFetch(
      { candidates: mockCandidates },
      { error: 'OpenAI timeout' },
    );
    const { result } = renderHook(() => useFindStocks());
    act(() => {
      result.current.run('AI Infrastructure');
    });
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    const state = result.current.state;
    if (state.phase === 'error') {
      expect(state.step).toBe(2);
      expect(state.candidates).toEqual(mockCandidates);
    }
  });

  it('enters error phase with step=3 and preserves candidates+scores when thesis call fails', async () => {
    global.fetch = makeFetch(
      { candidates: mockCandidates },
      { scores: mockScores },
      { error: 'OpenAI timeout' },
    );
    const { result } = renderHook(() => useFindStocks());
    act(() => {
      result.current.run('AI Infrastructure');
    });
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    const state = result.current.state;
    if (state.phase === 'error') {
      expect(state.step).toBe(3);
      expect(state.scores).toEqual(mockScores);
    }
  });

  it('reset returns to idle from any phase', async () => {
    global.fetch = makeFetch(
      { candidates: mockCandidates },
      { scores: mockScores },
      { thesis: mockThesis },
    );
    const { result } = renderHook(() => useFindStocks());
    act(() => {
      result.current.run('AI Infrastructure');
    });
    await waitFor(() => expect(result.current.state.phase).toBe('complete'));
    act(() => {
      result.current.reset();
    });
    expect(result.current.state.phase).toBe('idle');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=hooks/__tests__/useFindStocks
```

Expected: `Cannot find module '@/hooks/useFindStocks'`.

- [ ] **Step 3: Implement the hook**

```typescript
// hooks/useFindStocks.ts
'use client';

import { useState, useCallback } from 'react';
import type { TickerCandidate, ConvictionScore, ThesisCard } from '@/types';

export type FindStocksPhase =
  | { phase: 'idle' }
  | { phase: 'tickers-loading' }
  | { phase: 'scores-loading'; candidates: TickerCandidate[] }
  | {
      phase: 'thesis-loading';
      candidates: TickerCandidate[];
      scores: ConvictionScore[];
    }
  | {
      phase: 'complete';
      candidates: TickerCandidate[];
      scores: ConvictionScore[];
      thesis: ThesisCard[];
    }
  | {
      phase: 'error';
      step: 1 | 2 | 3;
      message: string;
      candidates?: TickerCandidate[];
      scores?: ConvictionScore[];
    };

export function useFindStocks() {
  const [state, setState] = useState<FindStocksPhase>({ phase: 'idle' });

  const run = useCallback(async (theme: string) => {
    // Step 1 — tickers
    setState({ phase: 'tickers-loading' });
    let candidates: TickerCandidate[];
    try {
      const res = await fetch('/api/find-stocks/tickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Step 1 failed');
      candidates = data.candidates;
    } catch (err) {
      setState({
        phase: 'error',
        step: 1,
        message: err instanceof Error ? err.message : 'Step 1 failed',
      });
      return;
    }

    // Step 2 — scores
    setState({ phase: 'scores-loading', candidates });
    let scores: ConvictionScore[];
    try {
      const res = await fetch('/api/find-stocks/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, candidates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Step 2 failed');
      scores = data.scores;
    } catch (err) {
      setState({
        phase: 'error',
        step: 2,
        message: err instanceof Error ? err.message : 'Step 2 failed',
        candidates,
      });
      return;
    }

    // Step 3 — thesis (top 3 only)
    setState({ phase: 'thesis-loading', candidates, scores });
    const topNames = scores.slice(0, 3);
    let thesis: ThesisCard[];
    try {
      const res = await fetch('/api/find-stocks/thesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, topNames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Step 3 failed');
      thesis = data.thesis;
    } catch (err) {
      setState({
        phase: 'error',
        step: 3,
        message: err instanceof Error ? err.message : 'Step 3 failed',
        candidates,
        scores,
      });
      return;
    }

    setState({ phase: 'complete', candidates, scores, thesis });
  }, []);

  const reset = useCallback(() => setState({ phase: 'idle' }), []);

  return { state, run, reset };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=hooks/__tests__/useFindStocks
```

Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add hooks/useFindStocks.ts hooks/__tests__/useFindStocks.test.ts
git commit -m "feat: add useFindStocks hook with phase state machine"
```

---

## Task 7: ThemeSelector Component

**Files:**

- Create: `components/FindStocks/ThemeSelector.tsx`
- Create: `components/FindStocks/__tests__/ThemeSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// components/FindStocks/__tests__/ThemeSelector.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeSelector } from '../ThemeSelector';

const noop = () => {};

describe('ThemeSelector', () => {
  it('renders all 8 preset pills', () => {
    render(<ThemeSelector value="" onChange={noop} onSubmit={noop} loading={false} />);
    expect(screen.getByText('AI Infrastructure')).toBeInTheDocument();
    expect(screen.getByText('Semiconductors')).toBeInTheDocument();
    expect(screen.getByText('Cybersecurity')).toBeInTheDocument();
    expect(screen.getByText('GLP-1 / Obesity')).toBeInTheDocument();
    expect(screen.getByText('Defense Primes')).toBeInTheDocument();
    expect(screen.getByText('Credit-Card Networks')).toBeInTheDocument();
    expect(screen.getByText('SaaS at a Discount')).toBeInTheDocument();
    expect(screen.getByText('Re-shoring Industries')).toBeInTheDocument();
  });

  it('calls onChange with preset value when a pill is clicked', () => {
    const onChange = jest.fn();
    render(<ThemeSelector value="" onChange={onChange} onSubmit={noop} loading={false} />);
    fireEvent.click(screen.getByText('AI Infrastructure'));
    expect(onChange).toHaveBeenCalledWith('AI Infrastructure');
  });

  it('calls onChange when text input changes', () => {
    const onChange = jest.fn();
    render(<ThemeSelector value="" onChange={onChange} onSubmit={noop} loading={false} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Clean energy' } });
    expect(onChange).toHaveBeenCalledWith('Clean energy');
  });

  it('disables the button when value is empty', () => {
    render(<ThemeSelector value="" onChange={noop} onSubmit={noop} loading={false} />);
    expect(screen.getByRole('button', { name: /find stocks/i })).toBeDisabled();
  });

  it('disables the button when loading', () => {
    render(<ThemeSelector value="AI Infrastructure" onChange={noop} onSubmit={noop} loading={true} />);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onSubmit when button is clicked with a non-empty value', () => {
    const onSubmit = jest.fn();
    render(<ThemeSelector value="AI Infrastructure" onChange={noop} onSubmit={onSubmit} loading={false} />);
    fireEvent.click(screen.getByRole('button', { name: /find stocks/i }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=components/FindStocks/__tests__/ThemeSelector
```

Expected: `Cannot find module '../ThemeSelector'`.

- [ ] **Step 3: Implement the component**

```typescript
// components/FindStocks/ThemeSelector.tsx
'use client';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

const PRESETS = [
  'AI Infrastructure',
  'Semiconductors',
  'Cybersecurity',
  'GLP-1 / Obesity',
  'Defense Primes',
  'Credit-Card Networks',
  'SaaS at a Discount',
  'Re-shoring Industries',
];

export function ThemeSelector({ value, onChange, onSubmit, loading }: Props) {
  const disabled = !value.trim() || loading;

  return (
    <div className="rounded-xl border border-[#1f1f1f] bg-[#111] p-5">
      <p className="mb-3 text-xs uppercase tracking-widest text-[#555]">Choose a theme</p>
      <div className="mb-4 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              value === preset
                ? 'bg-[#C8FF00] text-[#080808]'
                : 'bg-[#1f1f1f] text-[#999] hover:text-[#C8FF00]'
            }`}
          >
            {preset}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or type a custom theme..."
          disabled={loading}
          className="flex-1 rounded-md border border-[#2a2a2a] bg-[#0d0d0d] px-3 py-2 text-sm text-[#ccc] placeholder:text-[#444] focus:border-[#C8FF00] focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="rounded-md bg-[#C8FF00] px-5 py-2 text-sm font-bold text-[#080808] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {loading ? 'Running...' : 'Find Stocks →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=components/FindStocks/__tests__/ThemeSelector
```

Expected: all 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/FindStocks/ThemeSelector.tsx components/FindStocks/__tests__/ThemeSelector.test.tsx
git commit -m "feat: add ThemeSelector component with 8 preset pills"
```

---

## Task 8: TickerList Component

**Files:**

- Create: `components/FindStocks/TickerList.tsx`
- Create: `components/FindStocks/__tests__/TickerList.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// components/FindStocks/__tests__/TickerList.test.tsx
import { render, screen } from '@testing-library/react';
import { TickerList } from '../TickerList';

const candidates = [
  { rank: 1, ticker: 'NVDA', description: 'Dominant GPU maker' },
  { rank: 2, ticker: 'MSFT', description: 'Azure cloud powerhouse' },
];

describe('TickerList', () => {
  it('renders rank, ticker, and description for each candidate', () => {
    render(<TickerList candidates={candidates} />);
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('Dominant GPU maker')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText('Azure cloud powerhouse')).toBeInTheDocument();
  });

  it('renders rank numbers', () => {
    render(<TickerList candidates={candidates} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=components/FindStocks/__tests__/TickerList
```

Expected: `Cannot find module '../TickerList'`.

- [ ] **Step 3: Implement the component**

```typescript
// components/FindStocks/TickerList.tsx
import type { TickerCandidate } from '@/types';

interface Props {
  candidates: TickerCandidate[];
}

export function TickerList({ candidates }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#1f1f1f]">
      <div className="grid grid-cols-[32px_64px_1fr] border-b border-[#1a1a1a] px-3 py-2">
        <span className="text-xs text-[#555]">#</span>
        <span className="text-xs text-[#555]">Ticker</span>
        <span className="text-xs text-[#555]">Description</span>
      </div>
      {candidates.map((c) => (
        <div
          key={c.ticker}
          className="grid grid-cols-[32px_64px_1fr] border-b border-[#141414] px-3 py-2 last:border-0"
        >
          <span className="text-xs text-[#555]">{c.rank}</span>
          <span className="text-xs font-bold text-[#C8FF00]">{c.ticker}</span>
          <span className="text-xs text-[#aaa]">{c.description}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=components/FindStocks/__tests__/TickerList
```

Expected: all 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/FindStocks/TickerList.tsx components/FindStocks/__tests__/TickerList.test.tsx
git commit -m "feat: add TickerList component"
```

---

## Task 9: ConvictionTable Component

**Files:**

- Create: `components/FindStocks/ConvictionTable.tsx`
- Create: `components/FindStocks/__tests__/ConvictionTable.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// components/FindStocks/__tests__/ConvictionTable.test.tsx
import { render, screen } from '@testing-library/react';
import { ConvictionTable } from '../ConvictionTable';

const scores = [
  { rank: 1, ticker: 'NVDA', score: 91, tier: 'Best' as const, thesis: 'Dominant AI compute' },
  { rank: 2, ticker: 'MSFT', score: 68, tier: 'Strong' as const, thesis: 'Enterprise AI play' },
  { rank: 3, ticker: 'XYZ', score: 55, tier: 'Watch' as const, thesis: 'Speculative exposure' },
  { rank: 4, ticker: 'ABC', score: 40, tier: 'Avoid' as const, thesis: 'Weak fundamentals' },
];

describe('ConvictionTable', () => {
  it('renders ticker, score, tier, and thesis for each row', () => {
    render(<ConvictionTable scores={scores} />);
    expect(screen.getByText('NVDA')).toBeInTheDocument();
    expect(screen.getByText('91')).toBeInTheDocument();
    expect(screen.getByText('Best')).toBeInTheDocument();
    expect(screen.getByText('Dominant AI compute')).toBeInTheDocument();
  });

  it('renders all four tiers', () => {
    render(<ConvictionTable scores={scores} />);
    expect(screen.getByText('Best')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Watch')).toBeInTheDocument();
    expect(screen.getByText('Avoid')).toBeInTheDocument();
  });

  it('renders the disclaimer footer', () => {
    render(<ConvictionTable scores={scores} />);
    expect(screen.getByText(/ai-estimated/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=components/FindStocks/__tests__/ConvictionTable
```

Expected: `Cannot find module '../ConvictionTable'`.

- [ ] **Step 3: Implement the component**

```typescript
// components/FindStocks/ConvictionTable.tsx
import type { ConvictionScore } from '@/types';

interface Props {
  scores: ConvictionScore[];
}

const TIER_STYLES: Record<ConvictionScore['tier'], string> = {
  Best: 'bg-[#22c55e] text-black',
  Strong: 'bg-[#3d6b47] text-[#86efac]',
  Watch: 'bg-[#713f12] text-[#fbbf24]',
  Avoid: 'bg-[#7f1d1d] text-[#f87171]',
};

export function ConvictionTable({ scores }: Props) {
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-[#1f1f1f]">
        <div className="grid grid-cols-[40px_64px_52px_84px_1fr] border-b border-[#1a1a1a] px-3 py-2">
          <span className="text-xs text-[#555]">Rank</span>
          <span className="text-xs text-[#555]">Ticker</span>
          <span className="text-xs text-[#555]">Score</span>
          <span className="text-xs text-[#555]">Tier</span>
          <span className="text-xs text-[#555]">One-line thesis</span>
        </div>
        {scores.map((s) => (
          <div
            key={s.ticker}
            className="grid grid-cols-[40px_64px_52px_84px_1fr] items-center border-b border-[#141414] px-3 py-2 last:border-0"
          >
            <span className="text-xs text-[#555]">{s.rank}</span>
            <span className="text-xs font-bold text-[#C8FF00]">{s.ticker}</span>
            <span className="text-xs font-bold text-[#aaa]">{s.score}</span>
            <span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_STYLES[s.tier]}`}>
                {s.tier.toUpperCase()}
              </span>
            </span>
            <span className="text-xs text-[#aaa]">{s.thesis}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[#444]">
        Quality metrics (ROIC, FCF, leverage, growth) are AI-estimated from training data.
        Discount metrics use real-time Yahoo Finance data.
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=components/FindStocks/__tests__/ConvictionTable
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/FindStocks/ConvictionTable.tsx components/FindStocks/__tests__/ConvictionTable.test.tsx
git commit -m "feat: add ConvictionTable component with tier color-coding"
```

---

## Task 10: ThesisCards Component

**Files:**

- Create: `components/FindStocks/ThesisCards.tsx`
- Create: `components/FindStocks/__tests__/ThesisCards.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// components/FindStocks/__tests__/ThesisCards.test.tsx
import { render, screen } from '@testing-library/react';
import { ThesisCards } from '../ThesisCards';

const thesis = [
  {
    ticker: 'NVDA', rank: 1,
    moat: 'CUDA software lock-in',
    drawdown: 'Export controls hit revenue',
    catalyst: 'Blackwell ramp in H2',
    exit: 'AMD captures 20% GPU share',
    sources: ['NVDA Q1 2025 earnings', 'Reuters'],
  },
];

describe('ThesisCards', () => {
  it('renders ticker name', () => {
    render(<ThesisCards thesis={thesis} />);
    expect(screen.getByText('#1 NVDA')).toBeInTheDocument();
  });

  it('renders all four thesis sections', () => {
    render(<ThesisCards thesis={thesis} />);
    expect(screen.getByText('CUDA software lock-in')).toBeInTheDocument();
    expect(screen.getByText('Export controls hit revenue')).toBeInTheDocument();
    expect(screen.getByText('Blackwell ramp in H2')).toBeInTheDocument();
    expect(screen.getByText('AMD captures 20% GPU share')).toBeInTheDocument();
  });

  it('renders sources', () => {
    render(<ThesisCards thesis={thesis} />);
    expect(screen.getByText('NVDA Q1 2025 earnings')).toBeInTheDocument();
    expect(screen.getByText('Reuters')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- --testPathPattern=components/FindStocks/__tests__/ThesisCards
```

Expected: `Cannot find module '../ThesisCards'`.

- [ ] **Step 3: Implement the component**

```typescript
// components/FindStocks/ThesisCards.tsx
import type { ThesisCard } from '@/types';

interface Props {
  thesis: ThesisCard[];
}

const SECTION_LABEL = 'text-[9px] uppercase tracking-widest text-[#555] mb-1';
const SECTION_BODY = 'text-xs leading-relaxed text-[#aaa]';

export function ThesisCards({ thesis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {thesis.map((card) => (
        <div
          key={card.ticker}
          className="flex flex-col gap-4 rounded-lg border border-[#1f1f1f] bg-[#111] p-5"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-base font-bold text-[#C8FF00]">
              #{card.rank} {card.ticker}
            </span>
          </div>

          <div>
            <p className={SECTION_LABEL}>The Moat</p>
            <p className={SECTION_BODY}>{card.moat}</p>
          </div>
          <div>
            <p className={SECTION_LABEL}>The Drawdown</p>
            <p className={SECTION_BODY}>{card.drawdown}</p>
          </div>
          <div>
            <p className={SECTION_LABEL}>The Catalyst</p>
            <p className={SECTION_BODY}>{card.catalyst}</p>
          </div>
          <div>
            <p className={SECTION_LABEL}>The Exit</p>
            <p className={SECTION_BODY}>{card.exit}</p>
          </div>

          <div className="mt-auto border-t border-[#1a1a1a] pt-3">
            <p className={SECTION_LABEL}>Sources</p>
            <ul className="space-y-0.5">
              {card.sources.map((source, i) => (
                <li key={i} className="text-[10px] text-[#444]">
                  {source}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[9px] text-[#333]">AI-generated citations</p>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- --testPathPattern=components/FindStocks/__tests__/ThesisCards
```

Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/FindStocks/ThesisCards.tsx components/FindStocks/__tests__/ThesisCards.test.tsx
git commit -m "feat: add ThesisCards component"
```

---

## Task 11: Find Page

**Files:**

- Create: `app/find/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
// app/find/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useFindStocks } from '@/hooks/useFindStocks';
import { ThemeSelector } from '@/components/FindStocks/ThemeSelector';
import { TickerList } from '@/components/FindStocks/TickerList';
import { ConvictionTable } from '@/components/FindStocks/ConvictionTable';
import { ThesisCards } from '@/components/FindStocks/ThesisCards';
import type { FindStocksPhase } from '@/hooks/useFindStocks';
import type { TickerCandidate, ConvictionScore, ThesisCard } from '@/types';

function getCandidates(state: FindStocksPhase): TickerCandidate[] | undefined {
  if (
    state.phase === 'scores-loading' ||
    state.phase === 'thesis-loading' ||
    state.phase === 'complete'
  ) return state.candidates;
  if (state.phase === 'error') return state.candidates;
  return undefined;
}

function getScores(state: FindStocksPhase): ConvictionScore[] | undefined {
  if (state.phase === 'thesis-loading' || state.phase === 'complete') return state.scores;
  if (state.phase === 'error') return state.scores;
  return undefined;
}

function getThesis(state: FindStocksPhase): ThesisCard[] | undefined {
  if (state.phase === 'complete') return state.thesis;
  return undefined;
}

export default function FindPage() {
  const [theme, setTheme] = useState('');
  const { state, run, reset } = useFindStocks();

  const isLoading = ['tickers-loading', 'scores-loading', 'thesis-loading'].includes(state.phase);
  const hasStarted = state.phase !== 'idle';

  const candidates = getCandidates(state);
  const scores = getScores(state);
  const thesis = getThesis(state);

  return (
    <div className="min-h-screen bg-[#080808]">
      <header className="flex items-center justify-between border-b border-[#1f1f1f] px-4 py-4 sm:px-6">
        <h1 className="font-heading text-2xl font-bold tracking-wide text-[#C8FF00]">
          Market Pulse
        </h1>
        <Link href="/" className="text-sm text-[#888] hover:text-[#C8FF00]">
          ← Back to watchlist
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h2 className="font-heading text-3xl font-bold text-[#C8FF00]">Find Stocks</h2>
          <p className="mt-1 text-sm text-[#555]">
            AI-powered theme scanner · 3 steps · ~30 seconds
          </p>
        </div>

        {!hasStarted ? (
          <ThemeSelector
            value={theme}
            onChange={setTheme}
            onSubmit={() => { if (theme.trim()) run(theme.trim()); }}
            loading={isLoading}
          />
        ) : (
          <div className="mb-6 flex items-center gap-3">
            <span className="text-sm text-[#888]">
              Theme: <span className="text-[#C8FF00]">{theme}</span>
            </span>
            <button
              onClick={reset}
              className="text-xs text-[#555] hover:text-[#888]"
            >
              Start over
            </button>
          </div>
        )}

        {/* Step 1 */}
        {state.phase === 'tickers-loading' && (
          <StepSection step={1} title="Ticker Universe" loading />
        )}
        {candidates && (
          <StepSection step={1} title="Ticker Universe">
            <TickerList candidates={candidates} />
          </StepSection>
        )}

        {/* Step 2 */}
        {state.phase === 'scores-loading' && (
          <StepSection step={2} title="Conviction Scores" loading />
        )}
        {scores && (
          <StepSection step={2} title="Conviction Scores">
            <ConvictionTable scores={scores} />
          </StepSection>
        )}

        {/* Step 3 */}
        {state.phase === 'thesis-loading' && (
          <StepSection step={3} title="Deep Thesis" loading />
        )}
        {thesis && (
          <StepSection step={3} title="Deep Thesis">
            <ThesisCards thesis={thesis} />
          </StepSection>
        )}

        {/* Error */}
        {state.phase === 'error' && (
          <div className="mt-6 rounded-lg border border-red-900/50 bg-red-950/20 p-4">
            <p className="text-sm text-red-400">
              Step {state.step} failed: {state.message}
            </p>
            <button
              onClick={() => run(theme)}
              className="mt-2 text-xs text-[#C8FF00] hover:underline"
            >
              Try again
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function StepSection({
  step,
  title,
  loading = false,
  children,
}: {
  step: number;
  title: string;
  loading?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-[#C8FF00] px-2 py-0.5 text-[10px] font-bold text-[#080808]">
          STEP {step}
        </span>
        <span className="text-sm font-semibold text-[#aaa]">{title}</span>
        {loading && (
          <span className="animate-pulse text-xs text-[#555]">Loading...</span>
        )}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add app/find/page.tsx
git commit -m "feat: add /find page with 3-step Find Stocks workflow"
```

---

## Task 12: TopBar Navigation

**Files:**

- Modify: `components/TopBar.tsx`

- [ ] **Step 1: Update TopBar to add the Find Stocks link**

Replace the entire content of `components/TopBar.tsx` with:

```typescript
// components/TopBar.tsx
'use client';

import Link from 'next/link';
import { AddTickerForm } from './AddTickerForm';

interface Props {
  onAdd: (ticker: string) => void;
}

export function TopBar({ onAdd }: Props) {
  return (
    <header className="flex flex-col gap-3 px-4 py-4 border-b border-[#1f1f1f] sm:flex-row sm:items-center sm:justify-between sm:gap-0 sm:px-6">
      <h1 className="font-heading text-2xl font-bold tracking-wide text-[#C8FF00]">
        Market Pulse
      </h1>
      <div className="flex items-center gap-3">
        <Link
          href="/find"
          className="rounded border border-[#1f1f1f] px-3 py-1.5 text-xs text-[#888] transition-colors hover:border-[#C8FF00] hover:text-[#C8FF00]"
        >
          Find Stocks
        </Link>
        <AddTickerForm onAdd={onAdd} />
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/TopBar.tsx
git commit -m "feat: add Find Stocks link to TopBar"
```

---

## Verify End-to-End

- [ ] **Start the dev server and confirm the feature works**

```bash
npm run dev
```

1. Open `http://localhost:3000` — confirm "Find Stocks" link appears in the TopBar
2. Click "Find Stocks" — confirm navigation to `/find`
3. Click a preset pill (e.g. "AI Infrastructure") — confirm input fills
4. Click "Find Stocks →" — confirm Step 1 spinner appears, then ticker list populates
5. Confirm Step 2 spinner appears while scores load, then conviction table appears
6. Confirm Step 3 spinner appears while thesis loads, then 3 thesis cards appear
7. Confirm tier badge colors: green (Best), muted green (Strong), yellow (Watch), red (Avoid)
8. Click "Start over" — confirm theme selector reappears

> **Note:** Requires `OPENAI_API_KEY` in `.env.local`. Add it before running: `echo "OPENAI_API_KEY=sk-..." >> .env.local`
