import { renderHook, act, waitFor } from '@testing-library/react';
import { useFindStocks } from '@/hooks/useFindStocks';

const mockCandidates = [{ rank: 1, ticker: 'NVDA', description: 'GPU maker' }];
const mockScores = [{ rank: 1, ticker: 'NVDA', score: 91, tier: 'Best' as const, thesis: 'Dominant AI chip' }];
const mockThesis = [{
  ticker: 'NVDA', rank: 1,
  moat: 'moat', drawdown: 'drawdown', catalyst: 'catalyst', exit: 'exit',
  sources: [],
}];

function makeFetch(...responses: object[]) {
  let call = 0;
  return jest.fn().mockImplementation(() => {
    const data = responses[call++] ?? {};
    return Promise.resolve({
      ok: !('error' in data),
      json: () => Promise.resolve(data),
    });
  });
}

afterEach(() => { jest.restoreAllMocks(); });

describe('useFindStocks', () => {
  it('starts in idle phase', () => {
    const { result } = renderHook(() => useFindStocks());
    expect(result.current.state.phase).toBe('idle');
  });

  it('progresses to complete after all 3 steps succeed', async () => {
    global.fetch = makeFetch(
      { candidates: mockCandidates },
      { scores: mockScores },
      { thesis: mockThesis },
    );
    const { result } = renderHook(() => useFindStocks());
    act(() => { result.current.run('AI Infrastructure'); });
    await waitFor(() => expect(result.current.state.phase).toBe('complete'));
    const state = result.current.state;
    if (state.phase === 'complete') {
      expect(state.candidates).toEqual(mockCandidates);
      expect(state.scores).toEqual(mockScores);
      expect(state.thesis).toEqual(mockThesis);
    }
  });

  it('enters error phase with step=1 when tickers call fails', async () => {
    global.fetch = makeFetch({ error: 'OpenAI unavailable' });
    const { result } = renderHook(() => useFindStocks());
    act(() => { result.current.run('AI Infrastructure'); });
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    const state = result.current.state;
    if (state.phase === 'error') {
      expect(state.step).toBe(1);
      expect(state.candidates).toBeUndefined();
    }
  });

  it('enters error phase with step=2 and preserves candidates when scores call fails', async () => {
    global.fetch = makeFetch(
      { candidates: mockCandidates },
      { error: 'OpenAI timeout' },
    );
    const { result } = renderHook(() => useFindStocks());
    act(() => { result.current.run('AI Infrastructure'); });
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    const state = result.current.state;
    if (state.phase === 'error') {
      expect(state.step).toBe(2);
      expect(state.candidates).toEqual(mockCandidates);
    }
  });

  it('enters error phase with step=3 and preserves candidates+scores when thesis call fails', async () => {
    global.fetch = makeFetch(
      { candidates: mockCandidates },
      { scores: mockScores },
      { error: 'OpenAI timeout' },
    );
    const { result } = renderHook(() => useFindStocks());
    act(() => { result.current.run('AI Infrastructure'); });
    await waitFor(() => expect(result.current.state.phase).toBe('error'));
    const state = result.current.state;
    if (state.phase === 'error') {
      expect(state.step).toBe(3);
      expect(state.scores).toEqual(mockScores);
    }
  });

  it('reset returns to idle from any phase', async () => {
    global.fetch = makeFetch(
      { candidates: mockCandidates },
      { scores: mockScores },
      { thesis: mockThesis },
    );
    const { result } = renderHook(() => useFindStocks());
    act(() => { result.current.run('AI Infrastructure'); });
    await waitFor(() => expect(result.current.state.phase).toBe('complete'));
    act(() => { result.current.reset(); });
    expect(result.current.state.phase).toBe('idle');
  });
});
