import { NextRequest, NextResponse } from 'next/server';
import { fetchYahooWithCrumb, parseFundamentals } from '@/lib/yahoo';
import type { YahooSummaryResponse } from '@/types';

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  const symbol = encodeURIComponent(ticker.toUpperCase());
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData%2CdefaultKeyStatistics%2CearningsHistory`;

  try {
    const raw = await fetchYahooWithCrumb<YahooSummaryResponse>(url);
    const data = parseFundamentals(raw);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[/api/fundamentals] ${ticker}:`, message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
