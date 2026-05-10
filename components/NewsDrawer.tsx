'use client';

import { useNews } from '@/hooks/useNews';
import { NewsItem } from './NewsItem';

interface Props {
  ticker: string;
}

export function NewsDrawer({ ticker }: Props) {
  const state = useNews(ticker);

  return (
    <div className="border-t border-[#1f1f1f]">
      {state.status === 'loading' && (
        <div className="px-4 py-3 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-3 bg-[#1f1f1f] rounded w-full mb-1" />
              <div className="h-3 bg-[#1f1f1f] rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className="px-4 py-3 text-xs text-[#ef4444]">
          Could not load news: {state.message}
        </p>
      )}

      {state.status === 'ok' && state.articles.length === 0 && (
        <p className="px-4 py-3 text-xs text-gray-500">No recent news.</p>
      )}

      {state.status === 'ok' && (
        <div className="divide-y divide-[#1f1f1f]">
          {state.articles.map((a) => (
            <NewsItem key={a.link} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}
