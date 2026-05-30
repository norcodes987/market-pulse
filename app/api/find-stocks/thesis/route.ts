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
  const { theme, topNames } = body as { theme?: string; topNames?: ConvictionScore[] };

  if (!theme || !Array.isArray(topNames) || topNames.length === 0) {
    return NextResponse.json({ error: 'theme and topNames are required' }, { status: 400 });
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
