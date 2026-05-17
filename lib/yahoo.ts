import type {
  QuoteResponse,
  NewsArticle,
  YahooChartResponse,
  YahooSearchResponse,
  FundamentalsData,
  EarningsQuarter,
  YahooSummaryResponse,
} from '@/types';

export function parseQuote(raw: YahooChartResponse): QuoteResponse {
  const result = raw.chart.result?.[0];
  if (!result) {
    throw new Error(raw.chart.error?.description ?? 'No chart data returned');
  }
  const { meta, indicators } = result;
  const closes = indicators.quote[0]?.close ?? [];
  const price = meta.regularMarketPrice ?? 0;
  // Yahoo's chart API omits regularMarketChange/regularMarketPreviousClose.
  // With interval=1d&range=5d: closes[-1]=today, closes[-2]=yesterday's close.
  const prevClose =
    closes.length >= 2
      ? (closes[closes.length - 2] ?? meta.chartPreviousClose ?? 0)
      : (meta.chartPreviousClose ?? 0);
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

let crumbCache: { crumb: string; cookie: string; expiresAt: number } | null = null;

async function refreshCrumb(): Promise<{ crumb: string; cookie: string }> {
  // fc.yahoo.com reliably sets the A3 cookie that Yahoo's crumb endpoint requires.
  const fcRes = await fetch('https://fc.yahoo.com', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    redirect: 'follow',
  });
  const setCookies = fcRes.headers.getSetCookie();
  const cookie = setCookies.map((c) => c.split(';')[0].trim()).join('; ');

  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
  });
  if (!crumbRes.ok) throw new Error('Unable to authenticate with Yahoo Finance');
  const crumb = await crumbRes.text();
  if (!crumb || crumb.startsWith('{')) throw new Error('Unable to authenticate with Yahoo Finance');
  return { crumb, cookie };
}

export async function fetchYahooWithCrumb<T>(url: string): Promise<T> {
  if (!crumbCache || Date.now() > crumbCache.expiresAt) {
    const refreshed = await refreshCrumb();
    crumbCache = { ...refreshed, expiresAt: Date.now() + 3_600_000 };
  }

  async function attempt(crumb: string, cookie: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const sep = url.includes('?') ? '&' : '?';
      return await fetch(`${url}${sep}crumb=${encodeURIComponent(crumb)}`, {
        headers: { 'User-Agent': 'Mozilla/5.0', Cookie: cookie },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  let res = await attempt(crumbCache.crumb, crumbCache.cookie);
  if (res.status === 401) {
    const refreshed = await refreshCrumb();
    crumbCache = { ...refreshed, expiresAt: Date.now() + 3_600_000 };
    res = await attempt(crumbCache.crumb, crumbCache.cookie);
  }
  if (!res.ok) throw new Error(`Yahoo returned ${res.status}`);
  return res.json() as Promise<T>;
}

export function parseFundamentals(raw: YahooSummaryResponse): FundamentalsData {
  const result = raw.quoteSummary.result?.[0];
  if (!result) {
    throw new Error(raw.quoteSummary.error?.description ?? 'No quoteSummary data returned');
  }

  const fin = result.financialData;
  const stats = result.defaultKeyStatistics;
  const history = result.earningsHistory?.history ?? [];

  const earnings: EarningsQuarter[] = history.map((h) => ({
    quarter: h.quarter?.fmt ?? '',
    epsActual: h.epsActual?.raw ?? null,
    epsEstimate: h.epsEstimate?.raw ?? null,
    surprisePct: h.surprisePercent?.raw ?? null,
  }));

  return {
    targetLow: fin?.targetLowPrice?.raw ?? null,
    targetMean: fin?.targetMeanPrice?.raw ?? null,
    targetHigh: fin?.targetHighPrice?.raw ?? null,
    analystCount: fin?.numberOfAnalystOpinions?.raw ?? null,
    recommendation: fin?.recommendationKey ?? null,
    forwardPE: stats?.forwardPE?.raw ?? null,
    beta: stats?.beta?.raw ?? null,
    shortFloat: stats?.shortPercentOfFloat?.raw ?? null,
    earnings,
  };
}
