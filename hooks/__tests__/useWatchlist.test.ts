import { renderHook, act } from '@testing-library/react';
import { useWatchlist } from '../useWatchlist';

beforeEach(() => {
  localStorage.clear();
});

describe('useWatchlist', () => {
  it('starts with an empty list when localStorage is empty', () => {
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.tickers).toEqual([]);
  });

  it('adds a ticker', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    expect(result.current.tickers).toContain('AAPL');
  });

  it('uppercases the ticker on add', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('aapl'); });
    expect(result.current.tickers).toContain('AAPL');
  });

  it('does not add duplicate tickers', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    act(() => { result.current.addTicker('AAPL'); });
    expect(result.current.tickers.filter((t) => t === 'AAPL')).toHaveLength(1);
  });

  it('removes a ticker', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('AAPL'); });
    act(() => { result.current.removeTicker('AAPL'); });
    expect(result.current.tickers).not.toContain('AAPL');
  });

  it('persists tickers to localStorage', () => {
    const { result } = renderHook(() => useWatchlist());
    act(() => { result.current.addTicker('MSFT'); });
    const stored = JSON.parse(localStorage.getItem('stockbuzz:watchlist') ?? '[]');
    expect(stored).toContain('MSFT');
  });

  it('hydrates from localStorage on mount', () => {
    localStorage.setItem('stockbuzz:watchlist', JSON.stringify(['TSLA', 'NVDA']));
    const { result } = renderHook(() => useWatchlist());
    expect(result.current.tickers).toEqual(['TSLA', 'NVDA']);
  });
});
