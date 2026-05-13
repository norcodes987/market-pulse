'use client';

import { useState, useEffect } from 'react';
import type { QuoteState } from '@/types';

const MARKET_TICKERS = ['SPY', 'QQQ', 'IWM', 'VIX'] as const;

const initialState: Record<string, QuoteState> = Object.fromEntries(
  MARKET_TICKERS.map((t) => [t, { status: 'loading' } as QuoteState])
);

export function useMarketOverview(): Record<string, QuoteState> {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>(initialState);

  async function fetchAll() {
    const results = await Promise.allSettled(
      MARKET_TICKERS.map((ticker) =>
        fetch(`/api/quote?ticker=${ticker}`).then((r) => r.json())
      )
    );

    setQuotes(() => {
      const next: Record<string, QuoteState> = {};
      MARKET_TICKERS.forEach((ticker, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.error) {
            next[ticker] = { status: 'error', message: data.error };
          } else {
            next[ticker] = { status: 'ok', data };
          }
        } else {
          next[ticker] = {
            status: 'error',
            message: (result.reason as Error)?.message ?? 'Fetch failed',
          };
        }
      });
      return next;
    });
  }

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
    // fetchAll is defined inside the effect's closure; no dep needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return quotes;
}
