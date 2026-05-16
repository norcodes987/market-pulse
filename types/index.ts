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

export interface WatchlistEntry {
  ticker: string;
  tag: 'owned' | 'watching';
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

export interface EarningsQuarter {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePct: number | null;
}

export interface FundamentalsData {
  targetLow: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  analystCount: number | null;
  recommendation: string | null;
  forwardPE: number | null;
  beta: number | null;
  shortFloat: number | null;
  earnings: EarningsQuarter[];
}

export interface YahooSummaryResponse {
  quoteSummary: {
    result: Array<{
      financialData?: {
        targetLowPrice?: { raw: number };
        targetMeanPrice?: { raw: number };
        targetHighPrice?: { raw: number };
        numberOfAnalystOpinions?: { raw: number };
        recommendationKey?: string;
      };
      defaultKeyStatistics?: {
        forwardPE?: { raw: number };
        beta?: { raw: number };
        shortPercentOfFloat?: { raw: number };
      };
      earningsHistory?: {
        history: Array<{
          epsActual?: { raw: number };
          epsEstimate?: { raw: number };
          surprisePercent?: { raw: number };
          quarter?: { fmt: string };
        }>;
      };
    }> | null;
    error?: { code: string; description: string } | null;
  };
}
