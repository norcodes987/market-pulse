import { renderHook, act } from '@testing-library/react';
import { useWatchlist } from '../useWatchlist';
import type { WatchlistEntry } from '@/types';

const STORAGE_KEY = 'stockbuzz:watchlist';

beforeEach(() => {
  localStorage.clear();
});

describe('useWatchlist', () => {
  it('starts with an empty list when localStorage is empty', () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual([]);
  });

  it('adds a ticker as watching by default', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    expect(result.current.entries).toContainEqual({ ticker: 'AAPL', tag: 'watching' });
  });

  it('uppercases the ticker on add', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('aapl'); });
    expect(result.current.entries[0].ticker).toBe('AAPL');
  });

  it('does not add duplicate tickers', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    act(() => { result.current.addTicker('AAPL'); });
    expect(result.current.entries.filter((e) => e.ticker === 'AAPL')).toHaveLength(1);
  });

  it('removes a ticker entry', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    act(() => { result.current.removeTicker('AAPL'); });
    expect(result.current.entries).not.toContainEqual(expect.objectContaining({ ticker: 'AAPL' }));
  });

  it('sets a tag on an existing ticker', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    act(() => { result.current.setTag('AAPL', 'owned'); });
    expect(result.current.entries).toContainEqual({ ticker: 'AAPL', tag: 'owned' });
  });

  it('setTag is a no-op for unknown tickers', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.setTag('UNKNOWN', 'owned'); });
    expect(result.current.entries).toEqual([]);
  });

  it('persists entries to localStorage', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('MSFT'); });
    const stored: WatchlistEntry[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(stored).toContainEqual({ ticker: 'MSFT', tag: 'watching' });
  });

  it('hydrates WatchlistEntry[] from localStorage on mount', () => {
    const entries: WatchlistEntry[] = [
      { ticker: 'TSLA', tag: 'owned' },
      { ticker: 'NVDA', tag: 'watching' },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual(entries);
  });

  it('migrates legacy string[] format to WatchlistEntry[] on mount', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(['TSLA', 'NVDA']));
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.entries).toEqual([
      { ticker: 'TSLA', tag: 'watching' },
      { ticker: 'NVDA', tag: 'watching' },
    ]);
  });
});
