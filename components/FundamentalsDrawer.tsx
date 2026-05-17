'use client';

import { useFundamentals } from '@/hooks/useFundamentals';
import type { FundamentalsData } from '@/types';

interface Props {
  ticker: string;
  currentPrice: number;
}

function recBadge(key: string | null): { label: string; className: string } {
  if (!key) return { label: '--', className: 'text-gray-500' };
  if (key === 'buy' || key === 'strong_buy')
    return { label: 'BUY', className: 'text-[#C8FF00] bg-[#1f3a0f]' };
  if (key === 'sell' || key === 'underperform')
    return { label: 'SELL', className: 'text-[#ef4444] bg-[#2a0f0f]' };
  return { label: 'HOLD', className: 'text-gray-400 bg-[#1f1f1f]' };
}

function fmt2(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function DataSection({ data, currentPrice }: { data: FundamentalsData; currentPrice: number }) {
  const rec = recBadge(data.recommendation);
  const upside =
    data.targetMean != null && currentPrice > 0
      ? ((data.targetMean - currentPrice) / currentPrice) * 100
      : null;

  return (
    <div className='divide-y divide-[#1f1f1f]'>
      {/* Analyst Targets */}
      <div className='px-4 py-3'>
        <p className='text-[10px] text-gray-500 font-semibold tracking-wide uppercase mb-2'>
          Analyst Targets
        </p>
        {data.targetMean == null ? (
          <p className='text-xs text-gray-500'>No analyst coverage.</p>
        ) : (
          <div className='flex items-center flex-wrap gap-x-3 gap-y-1'>
            <span className='text-xs text-gray-500'>
              Low{' '}
              <span className='text-white font-semibold'>${fmt2(data.targetLow!)}</span>
              {' · '}Mean{' '}
              <span className='text-white font-semibold'>${fmt2(data.targetMean)}</span>
              {' · '}High{' '}
              <span className='text-white font-semibold'>${fmt2(data.targetHigh!)}</span>
            </span>
            {upside != null && (
              <span
                className={`text-xs font-semibold ${upside >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
              >
                {upside >= 0 ? '+' : ''}
                {upside.toFixed(1)}% to mean
              </span>
            )}
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${rec.className}`}
            >
              {rec.label}
            </span>
            {data.analystCount != null && (
              <span className='text-[10px] text-gray-500'>({data.analystCount} analysts)</span>
            )}
          </div>
        )}
      </div>

      {/* Key Stats */}
      <div className='px-4 py-3'>
        <p className='text-[10px] text-gray-500 font-semibold tracking-wide uppercase mb-2'>
          Key Stats
        </p>
        <div className='flex gap-6'>
          <div>
            <p className='text-[10px] text-gray-500'>Fwd P/E</p>
            <p className='text-xs font-semibold text-white'>
              {data.forwardPE?.toFixed(1) ?? '--'}
            </p>
          </div>
          <div>
            <p className='text-[10px] text-gray-500'>Beta</p>
            <p className='text-xs font-semibold text-white'>
              {data.beta?.toFixed(2) ?? '--'}
            </p>
          </div>
          <div>
            <p className='text-[10px] text-gray-500'>Short</p>
            <p className='text-xs font-semibold text-white'>
              {data.shortFloat != null
                ? `${(data.shortFloat * 100).toFixed(1)}%`
                : '--'}
            </p>
          </div>
        </div>
      </div>

      {/* Earnings History */}
      {data.earnings.length > 0 && (
        <div className='px-4 py-3'>
          <p className='text-[10px] text-gray-500 font-semibold tracking-wide uppercase mb-2'>
            Earnings History
          </p>
          <table className='w-full text-xs'>
            <thead>
              <tr className='text-[10px] text-gray-500'>
                <th className='text-left font-medium pb-1'>Quarter</th>
                <th className='text-right font-medium pb-1'>Est</th>
                <th className='text-right font-medium pb-1'>Actual</th>
                <th className='text-right font-medium pb-1'>Surprise</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-[#1f1f1f]'>
              {data.earnings.map((q) => {
                const s = q.surprisePct != null ? q.surprisePct * 100 : null;
                const sColor =
                  s == null
                    ? 'text-gray-500'
                    : s >= 0
                    ? 'text-[#22c55e]'
                    : 'text-[#ef4444]';
                return (
                  <tr key={q.quarter}>
                    <td className='py-1 text-gray-400'>{q.quarter}</td>
                    <td className='py-1 text-right text-gray-400'>
                      {q.epsEstimate != null ? `$${q.epsEstimate.toFixed(2)}` : '--'}
                    </td>
                    <td className='py-1 text-right text-white font-semibold'>
                      {q.epsActual != null ? `$${q.epsActual.toFixed(2)}` : '--'}
                    </td>
                    <td className={`py-1 text-right font-semibold ${sColor}`}>
                      {s != null
                        ? `${s >= 0 ? '+' : ''}${s.toFixed(1)}%`
                        : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function FundamentalsDrawer({ ticker, currentPrice }: Props) {
  const state = useFundamentals(ticker);

  return (
    <div className='border-t border-[#1f1f1f]'>
      {state.status === 'loading' && (
        <div className='px-4 py-3 space-y-2'>
          {[1, 2, 3].map((i) => (
            <div key={i} className='animate-pulse'>
              <div className='h-3 bg-[#1f1f1f] rounded w-full mb-1' />
              <div className='h-3 bg-[#1f1f1f] rounded w-3/4' />
            </div>
          ))}
        </div>
      )}

      {state.status === 'error' && (
        <p className='px-4 py-3 text-xs text-[#ef4444]'>
          Could not load fundamentals: {state.message}
        </p>
      )}

      {state.status === 'ok' && (
        <DataSection data={state.data} currentPrice={currentPrice} />
      )}
    </div>
  );
}
