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
