'use client';

import { useState, useEffect, useCallback } from 'react';
import type { QuoteState } from '@/types';

export function useQuotes(tickers: string[]) {
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});

  const tickerKey = tickers.join(',');

  const fetchAll = useCallback(async () => {
    if (tickers.length === 0) return;

    setQuotes((prev) => {
      const next = { ...prev };
      for (const ticker of tickers) {
        if (!next[ticker]) next[ticker] = { status: 'loading' };
      }
      return next;
    });

    const results = await Promise.allSettled(
      tickers.map((ticker) =>
        fetch(`/api/quote?ticker=${ticker}`).then((r) => r.json())
      )
    );

    setQuotes((prev) => {
      const next = { ...prev };
      tickers.forEach((ticker, i) => {
        const result = results[i];
        if (result.status === 'fulfilled') {
          const data = result.value;
          if (data.error) {
            next[ticker] = { status: 'error', message: data.error };
          } else {
            next[ticker] = { status: 'ok', data };
          }
        } else {
          next[ticker] = { status: 'error', message: result.reason?.message ?? 'Fetch failed' };
        }
      });
      return next;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 60_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  useEffect(() => {
    setQuotes((prev) => {
      const tickerSet = new Set(tickers);
      return Object.fromEntries(
        Object.entries(prev).filter(([t]) => tickerSet.has(t))
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickerKey]);

  return quotes;
}
