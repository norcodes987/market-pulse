'use client';

import { useState } from 'react';
import type { QuoteState } from '@/types';
import { Sparkline } from './Sparkline';
import { SkeletonCard } from './SkeletonCard';
import { NewsDrawer } from './NewsDrawer';
import { FundamentalsDrawer } from './FundamentalsDrawer';

interface Props {
  ticker: string;
  state: QuoteState;
  tag: 'owned' | 'watching';
  onTagToggle: () => void;
  onRemove: () => void;
}

function fmt(n: number, decimals = 2) {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function fmtVolume(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toString();
}

export function StockCard({ ticker, state, tag, onTagToggle, onRemove }: Props) {
  const [newsOpen, setNewsOpen] = useState(false);
  const [fundOpen, setFundOpen] = useState(false);

  if (state.status === 'loading') return <SkeletonCard />;

  if (state.status === 'error') {
    return (
      <div className='bg-[#111111] border border-[#1f1f1f] rounded-xl p-4'>
        <div className='flex justify-between items-start mb-1'>
          <p className='text-sm font-semibold text-white'>{ticker}</p>
          <button
            onClick={onRemove}
            className='text-gray-600 hover:text-gray-400 text-xs leading-none ml-2'
            aria-label={`Remove ${ticker}`}
          >
            ✕
          </button>
        </div>
        <p className='text-xs text-[#ef4444]'>{state.message}</p>
      </div>
    );
  }

  const { data } = state;
  const positive = data.change >= 0;
  const changeColor = positive ? 'text-[#22c55e]' : 'text-[#ef4444]';
  const sign = positive ? '+' : '';

  return (
    <div className='bg-[#111111] border border-[#1f1f1f] rounded-xl overflow-hidden'>
      <div className='p-4'>
        <div className='flex justify-between items-start mb-2'>
          <div>
            <p className='font-heading text-base font-bold text-white tracking-wide'>{ticker}</p>
            <p className='text-xs text-gray-500 truncate max-w-[140px]'>{data.name}</p>
          </div>
          <div className='flex items-center gap-1.5 shrink-0'>
            <button
              onClick={onTagToggle}
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors ${
                tag === 'owned'
                  ? 'bg-[#1f3a0f] text-[#C8FF00] hover:bg-[#2a4f14]'
                  : 'bg-[#1a1a2e] text-gray-500 hover:bg-[#222240]'
              }`}
            >
              {tag === 'owned' ? 'OWNED' : 'WATCH'}
            </button>
            <button
              onClick={onRemove}
              className='text-gray-600 hover:text-gray-400 text-xs leading-none'
              aria-label={`Remove ${ticker}`}
            >
              ✕
            </button>
          </div>
        </div>

        <p className='font-heading text-3xl font-bold text-white mb-0.5'>{fmt(data.price)}</p>

        <p className={`text-sm font-semibold ${changeColor} mb-3`}>
          {sign}
          {fmt(data.change)} ({sign}
          {fmt(data.changePct)}%)
        </p>

        {data.sparkline.length > 1 && (
          <div className='mb-3'>
            <Sparkline data={data.sparkline} positive={positive} />
          </div>
        )}

        <div className='flex justify-between text-xs text-gray-500 mb-3'>
          <span>
            H: {fmt(data.high)} / L: {fmt(data.low)}
          </span>
          <span>Vol: {fmtVolume(data.volume)}</span>
        </div>

        <button
          onClick={() => setNewsOpen((o) => !o)}
          className='text-xs text-[#C8FF00] hover:underline w-full text-left'
        >
          {newsOpen ? 'Hide news ↑' : 'Show news ↓'}
        </button>
        <button
          onClick={() => setFundOpen((o) => !o)}
          className='text-xs text-[#C8FF00] hover:underline w-full text-left mt-1'
        >
          {fundOpen ? 'Hide fundamentals ↑' : 'Show fundamentals ↓'}
        </button>
      </div>

      {newsOpen && <NewsDrawer ticker={ticker} />}
      {fundOpen && <FundamentalsDrawer ticker={ticker} currentPrice={data.price} />}
    </div>
  );
}
