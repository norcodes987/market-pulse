import { parseQuote, parseNews, parseFundamentals, parseMarketData } from '../yahoo';
import type { YahooChartResponse, YahooSearchResponse, YahooSummaryResponse } from '../../types';
import type { FindStocksYahooChart, FindStocksYahooSummary } from '../../types';

const mockChartResponse: YahooChartResponse = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'AAPL',
          longName: 'Apple Inc.',
          regularMarketPrice: 189.87,
          chartPreviousClose: 188.64,
          currency: 'USD',
          regularMarketDayHigh: 190.5,
          regularMarketDayLow: 188.0,
          regularMarketVolume: 50_000_000,
        },
        indicators: {
          quote: [{ close: [185.0, 186.5, 187.8, 188.64, 189.87] }],
        },
      },
    ],
    error: null,
  },
};

const mockSearchResponse: YahooSearchResponse = {
  news: [
    {
      title: 'Apple hits new high',
      publisher: 'Reuters',
      link: 'https://example.com/1',
      providerPublishTime: 1_700_000_000,
    },
  ],
};

describe('parseQuote', () => {
  it('maps meta fields to QuoteResponse', () => {
    const result = parseQuote(mockChartResponse);
    expect(result.ticker).toBe('AAPL');
    expect(result.name).toBe('Apple Inc.');
    expect(result.price).toBe(189.87);
    expect(result.change).toBeCloseTo(1.23);
    expect(result.changePct).toBeCloseTo(0.653);
    expect(result.currency).toBe('USD');
    expect(result.high).toBe(190.5);
    expect(result.low).toBe(188.0);
    expect(result.volume).toBe(50_000_000);
  });

  it('filters null values out of sparkline', () => {
    const result = parseQuote(mockChartResponse);
    expect(result.sparkline).toEqual([185.0, 186.5, 187.8, 188.64, 189.87]);
  });

  it('falls back to shortName when longName is missing', () => {
    const noLongName: YahooChartResponse = {
      chart: {
        result: [
          {
            ...mockChartResponse.chart.result![0],
            meta: {
              ...mockChartResponse.chart.result![0].meta,
              longName: undefined,
              shortName: 'Apple',
            },
          },
        ],
        error: null,
      },
    };
    expect(parseQuote(noLongName).name).toBe('Apple');
  });

  it('throws when chart result is null', () => {
    expect(() =>
      parseQuote({ chart: { result: null, error: { code: '404', description: 'Not found' } } })
    ).toThrow('Not found');
  });
});

describe('parseNews', () => {
  it('maps news items to NewsArticle', () => {
    const result = parseNews(mockSearchResponse);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Apple hits new high');
    expect(result[0].publisher).toBe('Reuters');
    expect(result[0].link).toBe('https://example.com/1');
  });

  it('converts providerPublishTime to ISO string', () => {
    const result = parseNews(mockSearchResponse);
    expect(result[0].publishedAt).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it('returns empty array when news is missing', () => {
    expect(parseNews({ news: [] })).toEqual([]);
  });
});

const mockSummaryResponse: YahooSummaryResponse = {
  quoteSummary: {
    result: [
      {
        financialData: {
          targetLowPrice: { raw: 150.0 },
          targetMeanPrice: { raw: 220.0 },
          targetHighPrice: { raw: 300.0 },
          numberOfAnalystOpinions: { raw: 42 },
          recommendationKey: 'buy',
        },
        defaultKeyStatistics: {
          forwardPE: { raw: 28.5 },
          beta: { raw: 1.25 },
          shortPercentOfFloat: { raw: 0.032 },
        },
        earningsHistory: {
          history: [
            {
              quarter: { fmt: '3/31/2024' },
              epsActual: { raw: 1.52 },
              epsEstimate: { raw: 1.48 },
              surprisePercent: { raw: 0.027 },
            },
            {
              quarter: { fmt: '12/31/2023' },
              epsActual: { raw: 2.18 },
              epsEstimate: { raw: 2.1 },
              surprisePercent: { raw: 0.038 },
            },
          ],
        },
      },
    ],
    error: null,
  },
};

describe('parseFundamentals', () => {
  it('maps all fields from a full response', () => {
    const result = parseFundamentals(mockSummaryResponse);
    expect(result.targetLow).toBe(150.0);
    expect(result.targetMean).toBe(220.0);
    expect(result.targetHigh).toBe(300.0);
    expect(result.analystCount).toBe(42);
    expect(result.recommendation).toBe('buy');
    expect(result.forwardPE).toBe(28.5);
    expect(result.beta).toBe(1.25);
    expect(result.shortFloat).toBe(0.032);
    expect(result.earnings).toHaveLength(2);
  });

  it('maps earnings fields including surprisePct as a fraction', () => {
    const result = parseFundamentals(mockSummaryResponse);
    expect(result.earnings[0]).toEqual({
      quarter: '3/31/2024',
      epsActual: 1.52,
      epsEstimate: 1.48,
      surprisePct: 0.027,
    });
  });

  it('returns null for missing optional stat fields', () => {
    const noStats: YahooSummaryResponse = {
      quoteSummary: {
        result: [
          {
            financialData: mockSummaryResponse.quoteSummary.result![0].financialData,
          },
        ],
        error: null,
      },
    };
    const result = parseFundamentals(noStats);
    expect(result.forwardPE).toBeNull();
    expect(result.beta).toBeNull();
    expect(result.shortFloat).toBeNull();
  });

  it('returns empty earnings array when earningsHistory is absent', () => {
    const noHistory: YahooSummaryResponse = {
      quoteSummary: {
        result: [
          {
            financialData: mockSummaryResponse.quoteSummary.result![0].financialData,
            defaultKeyStatistics:
              mockSummaryResponse.quoteSummary.result![0].defaultKeyStatistics,
          },
        ],
        error: null,
      },
    };
    const result = parseFundamentals(noHistory);
    expect(result.earnings).toEqual([]);
  });

  it('throws when quoteSummary result is null', () => {
    expect(() =>
      parseFundamentals({
        quoteSummary: {
          result: null,
          error: { code: '404', description: 'Not found' },
        },
      })
    ).toThrow('Not found');
  });
});

const mockChart: FindStocksYahooChart = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'NVDA',
          regularMarketPrice: 130,
          currency: 'USD',
        },
        indicators: {
          quote: [{ high: [100, 150, 140, null, 130] }],
        },
      },
    ],
    error: null,
  },
};

const mockSummary: FindStocksYahooSummary = {
  quoteSummary: {
    result: [
      {
        defaultKeyStatistics: { forwardPE: { raw: 30 } },
        summaryDetail: { trailingPE: { raw: 50 } },
      },
    ],
    error: null,
  },
};

describe('parseMarketData', () => {
  it('extracts 52-week high as max of highs array, ignoring nulls', () => {
    const result = parseMarketData('NVDA', mockChart, mockSummary);
    expect(result.fiftyTwoWeekHigh).toBe(150);
  });

  it('computes pctBelowHigh correctly', () => {
    const result = parseMarketData('NVDA', mockChart, mockSummary);
    // (150 - 130) / 150 * 100 = 13.33
    expect(result.pctBelowHigh).toBeCloseTo(13.33, 1);
  });

  it('extracts forward and trailing PE from summary', () => {
    const result = parseMarketData('NVDA', mockChart, mockSummary);
    expect(result.forwardPE).toBe(30);
    expect(result.trailingPE).toBe(50);
    expect(result.forwardBelowTrailing).toBe(true);
  });

  it('returns forwardBelowTrailing false when forward >= trailing', () => {
    const summary: FindStocksYahooSummary = {
      quoteSummary: {
        result: [
          {
            defaultKeyStatistics: { forwardPE: { raw: 60 } },
            summaryDetail: { trailingPE: { raw: 40 } },
          },
        ],
        error: null,
      },
    };
    const result = parseMarketData('NVDA', mockChart, summary);
    expect(result.forwardBelowTrailing).toBe(false);
  });

  it('returns all null fields when chart result is null', () => {
    const emptyChart: FindStocksYahooChart = {
      chart: { result: null, error: { code: 'Not Found', description: 'Not found' } },
    };
    const emptySummary: FindStocksYahooSummary = {
      quoteSummary: { result: null },
    };
    const result = parseMarketData('FAKE', emptyChart, emptySummary);
    expect(result.fiftyTwoWeekHigh).toBeNull();
    expect(result.currentPrice).toBeNull();
    expect(result.pctBelowHigh).toBeNull();
    expect(result.forwardPE).toBeNull();
    expect(result.trailingPE).toBeNull();
    expect(result.forwardBelowTrailing).toBeNull();
  });
});
