'use client';

interface Props {
  ticker: string;
  onRemove: (ticker: string) => void;
}

export function TickerPill({ ticker, onRemove }: Props) {
  return (
    <span className="flex items-center gap-1 bg-[#1a1a1a] border border-[#1f1f1f] text-white text-sm rounded-full px-3 py-1">
      {ticker}
      <button
        onClick={() => onRemove(ticker)}
        className="text-gray-500 hover:text-[#ef4444] ml-1 leading-none transition-colors"
        aria-label={`Remove ${ticker}`}
      >
        ×
      </button>
    </span>
  );
}
