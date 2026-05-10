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
    <div className="flex flex-wrap gap-2 py-2">
      {tickers.map((t) => (
        <TickerPill key={t} ticker={t} onRemove={onRemove} />
      ))}
    </div>
  );
}
