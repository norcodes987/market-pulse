export interface QuoteResponse {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  currency: string;
  high: number;
  low: number;
  volume: number;
  sparkline: number[];
}

export interface NewsArticle {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
}

export type QuoteState =
  | { status: 'loading' }
  | { status: 'ok'; data: QuoteResponse }
  | { status: 'error'; message: string };

export interface YahooChartMeta {
  symbol: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  currency: string;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketVolume?: number;
}

export interface YahooChartResult {
  meta: YahooChartMeta;
  indicators: {
    quote: Array<{ close: (number | null)[] }>;
  };
}

export interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code: string; description: string } | null;
  };
}

export interface YahooNewsItem {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
}

export interface YahooSearchResponse {
  news: YahooNewsItem[];
}
