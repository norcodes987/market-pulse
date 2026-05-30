import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const tickersSystemPrompt = `You are a senior equity analyst. Your job is to identify the 25 publicly traded US stocks
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
