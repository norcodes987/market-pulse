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
  const price = meta.regularMarketPrice ?? 0;
  const prevClose = meta.chartPreviousClose ?? 0;
  const change = prevClose > 0 ? price - prevClose : 0;
  const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
  return {
    ticker: meta.symbol,
    name: meta.longName ?? meta.shortName ?? meta.symbol,
    price,
    change,
    changePct,
    currency: meta.currency,
    high: meta.regularMarketDayHigh ?? 0,
    low: meta.regularMarketDayLow ?? 0,
    volume: meta.regularMarketVolume ?? 0,
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
    const res = await fetch(url, { headers: YAHOO_HEADERS, signal: controller.signal });
    if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}
