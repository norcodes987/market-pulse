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
