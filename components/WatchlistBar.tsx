'use client';

import { TickerPill } from './TickerPill';

interface Props {
  tickers: string[];
  onRemove: (ticker: string) => void;
}

export function WatchlistBar({ tickers, onRemove }: Props) {
  if (tickers.length === 0) {
    return (
      <p className="text-gray-500 text-sm py-2">
        No tickers yet — add one above.
      </p>
    );
  }
  return (
    <div className="flex gap-2 py-2 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      {tickers.map((t) => (
        <TickerPill key={t} ticker={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
