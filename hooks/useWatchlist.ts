'use client';

import { useState, useEffect } from 'react';
import type { WatchlistEntry } from '@/types';

const STORAGE_KEY = 'stockbuzz:watchlist';

function loadEntries(): WatchlistEntry[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Migrate legacy string[] format
    if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'string') {
      const migrated: WatchlistEntry[] = (parsed as string[]).map((ticker) => ({
        ticker,
        tag: 'watching',
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    return parsed as WatchlistEntry[];
  } catch {
    return [];
  }
}

function persist(entries: WatchlistEntry[]): WatchlistEntry[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  return entries;
}

export function useWatchlist() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  function addTicker(raw: string) {
    const ticker = raw.trim().toUpperCase();
    if (!ticker) return;
    setEntries((prev) => {
      if (prev.some((e) => e.ticker === ticker)) return prev;
      return persist([...prev, { ticker, tag: 'watching' }]);
    });
  }

  function removeTicker(ticker: string) {
    setEntries((prev) => persist(prev.filter((e) => e.ticker !== ticker)));
  }

  function setTag(ticker: string, tag: 'owned' | 'watching') {
    setEntries((prev) => {
      if (!prev.some((e) => e.ticker === ticker)) return prev;
      return persist(prev.map((e) => (e.ticker === ticker ? { ...e, tag } : e)));
    });
  }

  return { entries, addTicker, removeTicker, setTag };
}
