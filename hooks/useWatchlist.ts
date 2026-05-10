'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'stockbuzz:watchlist';

export function useWatchlist() {
  const [tickers, setTickers] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setTickers(JSON.parse(stored));
    } catch {
      // ignore parse errors
    }
  }, []);

  function addTicker(raw: string) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker) return;
    setTickers((prev) => {
      if (prev.includes(ticker)) return prev;
      const next = [...prev, ticker];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  function removeTicker(ticker: string) {
    setTickers((prev) => {
      const next = prev.filter((t) => t !== ticker);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { tickers, addTicker, removeTicker };
}
