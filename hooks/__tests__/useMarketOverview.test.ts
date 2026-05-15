import { renderHook, waitFor } from '@testing-library/react';
import { useMarketOverview } from '../useMarketOverview';
import type { QuoteResponse } from '@/types';

function mockQuote(ticker: string): QuoteResponse {
  return {
    ticker,
    name: `${ticker} Fund`,
    price: 100,
    change: 1,
    changePct: 1,
    currency: 'USD',
    high: 101,
    low: 99,
    volume: 1_000_000,
    sparkline: [99, 100, 101],
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useMarketOverview', () => {
  it('starts index and sector tickers in loading state', () => {
    jest.spyOn(global, 'fetch').mockImplementation(() => new Promise(() => {}));
    const { result } = renderHook(() => useMarketOverview());
    expect(result.current['SPY']).toEqual({ status: 'loading' });
    expect(result.current['QQQ']).toEqual({ status: 'loading' });
    expect(result.current['IWM']).toEqual({ status: 'loading' });
    expect(result.current['VIX']).toEqual({ status: 'loading' });
    expect(result.current['XLK']).toEqual({ status: 'loading' });
    expect(result.current['XLE']).toEqual({ status: 'loading' });
  });

  it('sets all tickers to ok on successful fetch', async () => {
    jest.spyOn(global, 'fetch').mockImplementation((input) => {
      const ticker = new URL(input as string, 'http://localhost').searchParams.get('ticker')!;
      return Promise.resolve({
        json: () => Promise.resolve(mockQuote(ticker)),
      } as Response);
    });

    const { result } = renderHook(() => useMarketOverview());
    await waitFor(() => expect(result.current['SPY'].status).toBe('ok'));
    expect(result.current['QQQ'].status).toBe('ok');
    expect(result.current['IWM'].status).toBe('ok');
    expect(result.current['VIX'].status).toBe('ok');
  });

  it('sets ticker to error when fetch rejects', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useMarketOverview());
    await waitFor(() => expect(result.current['SPY'].status).toBe('error'));
    expect(result.current['QQQ'].status).toBe('error');
  });

  it('sets ticker to error when API returns error field', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      json: () => Promise.resolve({ error: 'Invalid ticker' }),
    } as Response);

    const { result } = renderHook(() => useMarketOverview());
    await waitFor(() => expect(result.current['SPY'].status).toBe('error'));
    expect((result.current['SPY'] as { status: 'error'; message: string }).message).toBe('Invalid ticker');
  });
});
