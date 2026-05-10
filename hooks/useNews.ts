'use client';

import { useState, useEffect } from 'react';
import type { NewsArticle } from '@/types';

type NewsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; articles: NewsArticle[] }
  | { status: 'error'; message: string };

export function useNews(ticker: string) {
  const [state, setState] = useState<NewsState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });

    fetch(`/api/news?ticker=${ticker}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setState({ status: 'error', message: data.error });
        } else {
          setState({ status: 'ok', articles: data.articles });
        }
      })
      .catch((err) => {
        if (!cancelled) setState({ status: 'error', message: err.message });
      });

    return () => { cancelled = true; };
  }, [ticker]);

  return state;
}
