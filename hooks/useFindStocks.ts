'use client';

import { useState, useCallback, useRef } from 'react';
import type { TickerCandidate, ConvictionScore, ThesisCard } from '@/types';

export type FindStocksPhase =
  | { phase: 'idle' }
  | { phase: 'tickers-loading' }
  | { phase: 'scores-loading'; candidates: TickerCandidate[] }
  | { phase: 'thesis-loading'; candidates: TickerCandidate[]; scores: ConvictionScore[] }
  | { phase: 'complete'; candidates: TickerCandidate[]; scores: ConvictionScore[]; thesis: ThesisCard[] }
  | { phase: 'error'; step: 1 | 2 | 3; message: string; candidates?: TickerCandidate[]; scores?: ConvictionScore[] };

export function useFindStocks() {
  const [state, setState] = useState<FindStocksPhase>({ phase: 'idle' });
  const runId = useRef(0);

  const run = useCallback(async (theme: string) => {
    const id = ++runId.current;

    // Step 1 — tickers
    setState({ phase: 'tickers-loading' });
    let candidates: TickerCandidate[];
    try {
      const res = await fetch('/api/find-stocks/tickers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Step 1 failed');
      candidates = data.candidates;
    } catch (err) {
      if (runId.current === id) setState({ phase: 'error', step: 1, message: err instanceof Error ? err.message : 'Step 1 failed' });
      return;
    }

    // Step 2 — scores
    if (runId.current !== id) return;
    setState({ phase: 'scores-loading', candidates });
    let scores: ConvictionScore[];
    try {
      const res = await fetch('/api/find-stocks/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, candidates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Step 2 failed');
      scores = data.scores;
    } catch (err) {
      if (runId.current === id) setState({ phase: 'error', step: 2, message: err instanceof Error ? err.message : 'Step 2 failed', candidates });
      return;
    }

    // Step 3 — thesis (top 3 only)
    if (runId.current !== id) return;
    setState({ phase: 'thesis-loading', candidates, scores });
    const topNames = scores.slice(0, 3);
    let thesis: ThesisCard[];
    try {
      const res = await fetch('/api/find-stocks/thesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, topNames }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Step 3 failed');
      thesis = data.thesis;
    } catch (err) {
      if (runId.current === id) setState({ phase: 'error', step: 3, message: err instanceof Error ? err.message : 'Step 3 failed', candidates, scores });
      return;
    }

    if (runId.current === id) setState({ phase: 'complete', candidates, scores, thesis });
  }, []);

  const reset = useCallback(() => {
    runId.current++;
    setState({ phase: 'idle' });
  }, []);

  return { state, run, reset };
}
