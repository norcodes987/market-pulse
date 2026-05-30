import type { ThesisCard } from '@/types';

interface Props {
  thesis: ThesisCard[];
}

const SECTION_LABEL = 'text-[9px] uppercase tracking-widest text-[#555] mb-1';
const SECTION_BODY = 'text-xs leading-relaxed text-[#aaa]';

export function ThesisCards({ thesis }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {thesis.map((card) => (
        <div
          key={card.ticker}
          className="flex flex-col gap-4 rounded-lg border border-[#1f1f1f] bg-[#111] p-5"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-heading text-base font-bold text-[#C8FF00]">
              #{card.rank} {card.ticker}
            </span>
          </div>

          <div>
            <p className={SECTION_LABEL}>The Moat</p>
            <p className={SECTION_BODY}>{card.moat}</p>
          </div>
          <div>
            <p className={SECTION_LABEL}>The Drawdown</p>
            <p className={SECTION_BODY}>{card.drawdown}</p>
          </div>
          <div>
            <p className={SECTION_LABEL}>The Catalyst</p>
            <p className={SECTION_BODY}>{card.catalyst}</p>
          </div>
          <div>
            <p className={SECTION_LABEL}>The Exit</p>
            <p className={SECTION_BODY}>{card.exit}</p>
          </div>

          <div className="mt-auto border-t border-[#1a1a1a] pt-3">
            <p className={SECTION_LABEL}>Sources</p>
            <ul className="space-y-0.5">
              {card.sources.map((source, i) => (
                <li key={i} className="text-[10px] text-[#444]">
                  {source}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[9px] text-[#333]">AI-generated citations</p>
          </div>
        </div>
      ))}
    </div>
  );
}
