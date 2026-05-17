'use client';

import { useState, useEffect } from 'react';
import type { FundamentalsData } from '@/types';

type FundamentalsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; data: FundamentalsData }
  | { status: 'error'; message: string };

export function useFundamentals(ticker: string): FundamentalsState {
  const [state, setState] = useState<FundamentalsState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(`/api/fundamentals?ticker=${ticker}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setState({ status: 'error', message: data.error });
        } else {
          setState({ status: 'ok', data });
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err.message });
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return state;
}
