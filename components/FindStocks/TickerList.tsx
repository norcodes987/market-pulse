import type { TickerCandidate } from '@/types';

interface Props {
  candidates: TickerCandidate[];
}

export function TickerList({ candidates }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-[#1f1f1f]">
      <div className="grid grid-cols-[32px_64px_1fr] border-b border-[#1a1a1a] px-3 py-2">
        <span className="text-xs text-[#555]">#</span>
        <span className="text-xs text-[#555]">Ticker</span>
        <span className="text-xs text-[#555]">Description</span>
      </div>
      {candidates.map((c) => (
        <div
          key={c.ticker}
          className="grid grid-cols-[32px_64px_1fr] border-b border-[#141414] px-3 py-2 last:border-0"
        >
          <span className="text-xs text-[#555]">{c.rank}</span>
          <span className="text-xs font-bold text-[#C8FF00]">{c.ticker}</span>
          <span className="text-xs text-[#aaa]">{c.description}</span>
        </div>
      ))}
    </div>
  );
}
