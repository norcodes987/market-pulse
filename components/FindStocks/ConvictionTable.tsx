import type { ConvictionScore } from '@/types';

interface Props {
  scores: ConvictionScore[];
}

const TIER_STYLES: Record<ConvictionScore['tier'], string> = {
  Best: 'bg-[#22c55e] text-black',
  Strong: 'bg-[#3d6b47] text-[#86efac]',
  Watch: 'bg-[#713f12] text-[#fbbf24]',
  Avoid: 'bg-[#7f1d1d] text-[#f87171]',
};

export function ConvictionTable({ scores }: Props) {
  return (
    <div>
      <div className="overflow-hidden rounded-lg border border-[#1f1f1f]">
        <div className="grid grid-cols-[40px_64px_52px_84px_1fr] border-b border-[#1a1a1a] px-3 py-2">
          <span className="text-xs text-[#555]">Rank</span>
          <span className="text-xs text-[#555]">Ticker</span>
          <span className="text-xs text-[#555]">Score</span>
          <span className="text-xs text-[#555]">Tier</span>
          <span className="text-xs text-[#555]">One-line thesis</span>
        </div>
        {scores.map((s) => (
          <div
            key={s.ticker}
            className="grid grid-cols-[40px_64px_52px_84px_1fr] items-center border-b border-[#141414] px-3 py-2 last:border-0"
          >
            <span className="text-xs text-[#555]">{s.rank}</span>
            <span className="text-xs font-bold text-[#C8FF00]">{s.ticker}</span>
            <span className="text-xs font-bold text-[#aaa]">{s.score}</span>
            <span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${TIER_STYLES[s.tier]}`}>
                {s.tier}
              </span>
            </span>
            <span className="text-xs text-[#aaa]">{s.thesis}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] text-[#444]">
        Quality metrics (ROIC, FCF, leverage, growth) are AI-estimated from training data.
        Discount metrics use real-time Yahoo Finance data.
      </p>
    </div>
  );
}
