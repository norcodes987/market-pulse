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
  const { theme, candidates } = body as { theme?: string; candidates?: TickerCandidate[] };

  if (!theme || !Array.isArray(candidates) || candidates.length === 0) {
    return NextResponse.json({ error: 'theme and candidates are required' }, { status: 400 });
  }

  const rawResults = await Promise.allSettled(
    candidates.map((c) => fetchTickerMarketData(c.ticker)),
  );

  const marketData: TickerMarketData[] = candidates.map((c, i) => {
    const result = rawResults[i];
    if (result.status === 'fulfilled') return result.value;
    console.error(`[/api/find-stocks/scores] market data failed for ${c.ticker}:`, result.reason?.message);
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
          { role: 'user', content: scoresUserPrompt(theme, candidates, marketData) },
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
