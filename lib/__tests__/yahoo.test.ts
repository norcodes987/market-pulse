import { parseQuote, parseNews } from '../yahoo';
import type { YahooChartResponse, YahooSearchResponse } from '../../types';

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
          quote: [{ close: [185.0, 186.5, null, 188.5, 189.87] }],
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
    expect(result.sparkline).toEqual([185.0, 186.5, 188.5, 189.87]);
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
